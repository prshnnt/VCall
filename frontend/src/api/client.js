const TOKEN_KEY = 'calling_app_token';
const USER_KEY = 'calling_app_user';

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  authGoogle: (token, display_name) =>
    request('/auth/google', { method: 'POST', body: { token, display_name }, auth: false }),
  claimUserId: (user_id) =>
    request('/auth/claim-id', { method: 'POST', body: { user_id } }),
  me: () => request('/users/me'),
  lookupUser: (user_id) => request(`/users/${encodeURIComponent(user_id)}`),
  callHistory: () => request('/calls/history'),
  threads: () => request('/messages/threads'),
  thread: (peerId) => request(`/messages/${encodeURIComponent(peerId)}`),
  sendMessage: (to, body) => request('/messages', { method: 'POST', body: { to, body } }),
  pushPublicKey: () => request('/push/public-key'),
  pushSubscribe: (subscription) => request('/push/subscribe', { method: 'POST', body: subscription }),
  pushUnsubscribe: (endpoint) => request('/push/unsubscribe', { method: 'POST', body: { endpoint } }),
  
  // Contacts API
  addContact: (contact_user_id, contact_name) => 
    request('/contacts', { method: 'POST', body: { contact_user_id, contact_name } }),
  getContacts: () => request('/contacts'),
  removeContact: (contact_user_id) => 
    request(`/contacts/${encodeURIComponent(contact_user_id)}`, { method: 'DELETE' }),
};

