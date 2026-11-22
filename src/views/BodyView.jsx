// ─── CUERPO ──────────────────────────────────────────────────────────────────
//
// Peso y cintura, las sesiones con su mujer, y la configuración de este
// dispositivo (código de acceso y copia de seguridad). El corredor objetivo y
// las pautas de ingesta solo aparecen cuando BODY_PARAMS en config.js tiene
// sus datos.
//

import { useState, useRef } from 'react';
import { BODY_PARAMS, SYNC_CONFIG, setAccessCode } from '../config.js';
import { smoothSeries, today as todayIso } from '../analysis.js';
import {
  addBodyweight, addPartnerSession, removePartnerSession,
  exportJSON, importJSON, useStore,
} from '../store.js';
import { LineChart, Stat, Pill } from '../ui.jsx';

const HARDNESS = { 1: 'Suave', 2: 'Normal', 3: 'Dura' };
const fmt = (n, digits = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;

function AccessCode({ onChanged, onToast }) {
  const [code, setCode] = useState('');
  const [hasCode, setHasCode] = useState(Boolean(SYNC_CONFIG.TOKEN));

  const save = () => {
    if (!code.trim()) return;
    setAccessCode(code);
    setCode('');
    setHasCode(true);
    onToast('Código guardado');
    onChanged?.();
  };

  const forget = () => {
    setAccessCode('');
    setHasCode(false);
    onToast('Código borrado de este dispositivo');
  };

  if (!SYNC_CONFIG.URL) {
    return <div className="muted">Esta versión no tiene hoja configurada: todo se guarda solo en este dispositivo.</div>;
  }

  return hasCode ? (
    <div className="row-between">
      <span className="dim">✓ Código de acceso guardado en este dispositivo.</span>
      <button className="btn small ghost" onClick={forget}>Olvidar</button>
    </div>
  ) : (
    <>
      <div className="dim">
        Sin el código, lo que registres se queda en este dispositivo y no se sube a la hoja.
      </div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <div className="field grow">
          <input type="password" autoComplete="off" placeholder="Código de acceso" aria-label="Código de acceso"
            value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
        </div>
        <button className="btn primary" onClick={save} disabled={!code.trim()}>Guardar</button>
      </div>
    </>
  );
}

export default function BodyView({ bodyweight, partner, onToast, onCodeChanged }) {
  const [value, setValue] = useState('');
  const [waistValue, setWaistValue] = useState('');
  const [partnerDate, setPartnerDate] = useState(todayIso());
  const fileInput = useRef(null);
  const local = useStore();

  const series = smoothSeries(bodyweight);
  const waistSeries = smoothSeries(bodyweight, 7, 'waist');
  const latest = series[series.length - 1];
  const first = series[0];
  const latestWaist = waistSeries[waistSeries.length - 1];
  const firstWaist = waistSeries[0];

  const points = series.map((s) => ({ y: s.smooth, label: s.date.slice(5) }));

  // Corredor objetivo, solo si hay objetivo definido en config.js.
  const bandRange = BODY_PARAMS.weeklyChangeBand;
  const slope = (rate) => (first ? series.map((s) => {
    const weeks = (new Date(`${s.date}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / (7 * 86400000);
    return { y: first.smooth + weeks * rate, label: s.date.slice(5) };
  }) : []);
  const band = bandRange ? { lower: slope(bandRange[0]), upper: slope(bandRange[1]) } : null;

  const change = latest && first ? latest.smooth - first.smooth : 0;
  const weeksSpan = latest && first
    ? Math.max((new Date(`${latest.date}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / (7 * 86400000), 0)
    : 0;
  const actualRate = weeksSpan > 1 ? change / weeksSpan : null;
  const waistChange = latestWaist && firstWaist ? latestWaist.smooth - firstWaist.smooth : null;

  const verdict = (() => {
    if (!bandRange || actualRate === null) return null;
    const [lo, hi] = bandRange;
    if (BODY_PARAMS.goal === 'ganar' && waistChange !== null && waistChange > 1.5) {
      return { tone: 'warn', text: 'La cintura sube más de la cuenta: recorta unas 150–200 kcal.' };
    }
    if (actualRate < lo) return { tone: 'warn', text: `Por debajo del ritmo objetivo (${fmt(lo, 2)} a ${fmt(hi, 2)} kg/semana).` };
    if (actualRate > hi) return { tone: 'warn', text: `Por encima del ritmo objetivo (${fmt(lo, 2)} a ${fmt(hi, 2)} kg/semana).` };
    return { tone: 'good', text: 'Dentro del ritmo objetivo.' };
  })();

  const save = () => {
    const v = value.trim() ? parseFloat(value.replace(',', '.')) : null;
    const w = waistValue.trim() ? parseFloat(waistValue.replace(',', '.')) : null;
    if (v === null && w === null) { onToast('Introduce el peso, la cintura o ambos'); return; }
    if (v !== null && (isNaN(v) || v < 30 || v > 200)) { onToast('El peso va en kg'); return; }
    if (w !== null && (isNaN(w) || w < 40 || w > 200)) { onToast('La cintura va en cm'); return; }
    addBodyweight({ date: todayIso(), value: v, waist: w });
    setValue(''); setWaistValue('');
    onToast([v && `${v} kg`, w && `${w} cm`].filter(Boolean).join(' · ') + ' registrado');
  };

  const recentPartner = [...partner].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);

  const download = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entreno-copia-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Copia descargada');
  };

  const restore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importJSON(await file.text());
      onToast('Copia restaurada');
    } catch {
      onToast('No se pudo leer ese archivo');
    }
    event.target.value = '';
  };

  return (
    <div className="page stack">
      <h1>Cuerpo</h1>

      <div className="card" style={{ background: 'var(--accent-soft)', borderColor: '#F5D5D0' }}>
        <div className="label" style={{ color: 'var(--accent)' }}>Medidas de los lunes</div>
        <div className="dim" style={{ marginTop: 8, color: 'var(--ink)' }}>
          Una vez por semana, en ayunas, mismo sitio y misma hora. El peso solo no dice qué tejido
          cambia: <b>la cintura es la que lo aclara</b>.
        </div>
      </div>

      <div className="card">
        <div className="label">Registrar hoy</div>
        <div className="row" style={{ marginTop: 10, gap: 8, alignItems: 'flex-end' }}>
          <div className="field grow">
            <span className="muted">Peso, kg</span>
            <input type="number" inputMode="decimal" step="0.1" placeholder="80,0" aria-label="Peso en kg"
              value={value} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div className="field grow">
            <span className="muted">Cintura, cm</span>
            <input type="number" inputMode="decimal" step="0.1" placeholder="85,0" aria-label="Cintura en cm"
              value={waistValue} onChange={(e) => setWaistValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <button className="btn primary" onClick={save}>Guardar</button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Vale cualquiera de los dos. Mejor ambos.</div>
      </div>

      <div className="stats">
        <Stat label="Actual" value={latest ? `${latest.smooth.toFixed(1)}` : '—'} sub="kg, media móvil" />
        <Stat label="Cambio" value={latest ? fmt(change) : '—'} sub="kg desde el primer registro" />
        <Stat label="Ritmo"
          value={actualRate !== null ? fmt(actualRate, 2) : '—'}
          sub={bandRange ? `kg/sem · objetivo ${fmt(bandRange[0], 2)} a ${fmt(bandRange[1], 2)}` : 'kg/semana'}
          alert={verdict?.tone === 'warn'} />
        <Stat label="Cintura"
          value={latestWaist ? latestWaist.smooth.toFixed(1) : '—'}
          sub={waistChange !== null ? `cm · ${fmt(waistChange)} desde el inicio` : 'cm'} />
      </div>

      <div className="card">
        <div className="label">Peso: media móvil{band ? ' frente al corredor objetivo' : ''}</div>
        <div style={{ marginTop: 12 }}>
          {points.length ? <LineChart points={points} band={band} format={(v) => v.toFixed(1)} />
            : <div className="empty">Aún no hay registros. Con uno por semana basta.</div>}
        </div>
        {verdict && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 8, fontSize: 13.5,
            background: verdict.tone === 'good' ? 'var(--good-bg)' : 'var(--warn-bg)',
            border: `1px solid ${verdict.tone === 'good' ? 'var(--good-line)' : 'var(--warn-line)'}`,
            color: verdict.tone === 'good' ? 'var(--good)' : 'var(--warn)',
          }}>{verdict.text}</div>
        )}
      </div>

      <div className="card">
        <div className="label">Cintura</div>
        <div style={{ marginTop: 12 }}>
          {waistSeries.length
            ? <LineChart points={waistSeries.map((w) => ({ y: w.smooth, label: w.date.slice(5) }))}
                color="var(--info)" height={140} format={(v) => v.toFixed(1)} />
            : <div className="empty">Aún no hay medidas de cintura.</div>}
        </div>
      </div>

      {BODY_PARAMS.proteinTarget && (
        <div className="card">
          <div className="label">Pautas de ingesta</div>
          <div className="stats" style={{ marginTop: 12, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div>
              <div className="muted">Proteína</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{BODY_PARAMS.proteinTarget} g</div>
              <div className="muted">al día</div>
            </div>
            {BODY_PARAMS.calorieTarget && (
              <div>
                <div className="muted">Calorías</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{BODY_PARAMS.calorieTarget}</div>
                <div className="muted">kcal al día, orientativo</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="row-between">
          <div className="label">Sesiones con tu mujer</div>
          <input type="date" value={partnerDate} onChange={(e) => setPartnerDate(e.target.value)}
            aria-label="Fecha de la sesión"
            style={{ padding: '6px 8px', border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }} />
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {[1, 2, 3].map((h) => (
            <button key={h} className="btn small"
              onClick={() => { addPartnerSession({ date: partnerDate, minutes: 60, hardness: h }); onToast(`Sesión ${HARDNESS[h].toLowerCase()} registrada`); }}>
              + {HARDNESS[h]}
            </button>
          ))}
        </div>

        {recentPartner.length === 0
          ? <div className="empty">Aún no hay sesiones registradas.</div>
          : (
            <div className="list" style={{ marginTop: 10 }}>
              {recentPartner.map((g) => (
                <div key={g.id} className="row-between">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="mono" style={{ fontSize: 13 }}>{g.date}</span>
                    <Pill color={g.hardness === 3 ? 'var(--accent)' : g.hardness === 2 ? 'var(--good)' : 'var(--ink-3)'}>
                      {HARDNESS[g.hardness] || 'Normal'}
                    </Pill>
                  </div>
                  {g.source === 'local' && !g.syncedAt && (
                    <button className="btn small ghost" aria-label="Eliminar"
                      onClick={() => { removePartnerSession(g.id); onToast('Eliminada'); }}>×</button>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="card">
        <div className="label">Este dispositivo</div>
        <div style={{ marginTop: 10 }}>
          <AccessCode onChanged={onCodeChanged} onToast={onToast} />
        </div>
        <div className="dim" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule-soft)' }}>
          Lo que registras se sube a la hoja en cuanto hay conexión y se guarda aquí mientras tanto.
          La copia de seguridad sirve antes de borrar datos del navegador o para pasar la cola a otro móvil.
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn small primary" onClick={download}>↓ Descargar copia</button>
          <button className="btn small" onClick={() => fileInput.current?.click()}>↑ Restaurar</button>
          <input ref={fileInput} type="file" accept="application/json,.json"
            onChange={restore} style={{ display: 'none' }} />
        </div>
        <div className="muted mono" style={{ marginTop: 12 }}>
          {local.sets.length} series · {local.partner.length} sesiones con tu mujer · {local.bodyweight.length} pesajes en cola
        </div>
      </div>
    </div>
  );
}
