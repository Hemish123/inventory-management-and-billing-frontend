import { createSlice } from '@reduxjs/toolkit';

const storedTokens = {
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
};

const storedUser = localStorage.getItem('user');

const initialState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  accessToken: storedTokens.accessToken,
  refreshToken: storedTokens.refreshToken,
  isAuthenticated: !!storedTokens.accessToken,
  loading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, tokens } = action.payload;
      state.user = user;
      state.accessToken = tokens.access;
      state.refreshToken = tokens.refresh;
      state.isAuthenticated = true;
      localStorage.setItem('accessToken', tokens.access);
      localStorage.setItem('refreshToken', tokens.refresh);
      localStorage.setItem('user', JSON.stringify(user));
    },
    setTokens: (state, action) => {
      const { access, refresh } = action.payload;
      state.accessToken = access;
      if (refresh) state.refreshToken = refresh;
      localStorage.setItem('accessToken', access);
      if (refresh) localStorage.setItem('refreshToken', refresh);
    },
    setUser: (state, action) => {
      state.user = action.payload;
      localStorage.setItem('user', JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const { setCredentials, setTokens, setUser, logout, setLoading } = authSlice.actions;
export default authSlice.reducer;
