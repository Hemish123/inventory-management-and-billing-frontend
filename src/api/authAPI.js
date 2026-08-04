import api, { apiCall } from './axios';

export const loginUser = (credentials) =>
  apiCall(() => api.post('/auth/login/', credentials));

export const registerUser = (data) => {
  const config = data instanceof FormData ? { headers: { 'Content-Type': undefined } } : {};
  return apiCall(() => api.post('/auth/register/', data, config));
};

export const logoutUser = (refreshToken) =>
  apiCall(() => api.post('/auth/logout/', { refresh: refreshToken }));

export const getMe = () =>
  apiCall(() => api.get('/auth/me/'));

export const updateProfile = (data) => {
  const config = data instanceof FormData ? { headers: { 'Content-Type': undefined } } : {};
  return apiCall(() => api.put('/auth/me/', data, config));
};

export const refreshToken = (refresh) =>
  apiCall(() => api.post('/auth/token/refresh/', { refresh }));

export const deleteAccount = (refreshToken) =>
  apiCall(() => api.post('/auth/delete-account/', { refresh: refreshToken }));

export const getEmployees = () =>
  apiCall(() => api.get('/auth/employees/'));

export const createEmployee = (data) =>
  apiCall(() => api.post('/auth/employees/', data));

export const updateEmployee = (id, data) =>
  apiCall(() => api.put(`/auth/employees/${id}/`, data));

export const deleteEmployee = (id) =>
  apiCall(() => api.delete(`/auth/employees/${id}/`));
