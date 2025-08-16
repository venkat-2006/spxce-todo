import React, { useState } from 'react';
import './App.css';

function App() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);

  const API_BASE = 'http://localhost:4000';

  const fetchTodos = async (authToken) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/todos`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch todos');
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/auth/signin' : '/auth/signup';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Authentication failed');
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      setEmail('');
      setPassword('');
      fetchTodos(data.token);
    } catch (err) {
      alert(err.message);
    }
  };

  const addTodo = async () => {
    if (!inputValue.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: inputValue.trim() }),
      });
      if (!res.ok) throw new Error('Error adding todo');
      const newTodo = await res.json();
      setTodos((prev) => [newTodo, ...prev]);
      setInputValue('');
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTodo = async (id, completed) => {
    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: !completed }),
      });
      if (!res.ok) throw new Error('Error updating todo');
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, completed: !completed } : todo
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTodo = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/todos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error deleting todo');
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setTodos([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🚀 TodoSpace</h1>
            <p className="text-gray-300">
              Navigate your missions through the stellar void
            </p>
          </div>
          <form onSubmit={handleAuth} className="space-y-6 login-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              required
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-8 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700"
            >
              {isLogin ? '🚀 Launch' : '⭐ Join the Quest'}
            </button>
          </form>
          <div className="text-center mt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-400 hover:text-white"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-4xl mx-auto text-center w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">🚀 TodoSpace</h1>
          <p className="text-gray-300 text-lg mb-2">
            Welcome back, Commander {user?.name || user?.email}!
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-gray-400">
              {todos.filter((t) => t.completed).length} of {todos.length} missions
              completed
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-8 border border-white/20">
          <div className="flex gap-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your next cosmic mission..."
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            />
            <button
              onClick={addTodo}
              disabled={!inputValue.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
            >
              🚀 Launch
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-gray-400">Loading your missions...</p>
        ) : todos.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-12 text-center border border-white/20">
            <div className="text-6xl mb-4">⭐</div>
            <p className="text-gray-300 text-xl mb-2">No cosmic missions yet</p>
            <p className="text-gray-400">
              Add your first task to begin your stellar journey
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20 transition-all hover:bg-white/15 todo-item ${
                  todo.completed ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      todo.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-white/30 hover:border-green-400'
                    }`}
                  >
                    {todo.completed && '✓'}
                  </button>
                  <div className="flex-1 text-left">
                    <p
                      className={
                        todo.completed
                          ? 'line-through text-gray-400'
                          : 'text-white'
                      }
                    >
                      {todo.text}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Mission ID: {todo.id}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {todos.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mt-8 text-center border border-white/20">
            <p className="text-gray-300 mb-4">Mission Progress</p>
            <div className="w-full bg-white/20 rounded-full h-3 mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full progress-bar"
                style={{
                  width: `${
                    (todos.filter((t) => t.completed).length / todos.length) *
                    100
                  }%`,
                }}
              />
            </div>
            <p className="text-white font-medium">
              {Math.round(
                (todos.filter((t) => t.completed).length / todos.length) * 100
              )}
              % Complete
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;