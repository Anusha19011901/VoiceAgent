import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function ConnectGooglePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Connect Google Calendar</h1>
        <p className="text-slate-300">
          You are logged in as <strong>{user.email}</strong>. Connect Google so Captain Calendork can create
          events on your behalf.
        </p>
        <a href="/api/google/start" className="inline-block rounded bg-brand px-4 py-2 font-medium">
          Connect Google Calendar
        </a>
        <div>
          <Link href="/app" className="text-blue-300 underline">
            Skip for now and go to app
          </Link>
        </div>
      </div>
    </main>
  );
}
