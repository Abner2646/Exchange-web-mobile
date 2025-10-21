// src/components/common/ScrollToTop.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Componente que restaura el scroll al tope en cada cambio de ruta.
 * Se ejecuta automáticamente cuando cambia el pathname.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll instantáneo al tope de la página
    window.scrollTo(0, 0);
    
    // Alternativa con smooth scroll (opcional):
    // window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [pathname]);

  return null; // Este componente no renderiza nada
}

export default ScrollToTop;