'use client';

import React from 'react';
import { useAuth } from '@/app/context/AuthContext';

export default function NavbarAuth() {
  const { user, isLoading, openLoginModal, openRegisterModal, setIsReportsModalOpen, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-20 bg-slate-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openLoginModal}
          className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
        >
          Log In
        </button>
        <button
          type="button"
          onClick={openRegisterModal}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-xs"
        >
          Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* My Reports Button */}
      <button
        type="button"
        onClick={() => setIsReportsModalOpen(true)}
        className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
        title="View your saved flight reports"
      >
        <span>📁</span>
        <span className="hidden sm:inline">My Reports</span>
      </button>

      {/* User Chip */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-300">
        <span className="w-5 h-5 rounded-full bg-blue-600/40 text-blue-300 flex items-center justify-center text-[10px] font-bold">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-[100px] truncate">{user.username}</span>
      </div>

      {/* Logout Button */}
      <button
        type="button"
        onClick={logout}
        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors text-xs"
        title="Log Out"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}
