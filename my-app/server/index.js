require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000; // Changed from 4000 to 3000 to match your frontend
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/todoSpace';

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,      // This does nothing in v4+ but won't break anything
      useUnifiedTopology: true,   // This does nothing in v4+ but won't break anything
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    console.log('Falling back to in-memory storage');
    return false;
  }
  return true;
};

// MongoDB Models
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const todoSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
const Todo = mongoose.model('Todo', todoSchema);

// Connect to MongoDB
let isMongoConnected = false;
connectDB().then(connected => {
  isMongoConnected = connected;
});

// Fallback in-memory storage (existing code)
const users = []; // { id, email, passwordHash }
const todosByUserId = new Map(); // userId -> [ { id, text, completed } ]
let nextUserId = 1;
let nextTodoId = 1;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'TodoSpace API is running!', 
    database: isMongoConnected ? 'MongoDB' : 'In-Memory',
    endpoints: ['/auth/signup', '/auth/signin', '/todos'] 
  });
});

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

// Auth Routes
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    if (isMongoConnected) {
      // MongoDB implementation
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(409).json({ error: 'Email already in use' });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = new User({ email, passwordHash });
      await user.save();

      const token = createToken(user._id.toString());
      res.json({ token, user: { id: user._id.toString(), email: user.email } });
    } else {
      // Fallback to in-memory storage
      if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already in use' });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = { id: String(nextUserId++), email, passwordHash };
      users.push(user);
      todosByUserId.set(user.id, []);

      const token = createToken(user.id);
      res.json({ token, user: { id: user.id, email: user.email } });
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/debug/db', async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.json({ 
        error: 'MongoDB not connected', 
        fallback: 'Using in-memory storage',
        solution: 'Check your MONGODB_URI in .env file'
      });
    }

    const dbName = mongoose.connection.name;
    let collections = [];
    let collectionNames = [];
    
    try {
      // Try to get collections, but handle empty database
      const db = mongoose.connection.db;
      collections = await db.listCollections().toArray();
      collectionNames = collections.map(c => c.name);
    } catch (listError) {
      console.log('No collections found or database is empty:', listError.message);
      collections = [];
      collectionNames = [];
    }
    
    // Get document counts (these will be 0 if collections don't exist)
    let userCount = 0;
    let todoCount = 0;
    let sampleUsers = [];
    let sampleTodos = [];
    
    try {
      userCount = await User.countDocuments();
      todoCount = await Todo.countDocuments();
      
      if (userCount > 0) {
        sampleUsers = await User.find({}).limit(3).select('email createdAt');
      }
      if (todoCount > 0) {
        sampleTodos = await Todo.find({}).limit(3).select('text completed userId createdAt');
      }
    } catch (countError) {
      console.log('Error counting documents:', countError.message);
    }
    
    const response = {
      status: 'Connected to MongoDB',
      database: dbName,
      host: mongoose.connection.host,
      connectionString: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials
      collections: collectionNames,
      collectionsCount: collectionNames.length,
      counts: {
        users: userCount,
        todos: todoCount
      },
      samples: {
        users: sampleUsers,
        todos: sampleTodos
      }
    };
    
    // Add helpful message if database is empty
    if (collectionNames.length === 0) {
      response.message = 'Database is empty. Collections will be created when you sign up your first user.';
      response.nextSteps = [
        'POST /auth/signup to create your first user',
        'POST /auth/signin to get a token',
        'POST /todos to create your first todo'
      ];
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ 
      error: error.message,
      suggestion: 'Your database exists but is empty. Try creating a user first.',
      mongodbConnected: isMongoConnected,
      database: mongoose.connection.name || 'unknown'
    });
  }
});
app.post('/auth/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    if (isMongoConnected) {
      // MongoDB implementation
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const token = createToken(user._id.toString());
      res.json({ token, user: { id: user._id.toString(), email: user.email } });
    } else {
      // Fallback to in-memory storage
      const user = users.find(u => u.email === email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const token = createToken(user.id);
      res.json({ token, user: { id: user.id, email: user.email } });
    }
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Todo Routes
app.get('/todos', auth, async (req, res) => {
  try {
    if (isMongoConnected) {
      // MongoDB implementation
      const todos = await Todo.find({ userId: req.userId }).sort({ createdAt: -1 });
      // Convert to your expected format
      const formattedTodos = todos.map(todo => ({
        id: todo._id.toString(),
        text: todo.text,
        completed: todo.completed
      }));
      res.json(formattedTodos);
    } else {
      // Fallback to in-memory storage
      const todos = todosByUserId.get(req.userId) || [];
      res.json(todos);
    }
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/todos', auth, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });

  try {
    if (isMongoConnected) {
      // MongoDB implementation
      const todo = new Todo({
        text: text.trim(),
        userId: req.userId,
        completed: false
      });
      await todo.save();

      const formattedTodo = {
        id: todo._id.toString(),
        text: todo.text,
        completed: todo.completed
      };
      res.status(201).json(formattedTodo);
    } else {
      // Fallback to in-memory storage
      const todos = todosByUserId.get(req.userId) || [];
      const todo = { id: String(nextTodoId++), text: text.trim(), completed: false };
      todos.unshift(todo);
      todosByUserId.set(req.userId, todos);
      res.status(201).json(todo);
    }
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// FIXED: Single PATCH route that handles both text and completed updates
app.patch('/todos/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { text, completed } = req.body || {};

  try {
    if (isMongoConnected) {
      // MongoDB implementation
      const updateData = {};
      if (typeof text === 'string') updateData.text = text.trim();
      if (typeof completed === 'boolean') updateData.completed = completed;

      const todo = await Todo.findOneAndUpdate(
        { _id: id, userId: req.userId },
        updateData,
        { new: true }
      );

      if (!todo) return res.status(404).json({ error: 'Not found' });

      const formattedTodo = {
        id: todo._id.toString(),
        text: todo.text,
        completed: todo.completed
      };
      res.json(formattedTodo);
    } else {
      // Fallback to in-memory storage
      const todos = todosByUserId.get(req.userId) || [];
      const idx = todos.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });

      if (typeof text === 'string') todos[idx].text = text.trim();
      if (typeof completed === 'boolean') todos[idx].completed = completed;

      res.json(todos[idx]);
    }
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/todos/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    if (isMongoConnected) {
      // MongoDB implementation
      const todo = await Todo.findOneAndDelete({ _id: id, userId: req.userId });
      if (!todo) return res.status(404).json({ error: 'Not found' });

      const formattedTodo = {
        id: todo._id.toString(),
        text: todo.text,
        completed: todo.completed
      };
      res.json(formattedTodo);
    } else {
      // Fallback to in-memory storage
      const todos = todosByUserId.get(req.userId) || [];
      const idx = todos.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      const [removed] = todos.splice(idx, 1);
      res.json(removed);
    }
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Database: ${isMongoConnected ? 'MongoDB' : 'In-Memory (fallback)'}`);
});