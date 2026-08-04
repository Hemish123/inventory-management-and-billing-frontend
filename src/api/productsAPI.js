import api, { apiCall } from './axios';

// ── Products ──
export const getProducts = (params = {}) =>
  apiCall(() => api.get('/products/', { params }));

export const getProduct = (id) =>
  apiCall(() => api.get(`/products/${id}/`));

export const createProduct = (data) =>
  apiCall(() => api.post('/products/', data));

export const updateProduct = (id, data) =>
  apiCall(() => api.put(`/products/${id}/`, data));

export const deleteProduct = (id) =>
  apiCall(() => api.delete(`/products/${id}/`));

export const getProductDropdown = () =>
  apiCall(() => api.get('/products/dropdown/'));

export const getProductStock = (id) =>
  apiCall(() => api.get(`/products/${id}/stock/`));

export const barcodeLookup = (code) =>
  apiCall(() => api.get('/products/barcode-lookup/', { params: { code } }));

// ── Categories ──
export const getCategories = () =>
  apiCall(() => api.get('/products/categories/'));

export const createCategory = (data) =>
  apiCall(() => api.post('/products/categories/', data));

// ── Brands ──
export const getBrands = () =>
  apiCall(() => api.get('/products/brands/'));

export const createBrand = (data) =>
  apiCall(() => api.post('/products/brands/', data));

// ── Suppliers ──
export const getSuppliers = (params = {}) =>
  apiCall(() => api.get('/products/suppliers/', { params }));

export const getSupplier = (id) =>
  apiCall(() => api.get(`/products/suppliers/${id}/`));

export const createSupplier = (data) =>
  apiCall(() => api.post('/products/suppliers/', data));

export const updateSupplier = (id, data) =>
  apiCall(() => api.put(`/products/suppliers/${id}/`, data));

export const deleteSupplier = (id) =>
  apiCall(() => api.delete(`/products/suppliers/${id}/`));
