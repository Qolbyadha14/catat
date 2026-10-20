import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
  activeTab?: string;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex justify-center selection:bg-blue-600 selection:text-white antialiased">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl min-h-screen bg-white sm:shadow-xs sm:border-x sm:border-slate-200/60 flex flex-col relative pb-28">
        <main className="flex-1 flex flex-col relative">
          {children}
        </main>
      </div>
    </div>
  );
};
