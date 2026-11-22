# Entreno

Registro de entrenamiento por mesociclos para `dekkersiverson`. Prescribe la
sesión del día (rotación A → B → C), registra series, peso corporal y las
sesiones con su mujer, y lo guarda todo en una hoja de Google privada.

Publicada en <https://dekkersiverson.github.io/workout-dekkersiverson/>.

- **[docs/SETUP.md](docs/SETUP.md)**: puesta en marcha (hoja, Apps Script, GitHub) y cómo darle acceso a él.

## Cómo está montada

```
móvil ──GET ?codigo=… / POST──▶ Apps Script (Code.gs) ──▶ Hoja de Google (privada)
  │
  └─ GitHub Pages sirve la app (sin secretos: solo la URL del script)
```

- La hoja **no** se comparte por enlace y no hay clave de API de Google.
- El **código de acceso** (`SHARED_TOKEN` en `apps-script/Code.gs`) no está en el
  repositorio ni en el build. Se guarda en cada dispositivo al abrir
  `…/workout-dekkersiverson/#codigo=XYZ` o al escribirlo en **Cuerpo → Este dispositivo**.
  Quien encuentre la URL pública ve una app vacía.
- Sin conexión, todo queda en cola en el móvil y se sube al volver la cobertura.

## Cambiar la rutina

| Qué | Dónde |
| --- | --- |
| Ejercicios, series, repeticiones de cada día | `src/config.js` → `PROGRAM` |
| Incremento de carga y músculos de cada ejercicio | `src/exercises.js` → `EXERCISE_META` (obligatorio para cada ejercicio nuevo) |
| Bloques, fecha de inicio, notas de cada bloque | `src/mesocycles.js` |
| Peso, objetivo, proteína (pantalla Cuerpo) | `src/config.js` → `BODY_PARAMS` |

Cambiar el nombre de un ejercicio parte su historial: añade el nombre viejo a
`ALIASES` en `src/exercises.js` apuntando al nuevo.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # VITE_SYNC_URL=…/exec
npm run dev                  # http://localhost:5173/workout-dekkersiverson/
npm test                     # lógica + render de todas las vistas, sin red
```

Cada push a `main` ejecuta las pruebas, construye y publica (GitHub Actions).
