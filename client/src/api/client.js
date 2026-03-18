import { SERVER_URL } from '../constants/views.js';

// Token global (se actualiza con setApiToken)
let globalToken = null;

/**
 * Crea un cliente API con autenticación
 * @param {string|null} token - Token de autenticación JWT
 * @returns {object} - Objeto con métodos para hacer requests
 */
export const createApiClient = (token) => {
  const baseUrl = SERVER_URL.replace(/\/$/, '');
  
  // Usar el token proporcionado O el token global
  const currentToken = token !== undefined ? token : globalToken;
  
  const request = async (endpoint, options = {}) => {
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const url = `${baseUrl}/${cleanEndpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...options.headers
    };
    
    console.log('=== API REQUEST ===');
    console.log('Endpoint:', endpoint);
    console.log('Token:', currentToken ? '✓ presente' : '✗ ausente');
    console.log('Headers:', headers);
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    return response.json();
  };
  
  return {
    get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
    post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
  };
};

// Singleton del cliente API
let apiClient = createApiClient(null);

export const getApiClient = () => apiClient;

export const setApiToken = (token) => {
  globalToken = token;
  apiClient = createApiClient(token);
};

export default {
  get: (endpoint, options) => apiClient.get(endpoint, options),
  post: (endpoint, body, options) => apiClient.post(endpoint, body, options),
  put: (endpoint, body, options) => apiClient.put(endpoint, body, options),
  delete: (endpoint, options) => apiClient.delete(endpoint, options),
};
