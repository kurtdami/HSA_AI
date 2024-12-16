'use client'
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './authcontext';
import StarField from './components/StarField';

const HomePage: React.FC = () => {
  const router = useRouter();
  const { user, loading, error, login } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/expenses');
    }
  }, [user, router]);

  if (!isClient || loading) {
    return (
      <div className="flex min-h-screen bg-[#0B1120] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(93,52,211,0.1),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(236,72,153,0.1),transparent_50%)]"></div>
      
      {/* Add StarField component */}
      <StarField />
      
      {/* Add subtle gradient orbs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse-glow"></div>
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
      
      {/* Main content */}
      <div className="relative w-full max-w-[1200px] mx-auto px-4 py-20">
        <div className="flex flex-col items-center space-y-12">
          {/* Title with enhanced glow */}
          <h1 className="text-[3.5rem] sm:text-[4.5rem] lg:text-[5.5rem] leading-none font-extrabold text-center relative">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500 whitespace-nowrap relative">
              HSA AI Expense Tracker
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500 opacity-20 blur-2xl -z-10"></div>
            </span>
          </h1>

          {/* Subtitle */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl text-white font-bold text-center max-w-3xl">
            Rapidly track expenses without complexity
          </h2>
          
          {/* Description */}
          <p className="text-lg text-slate-400 text-center max-w-2xl">
            A utility-first expense tracker packed with features like{' '}
            <code className="text-sky-400 font-mono bg-sky-400/10 rounded px-1.5 py-0.5">receipt-scan</code>,{' '}
            <code className="text-sky-400 font-mono bg-sky-400/10 rounded px-1.5 py-0.5">auto-categorize</code>, and{' '}
            <code className="text-sky-400 font-mono bg-sky-400/10 rounded px-1.5 py-0.5">tax-report</code>{' '}
            that can be used to track any HSA-eligible expense
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={login}
              className="bg-white text-slate-900 hover:bg-white/90 px-8 py-3 rounded-lg font-semibold text-lg
                         flex items-center justify-center gap-2 min-w-[200px] relative group"
            >
              <div className="absolute inset-0 rounded-lg bg-white/20 blur-xl transition-opacity opacity-0 group-hover:opacity-100"></div>
              <div className="relative flex items-center justify-center gap-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </div>
            </button>
            
            <div className="relative group min-w-[200px]">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
              <button
                onClick={() => window.open('https://www.irs.gov/pub/irs-pdf/p502.pdf', '_blank')}
                className="relative w-full bg-[#0B1120] text-white px-8 py-3 rounded-lg font-semibold text-lg
                           flex items-center justify-center gap-2"
              >
                Learn about HSA
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
