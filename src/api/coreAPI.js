import api, { apiCall } from './axios';

// ── Branches ──
export const getBranches = () =>
  apiCall(() => api.get('/core/branches/'));

export const getBranchDropdown = () =>
  apiCall(() => api.get('/core/branches/dropdown/'));

export const createBranch = (data) =>
  apiCall(() => api.post('/core/branches/', data));

export const updateBranch = (id, data) =>
  apiCall(() => api.put(`/core/branches/${id}/`, data));

export const deleteBranch = (id) =>
  apiCall(() => api.delete(`/core/branches/${id}/`));

// ── Warehouses ──
export const getWarehouses = (params = {}) =>
  apiCall(() => api.get('/core/warehouses/', { params }));

export const createWarehouse = (data) =>
  apiCall(() => api.post('/core/warehouses/', data));
