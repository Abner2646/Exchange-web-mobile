// Para Create React App (solo si NO usas Vite)
const raw = process.env.REACT_APP_API_URL || 'https://exchange-backend-1.onrender.com/api';
export const API_URL = raw.replace(/\/+$/g, '');

export default {
  API_URL,
};