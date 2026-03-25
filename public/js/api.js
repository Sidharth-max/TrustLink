/**
 * public/js/api.js
 * Centralised fetch wrapper that talks to the backend REST API.
 * All methods are async and throw on non-2xx responses.
 */

const API = (() => {
  async function request(method, path, body, isFormData = false) {
    const opts = {
      method,
      credentials: 'same-origin',  // send session cookie
    };
    if (body) {
      if (isFormData) {
        opts.body = body;           // FormData — browser sets Content-Type
      } else {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
      }
    }

    const res = await fetch('/api' + path, opts);

    // Handle auth expiry
    if (res.status === 401) {
      throw new Error('Session expired — please log in');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  const get    = (path)        => request('GET',    path);
  const post   = (path, body)  => request('POST',   path, body);
  const put    = (path, body)  => request('PUT',    path, body);
  const patch  = (path, body)  => request('PATCH',  path, body);
  const del    = (path)        => request('DELETE', path);
  const upload = (path, fd)    => request('POST',   path, fd, true);

  return {
    // Auth
    login:  (email, password) => post('/agents/login', { email, password }),
    logout: ()                => post('/agents/logout'),
    me:     ()                => get('/agents/me'),

    // Agents (admin)
    agents:       () => get('/agents'),
    createAgent:  (d) => post('/agents', d),
    updateAgent:  (id, d) => put(`/agents/${id}`, d),
    deleteAgent:  (id) => del(`/agents/${id}`),

    // Contacts
    contacts: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get('/contacts' + (q ? '?' + q : ''));
    },
    contact:       (id) => get(`/contacts/${id}`),
    createContact: (d)  => post('/contacts', d),
    updateContact: (id, d) => put(`/contacts/${id}`, d),
    deleteContact: (id) => del(`/contacts/${id}`),
    importCSV:     (fd) => upload('/contacts/import/csv', fd),
    tags:          ()   => get('/contacts/tags'),

    // Conversations & Messages
    conversations: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get('/messages/conversations' + (q ? '?' + q : ''));
    },
    conversation:        (id, params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get(`/messages/conversations/${id}` + (q ? '?' + q : ''));
    },
    updateConversation:  (id, d) => put(`/messages/conversations/${id}`, d),
    sendMessage:         (d)     => post('/messages/send', d),
    scheduleMessage:     (d)     => post('/messages/schedule', d),

    // Broadcasts
    broadcasts:       () => get('/broadcasts'),
    broadcast:        (id) => get(`/broadcasts/${id}`),
    createBroadcast:  (d)  => post('/broadcasts', d),
    sendBroadcast:    (id, components = []) => post(`/broadcasts/${id}/send`, { components }),
    deleteBroadcast:  (id) => del(`/broadcasts/${id}`),

    // Analytics
    analyticsOverview:    () => get('/analytics/overview'),
    analyticsTimeline:    (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get('/analytics/timeline' + (q ? '?' + q : ''));
    },
    analyticsBroadcasts:  () => get('/analytics/broadcasts'),

    // Bot Flows
    flows:        () => get('/bot'),
    createFlow:   (d)  => post('/bot', d),
    updateFlow:   (id, d) => put(`/bot/${id}`, d),
    deleteFlow:   (id)    => del(`/bot/${id}`),
    toggleFlow:   (id)    => patch(`/bot/${id}/toggle`),
  };
})();
