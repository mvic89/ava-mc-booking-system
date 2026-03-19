'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';

const languageOptions = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
  { code: 'no', label: 'Norsk', flag: '🇳🇴' },
  { code: 'da', label: 'Dansk', flag: '🇩🇰' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact';
}

export default function LanguageSwitcher({ variant = 'default' }: LanguageSwitcherProps) {
  const locale = useLocale();
  const [showMenu, setShowMenu] = useState(false);

  const menuHandle = () => {
    setShowMenu(!showMenu);
  }

  const handleLanguageChange = (newLocale: string) => {
    // Set locale cookie
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`; // 1 year
    setShowMenu(false);
    // Get current path and reload to apply new locale
    const currentPath = window.location.pathname;
    // Use window.location to force a full page reload with new locale
    window.location.href = currentPath;
  };

  const currentLanguage = languageOptions.find(lang => lang.code === locale) || languageOptions[0];

  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
        >
          <span className="text-lg">{currentLanguage.flag}</span>
          <span className="text-sm font-medium">{currentLanguage.label}</span>
          <span className="text-xs">▼</span>
        </button>

        {showMenu && (
          <>
            {/* Backdrop to close menu */}
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}/>
            {/* Menu */}
            <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-20 min-w-40">
              {languageOptions.map((lang) => (
                <button key={lang.code} onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                    lang.code === locale
                      ? 'bg-[#FF6B2C] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}>
                  <span className="text-base">{lang.flag}</span>
                  <span className="font-medium">{lang.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={menuHandle} className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-[#1a2332] hover:text-slate-200 transition-colors" >
        <span className="text-base">{currentLanguage.flag}</span>
        <span className="text-sm font-medium">{currentLanguage.label}</span>
        <span className="text-xs">▼</span>
      </button>

      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          {/* Menu */}
          <div className="absolute bottom-full left-0 mb-2 bg-[#1e2a3f] rounded-lg shadow-xl border border-slate-700 overflow-hidden z-20">
            {languageOptions.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  lang.code === locale
                    ? 'bg-[#FF6B2C] text-white'
                    : 'text-slate-300 hover:bg-[#2a3a4f]'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

