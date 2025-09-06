import React, { useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useContext(AuthContext);

  useEffect(() => {
    const token = searchParams.get('token');
    const isNewUser = searchParams.get('new') === 'true'; // Detect if you are a new user
    
    if (token) {
      try {
        // Save token to localStorage
        localStorage.setItem('token', token);
        
        // Decode the token to obtain the user data
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Update the authentication context
        login({
          id: payload.id,
          email: payload.email,
          username: payload.username, // Change 'name' to 'username' for consistency
          role: payload.role,
          token: token
        });
        
        // Display different messages depending on whether the user is a new or existing user
        if (isNewUser) {
          // Optional: You can display a toast/notification instead of an alert.
          setTimeout(() => {
            //alert('Welcome! Your account has been successfully created with Google..');
          }, 500);
        }
        
        // Redirect to the dashboard or main page
        navigate('/');
        
      } catch (error) {
        console.error('Error processing token:', error);
        alert('Error processing authentication');
        navigate('/login');
      }
    } else {
      // If there is no token, redirect to login
      navigate('/login');
    }
  }, [searchParams, navigate, login]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;