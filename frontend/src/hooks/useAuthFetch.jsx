// hooks/useAuthFetch.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useAuthFetch = () => {
    const navigate = useNavigate();
    
    const authFetch = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        
        if (!token) {
            navigate('/login');
            throw new Error('No token available');
        }
        
        const config = {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        const response = await fetch(url, config);
        
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            navigate('/login');
            throw new Error('Token expired');
        }
        
        return response;
    };
    
    return authFetch;
};