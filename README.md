# Voice Scheduling Agent (Captain Calendork)

A deployed-ready Next.js 14 app where authenticated users can have a natural voice conversation and schedule **real Google Calendar events** with invitees.

## Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Google Calendar API (`googleapis`)
- Web Speech API (`SpeechRecognition`, `speechSynthesis`) on client
- LLM route `/api/llm` (Gemini default, provider abstraction for Groq)

## Core Flow
1. `/auth`: Sign up / login (password or magic link).
2. `/connect-google`: Connect Google Calendar OAuth.
3. `/app`: Use Captain Calendork voice UI.
4. Agent gathers attendee name, attendee email, date/time, optional title.
5. Agent confirms summary and asks explicit confirmation.
6. On confirmation, `/api/calendar/create` creates event in Google Calendar and returns `htmlLink`.
7. UI shows success + **View Event** button.

## Environment variables
Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
  - local example: `http://localhost:3000/api/google/callback`
  - prod example: `https://YOUR-VERCEL-DOMAIN.vercel.app/api/google/callback`
- `GEMINI_API_KEY` (default LLM provider)
- `APP_BASE_URL`
  - local: `http://localhost:3000`
  - prod: `https://YOUR-VERCEL-DOMAIN.vercel.app`

Optional:
- `GROQ_API_KEY` (provider abstraction stub included for easy swap)

## Supabase setup
1. Create project in Supabase.
2. Enable Auth providers you want (Email/Password and Magic Link).
3. Run SQL migration in `supabase/migrations/001_init.sql` in Supabase SQL Editor.
4. Ensure your site URL and redirect URLs include local/prod app URLs.

## Google Cloud setup
1. Create/select a Google Cloud project.
2. Enable **Google Calendar API**.
3. Configure OAuth consent screen (External/testing is fine).
4. Create OAuth 2.0 Client ID (Web application).
5. Authorized redirect URIs:
   - `http://localhost:3000/api/google/callback`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/api/google/callback`
6. Put client ID/secret in env vars.

## Local run
```bash
npm install
npm run dev
```
Then open `http://localhost:3000`.

## Deploy to Vercel (free tier)
1. Push repo to GitHub.
2. Import project into Vercel.
3. Add all environment variables in Vercel Project Settings.
4. Deploy.
5. Update Google OAuth redirect URI + Supabase redirect settings to production URL.

## Routes
### Pages
- `/` landing
- `/auth` signup/login
- `/connect-google` OAuth connect step
- `/app` voice agent UI

### API
- `GET /api/google/start` -> starts Google OAuth
- `GET /api/google/callback` -> exchanges code and stores tokens in `google_tokens`
- `POST /api/llm` -> returns assistant response + structured extraction + needs
- `POST /api/calendar/create` -> refreshes token if needed and creates event

## Notes
- Google tokens are never stored on the client.
- `google_tokens` table uses RLS for per-user access.
- Default timezone for events is `America/New_York` unless expanded in extraction.
- If speech recognition is unsupported, app falls back to typed input.
