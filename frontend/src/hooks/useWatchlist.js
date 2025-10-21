// src/hooks/useWatchlist.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const useWatchlist = () => {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState([]);

  // Cargar watchlist del localStorage
  useEffect(() => {
    const key = user ? `watchlist_${user.id}` : 'watchlist_guest';
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading watchlist:', error);
        setWatchlist([]);
      }
    }
  }, [user]);

  // Guardar watchlist en localStorage
  const saveWatchlist = (newWatchlist) => {
    const key = user ? `watchlist_${user.id}` : 'watchlist_guest';
    localStorage.setItem(key, JSON.stringify(newWatchlist));
    setWatchlist(newWatchlist);
  };

  const toggleWatchlist = (coinId) => {
    const isInWatchlist = watchlist.includes(coinId);
    
    if (isInWatchlist) {
      const newWatchlist = watchlist.filter(id => id !== coinId);
      saveWatchlist(newWatchlist);
    } else {
      const newWatchlist = [...watchlist, coinId];
      saveWatchlist(newWatchlist);
    }
  };

  const isInWatchlist = (coinId) => {
    return watchlist.includes(coinId);
  };

  return {
    watchlist,
    toggleWatchlist,
    isInWatchlist,
  };
};

export default useWatchlist;