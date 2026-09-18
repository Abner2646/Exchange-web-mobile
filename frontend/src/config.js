// src/config.js
// En producción, las variables REACT_APP_* se inyectan en tiempo de BUILD
const rawApiUrl = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api'
);

// Remover trailing slashes para evitar URLs duplicadas
export const API_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/g, '') : '/api';

export default {
  API_URL,
};