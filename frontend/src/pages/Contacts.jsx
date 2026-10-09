import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [newContactId, setNewContactId] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      const data = await api.getContacts();
      setContacts(data);
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newContactId) return;
    try {
      await api.addContact(newContactId, newContactName);
      setNewContactId('');
      setNewContactName('');
      await fetchContacts();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRemove(id) {
    try {
      await api.removeContact(id);
      await fetchContacts();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-muted">Loading contacts...</div>;

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-semibold mb-6 px-2 text-white">Contacts</h2>
      
      <div className="glass-panel p-4 space-y-3">
        <div className="text-sm font-medium text-muted mb-2">Add New Contact</div>
        <div className="flex flex-col gap-2">
          <input 
            className="modern-input" 
            placeholder="Call ID / Number" 
            value={newContactId} 
            onChange={e => setNewContactId(e.target.value)} 
          />
          <input 
            className="modern-input" 
            placeholder="Display Name (Optional)" 
            value={newContactName} 
            onChange={e => setNewContactName(e.target.value)} 
          />
          <button 
            onClick={handleAdd}
            className="touch-btn touch-btn-primary py-3"
          >
            Save Contact
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {contacts.length === 0 ? (
          <div className="text-center py-12 text-muted">No saved contacts.</div>
        ) : (
          contacts.map((c, i) => (
            <div key={i} className="glass-panel p-4 flex items-center justify-between transition-all active:scale-[0.98]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white font-bold border border-white/10">
                  {(c.contact_name || c.contact_user_id)[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-white">{c.contact_name || c.contact_user_id}</div>
                  <div className="text-xs text-muted">{c.contact_user_id}</div>
                </div>
              </div>
              <button 
                onClick={() => handleRemove(c.contact_user_id)}
                className="text-xs text-danger hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
