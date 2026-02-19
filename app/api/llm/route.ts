import { NextRequest, NextResponse } from 'next/server';
import { getLlmProvider } from '@/lib/llm';
import type { ChatMessage, ExtractedMeeting } from '@/types/meeting';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = (body.messages || []) as ChatMessage[];
    const partialExtracted = (body.partialExtracted || {}) as ExtractedMeeting;

    const provider = getLlmProvider();
    const result = await provider.respond(messages, partialExtracted);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
