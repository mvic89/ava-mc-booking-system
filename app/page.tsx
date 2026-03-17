'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect once to prevent loops
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    // Check if user is logged in
    const user = localStorage.getItem('user');
    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/auth/login');
    }
  }, [router]);

  // Show loading spinner while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="text-center animate-fade-in">
        <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading..</p>
      </div>
    </div>
  );

}
