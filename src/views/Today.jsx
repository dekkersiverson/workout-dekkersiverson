// ─── TODAY ───────────────────────────────────────────────────────────────────
//
// La pantalla de inicio: lee la última letra registrada, muestra la siguiente
// y nunca ofrece elegir. Si se puede elegir el día, el A se repite y el C se
// olvida.
//

import { useState, useEffect } from 'react';
import { PROGRAM, nextDayAfter } from '../config.js';
import { prescribe, STATUS_STYLE } from '../progression.js';
import { setBonus } from '../mesocycles.js';
import { today as todayIso, daysAgo } from '../analysis.js';
import { addSet, addSets, removeSet, addPartnerSession, saveNote, noteFor } from '../store.js';
import { Pill, Track } from '../ui.jsx';

function BlockHeader({ meso }) {
  const { block, sessionNumber, spec, sessionsLeftInBlock, nextBlock } = meso;
  return (
    <div className="block-head">
      <div className="row-between">
        <div>
          <div className="label">{block.id} · {block.name}</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 3 }}>
            Sesión {sessionNumber} de {block.sessions}
          </div>
        </div>
        <Pill color="#fff" solid={false}>{spec.label}</Pill>
      </div>
      <Track value={sessionNumber - 1} max={block.sessions} color="#fff" />
      <div className="block-meta">
        <span>Objetivo <b>RIR {spec.rir}</b></span>
        {spec.isDeload
          ? <span><b>Sesión de descarga</b>: mitad de series, 60 %</span>
          : block.kind === 'ramp'
            ? <span>Descarga en <b>{sessionsLeftInBlock - 1}</b> {sessionsLeftInBlock - 1 === 1 ? 'sesión' : 'sesiones'}</span>
            : <span>Quedan <b>{sessionsLeftInBlock}</b> {sessionsLeftInBlock === 1 ? 'sesión' : 'sesiones'}</span>}
        {nextBlock && <span>Después <b>{nextBlock.id}</b> · {nextBlock.name}</span>}
      </div>
    </div>
  );
}

