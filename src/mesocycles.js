// ─── MESOCICLOS ──────────────────────────────────────────────────────────────
//
// Un bloque son trece sesiones (cuatro rotaciones A–B–C más una descarga), no
// cuatro semanas. Un bloque contado en sesiones no se puede "perder", solo
// retrasar: si una semana falla, la tira se desplaza a la derecha.
//
// Las fechas son orientativas, calculadas a unas tres sesiones por semana.
//

export const PROGRAM_START = '2026-11-23';

export const BLOCKS = [
  {
    id: 'E0', name: 'Entrada', kind: 'entry', sessions: 6,
    window: '23 nov – 6 dic',
    note: 'Dos series por ejercicio, dejando 3 repeticiones en reserva. Sirve para encontrar los pesos de cada ejercicio y probar el hombro con todos los movimientos. Si algo molesta, se cambia aquí, antes de cargar.',
    setCap: 2, rir: 3, loadPct: 1,
  },
  {
    id: 'M1', name: 'Acumulación I', kind: 'ramp', sessions: 13,
    window: '7 dic – 10 ene',
    note: 'Primer bloque completo. Las series suben a lo largo de las rotaciones y la reserva baja de 3 a 0,5. Navidad cae aquí: si se pierde una semana, el bloque simplemente se alarga.',
  },
  {
    id: 'M2', name: 'Acumulación II', kind: 'ramp', sessions: 13,
    window: '11 ene – 14 feb',
    note: 'El bloque de más volumen: en la última rotación el cuarto ejercicio lleva una serie extra. Los básicos arrancan un escalón por debajo de donde terminó M1.',
    extraAccessorySet: true,
  },
  {
    id: 'M3', name: 'Acumulación III', kind: 'ramp', sessions: 13,
    window: '15 feb – 21 mar',
    note: 'Volumen estándar otra vez. Si el hombro lo permite, buen momento para valorar con el fisio si se reintroduce algún press por encima de la cabeza.',
  },
  {
    id: 'M4', name: 'Fuerza', kind: 'ramp', sessions: 13,
    window: '22 mar – 25 abr',
    note: 'Dos repeticiones menos y una serie menos en los básicos, con más carga. Después, se replanifica con cinco meses de datos.',
    repShift: -2, setDelta: -1,
  },
];

export const TOTAL_PLANNED_SESSIONS = BLOCKS.reduce((s, b) => s + b.sessions, 0);

// Repeticiones en reserva (RIR) por rotación.
export const RIR_BY_ROTATION = [3, 2, 1.5, 0.5];
const DELOAD_RIR = 5;
// Stamped on every set logged in a deload, so progression can skip them.
export const DELOAD_ROTATION = 4;

/**
 * Where a session sits inside its block.
 * Rotations 0–3 are sessions 1–12; session 13 is the deload.
 */
export function rotationSpec(block, sessionInBlock) {
  if (block.kind !== 'ramp') {
    return {
      rotation: null,
      label: block.kind === 'entry' ? 'Entrada' : 'Mantenimiento',
      rir: block.rir,
      loadPct: block.loadPct ?? 1,
      isDeload: false,
      setCap: block.setCap,
    };
  }
  const isDeload = sessionInBlock >= block.sessions - 1;
  if (isDeload) {
    return { rotation: DELOAD_ROTATION, label: 'Descarga', rir: DELOAD_RIR, loadPct: 0.6, isDeload: true, halveSets: true };
  }
  const rotation = Math.floor(sessionInBlock / 3);
  return {
    rotation,
    label: `Rotación ${rotation + 1}`,
    rir: RIR_BY_ROTATION[Math.min(rotation, 3)],
    loadPct: 1,
    isDeload: false,
  };
}

/**
 * Extra sets earned by position in the block.
 * Rotation 2 adds a set to the first lift; rotation 3 adds one to the third.
 */
export function setBonus(block, spec, exerciseIndex) {
  if (block.kind !== 'ramp' || spec.isDeload || spec.rotation == null) return 0;
  let bonus = 0;
  if (spec.rotation >= 1 && exerciseIndex === 0) bonus += 1;
  if (spec.rotation >= 2 && exerciseIndex === 2) bonus += 1;
  if (block.extraAccessorySet && spec.rotation >= 3 && exerciseIndex === 3) bonus += 1;
  return bonus;
}

/**
 * Current position in the plan, derived purely from logged sessions on or
 * after PROGRAM_START. No manual state to keep in sync, and a missed week
 * delays the block rather than invalidating it.
 */
export function mesocycleState(sessionDates) {
  const done = sessionDates.filter((d) => d >= PROGRAM_START).length;

  let remaining = done;
  for (let i = 0; i < BLOCKS.length; i++) {
    const block = BLOCKS[i];
    if (remaining < block.sessions) {
      const spec = rotationSpec(block, remaining);
      return {
        block,
        blockIndex: i,
        sessionInBlock: remaining,
        sessionNumber: remaining + 1,
        sessionsLeftInBlock: block.sessions - remaining,
        spec,
        totalDone: done,
        nextBlock: BLOCKS[i + 1] || null,
        finished: false,
      };
    }
    remaining -= block.sessions;
  }

  const last = BLOCKS[BLOCKS.length - 1];
  return {
    block: last,
    blockIndex: BLOCKS.length - 1,
    sessionInBlock: last.sessions,
    sessionNumber: last.sessions,
    sessionsLeftInBlock: 0,
    spec: rotationSpec(last, last.sessions - 1),
    totalDone: done,
    nextBlock: null,
    finished: true,
  };
}

/** Cumulative session index at which each block starts — for the year strip. */
export function blockOffsets() {
  let acc = 0;
  return BLOCKS.map((b) => {
    const start = acc;
    acc += b.sessions;
    return { id: b.id, start, end: acc };
  });
}
