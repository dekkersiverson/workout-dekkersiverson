// ─── REGISTRO DE EJERCICIOS ──────────────────────────────────────────────────
//
// Un nombre canónico por movimiento, más las variantes que puedan escribirse a
// mano (importación o edición en la hoja). Sin esto, "Jalón" y "Jalón al pecho"
// partirían el historial en dos.
//

// alias (en minúsculas) → nombre canónico
export const ALIASES = {
  'sentadilla': 'Sentadilla con barra',
  'sentadilla trasera': 'Sentadilla con barra',
  'press mancuernas': 'Press con mancuernas agarre neutro',
  'press con mancuernas': 'Press con mancuernas agarre neutro',
  'remo pecho apoyado': 'Remo con pecho apoyado',
  'remo en máquina': 'Remo con pecho apoyado',
  'curl de isquios': 'Curl femoral',
  'curl femoral tumbado': 'Curl femoral',
  'curl femoral sentado': 'Curl femoral',
  'rotación externa': 'Rotación externa en polea',
  'rotacion externa': 'Rotación externa en polea',
  'peso muerto rumano con mancuernas': 'Peso muerto rumano',
  'rdl': 'Peso muerto rumano',
  'jalón': 'Jalón agarre neutro',
  'jalon': 'Jalón agarre neutro',
  'jalón al pecho': 'Jalón agarre neutro',
  'press landmine': 'Press landmine a una mano',
  'búlgara': 'Zancada búlgara',
  'sentadilla búlgara': 'Zancada búlgara',
  'facepull': 'Face pulls',
  'face pull': 'Face pulls',
  'prensa de piernas': 'Prensa',
  'remo en polea': 'Remo en polea sentado',
  'remo gironda': 'Remo en polea sentado',
  'press pecho máquina': 'Press de pecho en máquina',
  'press de pecho': 'Press de pecho en máquina',
  'laterales': 'Elevaciones laterales',
  'elevación lateral': 'Elevaciones laterales',
  'pallof': 'Pallof press',
  'tríceps polea': 'Tríceps en polea',
  'triceps en polea': 'Tríceps en polea',
  'curl mancuernas': 'Curl con mancuernas',
  'curl de bíceps': 'Curl con mancuernas',
  'gemelo': 'Gemelos',
  'gemelos de pie': 'Gemelos',
};

/** Resuelve cualquier forma escrita a su nombre canónico. */
export function canonical(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  return ALIASES[trimmed.toLowerCase()] || trimmed;
}

// ─── ATRIBUCIÓN MUSCULAR ─────────────────────────────────────────────────────
//
// Fracción de cada serie que se acredita a cada músculo: 1 trabajo directo,
// 0.5 secundario relevante, 0.25 incidental. Alimenta el gráfico de volumen.
//

export const MUSCLES = {
  back: 'Espalda',
  chest: 'Pecho',
  quads: 'Cuádriceps',
  hams: 'Isquios',
  glutes: 'Glúteos',
  sideDelts: 'Deltoide lateral',
  frontDelts: 'Deltoide anterior',
  rearDelts: 'Deltoide posterior',
  cuff: 'Manguito rotador',
  triceps: 'Tríceps',
  biceps: 'Bíceps',
  neck: 'Cuello',
  core: 'Core',
  calves: 'Gemelos',
};

export const MUSCLE_ORDER = [
  'back', 'chest', 'quads', 'hams', 'glutes',
  'sideDelts', 'frontDelts', 'rearDelts', 'cuff',
  'triceps', 'biceps', 'neck', 'core',
];

// Series efectivas por rotación A–B–C. El límite inferior es más o menos la
// rotación base; el superior, la rotación pico con las series extra.
export const MUSCLE_TARGETS = {
  back: [9, 12], chest: [6, 9], quads: [8, 11], hams: [6, 9], glutes: [6, 9],
  sideDelts: [3, 5], frontDelts: [5, 7], rearDelts: [5, 8], cuff: [4, 6],
  triceps: [4, 6], biceps: [4, 6], neck: [6, 6], core: [0, 2], calves: [0, 2],
};

// untracked: carga ligera o fija, sin progresión (se marca como hecho).
export const EXERCISE_META = {
  'Sentadilla con barra':              { increment: 2.5,  muscles: { quads: 1, glutes: 0.5, hams: 0.25 } },
  'Press con mancuernas agarre neutro': { increment: 2,    muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 } },
  'Remo con pecho apoyado':            { increment: 2.5,  muscles: { back: 1, biceps: 0.5, rearDelts: 0.5 } },
  'Curl femoral':                      { increment: 2.5,  muscles: { hams: 1 } },
  'Rotación externa en polea':         { increment: 1.25, muscles: { cuff: 1 }, untracked: true },
  'Cuello: flexión':                   { increment: 1.25, muscles: { neck: 1 } },
  'Tríceps en polea':                  { increment: 2.5,  muscles: { triceps: 1 } },

  'Peso muerto rumano':                { increment: 2.5,  muscles: { hams: 1, glutes: 1, back: 0.25 } },
  'Jalón agarre neutro':               { increment: 2.5,  muscles: { back: 1, biceps: 0.5 } },
  'Press landmine a una mano':         { increment: 2.5,  muscles: { frontDelts: 1, chest: 0.5, triceps: 0.5 } },
  'Zancada búlgara':                   { increment: 2,    muscles: { quads: 1, glutes: 0.5 } },
  'Face pulls':                        { increment: 2.5,  muscles: { rearDelts: 1, cuff: 0.5 } },
  'Cuello: extensión':                 { increment: 1.25, muscles: { neck: 1 } },
  'Curl con mancuernas':               { increment: 2,    muscles: { biceps: 1 } },

  'Prensa':                            { increment: 5,    muscles: { quads: 1, glutes: 0.5 } },
  'Remo en polea sentado':             { increment: 2.5,  muscles: { back: 1, biceps: 0.5, rearDelts: 0.5 } },
  'Press de pecho en máquina':         { increment: 2.5,  muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 } },
  'Elevaciones laterales':             { increment: 1,    muscles: { sideDelts: 1 } },
  'Pallof press':                      { increment: 2.5,  muscles: { core: 1 }, untracked: true },
  'Cuello: lateral':                   { increment: 1.25, muscles: { neck: 1 } },
  // Fuera del programa por ahora; se conserva por si vuelve.
  'Gemelos':                           { increment: 5,    muscles: { calves: 1 } },
};

export function metaFor(name) {
  return EXERCISE_META[canonical(name)] || { increment: 2.5, muscles: {} };
}

/** Redondea una carga a algo que exista en el gimnasio. */
export function roundToIncrement(weight, increment) {
  if (!increment) return Math.round(weight * 2) / 2;
  return Math.round(weight / increment) * increment;
}
