'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/app/context/AuthContext';

interface SavedReport {
  id: string;
  title: string;
  reportType: 'standard' | 'a3';
  filename: string;
  fileSize: number;
  metadata: {
    pointsCount?: number;
    totalDistanceKm?: string | number;
    speedKmH?: number;
    headingType?: string;
    waypoints?: Array<{ name: string; lat: number; lng: number }>;
  } | null;
  createdAt: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReportsModal() {
  const { isReportsModalOpen, setIsReportsModalOpen, reportsRefreshKey, user, showToast } = useAuth();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'standard' | 'a3'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports');
      if (!res.ok) {
        throw new Error('Failed to load reports');
      }
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching reports');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isReportsModalOpen && user) {
      fetchReports();
    }
  }, [isReportsModalOpen, user, reportsRefreshKey, fetchReports]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isReportsModalOpen) {
        setIsReportsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReportsModalOpen, setIsReportsModalOpen]);

  const handleDelete = async (id: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete report');
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
      showToast('Report deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterType !== 'all' && r.reportType !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(query);
        const matchesFilename = r.filename.toLowerCase().includes(query);
        return matchesTitle || matchesFilename;
      }
      return true;
    });
  }, [reports, filterType, searchQuery]);

  const totalStorage = useMemo(() => {
    return reports.reduce((acc, r) => acc + r.fileSize, 0);
  }, [reports]);

  if (!isReportsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={() => setIsReportsModalOpen(false)} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📁</span>
            <div>
              <h2 className="text-base font-semibold text-slate-100">My Saved Reports</h2>
              <p className="text-xs text-slate-400">
                {reports.length} {reports.length === 1 ? 'file' : 'files'} ({formatBytes(totalStorage)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchReports}
              disabled={isLoading}
              title="Refresh reports"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-sm transition-colors"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIsReportsModalOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-2 text-xl font-bold leading-none hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Toolbar: Filters & Search */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterType === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({reports.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('standard')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterType === 'standard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              A4 Reports
            </button>
            <button
              type="button"
              onClick={() => setFilterType('a3')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterType === 'a3' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              A3 Maps
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        {/* Reports Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {isLoading && reports.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading your flight reports...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-sm text-center">
              {error}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <span className="text-4xl select-none">🗂</span>
              <p className="text-sm font-medium text-slate-300">No saved reports found</p>
              <p className="text-xs text-slate-500 max-w-sm">
                {reports.length === 0
                  ? 'Plan a flight route and click "Export PDF" or "A3 Map" to generate and automatically save files to your account.'
                  : 'No reports match your active filter or search query.'}
              </p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-lg shrink-0">
                    {report.reportType === 'a3' ? '🗺' : '📄'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100 truncate max-w-xs sm:max-w-md">
                        {report.title || report.filename}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          report.reportType === 'a3'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {report.reportType === 'a3' ? 'A3 Map' : 'A4 Report'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                      <span>{formatDate(report.createdAt)}</span>
                      <span>•</span>
                      <span>{formatBytes(report.fileSize)}</span>
                      {report.metadata?.pointsCount && (
                        <>
                          <span>•</span>
                          <span>{report.metadata.pointsCount} points</span>
                        </>
                      )}
                      {report.metadata?.totalDistanceKm && (
                        <>
                          <span>•</span>
                          <span>{report.metadata.totalDistanceKm} km</span>
                        </>
                      )}
                      {report.metadata?.speedKmH && (
                        <>
                          <span>•</span>
                          <span>{report.metadata.speedKmH} km/h</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <a
                    href={`/api/reports/${report.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    title="View PDF in new tab"
                  >
                    <span>View</span>
                    <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  <a
                    href={`/api/reports/${report.id}?download=true`}
                    download={report.filename}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                    title="Download PDF"
                  >
                    <span>Download</span>
                    <svg className="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>

                  <button
                    type="button"
                    disabled={deletingId === report.id}
                    onClick={() => handleDelete(report.id, report.filename)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete report"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
