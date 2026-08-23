// tests/time.test.js
//
// Fase 1 — zonas horarias. Los límites "diarios" (ej. el límite diario de
// volumen de exchange) deben calcularse en UTC, no en la hora local del server:
// created_at se guarda en UTC (TIMESTAMPTZ), así que un borde de día armado con
// setHours() (hora local) desalinea la ventana según la TZ del server. Estos
// helpers computan el borde en UTC, de forma determinística sin importar la TZ
// del runner de tests.

const { startOfUtcDay, endOfUtcDay } = require('../utils/time');

describe('time — bordes de día en UTC', () => {
  test('startOfUtcDay devuelve la medianoche UTC del mismo día', () => {
    const d = new Date('2026-08-23T15:30:45.123Z');
    expect(startOfUtcDay(d).toISOString()).toBe('2026-08-23T00:00:00.000Z');
  });

  test('endOfUtcDay devuelve el último ms del día UTC', () => {
    const d = new Date('2026-08-23T15:30:45.123Z');
    expect(endOfUtcDay(d).toISOString()).toBe('2026-08-23T23:59:59.999Z');
  });

  test('un instante justo antes de medianoche UTC pertenece a ese día UTC (no al siguiente)', () => {
    const d = new Date('2026-08-23T23:59:59.999Z');
    expect(startOfUtcDay(d).toISOString()).toBe('2026-08-23T00:00:00.000Z');
  });

  test('no mutan la fecha de entrada', () => {
    const d = new Date('2026-08-23T15:30:45.123Z');
    startOfUtcDay(d);
    endOfUtcDay(d);
    expect(d.toISOString()).toBe('2026-08-23T15:30:45.123Z');
  });
});
