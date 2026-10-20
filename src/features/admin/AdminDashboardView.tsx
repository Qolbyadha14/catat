import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  ShieldCheck,
  Activity,
  Users,
  Sliders,
  ArrowLeft,
} from 'lucide-react';

import {
  type AiLogEntry,
  subscribeAiLogs,
  calculateTelemetrySummary,
} from '../../lib/telemetry/telemetryService';
import {
  type SystemConfig,
  DEFAULT_SYSTEM_CONFIG,
  subscribeSystemConfig,
} from '../../lib/config/systemConfigService';
import { AiTelemetryTab } from './AiTelemetryTab';
import { UsersLedgersTab } from './UsersLedgersTab';
import { SystemControlsTab } from './SystemControlsTab';

interface AdminDashboardViewProps {
  user: User;
  onBackToApp: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ user, onBackToApp }) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'users' | 'controls'>('telemetry');
  const [logs, setLogs] = useState<AiLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);

  useEffect(() => {
    // 1. Subscribe to live AI telemetry logs
    const unsubLogs = subscribeAiLogs((newLogs) => {
      setLogs(newLogs);
      setLogsLoading(false);
    }, 150);

    // 2. Subscribe to dynamic system config
    const unsubConfig = subscribeSystemConfig((newConfig) => {
      setConfig(newConfig);
    });

    return () => {
      unsubLogs();
      unsubConfig();
    };
  }, []);

  const summary = calculateTelemetrySummary(logs);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Admin Header Bar */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToApp}
              className="p-1.5 -ml-1.5 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"
              title="Kembali ke Aplikasi Utama"
              aria-label="Kembali ke Catat"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span>Catat Super Admin Hub</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-stone-800 text-emerald-400 border border-stone-700">
                    Live
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 truncate max-w-[200px] sm:max-w-none">
                  Logged in as <strong className="text-stone-200">{user.email || user.displayName || user.uid}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* System Status Pill */}
          <div className="flex items-center gap-2">
            {config.aiKillSwitch ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                AI Suspended
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                System Normal
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-stone-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'telemetry'
                ? 'bg-stone-800 text-emerald-400 border border-stone-700 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Activity size={15} />
            <span>AI Telemetry & Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-stone-800 text-emerald-400 border border-stone-700 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Users size={15} />
            <span>Direktori Pengguna & Buku Kas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'controls'
                ? 'bg-stone-800 text-emerald-400 border border-stone-700 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Sliders size={15} />
            <span>Kontrol Sistem Dinamis</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'telemetry' && (
          <AiTelemetryTab logs={logs} summary={summary} loading={logsLoading} />
        )}

        {activeTab === 'users' && (
          <UsersLedgersTab dailyLimit={config.dailyOcrLimit || 20} />
        )}

        {activeTab === 'controls' && (
          <SystemControlsTab config={config} adminUid={user.uid} />
        )}
      </main>
    </div>
  );
};
