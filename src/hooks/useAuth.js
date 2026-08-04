import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setCredentials, logout as logoutAction } from '../store/authSlice';
import { loginUser, registerUser, logoutUser, deleteAccount as deleteAccountAPI } from '../api/authAPI';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, accessToken, refreshToken } = useSelector(
    (state) => state.auth
  );

  const login = async (email, password) => {
    const { data, error } = await loginUser({ email, password });
    if (error) {
      toast.error(error);
      return { success: false };
    }
    dispatch(setCredentials(data.data));
    toast.success('Login successful!');
    if (!data.data.reactivated) {
      navigate('/dashboard');
    }
    return { success: true, reactivated: data.data.reactivated };
  };

  const register = async (formData) => {
    const { data, error } = await registerUser(formData);
    if (error) {
      toast.error(error);
      return { success: false };
    }
    dispatch(setCredentials(data.data));
    toast.success('Registration successful!');
    if (!data.data.reactivated) {
      navigate('/dashboard');
    }
    return { success: true, reactivated: data.data.reactivated };
  };

  const logout = async () => {
    if (refreshToken) {
      await logoutUser(refreshToken);
    }
    dispatch(logoutAction());
    toast.success('Logged out');
    navigate('/login');
  };

  const deleteAccount = async () => {
    const { error } = await deleteAccountAPI(refreshToken);
    if (error) {
      toast.error(error);
      return false;
    }
    dispatch(logoutAction());
    toast.success('Account deactivated');
    navigate('/login');
    return true;
  };

  return {
    user,
    isAuthenticated,
    loading,
    accessToken,
    login,
    register,
    logout,
    deleteAccount,
  };
};
