import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { id: 'logs', label: 'Logs', icon: '🕒' },
  { id: 'contacts', label: 'Contacts', icon: '👥' },
  { id: 'dialpad', label: 'Dial', icon: '📞', isCenter: true },
  { id: 'chats', label: 'Chats', icon: '💬' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav({ activeTab, setActiveTab, hasNotification }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe-bottom pt-2">
      <div className="max-w-md mx-auto bg-[#16161a]/80 backdrop-blur-xl border border-white/10 rounded-3xl h-16 flex items-center justify-around px-2 relative shadow-2xl">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          
          if (tab.isCenter) {
            return (
              <div key={tab.id} className="relative -top-6">
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all duration-200 active:scale-90 ${
                    isActive 
                    ? 'bg-[#6366f1] text-white scale-110 shadow-[#6366f1]/40' 
                    : 'bg-[#1c1c22] text-white border border-white/10'
                  }`}
                >
                  {tab.icon}
                </button>
                <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[#6366f1]' : 'text-[#71717a]'
                }`}>
                  {tab.label}
                </span>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center w-16 h-full transition-all duration-200 active:scale-90"
            >
              <div className={`text-xl mb-1 transition-colors ${isActive ? 'text-[#6366f1]' : 'text-[#71717a]'}`}>
                {tab.icon}
              </div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-[#6366f1]' : 'text-[#71717a]'}`}>
                {tab.label}
              </span>
              {tab.id === 'chats' && hasNotification && (
                <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full border border-[#16161a]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