function SetLogger({ exercise, prescription, loggedSets, day, block, spec, onLogged }) {
  const [drafts, setDrafts] = useState({});
  const [extraSlots, setExtraSlots] = useState(0);
  const iso = todayIso();

  // Rows beyond the prescription: either already logged, or opened by hand.
  const extraLogged = Math.max(0, loggedSets.length - prescription.sets);
  const rowCount = prescription.sets + Math.max(extraSlots, extraLogged);

  const draftFor = (i) => drafts[i] ?? {
    reps: prescription.targetReps ?? prescription.lo,
    weight: prescription.weight ?? '',
    rir: Math.round(prescription.rir),   // actual, pre-filled with the target
  };

  const update = (i, patch) => setDrafts((d) => ({ ...d, [i]: { ...draftFor(i), ...patch } }));

  const log = (i) => {
    const { reps, weight, rir } = draftFor(i);
    if (!reps || weight === '' || weight === null) return;
    addSet({
      date: iso, day, exercise: exercise.name, set: i + 1,
      reps: Number(reps), weight: Number(weight),
      rir: rir === '' || rir === null ? null : Number(rir),
      block: block.id, rotation: spec.rotation,
    });
    onLogged?.(`${exercise.name}: serie ${i + 1} registrada`);
  };

  // Deshacer un toque por error.
  const undo = (i) => {
    const done = loggedSets[i];
    if (!done?.id) return;
    removeSet(done.id);
    setDrafts((d) => ({ ...d, [i]: { reps: done.reps, weight: done.weight, rir: done.rir } }));
    onLogged?.(`${exercise.name}: serie ${i + 1} deshecha`);
  };

  const anyLogged = loggedSets.some((s) => s?.id);

  return (
    <>
      <div className="set-hint">
        <span /><span>Reps</span><span>kg</span><span>RIR</span><span />
      </div>
      <div className="sets">
        {Array.from({ length: rowCount }, (_, i) => {
          const done = loggedSets[i];
          const draft = draftFor(i);
          const undoable = !!done?.id;
          const extra = i >= prescription.sets;
          return (
            <div className={`set-row${extra ? ' extra' : ''}`} key={i}>
              <div className="n" title={extra ? 'Serie extra: volumen adicional, no cuenta para la progresión' : undefined}>
                {i + 1}{extra && '+'}
              </div>
              <input type="number" inputMode="numeric" aria-label={`Serie ${i + 1} repeticiones`}
                value={done ? done.reps : draft.reps}
                disabled={!!done}
                onChange={(e) => update(i, { reps: e.target.value })} />
              <input type="number" inputMode="decimal" step="0.5" aria-label={`Serie ${i + 1} peso`}
                value={done ? done.weight : draft.weight}
                disabled={!!done}
                onChange={(e) => update(i, { weight: e.target.value })} />
              <input type="number" inputMode="numeric" min="0" max="6" step="1"
                aria-label={`Serie ${i + 1} repeticiones en reserva`}
                className={!done && Number(draft.rir) < prescription.rir ? 'hot' : undefined}
                value={done ? (done.rir ?? '') : draft.rir}
                disabled={!!done}
                onChange={(e) => update(i, { rir: e.target.value })} />
              <button className={`act${done ? ' done' : ''}`}
                onClick={() => (done ? undo(i) : log(i))}
                disabled={!!done && !undoable}
                title={undoable ? 'Toca para deshacer' : done ? 'Registrada' : 'Registrar esta serie'}
                aria-label={undoable ? `Deshacer serie ${i + 1}` : done ? `Serie ${i + 1} registrada` : `Registrar serie ${i + 1}`}>
                {done ? '✓' : '+'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ padding: '0 var(--pad) 12px', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn small ghost" onClick={() => setExtraSlots((n) => n + 1)}>
          + Añadir serie
        </button>
        <span className="muted">
          {anyLogged && 'Toca ✓ para deshacer. '}
          {rowCount > prescription.sets && 'Las series extra suman volumen y nunca cuentan en contra.'}
        </span>
      </div>
    </>
  );
}

function AccessoryLogger({ exercise, prescription, loggedSets, day, block, spec, onLogged }) {
  const iso = todayIso();
  const done = loggedSets.length > 0;

  const mark = () => {
    addSets(Array.from({ length: prescription.sets }, (_, i) => ({
      date: iso, day, exercise: exercise.name, set: i + 1,
      reps: prescription.targetReps ?? prescription.lo, weight: 0, rir: null,
      block: block.id, rotation: spec.rotation,
    })));
    onLogged?.(`${exercise.name}: hecho`);
  };

  const clear = () => {
    loggedSets.filter((s) => s.id).forEach((s) => removeSet(s.id));
    onLogged?.(`${exercise.name}: borrado`);
  };

  return (
    <div className="sets">
      <button className={`btn${done ? '' : ' primary'}`}
        onClick={done ? clear : mark}
        style={done ? { background: 'var(--good-bg)', color: 'var(--good)' } : undefined}>
        {done ? `✓ Hecho: ${loggedSets.length} × ${prescription.targetReps}. Toca para borrar` : `Marcar ${prescription.sets} × ${prescription.targetReps} como hecho`}
      </button>
    </div>
  );
}

function ExerciseCard({ exercise, index, history, block, spec, loggedSets, day, onLogged }) {
  const p = prescribe({ exercise, exerciseIndex: index, history, block, spec });
  const style = STATUS_STYLE[p.status] || STATUS_STYLE.hold;
  const bonus = setBonus(block, spec, index);

  return (
    <div className={`ex-card${p.optional ? ' optional' : ''}`}>
      <div className="ex-head">
        <div className="grow">
          <div className="ex-name">
            {index + 1}. {exercise.name}
            {p.optional && <span className="muted" style={{ fontWeight: 400 }}> · si hay tiempo</span>}
          </div>
          <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
            <Pill color={style.color}>{style.label}</Pill>
            {bonus > 0 && <Pill color="var(--info)">+{bonus} serie</Pill>}
          </div>
        </div>
        <div className="ex-target">
          {p.untracked ? '—' : p.weight !== null ? `${p.weight} kg` : '?'}
          <small>{p.repRange} reps @ RIR {p.rir}</small>
        </div>
      </div>

      <div className="ex-note" style={{ background: style.bg, color: style.color, borderTop: `1px solid ${style.border}` }}>
        {p.message}
      </div>

      {p.untracked ? (
        <AccessoryLogger exercise={exercise} prescription={p} loggedSets={loggedSets}
          day={day} block={block} spec={spec} onLogged={onLogged} />
      ) : (
        <SetLogger exercise={exercise} prescription={p} loggedSets={loggedSets}
          day={day} block={block} spec={spec} onLogged={onLogged} />
      )}

      {p.lastSummary && (
        <div className="ex-last">
          Última vez {p.lastSummary.date} · {p.lastSummary.sets} series
          {p.lastSummary.extras > 0 && ` (${p.lastSummary.extras} extra)`} con {p.lastSummary.weight} kg
          {p.lastSummary.floors?.length > 1 && ` · mínimo ${p.lastSummary.floors.join(' → ')}`}
          {' · '}{p.lastSummary.minReps === p.lastSummary.maxReps
            ? `${p.lastSummary.maxReps} reps`
            : `${p.lastSummary.minReps}–${p.lastSummary.maxReps} reps`}
        </div>
      )}
    </div>
  );
}

function SessionNote({ date, day, block, onSaved }) {
  const [text, setText] = useState(() => noteFor(date));
  const [dirty, setDirty] = useState(false);

  // Recargar si cambia el día a mitad de sesión.
  useEffect(() => { setText(noteFor(date)); setDirty(false); }, [date]);

  const commit = () => {
    if (!dirty) return;
    saveNote({ date, day, block: block.id, note: text });
    setDirty(false);
    onSaved?.(text.trim() ? 'Nota guardada' : 'Nota borrada');
  };

  return (
    <div className="card">
      <div className="label">Nota de la sesión (opcional)</div>
      <div className="field" style={{ marginTop: 8 }}>
        <textarea
          value={text}
          placeholder="Hombro molesto en el press · dormí mal · gimnasio lleno, sin prensa"
          style={{ minHeight: 64, fontFamily: 'inherit', fontSize: 14 }}
          onChange={(e) => { setText(e.target.value); setDirty(true); }}
          onBlur={commit} />
      </div>
      <div className="row-between" style={{ marginTop: 8 }}>
        <span className="muted">
          {dirty ? 'Sin guardar' : text.trim() ? 'Guardada' : 'Apunta sobre todo cómo responde el hombro.'}
        </span>
        {dirty && <button className="btn small primary" onClick={commit}>Guardar nota</button>}
      </div>
    </div>
  );
}

export default function Today({ meso, day, history, data, partner, lastSessionDate, onToast }) {
  const iso = todayIso();
  const plan = PROGRAM[day];
  const { block, spec } = meso;

  const loggedToday = data.filter((r) => r.date === iso);
  const byExerciseToday = {};
  for (const r of loggedToday) {
    (byExerciseToday[r.exercise] ||= []).push(r);
  }
  for (const list of Object.values(byExerciseToday)) list.sort((a, b) => a.set - b.set);

  const yesterday = daysAgo(1);
  const recentPartner = partner.find((g) => g.date === iso || g.date === yesterday);
  const legDay = day === 'A' || day === 'B';

  // "Hecho" es al menos una serie: irse tras el segundo ejercicio ya cuenta
  // como sesión.
  const core = plan.exercises.filter((e) => !e.optional);
  const coreCount = core.length;
  const doneCount = core.filter((e) => byExerciseToday[e.name]?.length).length;
  const complete = coreCount > 0 && doneCount === coreCount;
  const setsToday = loggedToday.length;

  return (
    <div className="page stack">
      <BlockHeader meso={meso} />

      <div className={`day-banner${complete ? ' complete' : ''}`}>
        <div className="day-badge" style={complete
          ? { background: 'var(--good)', color: '#fff' }
          : { background: plan.colorLight, color: plan.color }}>
          {complete ? '✓' : day}
        </div>
        <div className="grow">
          <div style={{ fontWeight: 600, fontSize: 15.5 }}>
            {complete ? `Día ${day} completado` : plan.name.replace(/^Día . — /, '')}
          </div>
          <div className="muted" style={{ marginTop: 2 }}>
            {complete
              ? `${coreCount} de ${coreCount} ejercicios · ${setsToday} series · el próximo es el día ${nextDayAfter(day)}`
              : doneCount > 0
                ? `${doneCount} de ${coreCount} ejercicios · ya cuenta como sesión`
                : (lastSessionDate
                    ? `Siguiente en la rotación tras el ${lastSessionDate}`
                    : 'Primera sesión del plan')}
          </div>
          {doneCount > 0 && !complete && (
            <div style={{ marginTop: 8 }}>
              <Track value={doneCount} max={coreCount} color="var(--good)" />
            </div>
          )}
        </div>
      </div>

      {complete && (
        <div className="card" style={{ background: 'var(--good-bg)', borderColor: 'var(--good-line)' }}>
          <div className="dim" style={{ color: 'var(--ink)' }}>
            No hay que cerrar nada: una sesión es su fecha. Cuenta en cuanto cambia el día, y la
            próxima vez esta pantalla abre en el <b>día {nextDayAfter(day)}</b>.
            Lo que añadas abajo sigue contando para hoy.
          </div>
        </div>
      )}

      {recentPartner && legDay && recentPartner.hardness >= 3 && (
        <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-line)' }}>
          <div className="label" style={{ color: 'var(--warn)' }}>Ajuste</div>
          <div className="dim" style={{ marginTop: 6, color: 'var(--ink)' }}>
            Sesión dura con tu mujer {recentPartner.date === iso ? 'hoy' : 'ayer'} y hoy toca pierna.
            Deja una repetición más en reserva en todo y sáltate el opcional. Una sesión reducida también avanza el bloque.
          </div>
        </div>
      )}

      {spec.isDeload && (
        <div className="card" style={{ background: 'var(--plum-bg)', borderColor: '#E0D4F0' }}>
          <div className="label" style={{ color: 'var(--plum)' }}>Descarga</div>
          <div className="dim" style={{ marginTop: 6, color: 'var(--ink)' }}>
            La mitad de las series al 60 % del peso, cinco repeticiones en reserva. Esta sesión es la que hace posible el siguiente bloque: no te la saltes.
          </div>
        </div>
      )}

      <div className="stack">
        {plan.exercises.map((exercise, i) => (
          <ExerciseCard
            key={exercise.name + i}
            exercise={exercise}
            index={i}
            history={history}
            block={block}
            spec={spec}
            day={day}
            loggedSets={byExerciseToday[exercise.name] || []}
            onLogged={onToast}
          />
        ))}
      </div>

      <SessionNote date={iso} day={day} block={block} onSaved={onToast} />

      <div className="card">
        <div className="label">¿Hoy con tu mujer?</div>
        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={() => { addPartnerSession({ date: iso, minutes: 60, hardness: 2 }); onToast('Sesión con tu mujer registrada'); }}>
            + Sesión normal
          </button>
          <button className="btn small" onClick={() => { addPartnerSession({ date: iso, minutes: 60, hardness: 3 }); onToast('Sesión dura con tu mujer registrada'); }}>
            + Sesión dura
          </button>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          No avanza la rotación A–B–C, pero cuenta en tu carga semanal. Regístrala el día que entrenes con ella,
          no hace falta registrar sus ejercicios.
        </div>
      </div>
    </div>
  );
}
