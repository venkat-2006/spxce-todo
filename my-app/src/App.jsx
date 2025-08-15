import { useEffect, useMemo, useState } from 'react';
import { api, getToken, clearToken } from './api';

function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'signin') await api.signin(email, password);
      else await api.signup(email, password);
      onAuthed();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>{mode === 'signin' ? 'Sign in' : 'Sign up'}</h2>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)}
               style={{ width: '100%', padding: 10, marginBottom: 10 }} required />
        <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)}
               style={{ width: '100%', padding: 10, marginBottom: 10 }} required />
        <button type="submit" style={{ width: '100%', padding: 10 }}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        {mode === 'signin' ? (
          <span>No account? <button onClick={() => setMode('signup')}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>Sign up</button></span>
        ) : (
          <span>Have an account? <button onClick={() => setMode('signin')}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>Sign in</button></span>
        )}
      </div>
      {err && <div style={{ color: 'crimson', marginTop: 10 }}>{err}</div>}
    </div>
  );
}

function TodoApp({ onLogout }) {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const completedCount = useMemo(() => todos.filter(t => t.completed).length, [todos]);

  useEffect(() => {
    let ignore = false;
    api.getTodos()
      .then(data => { if (!ignore) setTodos(data); })
      .catch(e => setErr(e.message));
    return () => { ignore = true; };
  }, []);

  async function add(e) {
    e.preventDefault();
    setErr('');
    if (!text.trim()) return;
    try {
      const todo = await api.addTodo(text.trim());
      setTodos(prev => [todo, ...prev]);
      setText('');
    } catch (e) {
      setErr(e.message);
    }
  }

  async function toggle(todo) {
    setErr('');
    try {
      const updated = await api.toggleTodo(todo.id, !todo.completed);
      setTodos(prev => prev.map(t => (t.id === todo.id ? updated : t)));
    } catch (e) {
      setErr(e.message);
    }
  }

  async function remove(id) {
    setErr('');
    try {
      await api.deleteTodo(id);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Todos</h2>
        <button onClick={onLogout}>Logout</button>
      </div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="New todo" value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, padding: 10 }} />
        <button type="submit">Add</button>
      </form>
      {err && <div style={{ color: 'crimson', marginBottom: 10 }}>{err}</div>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {todos.map(todo => (
          <li key={todo.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <input type="checkbox" checked={todo.completed} onChange={() => toggle(todo)} />
            <span style={{ marginLeft: 8, flex: 1, textDecoration: todo.completed ? 'line-through' : 'none' }}>{todo.text}</span>
            <button onClick={() => remove(todo.id)} style={{ color: 'crimson' }}>Delete</button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 10, fontSize: 13, color: '#555' }}>
        {completedCount}/{todos.length} completed
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  return authed
    ? <TodoApp onLogout={() => { clearToken(); setAuthed(false); }} />
    : <AuthForm onAuthed={() => setAuthed(true)} />;
}