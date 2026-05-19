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

// Проверка конкретного права. Владелец имеет все права.
export const hasPermission = (permission) => {
  const user = getUser();
  if (!user) return false;
  if (user.role === 'owner') return true;
  return !!user[permission];
};
