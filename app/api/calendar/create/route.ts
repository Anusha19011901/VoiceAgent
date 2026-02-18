import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import { getOAuth2Client } from '@/lib/google';
import { DEFAULT_TZ } from '@/lib/date-utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { extracted } = await req.json();
    if (!extracted?.attendeeEmail || !extracted?.attendeeName || !extracted?.startISO) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: tokenRow, error } = await admin
      .from('google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !tokenRow) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token,
      expiry_date: tokenRow.expiry_date
    });

    const refreshed = await oauth2Client.getAccessToken();
    if (refreshed.token && refreshed.token !== tokenRow.access_token) {
      await admin
        .from('google_tokens')
        .update({ access_token: refreshed.token })
        .eq('user_id', user.id);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const endISO =
      extracted.endISO || new Date(new Date(extracted.startISO).getTime() + 30 * 60 * 1000).toISOString();

    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: extracted.title || `Meeting with ${extracted.attendeeName}`,
        description: 'Scheduled by Captain Calendork',
        start: { dateTime: extracted.startISO, timeZone: DEFAULT_TZ },
        end: { dateTime: endISO, timeZone: DEFAULT_TZ },
        attendees: [{ email: extracted.attendeeEmail, displayName: extracted.attendeeName }]
      },
      sendUpdates: 'all'
    });

    return NextResponse.json({ htmlLink: created.data.htmlLink, eventId: created.data.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
