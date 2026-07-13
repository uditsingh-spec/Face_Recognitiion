import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Production URL pointing to Render
// export const API_URL = 'https://application-medtech.onrender.com/api';

// Local Development URL
// Note: If using a physical phone with Expo, replace 'localhost' with your computer's local Wi-Fi IP (e.g. 'http://192.168.1.x:5000/api')
export const API_URL = 'http://10.148.20.190:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  // Use the hardcoded bypass token from the store directly
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept 401 Unauthorized to trigger logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
