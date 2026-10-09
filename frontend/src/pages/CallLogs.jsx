import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function CallLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const data = await api.callHistory();
        setLogs(data);
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-muted">Loading logs...</div>;
  if (logs.length === 0) return <div className="flex items-center justify-center h-full text-muted">No call history yet.</div>;

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-2xl font-semibold mb-6 px-2 text-white">Recent Calls</h2>
      {logs.map((log, i) => (
        <div key={i} className="glass-panel p-4 flex items-center justify-between transition-all active:scale-[0.98]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {log.peer[0].toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-white">{log.peer}</div>
              <div className="text-xs text-muted">
                {log.direction === 'incoming' ? 'Incoming' : 'Outgoing'} • {log.status}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted">
              {new Date(log.startedAt).toLocaleDateString()}
            </div>
            <div className="text-xs text-dim">
              {new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
