import axios from 'axios';
import toast from 'react-hot-toast';

const backendUrl = import.meta.env.VITE_BACKEND_URL;
const apiBaseUrl = backendUrl ? `${backendUrl.replace(/\/$/, '')}/api` : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.error || err.message || 'Something went wrong';
    if (err.response?.status === 401) {
      localStorage.removeItem('aq_token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    } else if (err.response?.status !== 404) {
      toast.error(message);
    }
    return Promise.reject(err);
  }
);

export default api;
