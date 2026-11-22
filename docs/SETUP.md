# Puesta en marcha

Todo se hace desde la cuenta de Google de quien vaya a ser dueño de la hoja y
desde la cuenta de GitHub `dekkersiverson`. No hace falta acceso a su correo.

## 1. Hoja de cálculo

1. Crea una hoja de Google nueva, p. ej. **Entreno — registro**. No la compartas por enlace.
2. **Extensiones → Apps Script**. Selecciona todo (⌘A) y pega `apps-script/Code.gs`.
   Comprueba que la línea 1 es `/**` y no `function myFunction() {`.
3. En `SHARED_TOKEN` pon un código largo y aleatorio:
   `python3 -c "import secrets; print(secrets.token_urlsafe(24))"`
4. Guarda (⌘S).
5. **Implementar → Nueva implementación** → engranaje → **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Autoriza. Saldrá *"Google no ha verificado esta aplicación"*: es lo normal
   con un script propio. **Configuración avanzada → Ir a … → Permitir**.
7. Copia la URL que termina en `/exec`. Ábrela en el navegador: debe devolver
   `{"ok":true,…,"tokenConfigured":true}`.

Las pestañas `Series`, `Con mi mujer`, `Peso corporal` y `Notas` se crean solas
con el primer registro.

> Editar el código **no** actualiza la implementación. Para publicar cambios:
> **Implementar → Gestionar implementaciones → ✏️ → Versión: nueva versión**.
> Así se mantiene la misma URL.

## 2. GitHub (cuenta `dekkersiverson`)

En el repositorio `workout-dekkersiverson`:

1. **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   `VITE_SYNC_URL` = la URL `/exec`. Es una *variable*, no un secreto: sin el código no da datos.
3. Para poder hacer push desde tu ordenador con tu propia clave SSH:
   **Settings → Collaborators → Add people → `jacoboferrer`**, y acepta la invitación desde tu cuenta.
4. Haz push a `main`. En **Actions** se ve el despliegue; tarda un par de minutos.

## 3. Darle acceso a él

Mándale por un canal privado:

```
https://dekkersiverson.github.io/workout-dekkersiverson/#codigo=EL_CODIGO
```

Al abrirlo, el código queda guardado en su móvil y desaparece de la barra de
direcciones. Después, **Compartir → Añadir a pantalla de inicio**.

Si cambia de móvil o borra los datos del navegador, basta con volver a abrir el
enlace (o escribir el código en **Cuerpo → Este dispositivo**).

## Cambiar el código de acceso

Cambia `SHARED_TOKEN` en el script, publica una versión nueva (paso 1, recuadro)
y mándale un enlace nuevo. Los móviles con el código viejo dejan de sincronizar
hasta que lo actualicen; lo pendiente se queda en cola, no se pierde.

## Comprobaciones

- [ ] La URL `/exec` sin parámetros devuelve `tokenConfigured: true`
- [ ] La app publicada abre en el día A, bloque E0
- [ ] Sin código: banner *Sin conexión* con el aviso de introducir el código
- [ ] Con código: banner verde *Guardado en la hoja*
- [ ] Registrar una serie la hace aparecer en la pestaña `Series`
