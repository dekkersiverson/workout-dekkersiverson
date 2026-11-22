/**
 * Entreno — endpoint de lectura y escritura
 * ────────────────────────────────────────────────────────────────────────────
 * Publicado como aplicación web, vinculado a la hoja de cálculo del registro.
 * Es la ÚNICA vía de acceso de la app a la hoja: la hoja no se comparte por
 * enlace y no hay clave de API de Google.
 *
 *   GET  ?codigo=…   → todos los datos (sin código: solo un chequeo de salud)
 *   POST {token, type, records} → añade registros, deduplicados por id
 *
 * INSTALACIÓN — ver docs/SETUP.md:
 *   1. En la hoja: Extensiones → Apps Script, sustituir todo por este archivo.
 *   2. Poner en SHARED_TOKEN una cadena larga y aleatoria.
 *   3. Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como:   Yo
 *        Quién accede:    Cualquier usuario
 *   4. Autorizar y copiar la URL /exec.
 */

// El código de acceso que se introduce en la app. Sin él no se lee ni se
// escribe nada. Con el valor de fábrica el endpoint lo rechaza todo.
const SHARED_TOKEN = 'CHANGE_ME';

// Leave empty when the script is bound to the Sheet (Extensions → Apps Script).
// If you created it standalone at script.google.com instead, put the Sheet ID
// here — the part of the Sheet URL between /d/ and /edit.
const SHEET_ID = '';

function book() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('No bound spreadsheet — set SHEET_ID at the top of this script');
  }
  return active;
}

const TABS = {
  sets: {
    name: 'Series',
    headers: ['id', 'fecha', 'día', 'ejercicio', 'serie', 'reps', 'peso', 'rir', 'bloque', 'rotación', 'nota', 'registrado'],
    fields: ['id', 'date', 'day', 'exercise', 'set', 'reps', 'weight', 'rir', 'block', 'rotation', 'note', 'loggedAt'],
  },
  partner: {
    name: 'Con mi mujer',
    headers: ['id', 'fecha', 'minutos', 'intensidad', 'nota', 'registrado'],
    fields: ['id', 'date', 'minutes', 'hardness', 'note', 'loggedAt'],
  },
  bodyweight: {
    name: 'Peso corporal',
    headers: ['id', 'fecha', 'kg', 'cintura_cm', 'registrado'],
    fields: ['id', 'date', 'value', 'waist', 'loggedAt'],
  },
  notes: {
    name: 'Notas',
    headers: ['id', 'fecha', 'día', 'bloque', 'nota', 'registrado'],
    fields: ['id', 'date', 'day', 'block', 'note', 'loggedAt'],
  },
};

function tokenConfigured() {
  return SHARED_TOKEN && SHARED_TOKEN !== 'CHANGE_ME';
}

function sheetFor(key) {
  const config = TABS[key];
  if (!config) throw new Error('Unknown record type: ' + key);

  const target = book();
  let sheet = target.getSheetByName(config.name);
  if (!sheet) {
    sheet = target.insertSheet(config.name);
    sheet.appendRow(config.headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, config.headers.length).setFontWeight('bold');
    // Fechas como texto: si no, la hoja convierte "2026-11-23" en una fecha
    // con formato local y la app la leería como "23/11/2026".
    sheet.getRange('B:B').setNumberFormat('@');
  }
  return { sheet, config };
}

function existingIds(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return {};
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  const seen = {};
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i][0]).trim();
    if (id) seen[id] = true;
  }
  return seen;
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(request) {
  // Serialise concurrent writes so two tabs cannot interleave appends.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return reply({ ok: false, error: 'busy' });
  }

  try {
    // Sent as text/plain to keep the request "simple" and avoid a CORS
    // preflight, which Apps Script web apps cannot answer.
    const body = JSON.parse(request.postData.contents);

    if (!tokenConfigured() || body.token !== SHARED_TOKEN) {
      return reply({ ok: false, error: 'unauthorised' });
    }

    const type = body.type;
    const records = body.records || [];
    if (!records.length) return reply({ ok: true, written: 0, ids: [] });

    // An undo after the set has already reached the Sheet.
    if (type === 'deletions') return handleDeletions(records);

    const { sheet, config } = sheetFor(type);
    const seen = existingIds(sheet);

    const rows = [];
    const accepted = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record.id || seen[record.id]) {
        // Already stored: acknowledge so the client clears it from the queue.
        if (record.id) accepted.push(record.id);
        continue;
      }
      seen[record.id] = true;
      const row = config.fields.map(function (field) {
        const value = record[field];
        return value === undefined || value === null ? '' : value;
      });
      rows.push(row);
      accepted.push(record.id);
    }

    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return reply({ ok: true, written: rows.length, ids: accepted });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Remove rows the app has undone. Each record names the tab and the id of the
 * row to drop. Rows are deleted bottom-up so earlier indices stay valid.
 */
function handleDeletions(records) {
  const byTab = {};
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r.id || !r.recordType || !r.targetId) continue;
    if (!byTab[r.recordType]) byTab[r.recordType] = [];
    byTab[r.recordType].push(r);
  }

  const accepted = [];
  let removed = 0;

  for (const key in byTab) {
    const batch = byTab[key];
    const targets = {};
    for (let i = 0; i < batch.length; i++) targets[batch[i].targetId] = true;

    const sheet = sheetFor(key).sheet;
    const last = sheet.getLastRow();
    if (last >= 2) {
      const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
      for (let row = ids.length - 1; row >= 0; row--) {
        if (targets[String(ids[row][0]).trim()]) {
          sheet.deleteRow(row + 2);
          removed++;
        }
      }
    }
    // Acknowledge either way: a row that is already gone is the desired state.
    for (let i = 0; i < batch.length; i++) accepted.push(batch[i].id);
  }

  return reply({ ok: true, written: removed, ids: accepted });
}

/**
 * Celdas a valores que la app entiende. Una fecha que la hoja haya convertido
 * igualmente (p. ej. editada a mano) vuelve a ser AAAA-MM-DD.
 */
function plain(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  return value;
}

function readTab(target, key, tz) {
  const sheet = target.getSheetByName(TABS[key].name);
  if (!sheet) return [];
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const width = TABS[key].headers.length;
  return sheet.getRange(2, 1, last - 1, width).getValues()
    .map(function (row) { return row.map(function (v) { return plain(v, tz); }); });
}

/**
 * Con ?codigo=… correcto: todos los datos. Sin él: solo un chequeo de salud
 * (abre la URL /exec en el navegador para comprobar la implementación).
 */
function doGet(e) {
  const target = book();
  const code = e && e.parameter ? e.parameter.codigo : null;

  if (code) {
    if (!tokenConfigured() || code !== SHARED_TOKEN) {
      return reply({ ok: false, error: 'unauthorised' });
    }
    const tz = target.getSpreadsheetTimeZone();
    const data = {};
    for (const key in TABS) data[key] = readTab(target, key, tz);
    return reply({ ok: true, data: data });
  }

  return reply({
    ok: true,
    spreadsheet: target.getName(),
    tokenConfigured: tokenConfigured(),
  });
}
