import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-4">Captain Calendork: Voice Scheduling Agent</h1>
        <p className="text-slate-300 mb-6">
          Talk naturally and let Captain Calendork schedule real Google Calendar meetings.
        </p>
        <Link
          href="/auth"
          className="inline-block rounded-md bg-brand px-4 py-2 font-semibold hover:bg-blue-500 transition"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
