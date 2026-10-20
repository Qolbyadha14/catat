import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  AlertTriangle,
  XCircle,
  FileText,
  MessageSquare,
} from 'lucide-react';

import type { AiLogEntry, AiTelemetrySummary } from '../../lib/telemetry/telemetryService';

interface AiTelemetryTabProps {
  logs: AiLogEntry[];
  summary: AiTelemetrySummary;
  loading: boolean;
}

export const AiTelemetryTab: React.FC<AiTelemetryTabProps> = ({ logs, summary, loading }) => {
  const [filterType, setFilterType] = useState<'all' | 'ocr' | 'nlp' | 'errors'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter((log) => {
    // Filter type
    if (filterType === 'ocr' && log.feature !== 'ocr') return false;
    if (filterType === 'nlp' && log.feature !== 'nlp') return false;
    if (filterType === 'errors' && log.status !== 'error' && log.status !== 'fallback') return false;

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matchEmail = log.userEmail?.toLowerCase().includes(q);
      const matchUid = log.uid.toLowerCase().includes(q);
      const matchModel = log.model.toLowerCase().includes(q);
      const matchError = log.errorMsg?.toLowerCase().includes(q);
      return matchEmail || matchUid || matchModel || matchError;
    }

    return true;
  });

  const successRate =
    summary.totalCalls > 0
      ? Math.round((summary.successCount / summary.totalCalls) * 100)
      : 100;

  // Rough estimation: Gemini 3.5 Flash Lite is ~$0.075 per 1M input tokens, ~$0.30 per 1M output tokens (~$0.15/1M avg)
  const estimatedUsd = ((summary.totalTokens / 1_000_000) * 0.15).toFixed(4);

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total AI Calls */}
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800/80 shadow-md backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Total AI Calls</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cpu size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-100 mb-1">{summary.totalCalls.toLocaleString()}</div>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <FileText size={12} /> {summary.ocrCalls} OCR
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-indigo-400">
              <MessageSquare size={12} /> {summary.nlpCalls} NLP
            </span>
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800/80 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Success Rate</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-100 mb-1">{successRate}%</div>
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span className="text-emerald-400">{summary.successCount} ok</span>
            <span>•</span>
            <span className="text-amber-400">{summary.fallbackCount} fallback</span>
            <span>•</span>
            <span className="text-rose-400">{summary.errorCount} fail</span>
          </div>
        </div>

        {/* Card 3: Avg Duration */}
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800/80 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Avg Latency</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-100 mb-1">
            {summary.avgDurationMs > 1000
              ? `${(summary.avgDurationMs / 1000).toFixed(2)}s`
              : `${summary.avgDurationMs}ms`}
          </div>
          <div className="text-xs text-stone-400">Durasi respons Gemini</div>
        </div>

        {/* Card 4: Tokens & Est. Cost */}
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800/80 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Est. Tokens & Cost</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-100 mb-1">
            {summary.totalTokens > 0 ? summary.totalTokens.toLocaleString() : '0'}
          </div>
          <div className="text-xs text-stone-400">~${estimatedUsd} USD</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-stone-900/40 border border-stone-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-stone-100 text-stone-900 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            Semua ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('ocr')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'ocr'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            OCR Struk ({summary.ocrCalls})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('nlp')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'nlp'
                ? 'bg-indigo-500 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            NLP Teks ({summary.nlpCalls})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('errors')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'errors'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            Masalah / Fallback ({summary.fallbackCount + summary.errorCount})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari user, model, atau error..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-950/80 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/90 border-b border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Fitur</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Durasi</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    Memuat log telemetri...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    Tidak ada riwayat panggilan AI yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-stone-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-stone-400">{dateStr}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-200 truncate max-w-[140px]" title={log.userEmail || log.uid}>
                          {log.userEmail || log.uid.slice(0, 8) + '...'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[10px] ${
                            log.feature === 'ocr'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {log.feature === 'ocr' ? 'OCR Struk' : 'NLP Asisten'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-400">{log.model}</td>
                      <td className="py-3 px-4 font-mono text-stone-300">
                        {log.durationMs > 1000 ? `${(log.durationMs / 1000).toFixed(2)}s` : `${log.durationMs}ms`}
                      </td>
                      <td className="py-3 px-4">
                        {log.status === 'success' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 size={13} /> Sukses
                          </span>
                        )}
                        {log.status === 'fallback' && (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <AlertTriangle size={13} /> Fallback
                          </span>
                        )}
                        {log.status === 'error' && (
                          <span className="inline-flex items-center gap-1 text-rose-400">
                            <XCircle size={13} /> Gagal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-400 truncate max-w-[200px]" title={log.errorMsg || ''}>
                        {log.tokensUsed?.totalTokens ? `${log.tokensUsed.totalTokens} tokens` : log.errorMsg || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
