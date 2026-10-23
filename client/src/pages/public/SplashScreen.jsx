import React from 'react';

export function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-50 text-white">
      <div className="flex flex-col items-center space-y-5 animate-fade-in">
        {/* Brand Icon */}
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-tr from-teal-600 to-emerald-400 flex items-center justify-center shadow-2xl shadow-teal-500/20">
            <span className="font-extrabold text-4xl tracking-tighter text-white">C</span>
          </div>
          <div className="absolute -inset-1 rounded-3xl bg-teal-500/20 blur-sm -z-10 animate-pulse"></div>
        </div>

        {/* Brand Titles */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Enterprise Carpooling
          </h1>
          <p className="text-xs text-teal-400 font-medium tracking-wide uppercase mt-1">
            Workplace Commuting Platform
          </p>
        </div>

        {/* Loading Spinner */}
        <div className="flex items-center space-x-1.5 pt-4">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"></span>
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:0.2s]"></span>
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:0.4s]"></span>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;
