'use client';

/**
 * BankIDModal — Reusable BankID identification/signing component.
 *
 * USE THIS ON EVERY PAGE WHERE BANKID IS NEEDED:
 *   - Customer identification (mode="auth")
 *   - Waiver signing (mode="sign")
 *   - Agreement signing (mode="sign")
 *   - Test drive consent (mode="sign")
 *
 * Usage:
 *   <BankIDModal
 *     mode="auth"
 *     onComplete={(data) => { ... }}
 *     onCancel={() => { ... }}
 *   />
 *
 *   <BankIDModal
 *     mode="sign"
 *     signText="Jag signerar köpeavtal #SA-2026-042 för 98,280 kr"
 *     onComplete={(data) => { ... }}
 *     onCancel={() => { ... }}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BankIDStatus, BankIDModalProps, BankIDUser } from '@/types';

// ─── Types ───────────────────────────────────────────────────

// Re-export for backward compatibility
export type { BankIDResult, BankIDUser } from '@/types';

// ─── Browser-side HMAC-SHA256 for QR animation ───────────────

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function generateQRString(token: string, secret: string, time: number): Promise<string> {
  const qrAuthCode = await hmacSha256(secret, time.toString());
  return `bankid.${token}.${time}.${qrAuthCode}`;
}

// ─── Simple QR Code Renderer (SVG, no external dep) ──────────

function QRCodeSVG({ data, size = 200 }: { data: string; size?: number }) {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    // Dynamic import of qrcode to avoid SSR issues
    import('qrcode').then((QRCode) => {
      QRCode.toString(data, {
        type: 'svg',
        width: size,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).then((svg: string) => {
        setSvgContent(svg);
      });
    }).catch(() => {
      // Fallback: show the raw data if qrcode package not available
      setSvgContent('');
    });
  }, [data, size]);

  if (!svgContent) {
    // Fallback while loading or if qrcode unavailable
    return (
      <div
        className="flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-[10px] break-all p-2"
        style={{ width: size, height: size }}
      >
        {data.slice(0, 40)}...
      </div>
    );
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{ width: size, height: size }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function BankIDModal({
  mode = 'auth',
  signText,
  onComplete,
  onCancel,
  autoStart = false,
  title,
  subtitle,
}: BankIDModalProps) {
  const [status, setStatus] = useState<BankIDStatus>('idle');
  const [message, setMessage] = useState('');
  const [qrData, setQrData] = useState('');
  const [autoStartUrl, setAutoStartUrl] = useState('');
  const [completedUser, setCompletedUser] = useState<BankIDUser | null>(null);

  const orderRef = useRef('');
  const qrToken = useRef('');
  const qrSecret = useRef('');
  const qrTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const collectTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seconds = useRef(0);
  // Tracks the current auth call — incremented on every startBankID call and on
  // cleanup, so stale async completions (React StrictMode double-effect) bail out
  // before they can create a leaked interval.
  const authCallId = useRef(0);

  // Auto-start + cleanup (single effect so cleanup always matches the start)
  useEffect(() => {
    if (autoStart) startBankID();
    return () => {
      authCallId.current++;          // invalidate any in-flight startBankID
      if (qrTimer.current) clearInterval(qrTimer.current);
      if (collectTimer.current) clearInterval(collectTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Start BankID ────────────────────────────────────────

  const startBankID = useCallback(async () => {
    // Claim this call's ID — any previous in-flight call is now stale
    authCallId.current += 1;
    const myCallId = authCallId.current;

    setStatus('scanning');
    setMessage('Open the BankID app and scan the QR code.');
    seconds.current = 0;

    try {
      const res = await fetch('/api/bankid/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          userVisibleData: mode === 'sign' ? signText : undefined,
        }),
      });
      const data = await res.json();

      // If cleanup ran or a newer startBankID was called while we awaited, bail
      if (myCallId !== authCallId.current) return;

      if (data.error) {
        setStatus('failed');
        setMessage(data.error);
        return;
      }

      orderRef.current = data.orderRef;
      qrToken.current = data.qrStartToken;
      qrSecret.current = data.qrStartSecret;

      // Build autostart URL for same-device
      const isIOS = /iPhone|iPad/i.test(navigator.userAgent);
      setAutoStartUrl(
        isIOS
          ? `https://app.bankid.com/?autostarttoken=${data.autoStartToken}&redirect=null`
          : `bankid:///?autostarttoken=${data.autoStartToken}&redirect=null`
      );

      // Generate initial QR
      const initialQR = await generateQRString(data.qrStartToken, data.qrStartSecret, 0);
      setQrData(initialQR);

      // Animate QR every 1 second
      qrTimer.current = setInterval(async () => {
        seconds.current += 1;
        const qr = await generateQRString(
          qrToken.current,
          qrSecret.current,
          seconds.current
        );
        setQrData(qr);
      }, 1000);

      // Poll /collect every 2 seconds
      collectTimer.current = setInterval(async () => {
        try {
          const collectRes = await fetch('/api/bankid/collect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderRef: orderRef.current }),
          });
          const collectData = await collectRes.json();

          if (collectData.status === 'pending') {
            setMessage(collectData.message);
            return;
          }

          // Stop timers
          if (qrTimer.current) clearInterval(qrTimer.current);
          if (collectTimer.current) clearInterval(collectTimer.current);

          if (collectData.status === 'complete') {
            setStatus('complete');
            setCompletedUser(collectData.user);
            setMessage(`Identified: ${collectData.user.name}`);
            onComplete(collectData);
          } else if (collectData.status === 'failed') {
            setStatus('failed');
            setMessage(collectData.message);
          }
        } catch (err) {
          console.error('Collect error:', err);
        }
      }, 2000);

      // Auto-cancel after 3 minutes
      setTimeout(() => {
        if (status === 'scanning') {
          handleCancel();
          setStatus('failed');
          setMessage('BankID session expired (3 min). Please try again.');
        }
      }, 180_000);

    } catch (error) {
      setStatus('failed');
      setMessage('Could not start BankID. Please check your configuration or try again.');
    }
  }, [mode, signText, onComplete, status]);

  // ─── Cancel ──────────────────────────────────────────────

  const handleCancel = async () => {
    if (qrTimer.current) clearInterval(qrTimer.current);
    if (collectTimer.current) clearInterval(collectTimer.current);

    if (orderRef.current) {
      fetch('/api/bankid/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderRef: orderRef.current }),
      }).catch(() => {}); // fire and forget
    }

    setStatus('idle');
    onCancel();
  };

  // ─── Render ──────────────────────────────────────────────

  const defaultTitle = mode === 'sign' ? 'Sign with BankID' : 'Identify with BankID';
  const defaultSubtitle = mode === 'sign'
    ? 'The customer signs the document with the BankID app.'
    : 'Ask the customer to scan the QR code with the BankID app.';

  return (
    <div className="fixed inset-0 bg-[#0b1524]/75 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in">
      <div className="glass rounded-[24px] px-10 py-8 max-w-[420px] w-full text-center animate-fade-up">
        {/* BankID Logo */}
        <div className="mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#235971] inline-flex items-center justify-center">
            <span className="text-white font-extrabold text-sm">BankID</span>
          </div>
        </div>

        {/* ── IDLE ── */}
        {status === 'idle' && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-1.5">{title || defaultTitle}</h2>
            <p className="text-sm text-slate-500 mb-5">{subtitle || defaultSubtitle}</p>
            <button
              onClick={startBankID}
              className="block w-full bg-[#235971] text-white border-none rounded-[10px] px-6 py-3.5 text-[15px] font-semibold cursor-pointer mb-2.5 hover:bg-[#1a4557] transition-colors"
            >
              Start BankID
            </button>
            <button
              onClick={onCancel}
              className="bg-transparent border-none text-slate-400 text-sm cursor-pointer px-4 py-2 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {/* ── SCANNING ── */}
        {status === 'scanning' && (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-1.5">{title || defaultTitle}</h2>
            <p className="text-sm text-slate-500 mb-5">{subtitle || defaultSubtitle}</p>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              {qrData && <QRCodeSVG data={qrData} size={220} />}
            </div>

            {/* Animated indicator */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-xs text-blue-600">QR code updates automatically</span>
            </div>

            {/* Status message */}
            <div className="bg-blue-50 rounded-lg px-4 py-2.5 mb-4 text-sm text-blue-800">
              <span>{message}</span>
            </div>

            {/* Same device */}
            {autoStartUrl && (
              <a
                href={autoStartUrl}
                className="block bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-slate-600 no-underline cursor-pointer hover:bg-slate-100 transition-colors"
              >
                📱 Open BankID on this device
              </a>
            )}

            <button
              onClick={handleCancel}
              className="bg-transparent border-none text-slate-400 text-sm cursor-pointer px-4 py-2 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {/* ── COMPLETE ── */}
        {status === 'complete' && completedUser && (
          <>
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-green-600 mb-1.5">Identified!</h2>
            <p className="text-sm text-slate-500 mb-5">
              {completedUser.name}
            </p>
            <p className="text-base font-semibold text-slate-900 bg-green-50 px-4 py-2 rounded-lg inline-block">
              {completedUser.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')}
            </p>
          </>
        )}

        {/* ── FAILED ── */}
        {status === 'failed' && (
          <>
            <div className="text-5xl mb-3">❌</div>
            <h2 className="text-xl font-bold text-red-600 mb-1.5">Failed</h2>
            <p className="text-sm text-slate-500 mb-5">{message}</p>
            <button
              onClick={startBankID}
              className="block w-full bg-[#235971] text-white border-none rounded-[10px] px-6 py-3.5 text-[15px] font-semibold cursor-pointer mb-2.5 hover:bg-[#1a4557] transition-colors"
            >
              Try again
            </button>
            <button
              onClick={onCancel}
              className="bg-transparent border-none text-slate-400 text-sm cursor-pointer px-4 py-2 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}