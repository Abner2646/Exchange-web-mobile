// mobile/hooks/useWatchlist.js
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCHLIST_KEY = 'crypto_watchlist';

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar watchlist al iniciar
  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const stored = await AsyncStorage.getItem(WATCHLIST_KEY);
      if (stored) {
        setWatchlist(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[useWatchlist] Error loading watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWatchlist = async (newWatchlist) => {
    try {
      await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(newWatchlist));
      setWatchlist(newWatchlist);
    } catch (error) {
      console.error('[useWatchlist] Error saving watchlist:', error);
    }
  };

  const isInWatchlist = useCallback((coinId) => {
    return watchlist.includes(coinId);
  }, [watchlist]);

  const toggleWatchlist = useCallback(async (coinId) => {
    const newWatchlist = isInWatchlist(coinId)
      ? watchlist.filter(id => id !== coinId)
      : [...watchlist, coinId];
    
    await saveWatchlist(newWatchlist);
  }, [watchlist, isInWatchlist]);

  const addToWatchlist = useCallback(async (coinId) => {
    if (!isInWatchlist(coinId)) {
      await saveWatchlist([...watchlist, coinId]);
    }
  }, [watchlist, isInWatchlist]);

  const removeFromWatchlist = useCallback(async (coinId) => {
    await saveWatchlist(watchlist.filter(id => id !== coinId));
  }, [watchlist]);

  return {
    watchlist,
    isLoading,
    isInWatchlist,
    toggleWatchlist,
    addToWatchlist,
    removeFromWatchlist,
  };
};