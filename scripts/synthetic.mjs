// Un registro inventado, plausible, para las pruebas: no hay red ni datos
// reales de nadie. Sesiones en días alternos que terminan ayer, rotando A–B–C,
// con cargas que suben poco a poco.

import { PROGRAM, DAY_ORDER } from '../src/config.js';
import { metaFor } from '../src/exercises.js';
import { daysAgo } from '../src/analysis.js';

const START_LOAD = {
  'Sentadilla con barra': 60, 'Press con mancuernas agarre neutro': 20, 'Remo con pecho apoyado': 40,
  'Curl femoral': 30, 'Cuello: flexión': 5, 'Tríceps en polea': 20,
  'Peso muerto rumano': 60, 'Jalón agarre neutro': 50, 'Press landmine a una mano': 20,
  'Zancada búlgara': 12, 'Face pulls': 20, 'Cuello: extensión': 5, 'Curl con mancuernas': 12,
  'Prensa': 120, 'Remo en polea sentado': 50, 'Press de pecho en máquina': 40,
  'Elevaciones laterales': 8, 'Cuello: lateral': 2.5, 'Gemelos': 60,
};

export function syntheticLog(sessions = 18) {
  const rows = [];
  for (let n = 0; n < sessions; n++) {
    const day = DAY_ORDER[n % 3];
    const date = daysAgo(1 + (sessions - 1 - n) * 2);
    const rotation = Math.floor(n / 3);
    PROGRAM[day].exercises.forEach((ex) => {
      const meta = metaFor(ex.name);
      const [lo, hi] = ex.repRange.split('-').map(Number);
      const weight = meta.untracked ? 0 : (START_LOAD[ex.name] ?? 20) + meta.increment * Math.floor(rotation / 2);
      for (let set = 1; set <= ex.sets; set++) {
        rows.push({
          id: `syn-${n}-${ex.name}-${set}`, date, day, exercise: ex.name, set,
          reps: Math.min(hi, lo + (rotation % 2) + (set === ex.sets ? 0 : 1)), weight, rir: 2,
          source: 'app',
        });
      }
    });
  }
  return rows;
}

export function syntheticBody() {
  return [0, 1, 2, 3, 4].map((w) => ({
    date: daysAgo(35 - w * 7), value: 80 + w * 0.1, waist: 86 - w * 0.1,
  }));
}

export function syntheticPartner() {
  return [{ id: 'p1', date: daysAgo(1), minutes: 60, hardness: 3 }, { id: 'p2', date: daysAgo(8), minutes: 60, hardness: 2 }];
}
