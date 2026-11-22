// ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────
//
// La app lee y escribe la hoja de cálculo SOLO a través del Apps Script
// (apps-script/Code.gs). No hay clave de Google en el código y la hoja no está
// compartida por enlace.
//
//   VITE_SYNC_URL  — la URL /exec del Apps Script. No es secreta: sin el código
//                    de acceso no devuelve datos.
//
// El código de acceso (SHARED_TOKEN en Code.gs) NUNCA va en el código ni en el
// build. Se introduce una vez en cada dispositivo (pantalla Cuerpo → Este
// dispositivo) o llega en un enlace con #codigo=…, y se guarda en el propio
// dispositivo. Así, quien encuentre la URL pública ve una app vacía.
//

// `?? {}` mantiene este módulo importable fuera de Vite (scripts de prueba).
const env = import.meta.env ?? {};

const TOKEN_KEY = 'workout-dekkersiverson/codigo';
const hasStorage = typeof localStorage !== 'undefined';

function readToken() {
  if (!hasStorage) return '';
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export const SYNC_CONFIG = {
  URL: env.VITE_SYNC_URL || '',
  get TOKEN() { return readToken(); },
  get enabled() { return Boolean(this.URL && this.TOKEN); },
};

export function setAccessCode(code) {
  if (!hasStorage) return;
  try {
    const clean = String(code ?? '').trim();
    if (clean) localStorage.setItem(TOKEN_KEY, clean);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* modo privado: la app sigue funcionando solo en local */ }
}

/**
 * Un enlace del tipo …/workout-dekkersiverson/#codigo=XYZ guarda el código y
 * lo borra de la barra de direcciones. Se llama una vez al arrancar.
 */
export function captureAccessCodeFromUrl() {
  if (typeof window === 'undefined') return false;
  const match = window.location.hash.match(/codigo=([^&]+)/);
  if (!match) return false;
  setAccessCode(decodeURIComponent(match[1]));
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return true;
}

// Pestañas de la hoja que crea y usa el Apps Script. Mantener en sintonía con
// TABS en apps-script/Code.gs.
export const APP_TABS = {
  sets: 'Series',
  partner: 'Con mi mujer',
  bodyweight: 'Peso corporal',
  notes: 'Notas',
};

// ─── PROGRAMA ────────────────────────────────────────────────────────────────
//
// Tres sesiones propias por semana en rotación A → B → C (el cuarto día va con
// su mujer y hace el programa de ella; se registra aparte). Cuerpo completo
// cada día, unos 60–75 min, dentro del límite de hora y media.
//
// Hombro: nada de press con barra ni por encima de la cabeza; agarre neutro,
// más tirón que empuje y trabajo de manguito o deltoide posterior cada día.
// Cuello: un plano distinto cada día (flexión, extensión, lateral).
//
//   optional — "si hay tiempo". No cuenta para completar la sesión.
//

export const PROGRAM = {
  A: {
    name: 'Día A — Sentadilla y empuje',
    tag: 'A',
    color: '#C8391E',
    colorLight: '#FEF2F0',
    exercises: [
      { name: 'Sentadilla con barra',              type: 'Compound',  sets: 3, repRange: '6-8' },
      { name: 'Press con mancuernas agarre neutro', type: 'Compound',  sets: 3, repRange: '8-12' },
      { name: 'Remo con pecho apoyado',            type: 'Compound',  sets: 3, repRange: '8-12' },
      { name: 'Curl femoral',                      type: 'Isolation', sets: 3, repRange: '10-15' },
      { name: 'Rotación externa en polea',         type: 'Accessory', sets: 2, repRange: '12-15' },
      { name: 'Cuello: flexión',                   type: 'Accessory', sets: 2, repRange: '15-20' },
      { name: 'Tríceps en polea',                  type: 'Isolation', sets: 2, repRange: '10-15', optional: true },
    ],
  },
  B: {
    name: 'Día B — Bisagra y tirón',
    tag: 'B',
    color: '#1A6BB5',
    colorLight: '#EEF5FC',
    exercises: [
      { name: 'Peso muerto rumano',                type: 'Compound',  sets: 3, repRange: '8-10' },
      { name: 'Jalón agarre neutro',               type: 'Compound',  sets: 3, repRange: '8-12' },
      { name: 'Press landmine a una mano',         type: 'Compound',  sets: 3, repRange: '8-12' },
      { name: 'Zancada búlgara',                   type: 'Compound',  sets: 3, repRange: '8-10' },
      { name: 'Face pulls',                        type: 'Isolation', sets: 3, repRange: '15-20' },
      { name: 'Cuello: extensión',                 type: 'Accessory', sets: 2, repRange: '15-20' },
      { name: 'Curl con mancuernas',               type: 'Isolation', sets: 2, repRange: '10-15', optional: true },
    ],
  },
  C: {
    name: 'Día C — Pierna y espalda',
    tag: 'C',
    color: '#1A8A6E',
    colorLight: '#EDF8F5',
    exercises: [
      { name: 'Prensa',                            type: 'Compound',  sets: 3, repRange: '10-15' },
      { name: 'Remo en polea sentado',             type: 'Compound',  sets: 3, repRange: '10-15' },
      { name: 'Press de pecho en máquina',         type: 'Compound',  sets: 3, repRange: '8-12' },
      { name: 'Elevaciones laterales',             type: 'Isolation', sets: 3, repRange: '12-18' },
      { name: 'Rotación externa en polea',         type: 'Accessory', sets: 2, repRange: '12-15' },
      { name: 'Cuello: lateral',                   type: 'Accessory', sets: 2, repRange: '15-20' },
      { name: 'Pallof press',                      type: 'Accessory', sets: 2, repRange: '10-12', optional: true },
    ],
  },
};

export const DAY_ORDER = ['A', 'B', 'C'];

/** La rotación es estricta: nunca se elige el día. */
export function nextDayAfter(day) {
  const i = DAY_ORDER.indexOf(day);
  return i === -1 ? 'A' : DAY_ORDER[(i + 1) % DAY_ORDER.length];
}

// Pendiente de sus datos (peso, altura, edad, objetivo). Mientras sean null,
// la pantalla Cuerpo muestra solo las tendencias, sin corredor objetivo ni
// pautas de ingesta.
//
//   weeklyChangeBand — kg/semana, p. ej. [0.05, 0.1] para ganar músculo o
//                      [-0.5, -0.25] para perder grasa.
export const BODY_PARAMS = {
  weight: null,
  height: null,
  age: null,
  goal: null,               // 'ganar' | 'perder' | 'mantener'
  proteinTarget: null,      // g/día
  calorieTarget: null,      // kcal/día
  weeklyChangeBand: null,
  targetSessionsPerWeek: 3,
};
