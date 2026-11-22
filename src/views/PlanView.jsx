// ─── PLAN ────────────────────────────────────────────────────────────────────
//
// El plan de un vistazo y las tres sesiones con la prescripción de hoy. Los
// bloques se dibujan según su número de sesiones, no según el calendario.
//

import { useState } from 'react';
import { PROGRAM, DAY_ORDER } from '../config.js';
import { BLOCKS, TOTAL_PLANNED_SESSIONS, PROGRAM_START, rotationSpec } from '../mesocycles.js';
import { prescribe, STATUS_STYLE } from '../progression.js';
import { Pill } from '../ui.jsx';

const KIND_COLOR = {
  ramp: 'var(--info)',
  entry: 'var(--good)',
  hold: 'var(--ink-3)',
};

function YearStrip({ meso }) {
  return (
    <div className="scroll-x">
      <div style={{ display: 'flex', gap: 2, minWidth: 560 }}>
        {BLOCKS.map((b, i) => {
          const current = i === meso.blockIndex;
          const done = i < meso.blockIndex;
          const color = KIND_COLOR[b.kind];
          return (
            <div key={b.id} style={{ flex: b.sessions, minWidth: 0 }}>
              <div style={{
                height: 40, borderRadius: 4, display: 'flex', alignItems: 'center',
                paddingLeft: 8, overflow: 'hidden',
                background: current ? color : done ? 'var(--sunk)' : `${color}22`,
                border: current ? 'none' : `1px solid ${done ? 'var(--rule)' : `${color}55`}`,
              }}>
                <span className="mono" style={{
                  fontSize: 11, fontWeight: 700,
                  color: current ? '#fff' : done ? 'var(--ink-3)' : color,
                }}>{b.id}</span>
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 4, textAlign: 'center' }}>
                {b.sessions}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlanView({ meso, history }) {
  const [day, setDay] = useState(meso.currentDay || 'A');
  const plan = PROGRAM[day];
  const { block, spec } = meso;

  return (
    <div className="page stack">
      <div>
        <h1>El plan</h1>
        <p className="dim" style={{ marginTop: 6 }}>
          {BLOCKS.length} bloques, {TOTAL_PLANNED_SESSIONS} sesiones, tres sesiones propias por semana más el día
          con tu mujer. Un bloque termina en su última sesión, pase lo que pase con el calendario.
        </p>
      </div>

      <div className="card">
        <div className="label">Bloques, según número de sesiones</div>
        <div style={{ marginTop: 12 }}><YearStrip meso={meso} /></div>
        <div className="muted" style={{ marginTop: 10 }}>
          Ahora en <b style={{ color: 'var(--ink)' }}>{block.id} · {block.name}</b>,
          sesión {meso.sessionNumber} de {block.sessions} · {meso.totalDone} de {TOTAL_PLANNED_SESSIONS} registradas
          desde el {new Date(`${PROGRAM_START}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.
        </div>
      </div>

      <div className="card">
        <div className="label">Un mesociclo</div>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Fase</th><th>Sesiones</th><th>Series</th><th>RIR</th></tr>
          </thead>
          <tbody>
            {[0, 3, 6, 9, 12].map((s) => {
              const sp = rotationSpec({ kind: 'ramp', sessions: 13 }, s);
              const rows = ['base', '+1 en el ejercicio 1', '+1 en el ejercicio 3', 'mantener el pico', 'la mitad'];
              const idx = s === 12 ? 4 : s / 3;
              return (
                <tr key={s} style={{ background: meso.spec.label === sp.label ? 'var(--accent-soft)' : undefined }}>
                  <td style={{ color: 'var(--ink)', fontWeight: 600 }}>{sp.label}</td>
                  <td className="mono">{s === 12 ? '13' : `${s + 1}–${s + 3}`}</td>
                  <td>{rows[idx]}</td>
                  <td className="mono">{sp.rir}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="label">Sesión {day}</div>
        <div className="row" style={{ gap: 6, marginTop: 10, marginBottom: 4 }}>
          {DAY_ORDER.map((d) => (
            <button key={d} className={`btn small${day === d ? ' primary' : ''}`}
              style={day === d ? { background: PROGRAM[d].color } : undefined}
              onClick={() => setDay(d)}>
              {d} — {PROGRAM[d].name.split('—')[1].trim()}
            </button>
          ))}
        </div>
        <div className="list" style={{ marginTop: 8 }}>
          {plan.exercises.map((ex, i) => {
            const p = prescribe({ exercise: ex, exerciseIndex: i, history, block, spec });
            const style = STATUS_STYLE[p.status] || STATUS_STYLE.hold;
            return (
              <div key={ex.name + i} className="row-between" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    {i + 1}. {ex.name}
                    {ex.optional && <span className="muted" style={{ fontWeight: 400 }}> · si hay tiempo</span>}
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>{p.message}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
                    {p.untracked ? '—' : p.weight !== null ? `${p.weight} kg` : '?'}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.sets} × {p.repRange}</div>
                  <div style={{ marginTop: 4 }}><Pill color={style.color}>{style.label}</Pill></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="label">Bloques</div>
        <div className="list" style={{ marginTop: 6 }}>
          {BLOCKS.map((b, i) => (
            <div key={b.id} style={{ opacity: i < meso.blockIndex ? 0.5 : 1 }}>
              <div className="row-between">
                <div className="row" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontWeight: 700, color: KIND_COLOR[b.kind] }}>{b.id}</span>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{b.name}</span>
                  {i === meso.blockIndex && <Pill color="var(--accent)">Actual</Pill>}
                </div>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{b.window} · {b.sessions}</span>
              </div>
              <div className="dim" style={{ marginTop: 5, fontSize: 13.5 }}>{b.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ background: 'var(--good-bg)', borderColor: 'var(--good-line)' }}>
        <div className="label" style={{ color: 'var(--good)' }}>Hombro y cuello</div>
        <ul style={{ margin: '10px 0 0 18px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
          <li>Si un ejercicio molesta en el hombro (más de 3 sobre 10, o dolor que dura al día siguiente), baja el peso o acorta el recorrido. Si sigue, cámbialo y apúntalo en la nota.</li>
          <li>Nada de press con barra ni por encima de la cabeza hasta que el hombro lo permita. El landmine es el puente.</li>
          <li>La rotación externa y los face pulls no se saltan, ni siquiera en la descarga.</li>
          <li>Cuello: empieza muy ligero, sin tirones y con el recorrido controlado. Sube carga solo cuando todas las series lleguen a 20.</li>
          <li>Si el día con tu mujer fue duro de pierna, al día siguiente deja una repetición más en reserva en A o B.</li>
          <li>Esto no sustituye a un fisioterapeuta: si el hombro está en tratamiento, que revise la lista de ejercicios.</li>
        </ul>
      </div>
    </div>
  );
}
