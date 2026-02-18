import { redirect } from 'next/navigation';
import VoiceAgent from '@/components/voice-agent';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function AppPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  return (
    <main className="min-h-screen p-4 md:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">Captain Calendork Control Deck</h1>
        <p className="text-slate-300">Click the mic, chat naturally, then confirm to schedule on Google Calendar.</p>
        <VoiceAgent />
      </div>
    </main>
  );
}
