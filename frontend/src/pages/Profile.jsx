import React from 'react';
import { api } from '../api/client';

export default function Profile() {
  // We can't use a hook here easily without a context, but for a basic view:
  // In a real app, this would come from a UserContext.
  const user = JSON.parse(localStorage.getItem('calling_app_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('calling_app_token');
    localStorage.removeItem('calling_app_user');
    window.location.href = '/login';
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold mb-6 px-2 text-white">My Profile</h2>
      
      <div className="glass-panel p-6 flex flex-col items-center text-center space-y-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl text-white font-bold shadow-xl">
          {user.display_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <div className="text-xl font-semibold text-white">{user.display_name || 'User'}</div>
          <div className="text-sm text-muted">@{user.user_id || 'not_set'}</div>
        </div>
      </div>

      <div className="glass-panel p-4 space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <span className="text-sm text-muted">Account Status</span>
          <span className="text-sm text-success font-medium">Verified</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <span className="text-sm text-muted">App Version</span>
          <span className="text-sm text-white font-medium">2.0.0-premium</span>
        </div>
      </div>

      <button 
        onClick={handleLogout}
        className="w-full touch-btn touch-btn-danger py-4"
      >
        Logout
      </button>
    </div>
  );
}
