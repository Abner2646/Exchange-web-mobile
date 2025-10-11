// Central config for frontend environment variables
const raw = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
// Normalize: remove trailing slash if present
export const API_URL = raw.replace(/\/+$/g, '');

export default {
  API_URL,
};
