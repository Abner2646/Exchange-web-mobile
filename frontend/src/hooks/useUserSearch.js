// src/hooks/useUserSearch.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import { EMAIL_REGEX } from '../utils/validators';

/**
 * Hook para búsqueda de usuarios con debounce
 * @param {String} email - Email a buscar
 * @param {Number} debounceTime - Tiempo de debounce en ms (default: 500)
 */
export const useUserSearch = (email, debounceTime = 500) => {
  const { user } = useAuth();
  const [destinatario, setDestinatario] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Reset si el email está vacío
    if (!email) {
      setDestinatario(null);
      setNotFound(false);
      setSearching(false);
      setError('');
      return;
    }

    // Solo buscar si el email es válido
    if (!EMAIL_REGEX.test(email)) {
      setDestinatario(null);
      setNotFound(false);
      setSearching(false);
      setError('');
      return;
    }

    // Debounce
    const timer = setTimeout(async () => {
      setSearching(true);
      setNotFound(false);
      setError('');

      try {
        console.log('🔍 Buscando usuario:', email);
        const usuario = await userService.searchByEmail(email);

        if (usuario) {
          // Validar que no sea el mismo usuario
          if (usuario.id === user?.id) {
            setError('No puedes transferir a tu propia cuenta');
            setDestinatario(null);
            setNotFound(true);
          } else {
            setDestinatario(usuario);
            setNotFound(false);
            setError('');
            console.log('✅ Usuario encontrado:', usuario.username);
          }
        } else {
          setDestinatario(null);
          setNotFound(true);
          console.log('❌ Usuario no encontrado');
        }
      } catch (err) {
        console.error('❌ Error en búsqueda:', err);
        setDestinatario(null);
        setNotFound(true);
        setError('Error al buscar usuario');
      } finally {
        setSearching(false);
      }
    }, debounceTime);

    return () => clearTimeout(timer);
  }, [email, user, debounceTime]);

  return {
    destinatario,
    searching,
    notFound,
    error,
    setDestinatario,
    setError,
  };
};

export default useUserSearch;