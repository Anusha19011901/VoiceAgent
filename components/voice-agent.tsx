'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ExtractedMeeting } from '@/types/meeting';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const initialAssistant = `Ahoy! I'm Captain Calendork. Tell me who we're meeting, their email, and when you want it on the books.`;

export default function VoiceAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: initialAssistant }]);
  const [extracted, setExtracted] = useState<ExtractedMeeting>({});
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [typedInput, setTypedInput] = useState('');
  const [eventLink, setEventLink] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const userGestureEnabledRef = useRef(false);
  const supportsSpeech = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const speak = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => {
      if (supportsSpeech && userGestureEnabledRef.current) {
        startListening();
      }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    speak(initialAssistant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = () => {
    if (!supportsSpeech) return;

    setSpeechError(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = recognitionRef.current ?? new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript as string;
      if (!transcript) return;
      await handleUtterance(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatus('Idle');
    };
    recognition.onerror = (event: any) => {
      setIsListening(false);
      const errorType = event?.error ? ` (${event.error})` : '';
      const msg = `Speech recognition issue${errorType}. Try typed input or press Start Mic again.`;
      setSpeechError(msg);
      setStatus(msg);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setStatus('Listening...');
    } catch {
      setIsListening(false);
      const msg = `Could not start speech recognition. Try typed input or press Start Mic again.`;
      setSpeechError(msg);
      setStatus(msg);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setStatus('Stopped listening');
  };

  const handleUtterance = async (utterance: string) => {
    const updatedMessages = [...messages, { role: 'user' as const, content: utterance }];
    setMessages(updatedMessages);

    const confirmText = utterance.toLowerCase();
    const isConfirmation = /\b(confirm|yes schedule it|yes schedule|schedule it|yes)\b/.test(confirmText);

    if (isConfirmation && extracted.attendeeName && extracted.attendeeEmail && extracted.startISO) {
      setStatus('Scheduling event...');
      const createRes = await fetch('/api/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted })
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        const failText = `Whoops, calendar creation failed: ${createData.error || 'unknown error'}`;
        setMessages((prev) => [...prev, { role: 'assistant', content: failText }]);
        setStatus(failText);
        speak(failText);
        return;
      }

      setEventLink(createData.htmlLink);
      const success = 'Event scheduled! Your calendar has been officially captained.';
      setMessages((prev) => [...prev, { role: 'assistant', content: success }]);
      setStatus(success);
      speak(success);
      return;
    }

    setStatus('Thinking...');
    const llmRes = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: updatedMessages, partialExtracted: extracted, lastUserUtterance: utterance })
    });

    const llmData = await llmRes.json();
    if (!llmRes.ok) {
      setStatus(llmData.error || 'LLM request failed');
      return;
    }

    setExtracted(llmData.extracted);
    setMessages((prev) => [...prev, { role: 'assistant', content: llmData.assistantText }]);
    setStatus('Responded');
    speak(llmData.assistantText);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {supportsSpeech ? (
          <button
            onClick={() => {
              userGestureEnabledRef.current = true;
              if (isListening) {
                stopListening();
                return;
              }
              startListening();
            }}
            className="rounded-full bg-brand px-5 py-3 font-semibold"
          >
            {isListening ? 'Stop Mic' : 'Start Mic'}
          </button>
        ) : (
          <p className="text-sm text-amber-300">Speech recognition is not supported in this browser. Use typed input below.</p>
        )}
      </div>

      {speechError && <p className="text-sm text-amber-300">{speechError}</p>}

      <div className="w-full flex gap-2">
        <input
          className="flex-1 rounded bg-slate-800 p-2"
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder={supportsSpeech ? 'Type if mic has trouble...' : 'SpeechRecognition unsupported. Type here...'}
        />
        <button
          className="rounded bg-brand px-4"
          onClick={() => {
            if (!typedInput.trim()) return;
            handleUtterance(typedInput.trim());
            setTypedInput('');
          }}
        >
          Send
        </button>
      </div>

      <p className="text-sm text-slate-300">Status: {status}</p>

      <div className="rounded border border-slate-700 p-3">
        <h2 className="font-semibold mb-2">Extracted fields</h2>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap">{JSON.stringify(extracted, null, 2)}</pre>
      </div>

      <div className="rounded border border-slate-700 p-3">
        <h2 className="font-semibold mb-2">Transcript</h2>
        <ul className="space-y-2 text-sm">
          {messages.slice(-8).map((m, idx) => (
            <li key={`${m.role}-${idx}`}>
              <span className="font-semibold capitalize">{m.role}:</span> {m.content}
            </li>
          ))}
        </ul>
      </div>

      {eventLink && (
        <a href={eventLink} target="_blank" rel="noreferrer" className="inline-block rounded bg-emerald-700 px-4 py-2">
          View Event
        </a>
      )}
    </div>
  );
}
