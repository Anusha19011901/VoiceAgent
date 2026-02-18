import { env } from './env';
import type { ChatMessage, ExtractedMeeting } from '@/types/meeting';
import { parseNaturalDateToISO } from './date-utils';

type LlmResult = {
  assistantText: string;
  extracted: ExtractedMeeting;
  needs: string[];
};

export interface LlmProvider {
  respond(messages: ChatMessage[], partial: ExtractedMeeting): Promise<LlmResult>;
}

class GeminiProvider implements LlmProvider {
  private readonly endpointVersions = ['v1beta', 'v1'];

  private async getAvailableModels(): Promise<string[]> {
    for (const version of this.endpointVersions) {
      const res = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${env.geminiApiKey}`);
      if (!res.ok) continue;

      const data = await res.json();
      const models = (data.models || []) as Array<{ name?: string; supportedGenerationMethods?: string[] }>;

      const names = models
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => (m.name || '').replace(/^models\//, ''))
        .filter(Boolean);

      if (names.length) return names;
    }

    return [];
  }

  private async callGemini(payload: unknown): Promise<any> {
    const preferredRaw = process.env.GEMINI_MODEL?.trim();
    const preferred = preferredRaw?.replace(/^models\//, '');
    const staticCandidates = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-lite',
      'gemini-2.0-pro-exp',
      'gemini-2.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro'
    ];

    const available = await this.getAvailableModels();
    const availableSet = new Set(available);

    const candidates = [
      ...(preferred && (!available.length || availableSet.has(preferred)) ? [preferred] : []),
      ...(available.length ? available : staticCandidates)
    ];

    const dedupedCandidates = [...new Set(candidates)];

    const errors: string[] = [];

    for (const model of dedupedCandidates) {
      for (const version of this.endpointVersions) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${env.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        if (res.ok) {
          return res.json();
        }

        const txt = await res.text();
        errors.push(`version=${version}, model=${model} -> ${txt}`);

        const lower = txt.toLowerCase();
        const shouldTryAnother =
          txt.includes('NOT_FOUND') || lower.includes('not found') || lower.includes('is not supported');

        if (!shouldTryAnother) {
          throw new Error(
            `Gemini error while trying model=${model} on ${version}. ` +
              `Set GEMINI_MODEL to one available in your account. Details: ${txt}`
          );
        }
      }
    }

    throw new Error(
      `Gemini error after trying ${dedupedCandidates.length} model(s). ` +
        `Set GEMINI_MODEL to one available in your account. Details: ${errors.join(' | ')}`
    );
  }

  async respond(messages: ChatMessage[], partial: ExtractedMeeting): Promise<LlmResult> {
    const system = `You are Captain Calendork, a goofy-but-professional scheduling assistant.
Gather attendee name, attendee email, preferred datetime, and optional title.
Ask natural follow-up questions when details are missing.
When all required fields are present, summarize and ask explicitly for confirmation (say "confirm" or "yes schedule it").`;

    const convoText = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${system}\n\nCurrent partial extracted:\n${JSON.stringify(partial)}\n\nConversation:\n${convoText}`
            }
          ]
        }
      ],
      tools: [
        {
          functionDeclarations: [
            {
              name: 'extract_meeting_details',
              description: 'Extract fields for scheduling a meeting',
              parameters: {
                type: 'object',
                properties: {
                  attendee_name: { type: 'string' },
                  attendee_email: { type: 'string' },
                  start_datetime_iso: { type: 'string' },
                  end_datetime_iso: { type: 'string' },
                  title: { type: 'string' },
                  natural_datetime_text: { type: 'string' }
                }
              }
            }
          ]
        }
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: ['extract_meeting_details']
        }
      },
      generationConfig: {
        temperature: 0.6
      }
    };

    const data = await this.callGemini(payload);
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const fn = parts.find((p: any) => p.functionCall)?.functionCall;
    const textPart = parts.find((p: any) => p.text)?.text as string | undefined;

    let extracted: ExtractedMeeting = { ...partial };
    if (fn?.args) {
      const args = fn.args as Record<string, string>;
      extracted = {
        attendeeName: args.attendee_name || extracted.attendeeName,
        attendeeEmail: args.attendee_email || extracted.attendeeEmail,
        startISO: args.start_datetime_iso || extracted.startISO,
        endISO: args.end_datetime_iso || extracted.endISO,
        title: args.title || extracted.title
      };

      if (!extracted.startISO && args.natural_datetime_text) {
        const parsed = parseNaturalDateToISO(args.natural_datetime_text);
        extracted.startISO = parsed.startISO;
        extracted.endISO = parsed.endISO;
      }
    }

    if (extracted.startISO && !extracted.endISO) {
      extracted.endISO = new Date(new Date(extracted.startISO).getTime() + 30 * 60 * 1000).toISOString();
    }

    const needs: string[] = [];
    if (!extracted.attendeeName) needs.push('attendeeName');
    if (!extracted.attendeeEmail) needs.push('attendeeEmail');
    if (!extracted.startISO) needs.push('startISO');

    let assistantText = textPart?.trim();
    if (!assistantText) {
      assistantText = needs.length
        ? `Aye aye! I still need ${needs.join(', ')}. Can you share that?`
        : `Sweet. I have everything. Say \"confirm\" or \"yes schedule it\" and I'll schedule it.`;
    }

    if (!needs.length) {
      assistantText = `Perfect! I captured: ${extracted.title || 'Meeting'} with ${extracted.attendeeName} (${extracted.attendeeEmail}) at ${extracted.startISO}. Say "confirm" or "yes schedule it" to schedule.`;
    }

    return { assistantText, extracted, needs };
  }
}

class GroqProvider implements LlmProvider {
  async respond(): Promise<LlmResult> {
    throw new Error('Groq provider stub is included. Configure implementation if you switch providers.');
  }
}

export function getLlmProvider(): LlmProvider {
  if (env.geminiApiKey) return new GeminiProvider();
  if (env.groqApiKey) return new GroqProvider();
  throw new Error('No LLM provider configured.');
}
