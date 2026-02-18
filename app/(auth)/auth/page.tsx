'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/connect-google`
      }
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus('Signup successful. Check your inbox if email confirmation is enabled, then login.');
  };

  const signInPassword = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message);
      return;
    }

    router.push('/connect-google');
  };

  const signInMagic = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/connect-google`
      }
    });

    setStatus(error ? error.message : 'Magic link sent. Check your email.');
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Create account / Login</h1>
        <form onSubmit={signUp} className="space-y-3">
          <input
            className="w-full rounded bg-slate-800 p-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded bg-slate-800 p-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded bg-slate-800 p-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="w-full rounded bg-brand py-2 font-medium">Sign up</button>
        </form>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={signInPassword} className="rounded bg-emerald-700 py-2">
            Login with password
          </button>
          <button onClick={signInMagic} className="rounded bg-indigo-700 py-2">
            Send magic link
          </button>
        </div>

        {status && <p className="text-sm text-slate-300">{status}</p>}
      </div>
    </main>
  );
}
