# LosBroles Widget Lab

Laboratorio estatico para probar widgets de StreamElements y Twitch sin emitir en directo. Usa HTML, CSS y JavaScript vanilla, no requiere tokens reales, OAuth, secretos ni APIs privadas.

## Estructura

```text
/index.html
/src/app.js
/src/styles.css
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
- Los botones emiten `onWidgetLoad` y `onEventReceived` como eventos mock de StreamElements.
- La consola en pantalla recibe logs del laboratorio y del widget aislado.

## Crear widgets

1. Crea una carpeta dentro de `widgets/`.
2. Anade `widget.json`, `widget.html`, `widget.css`, `widget.js` y `fields.json`.
3. Registra el widget en `widgets/registry.json`.
