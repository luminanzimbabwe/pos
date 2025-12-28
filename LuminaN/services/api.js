import axios from 'axios';

// API Configuration - Production ready
const getApiBaseUrl = () => {
  // Detect the environment and use appropriate API URL
  if (typeof window !== 'undefined') {
    // Web environment
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Use current host for development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:8000/api/v1/shop`;
    }
    
    // Use current host for production
    return `${protocol}//${hostname}/api/v1/shop`;
  }
  
  // Fallback for other environments
  return 'http://localhost:8000/api/v1/shop';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add response interceptor for network error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network error (timeout, no connection, etc.)
      const errorMessage = error.code === 'ECONNREFUSED' 
        ? 'Cannot connect to server. Please check if the development server is running and the IP address is correct.'
        : 'Network connection failed. Please check your internet connection and try again.';
      throw new Error(errorMessage);
    }
    return Promise.reject(error);
  }
);

export const shopAPI = {
  checkStatus: () => api.get('/status/'),
  register: (data) => api.post('/register/', data),
  loginOwner: (data) => api.post('/login/', data),
  loginCashier: (data) => api.post('/cashiers/login/', data),
  resetPassword: (data) => api.post('/reset-password/', data),
  retrieveCredentials: (data) => api.post('/retrieve-credentials/', data),
  resetCashierPassword: (data) => api.post('/cashiers/reset-password/', data),
  getOwnerDashboard: () => api.get('/dashboard/'),
  
  // Staff management methods
  registerCashier: (data) => api.post('/cashiers/', data),
  registerCashierSelf: (data) => api.post('/cashiers/register/', data), // Self-registration endpoint
  getPendingStaff: (data) => api.post('/staff/pending/', data),
  getApprovedStaff: (data) => api.post('/staff/approved/', data),
  approveStaff: (data) => api.post('/staff/approve/', data),
  rejectStaff: (data) => api.post('/staff/reject/', data),
  deactivateCashier: (data) => api.post('/staff/deactivate/', data),
  deleteCashier: (data) => api.post('/staff/delete/', data),
  getInactiveStaff: (data) => api.post('/staff/inactive/', data),
  reactivateCashier: (data) => api.post('/staff/reactivate/', data),
  getCashierDetails: (data) => api.post('/staff/details/', data),
  editCashier: (data) => api.post('/staff/edit/', data),
  
  // Product management methods
  getProducts: (config = {}) => api.get('/products/', config),
  addProduct: (data) => api.post('/products/', data),
  updateProduct: (productId, data) => api.patch(`/products/${productId}/`, data),
  deleteProduct: (productId, authData) => api.delete(`/products/${productId}/`, {
    headers: {
      'Authorization': `Basic ${btoa(`${authData.email}:${authData.password}`)}`
    }
  }),
  getProductsByCategory: (category) => api.get(`/products/bulk/?category=${encodeURIComponent(category)}`),
  lookupBarcode: (barcode) => api.get(`/products/barcode-lookup/?barcode=${encodeURIComponent(barcode)}`),
  
  // Sales methods
  createSale: (data) => api.post('/sales/', data),
  getSales: () => api.get('/sales/'),
  getSale: (saleId) => api.get(`/sales/${saleId}/`),
  
  // Inventory audit trail methods
  getAuditTrail: () => api.get('/audit-trail/'),
  getProductAuditHistory: (productId) => api.get(`/products/${productId}/audit-history/`),
  getCustomEndpoint: (endpoint, authData) => api.get(endpoint, { 
    headers: { 
      'Authorization': `Basic ${btoa(`${authData.email}:${authData.password}`)}` 
    } 
  }),
  
  // Inventory management methods
  receiveInventory: (data) => api.post('/inventory/receive/', data),
  adjustInventory: (productId, data) => api.post(`/products/${productId}/adjust/`, data),
  stockTake: (data) => api.post('/inventory/stocktake/', data),
  
  // Enhanced receiving methods
  getSuppliers: () => api.get('/suppliers/'),
  getReceivingHistory: () => api.get('/inventory/receiving/history/'),
  submitBatchReceiving: (data) => api.post('/inventory/receiving/batch/', data),
  
  // Purchase Order methods
  getPurchaseOrders: () => api.get('/purchase-orders/'),
  createPurchaseOrder: (data) => api.post('/purchase-orders/', data),
  updatePurchaseOrder: (orderId, data) => api.patch(`/purchase-orders/${orderId}/`, data),
  
  // Founder super admin methods
  founderLogin: (data) => api.post('/founder/login/', data),
  getAllShops: (data) => api.post('/founder/shops/', data),
  getFounderShopDashboard: (data) => api.post('/founder/shops/dashboard/', data),
  resetShopPassword: (data) => api.post('/founder/shops/reset-password/', data),
  
  // Debug method to check API connectivity
  testConnection: async () => {
    try {
      const response = await api.get('/status/');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Debug method to test cashier login endpoint
  testCashierLogin: async (data) => {
    try {
      const response = await api.post('/cashiers/login/', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message, status: error.response?.status, details: error.response?.data };
    }
  },
  
  // Debug method to test cashier reset endpoint
  testCashierReset: async (data) => {
    try {
      const response = await api.post('/cashiers/reset-password/', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message, status: error.response?.status, details: error.response?.data };
    }
  },
  
  // Stock Transfer methods
  findProductForTransfer: (data, config = {}) => api.post('/stock-transfers/find_product/', data, config),
  validateTransfer: (data, config = {}) => api.post('/stock-transfers/validate_transfer/', data, config),
  createTransfer: (data, config = {}) => api.post('/stock-transfers/', data, config),
  getTransfers: (config = {}) => api.get('/stock-transfers/', config),

  // Waste/Wastage management methods
  getWastes: (config = {}) => api.get('/wastes/', config),
  createWaste: (data, config = {}) => api.post('/wastes/', data, config),
  getWasteSummary: (config = {}) => api.get('/wastes/summary/', config),
  searchWasteProduct: (data, config = {}) => api.post('/wastes/product-search/', data, config),
  
  // Waste Batch management methods
  createWasteBatch: (data, config = {}) => api.post('/waste-batches/', data, config),
  getWasteBatches: (config = {}) => api.get('/waste-batches/', config),
  getWasteBatchDetail: (batchId, config = {}) => api.get(`/waste-batches/${batchId}/`, config),
  addWasteToBatch: (batchId, data, config = {}) => api.post(`/waste-batches/${batchId}/`, data, config),
  updateWasteBatch: (batchId, data, config = {}) => api.patch(`/waste-batches/${batchId}/`, data, config),

  // Expense management methods
  getExpenses: (config = {}) => api.get('/expenses/', config),
  createExpense: (data, config = {}) => api.post('/expenses/', data, config),
  updateExpense: (expenseId, data, config = {}) => api.patch(`/expenses/${expenseId}/`, data, config),
  deleteExpense: (expenseId, config = {}) => api.delete(`/expenses/${expenseId}/`, config),

  // Refund management methods
  getRefunds: (config = {}) => api.get('/refunds/', config),
  createRefund: (data, config = {}) => api.post('/refunds/', data, config),
  updateRefund: (refundId, data, config = {}) => api.patch(`/refunds/${refundId}/`, data, config),
  deleteRefund: (refundId, config = {}) => api.delete(`/refunds/${refundId}/`, config),

  // Stock Take management methods
  getStockTakes: (config = {}) => api.get('/stock-takes/', config),
  createStockTake: (data, config = {}) => api.post('/stock-takes/', data, config),
  getStockTakeDetail: (stockTakeId, config = {}) => api.get(`/stock-takes/${stockTakeId}/`, config),
  getStockTakeItems: (stockTakeId, config = {}) => api.get(`/stock-takes/${stockTakeId}/items/`, config),
  addStockTakeItem: (stockTakeId, data, config = {}) => api.post(`/stock-takes/${stockTakeId}/items/`, data, config),
  bulkAddStockTakeItems: (stockTakeId, data, config = {}) => api.post(`/stock-takes/${stockTakeId}/items/bulk/`, data, config),
  searchStockTakeProduct: (stockTakeId, data, config = {}) => api.get(`/stock-takes/${stockTakeId}/search/?query=${encodeURIComponent(data.query)}`, config),
  updateStockTake: (stockTakeId, data, config = {}) => api.patch(`/stock-takes/${stockTakeId}/`, data, config),
  completeStockTake: (stockTakeId, data, config = {}) => api.patch(`/stock-takes/${stockTakeId}/`, data, config),
};

export default api;