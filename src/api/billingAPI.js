import api, { apiCall } from './axios';

// ── Bills ──
export const getBills = (params = {}) =>
  apiCall(() => api.get('/billing/', { params }));

export const getBill = (id) =>
  apiCall(() => api.get(`/billing/${id}/`));

export const createBill = (data) =>
  apiCall(() => api.post('/billing/create-bill/', data));

export const voidBill = (id) =>
  apiCall(() => api.post(`/billing/${id}/void/`));

// ── Draft / Hold ──
export const getDrafts = (params = {}) =>
  apiCall(() => api.get('/billing/drafts/', { params }));

export const resumeDraft = (id) =>
  apiCall(() => api.get(`/billing/${id}/resume/`));

export const finalizeBill = (id, data = {}) =>
  apiCall(() => api.post(`/billing/${id}/finalize/`, data));

export const discardDraft = (id) =>
  apiCall(() => api.delete(`/billing/${id}/discard/`));

export const getReceiptPDFBlob = (id) =>
  api.get(`/billing/${id}/pdf/`, { responseType: 'blob' });
