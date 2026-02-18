import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { env } from './env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        if (typeof cookieStore.set === 'function') {
          cookieStore.set({ name, value, ...(options || {}) });
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        if (typeof cookieStore.set === 'function') {
          cookieStore.set({ name, value: '', ...(options || {}) });
        }
      }
    }
  });
}

export function createSupabaseAdminClient() {
  return createAdminClient(env.supabaseUrl, env.supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
