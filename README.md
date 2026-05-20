# LosBroles Widget Lab

Laboratorio estatico para probar widgets de StreamElements y Twitch sin emitir en directo. Usa HTML, CSS y JavaScript vanilla, no requiere tokens reales, OAuth, secretos ni APIs privadas.

## Estructura

```text
/index.html
/src/app.js
/src/styles.css
/src/fixtures/streamelements/
/src/fixtures/twitch/predictions/
/src/harness/se-mock.js
/src/harness/twitch-eventsub-mock.js
/src/harness/worker-mock.js
/widgets/registry.json
/widgets/demo/widget.json
/widgets/demo/widget.html
/widgets/demo/widget.css
/widgets/demo/widget.js
/widgets/demo/fields.json
/widgets/demo/mocks/
```

## Ejecutar en local

Sirve la carpeta con cualquier servidor HTTP estatico:

```bash
python -m http.server 4173
```

Abre `http://localhost:4173/`.

## GitHub Pages

URL publica: <https://xseesx.github.io/losbroles-widget-lab/>

El despliegue automatico se ejecuta con GitHub Actions desde `.github/workflows/deploy-pages.yml` y publica la web completa desde la raiz del repositorio. La aplicacion usa rutas relativas y funciona servida desde la ruta de un repositorio, por ejemplo `/losbroles-widget-lab/`.

## Funcionamiento

- El listado de widgets se carga desde `widgets/registry.json`.
- El selector carga el `widget.json` del widget seleccionado.
- El laboratorio lee `widget.html`, `widget.css`, `widget.js` y `fields.json`.
- El iframe se construye con `srcdoc` y `sandbox="allow-scripts"`.
- Los mocks de `src/harness/` se inyectan antes de ejecutar el JavaScript del widget.
- Los botones emiten payloads mock de StreamElements: `onWidgetLoad`, chat message, follow, subscriber, tip, cheer y `kvstore:update`.
- El editor JSON muestra el payload del ultimo boton usado. Edita el JSON y pulsa el mismo boton para reenviarlo con cambios.
- La validacion JSON aparece en pantalla y bloquea el envio cuando el payload no es valido.
- El panel Twitch Predictions simula el ciclo EventSub de predicciones: begin, progress, lock y end.
- La consola en pantalla recibe logs del laboratorio y del widget aislado.

## Mock de StreamElements

`src/harness/se-mock.js` expone dentro del iframe:

- `window.SE_API.store.get(key)`
- `window.SE_API.store.set(key, value)`
- `window.SE_API.sanitize(message)`
- `window.SE_API.cheerFilter(message)`
- `window.SE_API.counters.get(counter)`
- `window.SE_API.setField(key, value)`
- `window.emitSEWidgetLoad({ fieldData, channel, session, recents, currency })`
- `window.emitSEEventReceived({ listener, event })`
- `window.emitSESessionUpdate({ session })`

Los eventos se entregan con `window.addEventListener("onWidgetLoad", handler)`, `window.addEventListener("onEventReceived", handler)` y `window.addEventListener("onSessionUpdate", handler)`, usando `event.detail` como en widgets reales. El canal de prueba usa `username: "losbroles"` y `apiToken: "fake-api-token-never-real"`.

Los payloads de ejemplo estan en `src/fixtures/streamelements/`.

## Mock de Twitch EventSub

`src/harness/twitch-eventsub-mock.js` emite predicciones con este formato:

```json
{
  "type": "channel.prediction.begin",
  "subscription": {
    "type": "channel.prediction.begin"
  },
  "event": {}
}
```

Tipos soportados:

- `channel.prediction.begin`
- `channel.prediction.progress`
- `channel.prediction.lock`
- `channel.prediction.end`

El panel permite configurar titulo, duracion, numero de opciones, nombre de cada opcion, usuarios, puntos y `winning_outcome_id`. Cada accion registra en la consola el evento emitido, timestamp y resumen del payload.

Los payloads base estan en `src/fixtures/twitch/predictions/`.

## Crear widgets

1. Crea una carpeta dentro de `widgets/`.
2. Anade `widget.json`, `widget.html`, `widget.css`, `widget.js` y `fields.json`.
3. Registra el widget en `widgets/registry.json`.
