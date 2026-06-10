'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, ArrowRight, Loader2, KeyRound, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';

// Animated Grid Background
function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#0a0a1a]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 240, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'grid-move 20s linear infinite',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'center top',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a1a]/50 to-[#0a0a1a]" />
    </div>
  );
}

// Glass Card Component
function GlassCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

export default function VerifyCodePage() {
  const router = useRouter();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Get employeeId from session storage
    const storedEmployeeId = sessionStorage.getItem('reset_employee_id');
    if (!storedEmployeeId) {
      // Redirect if no employeeId in storage
      router.push('/forgot-password');
      return;
    }
    setEmployeeId(storedEmployeeId);
  }, [router]);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take last character
    setCode(newCode);

    // Move to next input if value entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (index === 5 && value) {
      const fullCode = [...newCode.slice(0, 5), value].join('');
      if (fullCode.length === 6) {
        setTimeout(() => handleVerify(fullCode), 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = pasted.split('').concat(Array(6 - pasted.length).fill(''));
    setCode(newCode);
    
    // Focus appropriate input
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if complete
    if (pasted.length === 6) {
      setTimeout(() => handleVerify(pasted), 100);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    if (!employeeId) {
      setError('Session expired. Please start over.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await authService.verifyCode({ employeeId, code: codeToVerify });
      if (result.success) {
        setSuccess(true);
        // Store the verified code for reset password step
        sessionStorage.setItem('reset_code', codeToVerify);
        // Redirect to reset password page
        setTimeout(() => {
          router.push('/reset-password');
        }, 1500);
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  const handleResend = async () => {
    if (!employeeId) return;
    
    setIsLoading(true);
    setError('');

    try {
      const result = await authService.forgotPassword({ employeeId });
      if (result.success) {
        setError('');
        // Show success temporarily
        alert('New verification code sent!');
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden flex items-center justify-center relative">
      <AnimatedGrid />

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a1a]/50 border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/skyview" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Skyview
              </span>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Verify Code Form */}
      <div className="relative z-10 w-full max-w-md px-4 pt-16">
        <GlassCard className="p-8">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6"
            >
              <KeyRound className="w-8 h-8 text-cyan-400" />
            </motion.div>
            <h1 className="text-3xl font-bold mb-2">Enter Verification Code</h1>
            <p className="text-slate-400">
              Enter the 6-digit code sent to your email address
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm"
            >
              <p className="font-medium">Code verified!</p>
              <p className="mt-1">Redirecting to reset password...</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code Input Boxes */}
            <div className="flex justify-center gap-2 sm:gap-3">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isLoading || success}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all disabled:opacity-50"
                />
              ))}
            </div>

            <motion.button
              type="submit"
              disabled={isLoading || success || code.join('').length !== 6}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-cyan-400/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Verify Code
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Resend Code */}
          <div className="mt-6 text-center">
            <button
              onClick={handleResend}
              disabled={isLoading}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Resend code
            </button>
          </div>

          <div className="mt-4 flex flex-col items-center gap-3">
            <Link
              href="/forgot-password"
              className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Wrong employee ID? Start over
            </Link>
            <Link
              href="/login"
              className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Back to Sign in
            </Link>
          </div>
        </GlassCard>
      </div>

      {/* CSS for grid animation */}
      <style jsx>{`
        @keyframes grid-move {
          0% {
            transform: perspective(500px) rotateX(60deg) translateY(0);
          }
          100% {
            transform: perspective(500px) rotateX(60deg) translateY(50px);
          }
        }
      `}</style>
    </div>
  );
}
