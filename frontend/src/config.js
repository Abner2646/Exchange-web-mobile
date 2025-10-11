// src/config.js
// En producción, las variables REACT_APP_* se inyectan en tiempo de BUILD
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Remover trailing slashes para evitar URLs duplicadas
export const API_URL = apiUrl.replace(/\/+$/g, '');

export default {
  API_URL,
};