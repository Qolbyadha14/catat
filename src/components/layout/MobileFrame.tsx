import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
  activeTab?: string;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex justify-center selection:bg-blue-600 selection:text-white antialiased w-full overflow-x-hidden">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl min-h-screen bg-white dark:bg-slate-900 sm:shadow-xs sm:border-x sm:border-slate-200/60 dark:sm:border-slate-800 flex flex-col relative pb-28 min-w-0 overflow-x-hidden">
        <main className="flex-1 flex flex-col relative w-full min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
