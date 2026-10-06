import http from './http';

export const getCurrentUser = () => http.get('/auth/me').then((res) => res.data.user);
export const login = (credentials) => http.post('/auth/login', credentials).then((res) => res.data.user);
export const register = (credentials) => http.post('/auth/register', credentials).then((res) => res.data.user);
export const logout = () => http.post('/auth/logout');
