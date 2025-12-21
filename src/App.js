// TOOL INVENTORY - COMPLETE REACT APP WITH NEON POSTGRESQL BACKEND
// Multi-user app with image recognition powered by Google Cloud Vision

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Download, Search, Package, LogOut, UserCircle, Camera, Upload, Loader } from 'lucide-react';

// ============================================
// CONFIGURATION
// ============================================
const API_URL = '/api';

// ============================================
// API CLIENT
// ============================================
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...this.getAuthHeaders(), ...options.headers }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  }

  // Auth methods
  async register(email, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  }

  async logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // Tool methods
  async getTools() {
    return this.request('/tools');
  }

  async createTool(toolData) {
    return this.request('/tools', {
      method: 'POST',
      body: JSON.stringify(toolData)
    });
  }

  async updateTool(id, toolData) {
    return this.request(`/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toolData)
    });
  }

  async deleteTool(id) {
    return this.request(`/tools/${id}`, {
      method: 'DELETE'
    });
  }

  // Image recognition
  async recognizeTool(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${this.baseUrl}/recognize-tool`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Image recognition failed');
    }

    return data;
  }
}

// ============================================
// AUTH COMPONENT
// ============================================
function AuthScreen({ onLogin, api }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await api.register(email, password);
        setError('Success! Account created. Logging you in...');
        setTimeout(() => {
          onLogin();
        }, 1000);
      } else {
        await api.login(email, password);
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
// IMAGE UPLOAD COMPONENT
// ============================================
function ImageUploadModal({ isOpen, onClose, onRecognize, api }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setError('');
    } else {
      setError('Please select a valid image file');
    }
  };

  const handleRecognize = async () => {
    if (!selectedFile) return;

    setRecognizing(true);
    setError('');

    try {
      const result = await api.recognizeTool(selectedFile);
      onRecognize(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to recognize tool');
    } finally {
      setRecognizing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Upload Tool Image</h3>
        
        <div className="mb-4">
          <label className="block w-full">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition">
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-64 mx-auto mb-4 rounded" />
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-400">Click to select image</p>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 text-red-200 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleRecognize}
            disabled={!selectedFile || recognizing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition font-medium flex items-center justify-center gap-2"
          >
            {recognizing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                Recognize Tool
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function ToolInventory() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('tools'); // 'tools' or 'cars'
  const [items, setItems] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Diagnostic Equipment',
    brand: 'Snap-On',
    description: '',
    quantity: 1,
    condition: 'Good',
    estimated_value: '',
    notes: '',
    image_url: ''
  });
  const [carFormData, setCarFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    mileage: '',
    condition: 'Good',
    estimated_value: '',
    notes: '',
    image_url: ''
  });
  const [decodingVin, setDecodingVin] = useState(false);

  const categories = [
    'Diagnostic Equipment', 'Toolboxes/Storage', 'Sockets & Drives', 'Wrenches',
    'Power Tools', 'Specialty Tools', 'Hand Tools', 'Air Tools', 'Measuring Tools', 'Other'
  ];

  const brands = [
    'Snap-On', 'Mac', 'Matco', 'Craftsman', 'Milwaukee', 'DeWalt', 'Autel',
    'Masterforce', 'Harbor Freight', 'Tekton', 'SK', 'Williams', 'Kobalt', 
    'GearWrench', 'Ingersoll Rand', 'Icon', 'Other'
  ];

  const conditions = ['New', 'Excellent', 'Good', 'Fair', 'Poor'];

  const api = useMemo(() => new ApiClient(API_URL), []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTools();
      setItems(data);
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load tools. Make sure the backend server is running.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadCars = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/cars`, {
        headers: api.getAuthHeaders()
      });
      const data = await response.json();
      setCars(data);
    } catch (err) {
      console.error('Error loading cars:', err);
      setError('Failed to load cars.');
      setCars([]);
    }
  }, [api]);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    } else {
      setLoading(false);
    }
  }, []);

  // Load items only after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated) {
      loadItems();
      loadCars();
    }
  }, [isAuthenticated, loadItems, loadCars]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setItems([]);
  };

  const handleImageRecognition = (result) => {
    setFormData({
      ...formData,
      category: result.category || formData.category,
      brand: result.brand || formData.brand,
      description: result.description || formData.description,
      estimated_value: result.estimated_value || formData.estimated_value,
      image_url: result.image_url || ''
    });
    setShowForm(true);
  };

  const addItem = async () => {
    if (!formData.description || !formData.estimated_value) {
      alert('Please fill in description and estimated value');
      return;
    }

    const newItem = {
      category: formData.category,
      brand: formData.brand,
      description: formData.description,
      quantity: parseInt(formData.quantity),
      condition: formData.condition,
      estimated_value: parseFloat(formData.estimated_value),
      notes: formData.notes || '',
      image_url: formData.image_url || ''
    };

    try {
      const created = await api.createTool(newItem);
      setItems([created, ...items]);

      setFormData({
        category: 'Diagnostic Equipment',
        brand: 'Snap-On',
        description: '',
        quantity: 1,
        condition: 'Good',
        estimated_value: '',
        notes: '',
        image_url: ''
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
      await api.deleteTool(id);
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item: ' + err.message);
    }
  };

  const addCar = async () => {
    if (!carFormData.make || !carFormData.model || !carFormData.estimated_value) {
      alert('Please fill in make, model, and estimated value');
      return;
    }

    const newCar = {
      make: carFormData.make,
      model: carFormData.model,
      year: parseInt(carFormData.year),
      vin: carFormData.vin || '',
      mileage: carFormData.mileage ? parseInt(carFormData.mileage) : null,
      condition: carFormData.condition,
      estimated_value: parseFloat(carFormData.estimated_value),
      notes: carFormData.notes || '',
      image_url: carFormData.image_url || ''
    };

    try {
      const response = await fetch(`${API_URL}/cars`, {
        method: 'POST',
        headers: api.getAuthHeaders(),
        body: JSON.stringify(newCar)
      });
      const created = await response.json();
      setCars([created, ...cars]);

      setCarFormData({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        vin: '',
        mileage: '',
        condition: 'Good',
        estimated_value: '',
        notes: '',
        image_url: ''
      });
      setShowForm(false);
    } catch (err) {
      console.error('Error adding car:', err);
      alert('Failed to add car: ' + err.message);
    }
  };

  const deleteCar = async (id) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Delete this car?')) return;

    try {
      await fetch(`${API_URL}/cars/${id}`, {
        method: 'DELETE',
        headers: api.getAuthHeaders()
      });
      setCars(cars.filter(car => car.id !== id));
    } catch (err) {
      console.error('Error deleting car:', err);
      alert('Failed to delete car: ' + err.message);
    }
  };

  const decodeVin = async () => {
    if (!carFormData.vin || carFormData.vin.length !== 17) {
      alert('Please enter a valid 17-character VIN');
      return;
    }

    setDecodingVin(true);
    try {
      const response = await fetch(`${API_URL}/decode-vin/${carFormData.vin}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to decode VIN');
      }

      // Auto-fill the form with decoded data
      setCarFormData({
        ...carFormData,
        make: result.data.make || carFormData.make,
        model: result.data.model || carFormData.model,
        year: result.data.year || carFormData.year,
        notes: result.data.trim ? `Trim: ${result.data.trim}` : carFormData.notes
      });

      alert('✅ VIN decoded successfully! Form auto-filled.');
    } catch (err) {
      console.error('VIN decode error:', err);
      alert('❌ ' + err.message);
    } finally {
      setDecodingVin(false);
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
    const toolsValue = items.reduce((sum, item) => sum + (item.estimated_value * item.quantity), 0);
    const carsValue = cars.reduce((sum, car) => sum + parseFloat(car.estimated_value), 0);
    return toolsValue + carsValue;
  }, [items, cars]);

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
    return <AuthScreen onLogin={handleLogin} api={api} />;
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

  const user = api.getUser();

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

          {Object.keys(categoryTotals).length > 0 && activeTab === 'tools' && (
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

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-6 py-3 font-medium transition ${
                activeTab === 'tools'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔧 Tools ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('cars')}
              className={`px-6 py-3 font-medium transition ${
                activeTab === 'cars'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🚗 Cars ({cars.length})
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'tools' ? "Search tools..." : "Search cars..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {activeTab === 'tools' && (
              <>
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
                  onClick={() => setShowImageUpload(true)}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition font-medium"
                >
                  <Camera className="w-5 h-5" />
                  Scan Tool
                </button>
              </>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition font-medium"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'tools' ? 'Add Tool' : 'Add Car'}
            </button>
          </div>

          <ImageUploadModal
            isOpen={showImageUpload}
            onClose={() => setShowImageUpload(false)}
            onRecognize={handleImageRecognition}
            api={api}
          />

          {showForm && activeTab === 'tools' && (
            <div className="bg-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Add New Tool/Equipment</h3>
              
              {formData.image_url && (
                <div className="mb-4">
                  <img 
                    src={formData.image_url} 
                    alt="Tool" 
                    className="max-h-48 rounded-lg mx-auto"
                  />
                  <p className="text-center text-sm text-green-400 mt-2">✨ Auto-detected from image</p>
                </div>
              )}
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

          {showForm && activeTab === 'cars' && (
            <div className="bg-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Add New Car</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Make *</label>
                  <input
                    type="text"
                    value={carFormData.make}
                    onChange={(e) => setCarFormData({...carFormData, make: e.target.value})}
                    placeholder="e.g., Toyota, Ford, BMW"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Model *</label>
                  <input
                    type="text"
                    value={carFormData.model}
                    onChange={(e) => setCarFormData({...carFormData, model: e.target.value})}
                    placeholder="e.g., Camry, F-150, 3 Series"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Year *</label>
                  <input
                    type="number"
                    value={carFormData.year}
                    onChange={(e) => setCarFormData({...carFormData, year: e.target.value})}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">VIN</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={carFormData.vin}
                      onChange={(e) => setCarFormData({...carFormData, vin: e.target.value.toUpperCase()})}
                      placeholder="Enter 17-character VIN"
                      maxLength="17"
                      className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={decodeVin}
                      disabled={!carFormData.vin || carFormData.vin.length !== 17 || decodingVin}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg transition font-medium whitespace-nowrap"
                    >
                      {decodingVin ? 'Decoding...' : '🔍 Decode VIN'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Enter VIN and click Decode to auto-fill make, model, and year</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mileage</label>
                  <input
                    type="number"
                    value={carFormData.mileage}
                    onChange={(e) => setCarFormData({...carFormData, mileage: e.target.value})}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Condition *</label>
                  <select
                    value={carFormData.condition}
                    onChange={(e) => setCarFormData({...carFormData, condition: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {conditions.map(cond => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Estimated Value *</label>
                  <input
                    type="number"
                    value={carFormData.estimated_value}
                    onChange={(e) => setCarFormData({...carFormData, estimated_value: e.target.value})}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                  <input
                    type="text"
                    value={carFormData.notes}
                    onChange={(e) => setCarFormData({...carFormData, notes: e.target.value})}
                    placeholder="Modifications, issues, etc."
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={addCar}
                  className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition font-medium"
                >
                  Add Car
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
            {activeTab === 'tools' ? (
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
            ) : (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Make</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Model</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Year</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">VIN</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Mileage</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Condition</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Value</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Notes</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {cars.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg">No cars yet. Click "Add Car" to start building your car inventory.</p>
                      </td>
                    </tr>
                  ) : (
                    cars
                      .filter(car => 
                        car.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        car.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (car.notes && car.notes.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .map(car => (
                        <tr key={car.id} className="hover:bg-gray-750">
                          <td className="px-4 py-3 text-sm font-medium">{car.make}</td>
                          <td className="px-4 py-3 text-sm">{car.model}</td>
                          <td className="px-4 py-3 text-sm">{car.year}</td>
                          <td className="px-4 py-3 text-sm text-xs">{car.vin || '-'}</td>
                          <td className="px-4 py-3 text-sm">{car.mileage ? car.mileage.toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getConditionColor(car.condition)}`}>
                              {car.condition}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-400">
                            ${parseFloat(car.estimated_value).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">{car.notes || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => deleteCar(car.id)}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
