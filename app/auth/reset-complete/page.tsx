'use client';

import Link from 'next/link';

export default function ResetCompletePage() {
  return (
    <div className="flex min-h-screen">
      {/* Left Side - Branding */}
      <div className="w-[45%] bg-[#0f1f2e] text-white p-16 flex flex-col justify-between">
        <div>
          <h1 className="text-[#FF6B2C] text-4xl font-bold mb-4">MOTOOS</h1>
          <p className="text-slate-300 text-lg mb-12">Dealership Intelligence Platform</p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">✅</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Password Updated</h3>
                <p className="text-slate-400">Your new password is now active</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🔒</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Securely Encrypted</h3>
                <p className="text-slate-400">256-bit encryption protects your password</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🚀</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Ready to Go</h3>
                <p className="text-slate-400">Sign in with your new password</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🛡️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Account Secure</h3>
                <p className="text-slate-400">Old password is no longer valid</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          <p>© 2026 MotoOS — AVA MC. All rights reserved.</p>
          <p>256-bit encrypted • GDPR compliant • Swedish hosting</p>
        </div>
      </div>

      {/* Right Side - Success Message */}
      <div className="flex-1 bg-[#f5f7fa] flex items-center justify-center p-12">
        <div className="w-full max-w-md text-center">
          <div className="text-7xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Password Reset Complete!</h2>
          <p className="text-slate-600 mb-8">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-green-900 mb-1">
                  Password Successfully Updated
                </p>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• New password is now active</li>
                  <li>• Old password has been invalidated</li>
                  <li>• You can sign in immediately</li>
                </ul>
              </div>
            </div>
          </div>

          <Link
            href="/auth/login"
            className="block w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors mb-4"
          >
            Go to Sign In
          </Link>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <p className="text-xs text-blue-800">
              <strong>💡 Tip:</strong> Keep your password safe and don't share it with anyone. For added security, consider using BankID for future logins.
            </p>
          </div>

          <p className="text-center text-sm text-slate-600 mt-8">
            🔒 256-bit SSL encrypted • GDPR compliant
          </p>
        </div>
      </div>
    </div>
  );
}
