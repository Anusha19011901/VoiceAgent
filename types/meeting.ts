export type Role = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: Role;
  content: string;
};

export type ExtractedMeeting = {
  attendeeName?: string;
  attendeeEmail?: string;
  startISO?: string;
  endISO?: string;
  title?: string;
};
