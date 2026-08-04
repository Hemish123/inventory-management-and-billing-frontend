import api, { apiCall } from './axios';

export const getCustomers = (params = {}) =>
  apiCall(() => api.get('/customers/', { params }));

export const getCustomer = (id) =>
  apiCall(() => api.get(`/customers/${id}/`));

export const createCustomer = (data) =>
  apiCall(() => api.post('/customers/', data));

export const updateCustomer = (id, data) =>
  apiCall(() => api.put(`/customers/${id}/`, data));

export const deleteCustomer = (id) =>
  apiCall(() => api.delete(`/customers/${id}/`));

export const getCustomerDropdown = () =>
  apiCall(() => api.get('/customers/dropdown/'));
