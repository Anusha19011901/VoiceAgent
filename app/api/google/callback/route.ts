import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/google';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase-server';
import { env } from '@/lib/env';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth', env.appBaseUrl));

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('google_tokens').upsert(
    {
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/app', env.appBaseUrl));
}
