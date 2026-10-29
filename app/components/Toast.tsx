'use client';

import React from 'react';
import { useAuth } from '@/app/context/AuthContext';

export default function Toast() {
  const { toast } = useAuth();

  if (!toast) return null;

  const bgClasses = {
    success: 'bg-emerald-600/90 text-white border-emerald-500',
    info: 'bg-blue-600/90 text-white border-blue-500',
    error: 'bg-rose-600/90 text-white border-rose-500',
  }[toast.type];

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
      <div className={`px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2 backdrop-blur-xs ${bgClasses}`}>
        {toast.type === 'success' && <span>✓</span>}
        {toast.type === 'info' && <span>ℹ</span>}
        {toast.type === 'error' && <span>⚠</span>}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
