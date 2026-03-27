'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import { emit } from '@/lib/realtime';

async function createSession(payload: object) {
  await fetch('/api/auth/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      try {
        const supabase = getSupabaseBrowser();

        // Read the ?code= param from the URL (set by Supabase after Google redirects back)
        const params = new URLSearchParams(window.location.search);
        const code   = params.get('code');

        let session: { user: { email?: string | null } } | null = null;

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.session) {
            router.replace('/auth/login?error=oauth_failed');
            return;
          }
          session = data.session;
        } else {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        if (!session) {
          router.replace('/auth/login?error=no_session');
          return;
        }

        const email = session.user.email?.toLowerCase().trim() ?? '';
        if (!email) {
          router.replace('/auth/login?error=no_email');
          return;
        }

        // Look up the user in staff_users (admin key used server-side; anon key is fine here
        // because staff_users has permissive RLS policies)
        const { data: staffRow } = await (supabase as any)
          .from('staff_users')
          .select('role, dealership_id, name')
          .eq('email', email)
          .maybeSingle() as {
            data: { role: string; dealership_id: string | null; name: string } | null;
          };

        if (!staffRow) {
          router.replace('/auth/login?error=not_registered');
          return;
        }

        const role:           'admin' | 'sales' | 'service' | 'platform_admin' = staffRow.role as any;
        const dealershipId:   string = role === 'platform_admin' ? '' : (staffRow.dealership_id ?? '');
        const dealershipName: string = role === 'platform_admin' ? 'BikeMeNow Platform' : '';
        const name:           string = staffRow.name ?? email.split('@')[0];

        // Persist to localStorage so Sidebar / dashboard render immediately
        localStorage.setItem('user', JSON.stringify({ name, email, role, dealershipId, dealershipName }));
        emit({ type: 'data:refresh' });

        // Create the httpOnly session cookie
        await createSession({ dealershipId, dealershipName, name, email, role });

        // Update last_login
        await (supabase as any)
          .from('staff_users')
          .update({ last_login: new Date().toISOString() })
          .eq('email', email);

        // Redirect
        if (role === 'platform_admin') {
          router.replace('/admin');
        } else {
          router.replace('/dashboard');
        }
      } catch (err) {
        console.error('[auth/callback]', err);
        router.replace('/auth/login?error=callback_failed');
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Signing you in…</p>
      </div>
    </div>
  );
}
