

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
  async respond(messages: ChatMessage[], partial: ExtractedMeeting): Promise<LlmResult> {
    const system = `You are Captain Calendork, a goofy-but-professional scheduling assistant.
Gather attendee name, attendee email, preferred datetime, and optional title.
Ask natural follow-up questions when details are missing.
When all required fields are present, summarize and ask explicitly for confirmation (say \"confirm\" or \"yes schedule it\").`;

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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gemini error: ${txt}`);
    }

    const data = await res.json();
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

