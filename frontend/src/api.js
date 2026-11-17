// Thin fetch wrapper. Each browser gets a random anonymous id so the server
// can keep its sessions and results separate from everyone else's.
const KEY = 'notary.clientId';

function clientId() {
  let id = null;
  try { id = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (!id) {
    // randomUUID needs a secure context (https/localhost); fall back otherwise.
    id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(KEY, id); } catch { /* keep for this page only */ }
  }
  return id;
}
const CLIENT_ID = clientId();

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-client-id': CLIENT_ID },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  states: () => request('GET', '/states'),
  startSession: (payload) => request('POST', '/sessions', payload),
  getSession: (id) => request('GET', `/sessions/${id}`),
  answer: (id, questionId, optionId) => request('POST', `/sessions/${id}/answers`, { questionId, optionId }),
  submit: (id) => request('POST', `/sessions/${id}/submit`),
  results: () => request('GET', '/results'),
  result: (id) => request('GET', `/results/${id}`),
  deleteResult: (id) => request('DELETE', `/results/${id}`),
};
