import React, { useState, useEffect } from 'react';

export function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setHealth({ success: false, error: { message: err.message } });
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
              C
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Carpooling Platform</h1>
              <p className="text-xs text-slate-500">Sustainable Workplace Commuting</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              Phase 1: Foundation
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">System Status</h2>
          <p className="text-slate-600 text-sm mb-6">
            Connecting frontend to backend via Vite development proxy (<code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">/api</code>).
          </p>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Health Check Endpoint</span>
              {loading ? (
                <span className="inline-block animate-pulse text-xs text-slate-500">Checking...</span>
              ) : health?.success ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Operational
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  Connecting
                </span>
              )}
            </div>

            <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-lg overflow-x-auto font-mono">
              {JSON.stringify(health || { message: 'Awaiting server response...' }, null, 2)}
            </pre>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500 bg-white">
        &copy; {new Date().getFullYear()} Enterprise Carpooling Platform. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
