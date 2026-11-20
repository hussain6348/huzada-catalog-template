import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, EyeOff, LoaderCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { loginAdmin } from '../lib/auth';

interface AdminLoginProps {
  onSuccess?: () => void;
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- SMART LOCKOUT LOGIC ---
  const [lockoutTime, setLockoutTime] = useState<number | null>(() => {
    const stored = localStorage.getItem('admin_lockout_until');
    return stored && parseInt(stored) > Date.now() ? parseInt(stored) : null;
  });
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Secret Override: /admin?override=huzada
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('override') === 'huzada') {
      localStorage.removeItem('admin_failed_attempts');
      localStorage.removeItem('admin_lockout_until');
      setLockoutTime(null);
      setErrorMessage('Lockout overridden by administrator.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Countdown Engine
  useEffect(() => {
    if (!lockoutTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= lockoutTime) {
        setLockoutTime(null);
        localStorage.removeItem('admin_lockout_until');
        localStorage.removeItem('admin_failed_attempts');
        setErrorMessage(null);
      } else {
        setRemainingSeconds(Math.ceil((lockoutTime - now) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);
  // ---------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMessage('Please enter the administrative password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const result = await loginAdmin(trimmed);
    setLoading(false);

    if (result.success) {
      localStorage.removeItem('admin_failed_attempts');
      localStorage.removeItem('admin_lockout_until');
      if (onSuccess) {
        onSuccess();
      }
    } else {
      let attempts = parseInt(localStorage.getItem('admin_failed_attempts') || '0') + 1;
      localStorage.setItem('admin_failed_attempts', attempts.toString());
      
      if (attempts >= 5) {
        const lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
        localStorage.setItem('admin_lockout_until', lockUntil.toString());
        setLockoutTime(lockUntil);
        setErrorMessage('Too many failed attempts. Console locked for 30 minutes.');
      } else {
        setErrorMessage(`Invalid credentials. ${5 - attempts} attempts remaining.`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100/70 flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-zinc-900 selection:bg-zinc-900 selection:text-white w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-sm">
        {/* Return to storefront / public catalog view */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Storefront</span>
          </Link>
        </div>

        {/* Login Container Card */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xl p-7 sm:p-8 space-y-6">
          {/* Header & Icon */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-zinc-950 text-white flex items-center justify-center mx-auto shadow-xs">
              <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-zinc-900 tracking-tight">
                Storefront Operations Console
              </h1>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Protected administrative access. Enter security passkey to manage orders and catalog.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-xl flex items-center gap-2 text-xs text-red-700 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Console Security Passkey
              </label>
              <div className="relative">
                <input
                  required
                  autoFocus
                  disabled={lockoutTime !== null}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter administrator password..."
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full bg-zinc-50/50 hover:bg-white focus:bg-white border border-zinc-200 focus:border-zinc-900 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || lockoutTime !== null}
              className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs font-sans tracking-tight"
            >
              {lockoutTime !== null ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Locked: {Math.floor(remainingSeconds / 60)}m {remainingSeconds % 60}s</span>
                </>
              ) : loading ? (
                <>
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Access Console</span>
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="pt-2 border-t border-zinc-100 text-center">
            <span className="text-[11px] font-mono text-zinc-400">
              System Session Protected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
