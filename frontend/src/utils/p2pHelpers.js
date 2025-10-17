/**
 * Invertir tipo de operación (compra ↔ venta)
 */
export const invertirTipoOperacion = (tipoOperacion) => {
  return tipoOperacion === 'compra' ? 'venta' : 'compra';
};

/**
 * Ordenar ofertas por precio según perspectiva del usuario
 */
export const ordenarOfertasPorPrecio = (ofertas, tipoOperacion) => {
  if (!Array.isArray(ofertas)) return [];
  
  const ofertasOrdenadas = [...ofertas].sort((a, b) => {
    const precioA = parseFloat(a.precioUnitario);
    const precioB = parseFloat(b.precioUnitario);
    
    return tipoOperacion === 'compra' 
      ? precioA - precioB
      : precioB - precioA;
  });

  console.log(`📊 Ofertas ordenadas para ${tipoOperacion}:`, {
    cantidad: ofertasOrdenadas.length,
    primerPrecio: ofertasOrdenadas[0]?.precioUnitario,
    ultimoPrecio: ofertasOrdenadas[ofertasOrdenadas.length - 1]?.precioUnitario,
  });

  return ofertasOrdenadas;
};

/**
 * Calcular rango en moneda fiat
 */
export const calcularRangoFiat = (cantidadMin, cantidadMax, precioUnitario) => {
  const min = parseFloat(cantidadMin) * parseFloat(precioUnitario);
  const max = parseFloat(cantidadMax) * parseFloat(precioUnitario);
  
  return { min, max };
};

/**
 * Formatear precio con separadores de miles
 */
export const formatearPrecio = (precio, decimals = 2) => {
  const num = parseFloat(precio);
  if (isNaN(num)) return '0.00';
  
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Filtrar criptomonedas por búsqueda (symbol o nombre)
 */
export const filtrarCriptomonedas = (criptomonedas, busqueda) => {
  if (!busqueda || busqueda.trim() === '') return criptomonedas;
  
  const searchTerm = busqueda.toLowerCase();
  
  return criptomonedas.filter(cripto =>
    cripto.symbol.toLowerCase().includes(searchTerm) ||
    cripto.nombre.toLowerCase().includes(searchTerm)
  );
};

/**
 * ⭐ NUEVO: Calcular cantidad en crypto basado en fiat y precio
 */
export const calcularCantidadCrypto = (montoFiat, precioUnitario) => {
  const fiat = parseFloat(montoFiat);
  const precio = parseFloat(precioUnitario);
  
  if (isNaN(fiat) || isNaN(precio) || precio === 0) return 0;
  
  return fiat / precio;
};

/**
 * ⭐ NUEVO: Obtener símbolo de crypto por ID
 */
export const getCryptoSymbolById = (cryptoId, criptomonedas) => {
  const crypto = criptomonedas.find(c => c.id === cryptoId);
  return crypto?.symbol || 'N/A';
};

export default {
  invertirTipoOperacion,
  ordenarOfertasPorPrecio,
  calcularRangoFiat,
  formatearPrecio,
  filtrarCriptomonedas,
  calcularCantidadCrypto,
  getCryptoSymbolById,
};