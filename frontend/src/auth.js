import axios from 'axios';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const saveAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = () => !!getToken();
export const isOwner = () => {
  const user = getUser();
  return user && user.role === 'owner';
};


export const hasPermission = (permission) => {
  const user = getUser();
  if (!user) return false;
  if (user.role === 'owner') return true;
  return !!user[permission];
};


axios.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {

      if (!error.config?.url?.includes('/auth/login')) {
        clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
