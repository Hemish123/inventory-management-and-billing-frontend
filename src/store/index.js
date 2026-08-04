import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import customerReducer from './customerSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    customers: customerReducer,
  },
});
