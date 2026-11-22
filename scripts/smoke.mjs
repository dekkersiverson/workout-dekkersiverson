// Renderiza todas las vistas en el servidor con un registro sintético, luego
// con la app vacía y con una sesión completa. Detecta errores en tiempo de
// ejecución que el build no ve.
//   npm run smoke

import { rmSync } from 'node:fs';
import { build } from 'esbuild';
import { syntheticLog, syntheticBody, syntheticPartner } from './synthetic.mjs';

const out = new URL('./.smoke-bundle.mjs', import.meta.url).pathname;
await build({
  entryPoints: [new URL('./smoke.jsx', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'node', outfile: out,
  jsx: 'automatic', external: ['react', 'react-dom'], logLevel: 'error',
  define: { 'import.meta.env': '{}' },
});

const { run, runEmpty, runComplete } = await import(out);
const rows = syntheticLog(18);

let fail = 0;
const report = (label, { results, meso, day, sessions }) => {
  console.log(`\n${label}`);
  console.log(`  bloque ${meso.block.id} · sesión ${meso.sessionNumber}/${meso.block.sessions} · ${meso.spec.label} · RIR ${meso.spec.rir} · siguiente día ${day} · ${sessions} sesiones`);
  for (const [name, len] of Object.entries(results)) {
    const ok = len > 400;
    if (!ok) fail++;
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(9)} ${len.toLocaleString('es-ES')} caracteres`);
  }
};

try {
  report(`Registro sintético · ${rows.length} series`, run(rows, syntheticPartner(), syntheticBody()));
  report('App vacía · instalación nueva', runEmpty());

  const done = runComplete();
  console.log('\nSesión completa');
  for (const [label, ok] of [
    ['aparece el aviso de completada', done.complete],
    ['nombra el siguiente día', done.nextDay],
  ]) {
    if (!ok) fail++;
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  }
} catch (err) {
  console.error('\n✗ el render falló:', err.stack);
  fail++;
} finally {
  rmSync(out, { force: true });
}

console.log(fail ? `\n${fail} fallidas\n` : '\nTodas las vistas se renderizan.\n');
process.exit(fail ? 1 : 0);
