// Comprueba la lógica pura con datos sintéticos. Sin red.
//   npm run verify

import './setup-storage.mjs';
import { PROGRAM, DAY_ORDER, nextDayAfter, SYNC_CONFIG, setAccessCode } from '../src/config.js';
import { canonical, metaFor, ALIASES, EXERCISE_META, MUSCLES, MUSCLE_ORDER, MUSCLE_TARGETS } from '../src/exercises.js';
import { BLOCKS, mesocycleState, rotationSpec, PROGRAM_START, TOTAL_PLANNED_SESSIONS } from '../src/mesocycles.js';
import { prescribe } from '../src/progression.js';
import { byExercise, smoothSeries, weeklyLoad, toSessions } from '../src/analysis.js';
import { parseAppTabs } from '../src/sheets.js';
import {
  addSet, addSets, pendingRecords, markSynced, clearAll, removeSet, saveNote, noteFor,
  addBodyweight, deletedIds, addPartnerSession,
} from '../src/store.js';
import { TYPES as SYNC_TYPES } from '../src/sync.js';
import { syntheticLog, syntheticPartner } from './synthetic.mjs';

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? `  [${detail}]` : ''}`); }
};

const byId = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));
const allExercises = DAY_ORDER.flatMap((d) => PROGRAM[d].exercises);

// ── 1. Programa ───────────────────────────────────────────────────────────
console.log('\nPrograma');
const unknown = allExercises.filter((e) => !EXERCISE_META[e.name]).map((e) => e.name);
check('cada ejercicio tiene ficha (incremento y músculos)', unknown.length === 0, unknown.join(', '));
check('cada nombre ya es canónico', allExercises.every((e) => canonical(e.name) === e.name));
const badAlias = Object.entries(ALIASES).filter(([, to]) => !EXERCISE_META[to]);
check('cada alias apunta a un ejercicio existente', badAlias.length === 0, badAlias.map(([a]) => a).join(', '));
const badMuscle = Object.entries(EXERCISE_META).flatMap(([n, m]) => Object.keys(m.muscles).filter((k) => !MUSCLES[k]).map((k) => `${n}:${k}`));
check('cada músculo citado existe', badMuscle.length === 0, badMuscle.join(', '));
check('cada músculo tiene franja objetivo', MUSCLE_ORDER.every((m) => MUSCLE_TARGETS[m]));
check('rangos de repeticiones válidos', allExercises.every((e) => {
  const [lo, hi] = e.repRange.split('-').map(Number); return lo >= 1 && hi >= lo;
}));
check('sin ejercicios repetidos dentro de un día', DAY_ORDER.every((d) => {
  const names = PROGRAM[d].exercises.map((e) => e.name); return new Set(names).size === names.length;
}));
check('cuello todos los días', DAY_ORDER.every((d) => PROGRAM[d].exercises.some((e) => metaFor(e.name).muscles.neck)));
check('manguito o deltoide posterior todos los días', DAY_ORDER.every((d) =>
  PROGRAM[d].exercises.some((e) => metaFor(e.name).muscles.cuff || (metaFor(e.name).muscles.rearDelts ?? 0) >= 1)));
const risky = allExercises.filter((e) => /militar|press con barra|banca|tras nuca|fondos/i.test(e.name));
check('nada de press con barra, banca, militar ni fondos (hombro)', risky.length === 0, risky.map((e) => e.name).join(', '));

// ── 2. Volumen por rotación ───────────────────────────────────────────────
console.log('\nVolumen');
const projected = (block, s) => {
  const spec = rotationSpec(block, s);
  const out = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0]));
  for (const d of DAY_ORDER) {
    PROGRAM[d].exercises.forEach((exercise, i) => {
      if (exercise.optional) return;
      const p = prescribe({ exercise, exerciseIndex: i, history: {}, block, spec });
      for (const [m, w] of Object.entries(metaFor(exercise.name).muscles)) out[m] += p.sets * w;
    });
  }
  return out;
};
const base = projected(byId.M1, 0);
console.log('    base: ' + MUSCLE_ORDER.map((m) => `${m} ${base[m].toFixed(1)}`).join(' · '));
const under = MUSCLE_ORDER.filter((m) => base[m] < MUSCLE_TARGETS[m][0]);
check('la rotación base llega al mínimo de cada músculo', under.length === 0, under.join(', '));
check('más tirón que empuje', base.back + base.rearDelts > base.chest + base.frontDelts,
  `${(base.back + base.rearDelts).toFixed(1)} vs ${(base.chest + base.frontDelts).toFixed(1)}`);

// Duración: ~3,5 min por serie de básico, ~2,5 por el resto, 10 min de calentamiento.
const minutes = (block, s, withOptional) => {
  const spec = rotationSpec(block, s);
  return Math.max(...DAY_ORDER.map((d) => 10 + PROGRAM[d].exercises.reduce((t, exercise, i) => {
    if (exercise.optional && !withOptional) return t;
    const p = prescribe({ exercise, exerciseIndex: i, history: {}, block, spec });
    return t + p.sets * (exercise.type === 'Compound' ? 3.5 : 2.5);
  }, 0)));
};
const peak = minutes(byId.M2, 9, true);
check('la sesión más larga, con opcional, cabe en hora y media', peak <= 90, `${peak} min`);
console.log(`    sesión base ≈ ${minutes(byId.M1, 0, false)} min · pico con opcional ≈ ${peak} min`);

// ── 3. Mesociclos ─────────────────────────────────────────────────────────
console.log('\nMesociclos');
const at = (n) => mesocycleState(Array.from({ length: n }, () => '2026-12-01'));
check('0 sesiones → E0, sesión 1', at(0).block.id === 'E0' && at(0).sessionNumber === 1);
check('6 sesiones → M1, sesión 1', at(6).block.id === 'M1' && at(6).sessionNumber === 1);
check('la sesión 13 de M1 es descarga', at(6 + 12).spec.isDeload);
check('la 12 no', !at(6 + 11).spec.isDeload);
check('19 sesiones → M2', at(19).block.id === 'M2');
check(`las sesiones anteriores al ${PROGRAM_START} no cuentan`, mesocycleState(['2026-11-20']).totalDone === 0);
check('el inicio es lunes', new Date(`${PROGRAM_START}T00:00:00`).getDay() === 1);
check(`total planificado = ${TOTAL_PLANNED_SESSIONS}`, TOTAL_PLANNED_SESSIONS === 6 + 13 * 4);
check('E0 limita a 2 series con RIR 3', rotationSpec(byId.E0, 0).setCap === 2 && rotationSpec(byId.E0, 0).rir === 3);
check('el plan termina sin romperse', at(TOTAL_PLANNED_SESSIONS + 5).finished);

// ── 4. Rotación ───────────────────────────────────────────────────────────
console.log('\nRotación');
check('A → B → C → A', DAY_ORDER.map(nextDayAfter).join('') === 'BCA');

// ── 5. Prescripciones ─────────────────────────────────────────────────────
console.log('\nPrescripciones');
const history = byExercise(syntheticLog(18));
for (const [label, hist] of [['con historial', history], ['sin historial', {}]]) {
  const problems = [];
  for (const block of BLOCKS) {
    for (let s = 0; s < block.sessions; s++) {
      const spec = rotationSpec(block, s);
      for (const day of DAY_ORDER) {
        PROGRAM[day].exercises.forEach((exercise, i) => {
          const p = prescribe({ exercise, exerciseIndex: i, history: hist, block, spec });
          if (!Number.isFinite(p.targetReps)) problems.push(`${block.id}/${s} ${exercise.name}: reps`);
          if (p.sets < 1) problems.push(`${block.id}/${s} ${exercise.name}: ${p.sets} series`);
          if (p.untracked || p.weight == null) return;
          const steps = p.weight / metaFor(exercise.name).increment;
          if (Math.abs(steps - Math.round(steps)) > 1e-9) problems.push(`${block.id}/${s} ${exercise.name}: ${p.weight} kg`);
        });
      }
    }
  }
  check(`cargas válidas en las ${TOTAL_PLANNED_SESSIONS} sesiones, ${label}`, problems.length === 0, problems.slice(0, 3).join(' | '));
}

const SQ = 'Sentadilla con barra';
const sq = PROGRAM.A.exercises.find((e) => e.name === SQ);   // 3 × 6-8, 2,5 kg
const mid = { block: byId.M2, spec: rotationSpec(byId.M2, 4) };
const hist = (sessions) => ({ [SQ]: sessions.flatMap(([date, sets, rotation]) =>
  sets.map(([w, r], i) => ({ date, exercise: SQ, set: i + 1, reps: r, weight: w, rotation }))) });
const rx = (sessions, at = mid) => prescribe({ exercise: sq, exerciseIndex: 0, history: hist(sessions), ...at });

check('la serie más pesada manda, no la media', rx([['2026-12-01', [[60, 6], [60, 6], [57.5, 5]]]]).weight === 60);
check('una serie corta bloquea la subida', rx([['2026-12-01', [[60, 8], [60, 8], [60, 7]]]]).status === 'hold');
const up = rx([['2026-12-01', [[60, 8], [60, 8], [60, 8]]]]);
check('todas arriba del rango → +2,5 kg y vuelta a 6', up.status === 'increase' && up.weight === 62.5 && up.targetReps === 6, `${up.weight} × ${up.targetReps}`);
check('una cuarta serie dura no anula la subida', rx([['2026-12-01', [[60, 8], [60, 8], [60, 8], [60, 5]]]]).status === 'increase');
const ladder = rx([['2026-12-01', [[60, 6], [60, 6], [60, 6]]]]);
check('sesión completa en el mínimo → pide mínimo + 1', ladder.targetReps === 7 && ladder.status === 'hold');
const deload = rx([['2026-12-01', [[60, 8], [60, 8], [60, 8]]]], { block: byId.M1, spec: rotationSpec(byId.M1, 12) });
check('descarga al 60 % y mitad de series', deload.weight === 35 && deload.sets <= 2, `${deload.weight} × ${deload.sets}`);
const afterDeload = rx([['2026-12-01', [[60, 7], [60, 7], [60, 7]], 3], ['2026-12-03', [[35, 6], [35, 6]], 4]],
  { block: byId.M2, spec: rotationSpec(byId.M2, 0) });
check('tras la descarga, el bloque siguiente parte del peso real menos un escalón', afterDeload.weight === 57.5, `${afterDeload.weight}`);
const fresh = prescribe({ exercise: sq, exerciseIndex: 0, history: {}, block: byId.E0, spec: rotationSpec(byId.E0, 0) });
check('sin historial pide elegir peso, con mensaje en español', fresh.status === 'no_data' && /Sin historial/.test(fresh.message));
const neck = PROGRAM.A.exercises.find((e) => e.name === 'Cuello: flexión');
const neckUp = prescribe({ exercise: neck, exerciseIndex: 5, history: { [neck.name]: [1, 2].map((set) => ({
  date: '2026-12-01', exercise: neck.name, set, reps: 20, weight: 5 })) }, ...mid });
check('el cuello progresa de 1,25 en 1,25 kg', neckUp.status === 'increase' && neckUp.weight === 6.25, `${neckUp.weight}`);
const cuff = PROGRAM.A.exercises.find((e) => e.name === 'Rotación externa en polea');
check('la rotación externa no persigue carga', prescribe({ exercise: cuff, exerciseIndex: 4, history: {}, ...mid }).untracked);

// ── 6. Lectura de la hoja ─────────────────────────────────────────────────
console.log('\nLectura de la hoja');
const parsed = parseAppTabs({
  sets: [
    ['a1', '2026-11-23', 'A', 'Sentadilla con barra', 1, 8, 60, 3, 'E0', '', '', '2026-11-23T10:00:00Z'],
    ['a2', '23/11/2026', 'A', 'sentadilla', '2', '8', '62,5', '', 'E0', '', '', ''],
    ['a3', '2026-11-23', 'A', 'Rotación externa en polea', 1, 15, 0, '', 'E0', '', '', ''],
    ['', '2026-11-23', 'A', 'sin id', 1, 8, 60],
  ],
  partner: [['p1', '2026-11-24', 60, 3, '', '']],
  bodyweight: [['b1', '2026-11-23', '80,4', '', '']],
});
check('fechas ISO y D/M/AAAA', parsed.sets.length === 3 && parsed.sets[1].date === '2026-11-23', JSON.stringify(parsed.sets.map((s) => s.date)));
check('decimales con coma', parsed.sets[1].weight === 62.5 && parsed.bodyweight[0].value === 80.4);
check('alias resuelto al leer', parsed.sets[1].exercise === 'Sentadilla con barra');
check('los accesorios a 0 kg se leen', parsed.sets[2].weight === 0);
check('pestañas ausentes → vacías', parseAppTabs({}).notes.length === 0);
check('sesiones con su mujer leídas', parsed.partner[0].hardness === 3);

// ── 7. Código de acceso ───────────────────────────────────────────────────
console.log('\nCódigo de acceso');
check('sin código no hay token', SYNC_CONFIG.TOKEN === '');
setAccessCode('  abc123  ');
check('el código se guarda recortado en el dispositivo', SYNC_CONFIG.TOKEN === 'abc123');
setAccessCode('');
check('y se puede olvidar', SYNC_CONFIG.TOKEN === '');
check('sin URL la sincronización está desactivada', !SYNC_CONFIG.enabled);

// ── 8. Cola de sincronización ─────────────────────────────────────────────
console.log('\nCola de sincronización');
clearAll();
addSets([
  { date: '2026-11-23', day: 'A', exercise: SQ, set: 1, reps: 8, weight: 60 },
  { date: '2026-11-23', day: 'A', exercise: SQ, set: 2, reps: 8, weight: 60 },
]);
let queued = pendingRecords('sets');
check('las series nuevas quedan en cola', queued.length === 2);
check('con id único', new Set(queued.map((r) => r.id)).size === 2);
markSynced('sets', [queued[0].id]);
check('las confirmadas salen de la cola', pendingRecords('sets').length === 1);
addSet({ date: '2026-11-23', day: 'A', exercise: 'Curl femoral', set: 1, reps: 12, weight: 30 });
const target = pendingRecords('sets').find((s) => s.exercise === 'Curl femoral');
removeSet(target.id);
check('una serie deshecha antes de subir no llega a la hoja', !pendingRecords('sets').some((s) => s.id === target.id));
const synced = pendingRecords('sets')[0];
markSynced('sets', [synced.id]);
removeSet(synced.id);
check('deshacer una serie ya subida encola un borrado', pendingRecords('deletions').length === 1 && deletedIds().has(synced.id));
check('los borrados se sincronizan', SYNC_TYPES.includes('deletions'));
clearAll();

addPartnerSession({ date: '2026-11-24', hardness: 3 });
addPartnerSession({ date: '2026-11-24', hardness: 2 });
check('una sesión con su mujer por día', pendingRecords('partner').length === 1 && pendingRecords('partner')[0].hardness === 2);
check('las sesiones con su mujer se sincronizan', SYNC_TYPES.includes('partner'));
const sessions = toSessions(syntheticLog(6));
const weeks = weeklyLoad(sessions, syntheticPartner(), 4);
check('cuentan en la carga semanal', weeks.reduce((t, w) => t + w.extra, 0) === 2, JSON.stringify(weeks.map((w) => w.extra)));
check('pero no avanzan la rotación', mesocycleState(sessions.map((s) => s.date)).totalDone <= sessions.length);
clearAll();

saveNote({ date: '2026-11-23', day: 'A', block: 'E0', note: '  hombro bien  ' });
check('las notas se guardan recortadas', noteFor('2026-11-23') === 'hombro bien');
saveNote({ date: '2026-11-23', day: 'A', block: 'E0', note: '' });
check('y se borran', noteFor('2026-11-23') === '' && pendingRecords('notes').length === 0);

addBodyweight({ date: '2026-11-23', value: 80.2 });
addBodyweight({ date: '2026-11-23', waist: 86 });
const bw = pendingRecords('bodyweight');
check('peso y cintura del mismo día en una fila', bw.length === 1 && bw[0].value === 80.2 && bw[0].waist === 86);
check('la serie de cintura salta días sin medida',
  smoothSeries([{ date: '2026-11-23', value: 80, waist: 86 }, { date: '2026-11-30', value: 80.1 }], 7, 'waist').length === 1);
clearAll();

console.log(`\n${pass} correctas, ${fail} fallidas\n`);
process.exit(fail ? 1 : 0);
