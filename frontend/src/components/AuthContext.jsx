import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
        token: action.payload.token
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    user: null,
    token: localStorage.getItem('token')
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Check if the token is valid - FIX URL
      axios.get('http://localhost:3001/api/profile', { // Change port from 3000 to 3001
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
        dispatch({ 
          type: 'LOGIN', 
          payload: { ...response.data, token } 
        });
      })
      .catch((error) => {
        console.error('Invalid or expired token:', error);
        localStorage.removeItem('token');
        dispatch({ type: 'LOGOUT' });
      });
    }
  }, []);

  const login = (userData) => {
    // Ensure the token is saved in localStorage if it comes in userData
    if (userData.token) {
      localStorage.setItem('token', userData.token);
    }
    dispatch({ type: 'LOGIN', payload: userData });
  };

  const logout = async () => {
    try {
      // CORRECT logout URL
      await axios.post('http://localhost:3001/auth/logout', {}, { // Change port from 3000 to 3001
        headers: { Authorization: `Bearer ${state.token}` }
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      localStorage.removeItem('token');
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Helper function to get user data from the JWT token
  const getUserFromToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.id,
        email: payload.email,
        username: payload.username,
        role: payload.role,
        token: token
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      getUserFromToken // Expose the function in case you need it in other components
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };