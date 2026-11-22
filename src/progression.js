// ─── PROGRESSION ─────────────────────────────────────────────────────────────
//
// Two rules the old implementation got wrong:
//
//  1. Load comes from the TOP set, not the average of all sets. Averaging
//     57.5 / 57.5 / 55 proposed 56.7 kg — below the top set, and not a weight
//     that exists on a barbell.
//  2. Progression requires ALL working sets at the top of the range, which is
//     what the Program tab always claimed and the code never did.
//

import { metaFor, roundToIncrement } from './exercises.js';
import { setBonus, DELOAD_ROTATION } from './mesocycles.js';

// A gap longer than this is treated as detrained, which is what re-entry and
// hold blocks discount against.
const DETRAINING_DAYS = 21;

export function e1rm(weight, reps) {
  return weight * (1 + reps / 30);
}

export function parseRepRange(range) {
  const [lo, hi] = String(range).split('-').map(Number);
  return { lo, hi: hi ?? lo };
}

/** Heaviest set of a session; ties broken by reps. */
export function topSet(sets) {
  return sets.reduce((best, s) => {
    if (s.weight > best.weight) return s;
    if (s.weight === best.weight && s.reps > best.reps) return s;
    return best;
  }, sets[0]);
}

/** The most recent session in which this exercise was trained. */
export function lastPerformance(history, exerciseName) {
  const sets = history[exerciseName];
  if (!sets?.length) return null;
  const date = sets.reduce((a, s) => (s.date > a ? s.date : a), sets[0].date);
  return { date, sets: sets.filter((s) => s.date === date) };
}

/**
 * This exercise's sessions, newest first, each reduced to the sets the plan
 * actually asked for. `base` is the exercise's base set count — deliberately
 * not the ramped count, so the rep target does not lurch when a rotation adds
 * a set.
 */
export function sessionHistory(history, name, base) {
  const sets = history[name] || [];
  if (!sets.length) return [];

  const byDate = {};
  for (const s of sets) (byDate[s.date] ||= []).push(s);

  return Object.entries(byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, all]) => {
      const ordered = [...all].sort((a, b) => (a.set || 0) - (b.set || 0));
      const judged = ordered.slice(0, Math.max(1, Math.min(base, ordered.length)));
      const load = topSet(judged).weight;
      return {
        date,
        load,
        logged: ordered.length,
        extras: ordered.length - judged.length,
        minReps: Math.min(...judged.map((s) => s.reps)),
        maxReps: Math.max(...judged.map((s) => s.reps)),
        // Completed AT THIS LOAD: every base set done, and all of them at the
        // same weight. A session cut short does not qualify, nor does one that
        // dropped the weight part-way.
        complete: judged.length >= base && judged.every((s) => s.weight >= load),
        deload: all.some((s) => s.rotation === DELOAD_ROTATION),
      };
    });
}

/**
 * What to do today, for one exercise, given where we are in the block.
 * Returns everything the Today card needs to render without further maths.
 */
