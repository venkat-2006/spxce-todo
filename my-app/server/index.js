const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 4000;
const JWT_SECRET = 'dev-secret-change-me';

// ... existing code ...

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Add this line
app.get('/', (req, res) => {
  res.json({ message: 'TodoSpace API is running!', endpoints: ['/auth/signup', '/auth/signin', '/todos'] });
});

// ... existing code ...

// In-memory data
const users = []; // { id, email, passwordHash }
const todosByUserId = new Map(); // userId -> [ { id, text, completed } ]
let nextUserId = 1;
let nextTodoId = 1;

// Helpers
function createToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return _res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return _res.status(401).json({ error: 'Invalid token' });
  }
}

// Auth
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: String(nextUserId++), email, passwordHash };
  users.push(user);
  todosByUserId.set(user.id, []);

  const token = createToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post('/auth/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = createToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Todos
app.get('/todos', auth, (req, res) => {
  const todos = todosByUserId.get(req.userId) || [];
  res.json(todos);
});

app.post('/todos', auth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });

  const todos = todosByUserId.get(req.userId) || [];
  const todo = { id: String(nextTodoId++), text: text.trim(), completed: false };
  todos.unshift(todo);
  todosByUserId.set(req.userId, todos);
  res.status(201).json(todo);
});

app.patch('/todos/:id', auth, (req, res) => {
  const { id } = req.params;
  const { text, completed } = req.body || {};
  const todos = todosByUserId.get(req.userId) || [];
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  if (typeof text === 'string') todos[idx].text = text.trim();
  if (typeof completed === 'boolean') todos[idx].completed = completed;

  res.json(todos[idx]);
});

app.delete('/todos/:id', auth, (req, res) => {
  const { id } = req.params;
  const todos = todosByUserId.get(req.userId) || [];
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = todos.splice(idx, 1);
  res.json(removed);
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});