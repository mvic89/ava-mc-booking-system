'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (formData.password.length < 8) {
      alert('Password must be at least 8 characters long!');
      return;
    }

    // TODO: Implement password reset with token
    console.log('Resetting password with token:', token);
    router.push('/auth/reset-complete');
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Branding */}
      <div className="w-[45%] bg-[#0f1f2e] text-white p-16 flex flex-col justify-between">
        <div>
          <h1 className="text-[#FF6B2C] text-4xl font-bold mb-4">MOTOOS</h1>
          <p className="text-slate-300 text-lg mb-12">Dealership Intelligence Platform</p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🔐</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Strong Password</h3>
                <p className="text-slate-400">Minimum 8 characters required</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">✅</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Confirmation Match</h3>
                <p className="text-slate-400">Both passwords must match</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🛡️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Secure Hash</h3>
                <p className="text-slate-400">Passwords are encrypted and never stored as plain text</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🔄</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Immediate Effect</h3>
                <p className="text-slate-400">New password works right away</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          <p>© 2026 MotoOS — AVA MC. All rights reserved.</p>
          <p>256-bit encrypted • GDPR compliant • Swedish hosting</p>
        </div>
      </div>

      {/* Right Side - Reset Form */}
      <div className="flex-1 bg-[#f5f7fa] flex items-center justify-center p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔑</div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Set New Password</h2>
            <p className="text-slate-600">
              Enter your new password below. Make it strong and memorable!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="••••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="••••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Password Match Indicator */}
            {formData.password && formData.confirmPassword && (
              <div className={`text-sm rounded-lg p-3 ${
                formData.password === formData.confirmPassword
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {formData.password === formData.confirmPassword
                  ? '✅ Passwords match!'
                  : '❌ Passwords do not match'}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors"
            >
              Reset Password
            </button>
          </form>

          <div className="text-center mt-6">
            <Link
              href="/auth/login"
              className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1"
            >
              <span>←</span> Back to Sign In
            </Link>
          </div>

          <p className="text-center text-sm text-slate-600 mt-8">
            🔒 256-bit SSL encrypted • GDPR compliant
          </p>
        </div>
      </div>
    </div>
  );
}