export function prescribe({ exercise, exerciseIndex, history, block, spec }) {
  const meta = metaFor(exercise.name);

  // ── Sets ──────────────────────────────────────────────────────────────
  let sets = exercise.sets + setBonus(block, spec, exerciseIndex) + (block.setDelta || 0);
  if (spec.setCap) sets = Math.min(sets, spec.setCap);
  if (spec.halveSets) sets = Math.ceil(sets / 2);
  sets = Math.max(1, sets);

  // ── Reps ──────────────────────────────────────────────────────────────
  let { lo, hi } = parseRepRange(exercise.repRange);
  if (block.repShift && exercise.type === 'Compound') {
    lo = Math.max(3, lo + block.repShift);
    hi = Math.max(lo + 2, hi + block.repShift);
  }
  const repRange = lo === hi ? `${lo}` : `${lo}–${hi}`;

  const base = {
    name: exercise.name, sets, lo, hi, repRange,
    rir: spec.rir, optional: !!exercise.optional, type: exercise.type,
    increment: meta.increment,
  };

  if (meta.untracked) {
    return { ...base, targetReps: lo, untracked: true, weight: null, status: 'accessory',
      message: 'Carga ligera o fija, sin dolor. Sin progresión: márcalo como hecho' };
  }

  // ── Load ──────────────────────────────────────────────────────────────
  // A deload is not a performance. Measured from it, the next block would
  // restart one increment below 60% of its load, a hold block would hold 60%,
  // and a second deload set would take 60% of 60%.
  const past = sessionHistory(history, exercise.name, exercise.sets).filter((s) => !s.deload);
  const last = past[0];
  const firstExposure = spec.rotation === 0 && !spec.isDeload;

  if (!last) {
    if (exercise.restart) {
      return { ...base, targetReps: lo, weight: exercise.restart, status: 'restart',
        message: `Carga inicial de ${block.id}` };
    }
    return { ...base, targetReps: lo, weight: null, status: 'no_data',
      message: `Sin historial: elige un peso con el que hagas ${lo} repeticiones dejando ${spec.rir} en reserva` };
  }

  const round = (w) => roundToIncrement(w, meta.increment);

  // The rep target only moves off a session that was actually completed at the
  // current load. A session cut short, or a bonus set that happened to be
  // heavier, must never advance it — otherwise a load increase would be
  // followed by a target nobody has earned.
  const baseline = past.find((s) => s.complete && s.load === last.load);

  const lastSummary = {
    date: last.date, sets: last.logged, extras: last.extras,
    weight: last.load, minReps: last.minReps, maxReps: last.maxReps,
    complete: last.complete,
    floors: past.filter((s) => s.complete && s.load === last.load)
      .slice(0, 3).map((s) => s.minReps).reverse(),
  };

  if (spec.isDeload) {
    return { ...base, targetReps: lo, weight: round(last.load * 0.6), status: 'deload', lastSummary,
      message: 'Descarga: la mitad de series, 60 % del peso, cinco repeticiones en reserva' };
  }

  // The re-entry discount assumes detraining. It should not fire when you have
  // been training recently — 65% of a current load would be far too light.
  const daysSinceLast = (Date.now() - new Date(`${last.date}T00:00:00`)) / 86400000;
  if (spec.loadPct && spec.loadPct < 1 && daysSinceLast > DETRAINING_DAYS) {
    return { ...base, targetReps: lo, weight: round(last.load * spec.loadPct), status: 'reentry', lastSummary,
      message: `${Math.round(spec.loadPct * 100)} % de tu último peso de trabajo: ${Math.round(daysSinceLast)} días sin entrenar` };
  }

  if (firstExposure && block.useRestart && exercise.restart) {
    return { ...base, targetReps: lo, weight: exercise.restart, status: 'restart', lastSummary,
      message: `Reinicio de bloque: ${exercise.restart} kg` };
  }

  if (firstExposure && block.kind === 'ramp') {
    return { ...base, targetReps: lo,
      weight: round(Math.max(last.load - meta.increment, meta.increment)), status: 'restart', lastSummary,
      message: 'Reinicio de bloque: un escalón por debajo de donde terminó el anterior' };
  }

  const extraNote = last.extras
    ? ` · ${last.extras} ${last.extras === 1 ? 'serie extra no cuenta' : 'series extra no cuentan'} en tu contra`
    : '';

  // Top of the range on every prescribed set: the load goes up and the ladder
  // restarts at the bottom.
  if (baseline && baseline.minReps >= hi) {
    return { ...base, targetReps: lo, weight: round(last.load + meta.increment), status: 'increase', lastSummary,
      message: `Todas las series llegaron a ${hi} con ${last.load} kg: sube ${meta.increment} kg y vuelve a ${lo}${extraNote}` };
  }

  const held = round(last.load);

  // Never completed this load yet: the target stays at the bottom until a full
  // session earns the first step.
  if (!baseline) {
    return { ...base, targetReps: lo, weight: held, status: 'hold', lastSummary,
      message: `Mantén ${held} kg a ${lo} repeticiones: ${exercise.sets} series completas con este peso antes de que suba el objetivo${extraNote}` };
  }

  const targetReps = Math.min(baseline.minReps + 1, hi);
  const sameSession = baseline.date === last.date;

  return { ...base, targetReps, weight: held, status: 'hold', lastSummary,
    message: `Mantén ${held} kg · todas las series a ${targetReps} hoy`
      + (sameSession ? ` (el mínimo fue ${baseline.minReps})` : ` (última sesión completa ${baseline.date}, mínimo ${baseline.minReps})`)
      + (targetReps >= hi ? `. Si lo consigues, +${meta.increment} kg` : '')
      + extraNote };
}

export const STATUS_STYLE = {
  increase: { label: 'Sube peso', color: '#1A8A6E', bg: '#EDF8F5', border: '#C5E8DE' },
  hold:     { label: 'Mantén',     color: '#B8860B', bg: '#FFF8E6', border: '#F0E6C0' },
  restart:  { label: 'Reinicio',  color: '#1A6BB5', bg: '#EEF5FC', border: '#CFE2F5' },
  deload:   { label: 'Descarga',   color: '#7B5EA7', bg: '#F5F1FA', border: '#E0D4F0' },
  reentry:  { label: 'Reentrada', color: '#1A6BB5', bg: '#EEF5FC', border: '#CFE2F5' },
  no_data:  { label: 'Nuevo',      color: '#666',    bg: '#FAFAF9', border: '#E8E6E3' },
  accessory:{ label: 'Accesorio',color: '#666',    bg: '#FAFAF9', border: '#E8E6E3' },
};
