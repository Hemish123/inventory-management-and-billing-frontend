import api, { apiCall } from './axios';

// ── Expenses ──
export const getExpenses = (params = {}) =>
  apiCall(() => api.get('/purchases/expenses/', { params }));

export const getExpense = (id) =>
  apiCall(() => api.get(`/purchases/expenses/${id}/`));

export const createExpense = (data) =>
  apiCall(() => api.post('/purchases/expenses/', data));

export const updateExpense = (id, data) =>
  apiCall(() => api.put(`/purchases/expenses/${id}/`, data));

export const deleteExpense = (id) =>
  apiCall(() => api.delete(`/purchases/expenses/${id}/`));
