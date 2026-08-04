import api, { apiCall } from './axios';

export const getDashboardStats = (params = {}) =>
  apiCall(() => api.get('/reports/dashboard/', { params }));

export const getSalesTrend = (params = {}) =>
  apiCall(() => api.get('/reports/sales-trend/', { params }));

export const getSalesReport = (params = {}) =>
  apiCall(() => api.get('/reports/sales/', { params }));

export const getPurchaseReport = (params = {}) =>
  apiCall(() => api.get('/reports/purchases/', { params }));

export const getInventoryReport = (params = {}) =>
  apiCall(() => api.get('/reports/inventory/', { params }));

export const getTopProducts = (params = {}) =>
  apiCall(() => api.get('/reports/top-products/', { params }));

export const getLowStockReport = (params = {}) =>
  apiCall(() => api.get('/reports/low-stock/', { params }));

export const getDeadStockReport = (params = {}) =>
  apiCall(() => api.get('/reports/dead-stock/', { params }));

export const getBranchSalesReport = (params = {}) =>
  apiCall(() => api.get('/reports/branch-sales/', { params }));

export const getSupplierPurchaseReport = (params = {}) =>
  apiCall(() => api.get('/reports/supplier-purchases/', { params }));

export const getCustomerPurchaseReport = (params = {}) =>
  apiCall(() => api.get('/reports/customer-purchases/', { params }));

export const getProfitReport = (params = {}) =>
  apiCall(() => api.get('/reports/profit/', { params }));

export const getStockValuation = (params = {}) =>
  apiCall(() => api.get('/reports/stock-valuation/', { params }));

// ── Export helpers ──
export const exportCSV = (reportType, params = {}) =>
  api.get(`/reports/${reportType}/`, { params: { ...params, export: 'csv' }, responseType: 'blob' });
