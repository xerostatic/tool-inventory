// TOOL INVENTORY - COMPLETE REACT APP WITH SUPABASE
// This is the main App.jsx file - copy this entire thing

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Download, Search, Package, LogOut, UserCircle } from 'lucide-react';

// ============================================
// CONFIGURATION - YOU'LL UPDATE THIS LATER
// ============================================
const SUPABASE_URL = 'https://likyqatbjazcuchfbega.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpa3lxYXRiamF6Y3VjaGZiZWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMDgwODUsImV4cCI6MjA3NzU4NDA4NX0.sGSHxVdjHdh153ghEAqe5y2UIPkxyumUo1jal3RpGf0';

// Simple Supabase client with Auth
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  getAuthHeaders() {
    const token = localStorage.getItem('supabase_token');
    return {
      ...this.headers,
      'Authorization': `Bearer ${token || this.key}`
    };
  }

  async fetch(endpoint, options = {}) {
    const response = await fetch(`${this.url}/rest/v1/${endpoint}`, {
      ...options,
      headers: { ...this.getAuthHeaders(), ...options.headers }
    });
    if (!response.ok) throw new Error(`Error: ${response.statusText}`);
    return response.json();
  }

  async authFetch(endpoint, options = {}) {
    const response = await fetch(`${this.url}/auth/v1/${endpoint}`, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || data.message || 'Authentication error');
    return data;
  }

  async signUp(email, password) {
    return this.authFetch('signup', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async signIn(email, password) {
    const data = await this.authFetch('token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.access_token) {
      localStorage.setItem('supabase_token', data.access_token);
      localStorage.setItem('supabase_user', JSON.stringify(data.user));
    }
    return data;
  }

  async signOut() {
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_user');
  }

  getUser() {
    const user = localStorage.getItem('supabase_user');
    return user ? JSON.parse(user) : null;
  }

  async select(table) {
    return this.fetch(`${table}?select=*&order=id.desc`);
  }

  async insert(table, data) {
    return this.fetch(table, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async delete(table, id) {
    return this.fetch(`${table}?id=eq.${id}`, {
      method: 'DELETE'
    });
  }
}

// ============================================
// AUTH COMPONENT
// ============================================
function AuthScreen({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') return null;
    return new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await supabase.signUp(email, password);
        setError('Success! Check your email to verify your account, then sign in.');
        setIsSignUp(false);
      } else {
        await supabase.signIn(email, password);
        onLogin();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-6">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Package className="w-16 h-16 mx-auto mb-4 text-blue-500" />
          <h1 className="text-3xl font-bold text-white mb-2">Tool Inventory</h1>
          <p className="text-gray-400">Sign in to access your collection</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className={`p-3 rounded-lg text-sm ${
              error.includes('Success') ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="w-full text-gray-400 hover:text-white text-sm transition"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function ToolInventory() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Diagnostic Equipment',
    brand: 'Snap-On',
    description: '',
    quantity: 1,
    condition: 'Good',
    estimated_value: '',
    notes: ''
  });

  const categories = [
    'Diagnostic Equipment', 'Toolboxes/Storage', 'Sockets & Drives', 'Wrenches',
    'Power Tools', 'Specialty Tools', 'Hand Tools', 'Air Tools', 'Measuring Tools', 'Other'
  ];

  const brands = [
    'Snap-On', 'Mac', 'Matco', 'Craftsman', 'Milwaukee', 'DeWalt', 'Autel',
    'Masterforce', 'Harbor Freight', 'Other'
  ];

  const conditions = ['New', 'Excellent', 'Good', 'Fair', 'Poor'];

  const supabase = useMemo(() => {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') return null;
    return new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (token) {
      setIsAuthenticated(true);
    } else {
      setLoading(false);
    }
  }, []);

  // Load items only after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to ensure token is fully ready
      const timer = setTimeout(() => {
        loadItems();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loadItems]);

  const saveToLocalStorage = useCallback((newItems) => {
    try {
      localStorage.setItem('toolInventory', JSON.stringify(newItems));
    } catch (e) {
      console.error('LocalStorage save failed:', e);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!supabase) {
        const stored = localStorage.getItem('toolInventory');
        setItems(stored ? JSON.parse(stored) : []);
      } else {
        try {
          const data = await supabase.select('tools');
          setItems(data);
        } catch (fetchError) {
          console.error('Error fetching from Supabase:', fetchError);
          // Don't show error on initial load, just use empty array
          setItems([]);
        }
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isAuthenticated) {
      loadItems();
    }
  }, [isAuthenticated, loadItems]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.signOut();
    }
    setIsAuthenticated(false);
    setItems([]);
  };

  const addItem = async () => {
    if (!formData.description || !formData.estimated_value) {
      alert('Please fill in description and estimated value');
      return;
    }

    const newItem = {
      ...formData,
      estimated_value: parseFloat(formData.estimated_value),
      quantity: parseInt(formData.quantity),
      created_at: new Date().toISOString()
    };

    try {
      if (!supabase) {
        const itemWithId = { ...newItem, id: Date.now() };
        const newItems = [...items, itemWithId];
        setItems(newItems);
        saveToLocalStorage(newItems);
      } else {
        const [inserted] = await supabase.insert('tools', newItem);
        setItems([inserted, ...items]);
      }

      setFormData({
        category: 'Diagnostic Equipment',
        brand: 'Snap-On',
        description: '',
        quantity: 1,
        condition: 'Good',
        estimated_value: '',
        notes: ''
      });
      setShowForm(false);
    } catch (err) {
      console.error('Error adding item:', err);
      alert('Failed to add item: ' + err.message);
    }
  };

  const deleteItem = async (id) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Delete this item?')) return;

    try {
      if (!supabase) {
        const newItems = items.filter(item => item.id !== id);
        setItems(newItems);
        saveToLocalStorage(newItems);
      } else {
        await supabase.delete('tools', id);
        setItems(items.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item: ' + err.message);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      const matchesSearch = 
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, filterCategory, searchTerm]);

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.estimated_value * item.quantity), 0);
  }, [items]);

  const filteredValue = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.estimated_value * item.quantity), 0);
  }, [filteredItems]);

  const categoryTotals = useMemo(() => {
    const totals = {};
    items.forEach(item => {
      if (!totals[item.category]) totals[item.category] = 0;
      totals[item.category] += item.estimated_value * item.quantity;
    });
    return totals;
  }, [items]);

  const exportToCSV = () => {
    const headers = ['Category', 'Brand', 'Description', 'Quantity', 'Condition', 'Unit Value', 'Total Value', 'Notes'];
    const rows = items.map(item => [
      item.category,
      item.brand,
      item.description,
      item.quantity,
      item.condition,
      item.estimated_value,
      item.estimated_value * item.quantity,
      item.notes || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getConditionColor = (condition) => {
    const colors = {
      'New': 'bg-green-900 text-green-200',
      'Excellent': 'bg-blue-900 text-blue-200',
      'Good': 'bg-yellow-900 text-yellow-200',
      'Fair': 'bg-orange-900 text-orange-200',
      'Poor': 'bg-red-900 text-red-200'
    };
    return colors[condition] || 'bg-gray-900 text-gray-200';
  };

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center text-white">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-xl">Loading your tools...</p>
        </div>
      </div>
    );
  }

  const user = supabase?.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-6 mb-6">
          {error && (
            <div className="mb-4 p-3 bg-yellow-900 text-yellow-200 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Package className="w-8 h-8" />
                Tool Inventory & Valuation
              </h1>
              <p className="text-gray-400 mt-2">Professional automotive tool collection tracker</p>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <UserCircle className="w-4 h-4" />
                  {user.email}
                </div>
              )}
              <button
                onClick={exportToCSV}
                disabled={items.length === 0}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4">
              <div className="text-blue-200 text-sm font-medium">Total Items</div>
              <div className="text-3xl font-bold mt-1">{items.length}</div>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4">
              <div className="text-green-200 text-sm font-medium">Total Value</div>
              <div className="text-3xl font-bold mt-1">${totalValue.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4">
              <div className="text-purple-200 text-sm font-medium">Filtered Value</div>
              <div className="text-3xl font-bold mt-1">${filteredValue.toLocaleString()}</div>
            </div>
          </div>

          {Object.keys(categoryTotals).length > 0 && (
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3">Value by Category</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, value]) => (
                    <div key={category} className="bg-gray-600 rounded p-3">
                      <div className="text-xs text-gray-300">{category}</div>
                      <div className="text-lg font-bold">${value.toLocaleString()}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Item
            </button>
          </div>

          {showForm && (
            <div className="bg-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Add New Tool/Equipment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Brand</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({...formData, brand: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="e.g., 1/2 drive socket set 10-32mm"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    min="1"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({...formData, condition: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {conditions.map(cond => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Estimated Value (per unit)</label>
                  <input
                    type="number"
                    value={formData.estimated_value}
                    onChange={(e) => setFormData({...formData, estimated_value: e.target.value})}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Model number, condition details, etc."
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={addItem}
                  className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition font-medium"
                >
                  Add Item
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Brand</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Condition</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Unit Value</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Notes</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg">
                        {items.length === 0 
                          ? 'No items yet. Click "Add Item" to start building your inventory.'
                          : 'No items match your search.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3 text-sm">{item.category}</td>
                      <td className="px-4 py-3 text-sm font-medium">{item.brand}</td>
                      <td className="px-4 py-3 text-sm">{item.description}</td>
                      <td className="px-4 py-3 text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getConditionColor(item.condition)}`}>
                          {item.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">${item.estimated_value.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-400">
                        ${(item.estimated_value * item.quantity).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{item.notes || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}