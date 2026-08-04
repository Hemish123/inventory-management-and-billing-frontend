import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  customers: [],
  currentCustomer: null,
  customerPayments: [],
  customerSummary: null,
  creditHistory: [],
  loading: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
  filters: {
    search: '',
    tier: '',
    status: '',
  },
};

const customerSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    setCustomers: (state, action) => {
      state.customers = action.payload.results || action.payload;
      state.totalCount = action.payload.count || action.payload.length || 0;
    },
    setCurrentCustomer: (state, action) => {
      state.currentCustomer = action.payload;
    },
    setCustomerPayments: (state, action) => {
      state.customerPayments = action.payload.results || action.payload;
    },
    setCustomerSummary: (state, action) => {
      state.customerSummary = action.payload;
    },
    setCreditHistory: (state, action) => {
      state.creditHistory = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
    clearCurrentCustomer: (state) => {
      state.currentCustomer = null;
      state.customerPayments = [];
      state.customerSummary = null;
      state.creditHistory = [];
    },
  },
});

export const {
  setCustomers, setCurrentCustomer, setCustomerPayments, setCustomerSummary,
  setCreditHistory, setLoading, setError, setFilters, setCurrentPage,
  clearCurrentCustomer,
} = customerSlice.actions;
export default customerSlice.reducer;
