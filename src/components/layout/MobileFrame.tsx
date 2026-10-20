import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Wifi, Battery, Volume2, VolumeX } from 'lucide-react';
import { playHapticSound } from '../../lib/haptic';

interface MobileFrameProps {
  children: React.ReactNode;
  activeTab?: string;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center justify-start sm:p-4 md:p-6 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Top Controls Header for Desktop Preview */}
      <header className="w-full max-w-5xl py-2 px-4 mb-2 hidden sm:flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-200">Catat Coreboy</span>
          <span className="text-slate-500">• Catat Keuangan Pribadi & Kas Keluarga</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playHapticSound('click');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
            title="Suara Efek Haptic"
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{soundEnabled ? 'Suara Aktif' : 'Senyap'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPhoneFrame(!isPhoneFrame);
              playHapticSound('click');
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 cursor-pointer"
          >
            {isPhoneFrame ? (
              <>
                <Monitor size={13} />
                <span>Layar Penuh</span>
              </>
            ) : (
              <>
                <Smartphone size={13} />
                <span>Mode Mockup HP</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container: Either Phone Shell or Full Responsive Layout */}
      <div
        className={`w-full transition-all duration-300 relative flex flex-col justify-start ${
          isPhoneFrame
            ? 'max-w-[420px] min-h-[880px] my-auto bg-[#f8fafc] text-slate-800 rounded-[44px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_12px_#1e293b,0_0_0_14px_#334155] border border-slate-700/60 overflow-hidden'
            : 'max-w-md w-full bg-[#f8fafc] text-slate-800 min-h-screen sm:rounded-2xl sm:shadow-2xl overflow-hidden'
        }`}
      >
        {/* Mobile Phone Status Bar */}
        <div className="sticky top-0 z-40 bg-[#f8fafc]/90 backdrop-blur-md px-6 pt-3 pb-1 flex items-center justify-between text-slate-800 select-none">
          <span className="text-[13px] font-bold tracking-tight pl-1">{currentTime}</span>

          {/* Notch / Speaker hole indicator */}
          <div className="h-4 w-24 bg-slate-900 rounded-full mx-auto flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-800 mr-2" />
            <div className="w-8 h-1 bg-slate-800 rounded-full" />
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 pr-1">
            <Wifi size={13} strokeWidth={2.5} />
            <div className="text-[10px] font-bold">5G</div>
            <Battery size={15} strokeWidth={2.5} className="fill-slate-800" />
          </div>
        </div>

        {/* Inner Content Area */}
        <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden pb-24">
          {children}
        </main>

        {/* Mobile Bottom Home Bar indicator */}
        <div className="fixed bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-300 rounded-full z-50 pointer-events-none opacity-60" />
      </div>
    </div>
  );
};
