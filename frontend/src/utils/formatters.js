// src/utils/formatters.js
import jsPDF from 'jspdf';

/**
 * Formatear cantidad de criptomoneda con decimales
 * @param {Number} amount - Cantidad a formatear
 * @param {Number} decimals - Número de decimales (default: 8)
 * @returns {String}
 */
export const formatCryptoAmount = (amount, decimals = 8) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.00000000';
  return num.toFixed(decimals);
};

/**
 * Formatear fecha en español (Argentina)
 * @param {String|Date} date - Fecha a formatear
 * @returns {String}
 */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('es-AR');
};

/**
 * Formatear fecha solo hora
 * @param {String|Date} date
 * @returns {String}
 */
export const formatTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleTimeString('es-AR');
};

/**
 * Formatear fecha relativa (para notificaciones)
 * @param {String|Date} dateString - Fecha a formatear
 * @returns {String} "Ahora", "Hace 3m", "Hace 2h", "Hace 5d", "15 Oct"
 */
export const formatRelativeDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInMinutes < 1) return 'Ahora';
  if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
  if (diffInHours < 24) return `Hace ${diffInHours}h`;
  if (diffInDays < 7) return `Hace ${diffInDays}d`;

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
};

/**
 * Calcular cantidad basada en porcentaje del balance
 * @param {Number} balance - Balance disponible
 * @param {Number} percentage - Porcentaje (0-100)
 * @returns {String}
 */
export const getPercentageAmount = (balance, percentage) => {
  const amount = (parseFloat(balance) * percentage) / 100;
  return formatCryptoAmount(amount, 8);
};

/**
 * Obtener icono de criptomoneda con fallback
 * @param {String} symbol - Símbolo de la crypto
 * @param {String} iconUrl - URL del icono (opcional)
 * @returns {String}
 */
export const getCryptoIcon = (symbol, iconUrl) => {
  if (iconUrl) return iconUrl;
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${symbol.toLowerCase()}.svg`;
};

/**
 * Generar PDF de comprobante de transferencia
 * @param {Object} transfer - Datos de la transferencia
 */
export const generateTransferPDF = (transfer) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('Comprobante de Transferencia', 105, 20, { align: 'center' });

  // Line separator
  doc.setLineWidth(0.5);
  doc.line(20, 25, 190, 25);

  // Transfer ID and Date
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`ID: ${transfer.id}`, 105, 32, { align: 'center' });
  doc.text(`Fecha: ${formatDate(transfer.created_at)}`, 105, 38, { align: 'center' });

  // Details section
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Detalles de la Transferencia', 20, 55);

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');

  let yPos = 65;

  // Destinatario
  doc.setFont(undefined, 'bold');
  doc.text('Destinatario:', 20, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(transfer.destinatario?.username || 'N/A', 70, yPos);
  yPos += 10;

  // Criptomoneda
  doc.setFont(undefined, 'bold');
  doc.text('Criptomoneda:', 20, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(
    `${transfer.criptomonedaTransferencia?.symbol} - ${transfer.criptomonedaTransferencia?.nombre}`,
    70,
    yPos
  );
  yPos += 10;

  // Cantidad
  doc.setFont(undefined, 'bold');
  doc.text('Cantidad:', 20, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(formatCryptoAmount(transfer.cantidad), 70, yPos);
  yPos += 10;

  // Nota (if exists)
  if (transfer.nota) {
    doc.setFont(undefined, 'bold');
    doc.text('Nota:', 20, yPos);
    doc.setFont(undefined, 'normal');

    // Split long notes into multiple lines
    const notaLines = doc.splitTextToSize(transfer.nota, 120);
    doc.text(notaLines, 70, yPos);
    yPos += notaLines.length * 7 + 3;
  }

  // Estado
  doc.setFont(undefined, 'bold');
  doc.text('Estado:', 20, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(transfer.estado.toUpperCase(), 70, yPos);
  yPos += 15;

  // Features section
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Características', 20, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('✓ Sin comisión', 25, yPos);
  yPos += 6;
  doc.text('✓ Transferencia instantánea', 25, yPos);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text('Este es un comprobante digital de tu transferencia', 105, 270, { align: 'center' });
  doc.text(`Generado el ${formatDate(new Date())}`, 105, 276, { align: 'center' });

  // Save PDF
  doc.save(`comprobante-${transfer.id}.pdf`);

  console.log('📄 PDF generado para transferencia:', transfer.id);
};

/**
 * Obtener destinatarios únicos del historial
 * @param {Array} historial - Historial de transferencias
 * @param {Number} limit - Límite de destinatarios (default: 12)
 * @returns {Array}
 */
export const getUniqueRecipients = (historial, limit = 12) => {
  const uniqueRecipients = [];
  const seenIds = new Set();

  for (const transfer of historial) {
    if (transfer.destinatario && !seenIds.has(transfer.destinatario.id)) {
      uniqueRecipients.push(transfer.destinatario);
      seenIds.add(transfer.destinatario.id);
      if (uniqueRecipients.length >= limit) break;
    }
  }

  console.log('👥 Destinatarios únicos encontrados:', uniqueRecipients.length);
  return uniqueRecipients;
};

/**
 * Obtener criptomonedas únicas del historial
 * @param {Array} historial
 * @returns {Array}
 */
export const getUniqueCryptos = (historial) => {
  const cryptos = historial
    .map((t) => t.criptomonedaTransferencia?.symbol)
    .filter(Boolean);
  return [...new Set(cryptos)];
};

export default {
  formatCryptoAmount,
  formatDate,
  formatTime,
  formatRelativeDate,
  getPercentageAmount,
  getCryptoIcon,
  generateTransferPDF,
  getUniqueRecipients,
  getUniqueCryptos,
};