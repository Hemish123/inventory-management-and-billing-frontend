import api, { apiCall } from './axios';

// ── Stock Movements ──
export const getStockMovements = (params = {}) =>
  apiCall(() => api.get('/stock/movements/', { params }));

export const adjustStock = (data) =>
  apiCall(() => api.post('/stock/movements/adjust/', data));

export const updateStockMovement = (id, data) =>
  apiCall(() => api.put(`/stock/movements/${id}/`, data));

export const deleteStockMovement = (id) =>
  apiCall(() => api.delete(`/stock/movements/${id}/`));

// ── Stock Transfers ──
export const getStockTransfers = (params = {}) =>
  apiCall(() => api.get('/stock/transfers/', { params }));

export const createStockTransfer = (data) =>
  apiCall(() => api.post('/stock/transfers/create-transfer/', data));

export const approveTransfer = (id) =>
  apiCall(() => api.post(`/stock/transfers/${id}/approve/`));

export const rejectTransfer = (id, reason = '') =>
  apiCall(() => api.post(`/stock/transfers/${id}/reject/`, { reason }));

export const completeTransfer = (id) =>
  apiCall(() => api.post(`/stock/transfers/${id}/complete/`));

export const cancelTransfer = (id) =>
  apiCall(() => api.post(`/stock/transfers/${id}/cancel/`));

// ── Purchases ──
export const getPurchases = (params = {}) =>
  apiCall(() => api.get('/purchases/', { params }));

export const getPurchase = (id) =>
  apiCall(() => api.get(`/purchases/${id}/`));

export const createPurchase = (data) =>
  apiCall(() => api.post('/purchases/', data));

export const updatePurchase = (id, data) =>
  apiCall(() => api.put(`/purchases/${id}/`, data));

export const deletePurchase = (id) =>
  apiCall(() => api.delete(`/purchases/${id}/`));

export const receivePurchase = (id) =>
  apiCall(() => api.post(`/purchases/${id}/receive/`));
