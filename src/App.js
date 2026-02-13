// TOOL INVENTORY - COMPLETE REACT APP WITH NEON POSTGRESQL BACKEND
// Multi-user app with image recognition powered by Google Cloud Vision

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, Download, Search, Package, LogOut, UserCircle, Camera, Upload, Loader, ChevronDown, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

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
      const response = await fetch(`${API_URL}/cars`, {
        headers: api.getAuthHeaders()
      });
      
      // If cars table doesn't exist yet, just set empty array
      if (!response.ok) {
        console.log('Cars table not yet initialized');
        setCars([]);
        return;
      }
      
      const data = await response.json();
      setCars(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading cars:', err);
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

  const toolsValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.estimated_value * item.quantity), 0);
  }, [items]);

  const carsValue = useMemo(() => {
    return cars.reduce((sum, car) => sum + parseFloat(car.estimated_value), 0);
  }, [cars]);

  const totalValue = useMemo(() => {
    return toolsValue + carsValue;
  }, [toolsValue, carsValue]);

  const categoryTotals = useMemo(() => {
    const totals = {};
    items.forEach(item => {
      if (!totals[item.category]) totals[item.category] = 0;
      totals[item.category] += item.estimated_value * item.quantity;
    });
    return totals;
  }, [items]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const exportToCSV = () => {
    let headers, rows, filename;

    if (activeTab === 'tools') {
      headers = ['Category', 'Brand', 'Description', 'Quantity', 'Condition', 'Unit Value', 'Total Value', 'Notes'];
      rows = items.map(item => [
        item.category,
        item.brand,
        item.description,
        item.quantity,
        item.condition,
        item.estimated_value,
        item.estimated_value * item.quantity,
        item.notes || ''
      ]);
      filename = `tool-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      headers = ['Year', 'Make', 'Model', 'VIN', 'Mileage', 'Condition', 'Estimated Value', 'Notes'];
      rows = cars.map(car => [
        car.year,
        car.make,
        car.model,
        car.vin || '',
        car.mileage || '',
        car.condition,
        car.estimated_value,
        car.notes || ''
      ]);
      filename = `car-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const exportToPDF = (type) => {
    setShowExportMenu(false);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const date = new Date().toLocaleDateString();
    let yPosition = 20;

    // Draw logo
    const logoX = pageWidth / 2 - 45;
    const logoY = yPosition - 5;

    // Outer circle (speedometer)
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(2);
    doc.circle(logoX + 12, logoY + 12, 12, 'S');

    // Inner arc (speed indicator)
    doc.setLineWidth(1.5);
    doc.setDrawColor(220, 38, 38); // Red accent
    // Draw speed needle
    doc.line(logoX + 12, logoY + 12, logoX + 20, logoY + 5);

    // Small tick marks
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.8);
    doc.line(logoX + 12, logoY + 2, logoX + 12, logoY + 5);
    doc.line(logoX + 22, logoY + 7, logoX + 20, logoY + 9);
    doc.line(logoX + 2, logoY + 7, logoX + 4, logoY + 9);

    // Wrench accent (small)
    doc.setLineWidth(1.2);
    doc.setDrawColor(100, 100, 100);
    doc.line(logoX + 18, logoY + 18, logoX + 24, logoY + 24);

    // Company name
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('SPEEDISH', logoX + 28, logoY + 10);
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text('AUTOMOTIVE', logoX + 28, logoY + 19);

    yPosition += 25;

    // Subtitle
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Inventory Valuation Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    doc.text(`Generated: ${date}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Include tools
    if (type === 'tools' || type === 'both') {
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Tool Inventory', 14, yPosition);
      yPosition += 3;

      const toolHeaders = [['Category', 'Brand', 'Description', 'Qty', 'Condition', 'Unit Value', 'Total']];
      const toolRows = items.map(item => [
        item.category,
        item.brand,
        item.description.substring(0, 30) + (item.description.length > 30 ? '...' : ''),
        item.quantity,
        item.condition,
        `$${item.estimated_value.toLocaleString()}`,
        `$${(item.estimated_value * item.quantity).toLocaleString()}`
      ]);

      autoTable(doc, {
        head: toolHeaders,
        body: toolRows,
        startY: yPosition,
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 22 },
          2: { cellWidth: 45 },
          3: { cellWidth: 12 },
          4: { cellWidth: 20 },
          5: { cellWidth: 25 },
          6: { cellWidth: 25 }
        }
      });

      yPosition = doc.lastAutoTable.finalY + 8;

      // Tool summary
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Tools: ${items.length} items`, 14, yPosition);
      yPosition += 6;
      doc.setFont(undefined, 'bold');
      doc.text(`Tool Value: $${toolsValue.toLocaleString()}`, 14, yPosition);
      doc.setFont(undefined, 'normal');
      yPosition += 15;
    }

    // Include cars
    if (type === 'cars' || type === 'both') {
      // Check if we need a new page
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Car Inventory', 14, yPosition);
      yPosition += 3;

      const carHeaders = [['Year', 'Make', 'Model', 'VIN', 'Mileage', 'Condition', 'Value']];
      const carRows = cars.map(car => [
        car.year,
        car.make,
        car.model,
        car.vin ? car.vin.substring(0, 10) + '...' : '-',
        car.mileage ? car.mileage.toLocaleString() : '-',
        car.condition,
        `$${parseFloat(car.estimated_value).toLocaleString()}`
      ]);

      autoTable(doc, {
        head: carHeaders,
        body: carRows,
        startY: yPosition,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], textColor: 255 }, // Purple for cars
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 28 },
          2: { cellWidth: 28 },
          3: { cellWidth: 30 },
          4: { cellWidth: 25 },
          5: { cellWidth: 22 },
          6: { cellWidth: 28 }
        }
      });

      yPosition = doc.lastAutoTable.finalY + 8;

      // Car summary
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Cars: ${cars.length} vehicles`, 14, yPosition);
      yPosition += 6;
      doc.setFont(undefined, 'bold');
      doc.text(`Car Value: $${carsValue.toLocaleString()}`, 14, yPosition);
      doc.setFont(undefined, 'normal');
      yPosition += 15;
    }

    // Grand total for combined export
    if (type === 'both') {
      // Check if we need a new page
      if (yPosition > 260) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(0.5);
      doc.line(14, yPosition, pageWidth - 14, yPosition);
      yPosition += 10;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(`TOTAL INVENTORY VALUE: $${totalValue.toLocaleString()}`, 14, yPosition);
    }

    // Add valuation methodology section on last page
    const pageHeight = doc.internal.pageSize.getHeight();

    // Check if we need a new page for footer content
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    yPosition += 10;

    // Valuation methodology box
    doc.setDrawColor(100, 100, 100);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(10, yPosition, pageWidth - 20, 55, 3, 3, 'FD');

    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('VALUATION METHODOLOGY', 14, yPosition);

    yPosition += 6;
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(60, 60, 60);

    const methodologyText = [
      'All values represent Fair Market Value (FMV) estimates based on current market comparables from multiple sources:',
      '',
      '• eBay (completed listings & Buy It Now)     • Facebook Marketplace     • Craigslist',
      '• Amazon     • Snap-on Tools (official pricing)     • Mac Tools (official pricing)     • Matco Tools (official pricing)',
      '• Tool Truck Direct     • Zoro Tools     • Tooltopia     • KC Tool     • Acme Tools     • Northern Tool',
      '• CarGurus     • Autotrader     • Cars.com     • Kelley Blue Book (KBB)     • NADA Guides     • Edmunds',
      '',
      'Values are adjusted for condition, age, completeness, and regional market variations. Tool values reflect replacement cost',
      'for items in similar condition. Vehicle values consider mileage, maintenance history, and market demand.'
    ];

    methodologyText.forEach((line, idx) => {
      doc.text(line, 14, yPosition + (idx * 4.5));
    });

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(
        'Speedish Automotive | Professional Inventory Valuation Services',
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
      doc.text(
        `Page ${i} of ${pageCount} | This document is for informational purposes only and does not constitute a formal appraisal.`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }

    // Generate filename
    let filename;
    if (type === 'tools') {
      filename = `tool-inventory-${new Date().toISOString().split('T')[0]}.pdf`;
    } else if (type === 'cars') {
      filename = `car-inventory-${new Date().toISOString().split('T')[0]}.pdf`;
    } else {
      filename = `complete-inventory-${new Date().toISOString().split('T')[0]}.pdf`;
    }

    doc.save(filename);
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
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={items.length === 0 && cars.length === 0}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition"
                >
                  <Download className="w-5 h-5" />
                  Export
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-lg shadow-xl border border-gray-600 py-2 z-50">
                    <div className="px-3 py-2 text-xs text-gray-400 uppercase tracking-wide border-b border-gray-600">
                      PDF Export
                    </div>
                    <button
                      onClick={() => exportToPDF('tools')}
                      disabled={items.length === 0}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      Tools Only
                    </button>
                    <button
                      onClick={() => exportToPDF('cars')}
                      disabled={cars.length === 0}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <FileText className="w-4 h-4 text-purple-400" />
                      Cars Only
                    </button>
                    <button
                      onClick={() => exportToPDF('both')}
                      disabled={items.length === 0 && cars.length === 0}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <FileText className="w-4 h-4 text-green-400" />
                      Complete Inventory
                    </button>
                    <div className="px-3 py-2 text-xs text-gray-400 uppercase tracking-wide border-t border-b border-gray-600 mt-2">
                      CSV Export
                    </div>
                    <button
                      onClick={() => { exportToCSV(); setShowExportMenu(false); }}
                      disabled={activeTab === 'tools' ? items.length === 0 : cars.length === 0}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <Download className="w-4 h-4 text-gray-400" />
                      {activeTab === 'tools' ? 'Tools CSV' : 'Cars CSV'}
                    </button>
                  </div>
                )}
              </div>
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
              <div className="text-blue-200 text-sm font-medium">🔧 Tool Value</div>
              <div className="text-3xl font-bold mt-1">${toolsValue.toLocaleString()}</div>
              <div className="text-blue-200 text-xs mt-1">{items.length} items</div>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4">
              <div className="text-purple-200 text-sm font-medium">🚗 Car Value</div>
              <div className="text-3xl font-bold mt-1">${carsValue.toLocaleString()}</div>
              <div className="text-purple-200 text-xs mt-1">{cars.length} cars</div>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4">
              <div className="text-green-200 text-sm font-medium">💰 Total Value</div>
              <div className="text-3xl font-bold mt-1">${totalValue.toLocaleString()}</div>
              <div className="text-green-200 text-xs mt-1">Combined inventory</div>
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
