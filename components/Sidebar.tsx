'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const menuItems = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  { icon: '🏍', label: 'Inventory', href: '/inventory' },
  { icon: '📦', label: 'Purchase Orders', href: '/purchase-orders' },
  { icon: '💰', label: 'Sales Pipeline', href: '/sales/leads/new' },
  { icon: '👥', label: 'Customers', href: '/customers' },
  { icon: '📧', label: 'Invoices', href: '/invoices' },
  { icon: '📄', label: 'Documents', href: '/documents' },
  { icon: '📈', label: 'Analytics', href: '/analytics' },
  { icon: '⚙', label: 'Settings', href: '/settings' },
  { icon: '👤', label: 'Users', href: '/users' },
  { icon: '📜', label: 'Audit Log', href: '/audit-log' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-[230px] h-screen bg-[#0f1729] text-slate-300 fixed left-0 top-0 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6">
        <h1 className="text-[#FF6B2C] text-2xl font-bold">
          MOTOOS
          <span className="text-slate-500 text-xs ml-2">v3.0</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {menuItems.map((item) => {
          const isActive = pathname === item.href ||
                          (item.href === '/sales/leads/new' && pathname?.startsWith('/sales'));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors
                ${isActive
                  ? 'bg-[#1e2a3f] text-white border-l-2 border-[#FF6B2C]'
                  : 'text-slate-400 hover:bg-[#1a2332] hover:text-slate-200'
                }
              `}
            >
              <span className="text-base">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info at bottom */}
      <div className="px-6 py-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF6B2C] rounded-full flex items-center justify-center text-white text-sm font-bold">
            MS
          </div>
          <div className="text-xs">
            <div className="text-white font-medium">Monica Svensson</div>
            <div className="text-slate-500">Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}
