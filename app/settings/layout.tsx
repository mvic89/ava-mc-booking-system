'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checking, setChecking] = useState(true);
  const redirected = useRef(false);

  useEffect(() => {
    if (pathname === '/settings/auth') {
      setChecking(false);
      return;
    }
    const unlocked = sessionStorage.getItem('settings_unlocked');
    if (!unlocked && !redirected.current) {
      redirected.current = true;
      router.replace('/settings/auth');
    } else if (unlocked) {
      setChecking(false);
    }
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
