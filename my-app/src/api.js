const BASE_URL = '/api';

export function getToken() {
  return localStorage.getItem('token') || '';
}
export function setToken(token) {
  if (token) localStorage.setItem('token', token);
}
export function clearToken() {
  localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  signup(email, password) {
    return request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
      .then(res => { setToken(res.token); return res; });
  },
  signin(email, password) {
    return request('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) })
      .then(res => { setToken(res.token); return res; });
  },
  getTodos() { return request('/todos'); },
  addTodo(text) { return request('/todos', { method: 'POST', body: JSON.stringify({ text }) }); },
  toggleTodo(id, completed) { return request(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ completed }) }); },
  updateTodo(id, text) { return request(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }); },
  deleteTodo(id) { return request(`/todos/${id}`, { method: 'DELETE' }); },
};