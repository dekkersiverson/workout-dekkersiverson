// ─── LECTURA DE LA HOJA ──────────────────────────────────────────────────────
//
// Todo pasa por el Apps Script (apps-script/Code.gs): GET ?codigo=… devuelve
// las cuatro pestañas que la app escribe. Ni clave de API ni hoja compartida.
//
// Las columnas las fija TABS en Code.gs. Mantener ambos en sintonía.
//

import { SYNC_CONFIG } from './config.js';
import { canonical } from './exercises.js';

const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
};

/** AAAA-MM-DD. Acepta también D/M/AAAA por si alguien edita la hoja a mano. */
function isoDate(v) {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * Filas crudas de las pestañas → registros de la app.
 * Exportado para que las pruebas usen este parser y no una copia.
 */
export function parseAppTabs({ sets = [], partner = [], bodyweight = [], notes = [] }) {
  return {
    sets: sets
      .map((r) => ({ r, date: isoDate(r[1]) }))
      .filter(({ r, date }) => r[0] && date && r[3])
      .map(({ r, date }) => ({
        id: String(r[0]), date, day: r[2] || 'A', exercise: canonical(r[3]),
        set: parseInt(r[4], 10) || 1, reps: parseInt(r[5], 10), weight: num(r[6]) ?? 0,
        rir: num(r[7]), block: r[8] || null, rotation: num(r[9]),
        comment: r[10] || null, source: 'app',
      }))
      .filter((r) => !isNaN(r.reps)),

    partner: partner
      .map((r) => ({ r, date: isoDate(r[1]) }))
      .filter(({ r, date }) => r[0] && date)
      .map(({ r, date }) => ({
        id: String(r[0]), date, minutes: num(r[2]) ?? 60,
        hardness: num(r[3]) ?? 2, source: 'app',
      })),

    bodyweight: bodyweight
      .map((r) => ({ r, date: isoDate(r[1]) }))
      .filter(({ r, date }) => r[0] && date && (num(r[2]) !== null || num(r[3]) !== null))
      .map(({ r, date }) => ({ id: String(r[0]), date, value: num(r[2]), waist: num(r[3]), source: 'app' })),

    notes: notes
      .map((r) => ({ r, date: isoDate(r[1]) }))
      .filter(({ r, date }) => r[0] && date && r[4])
      .map(({ r, date }) => ({ id: String(r[0]), date, day: r[2] || null, block: r[3] || null, note: r[4], source: 'app' })),
  };
}

export async function fetchFromSheet() {
  if (!SYNC_CONFIG.URL) throw new Error('Falta VITE_SYNC_URL: la app funciona solo en este dispositivo');
  if (!SYNC_CONFIG.TOKEN) throw new Error('Introduce el código de acceso en Cuerpo → Este dispositivo');

  // GET sin cabeceras propias: petición "simple", sin preflight CORS, que es
  // lo único que una aplicación web de Apps Script sabe responder.
  const url = `${SYNC_CONFIG.URL}?codigo=${encodeURIComponent(SYNC_CONFIG.TOKEN)}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`El script respondió ${response.status}`);

  const result = await response.json().catch(() => {
    throw new Error('Respuesta no válida del script: revisa la implementación');
  });
  if (!result.ok) {
    throw new Error(result.error === 'unauthorised'
      ? 'Código de acceso incorrecto'
      : `Error del script: ${result.error}`);
  }

  const app = parseAppTabs(result.data || {});
  console.log(`[hoja] ${app.sets.length} series, ${app.partner.length} con mujer, ${app.bodyweight.length} pesajes`);
  return app;
}
