const LAB_SOURCE = "losbroles-widget-lab";
const WIDGET_SOURCE = "losbroles-widget-lab-widget";
const REGISTRY_URL = new URL("../widgets/registry.json", import.meta.url);
const HARNESS_URLS = [
  new URL("./harness/se-mock.js", import.meta.url),
  new URL("./harness/twitch-eventsub-mock.js", import.meta.url),
  new URL("./harness/worker-mock.js", import.meta.url)
];

const DEFAULT_EVENT_PAYLOAD = {
  listener: "follower-latest",
  event: {
    name: "DemoFollower",
    displayName: "DemoFollower",
    providerId: "mock-user-001",
    amount: 1,
    message: "Hola desde el laboratorio"
  }
};

const state = {
  widgets: [],
  selectedWidget: null,
  selectedManifest: null,
  selectedManifestUrl: null,
  fieldsSchema: {},
  fieldData: {},
  logCount: 0
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  writeLog("info", "lab", "Inicializando laboratorio");

  try {
    await loadRegistry();
    setStatus("Listo");
  } catch (error) {
    setStatus("Error al cargar");
    writeLog("error", "lab", error.message, error);
  }
}

function bindElements() {
  elements.status = document.querySelector("#appStatus");
  elements.widgetSelect = document.querySelector("#widgetSelect");
  elements.widgetMeta = document.querySelector("#widgetMeta");
  elements.reloadButton = document.querySelector("#reloadWidgetButton");
  elements.emitWidgetLoadButton = document.querySelector("#emitWidgetLoadButton");
  elements.emitEventButton = document.querySelector("#emitEventButton");
  elements.clearLogsButton = document.querySelector("#clearLogsButton");
  elements.eventPayload = document.querySelector("#eventPayload");
  elements.fieldsList = document.querySelector("#fieldsList");
  elements.frame = document.querySelector("#widgetFrame");
  elements.logList = document.querySelector("#logList");
  elements.logCount = document.querySelector("#logCount");
}

function bindEvents() {
  elements.widgetSelect.addEventListener("change", () => {
    loadWidget(elements.widgetSelect.value);
  });

  elements.reloadButton.addEventListener("click", () => {
    if (state.selectedWidget) {
      loadWidget(state.selectedWidget.id);
    }
  });

  elements.emitWidgetLoadButton.addEventListener("click", emitWidgetLoad);
  elements.emitEventButton.addEventListener("click", emitEventReceived);
  elements.clearLogsButton.addEventListener("click", clearLogs);
  elements.frame.addEventListener("load", () => {
    if (state.selectedWidget) {
      writeLog("info", "lab", `Iframe cargado: ${state.selectedWidget.id}`);
    }
  });

  window.addEventListener("message", handleWidgetMessage);
}

async function loadRegistry() {
  setStatus("Cargando registry");
  const registry = await fetchJson(REGISTRY_URL);
  state.widgets = Array.isArray(registry.widgets) ? registry.widgets : [];

  if (state.widgets.length === 0) {
    throw new Error("widgets/registry.json no contiene widgets");
  }

  renderWidgetOptions();
  await loadWidget(state.widgets[0].id);
}

function renderWidgetOptions() {
  elements.widgetSelect.replaceChildren();

  for (const widget of state.widgets) {
    const option = document.createElement("option");
    option.value = widget.id;
    option.textContent = widget.name || widget.id;
    elements.widgetSelect.append(option);
  }
}

async function loadWidget(widgetId) {
  const widget = state.widgets.find((item) => item.id === widgetId);

  if (!widget) {
    writeLog("error", "lab", `Widget no encontrado: ${widgetId}`);
    return;
  }

  setStatus(`Cargando ${widget.name || widget.id}`);
  state.selectedWidget = widget;
  elements.widgetSelect.value = widget.id;

  try {
    const manifestUrl = new URL(widget.path || widget.manifest, window.location.href);
    const manifest = await fetchJson(manifestUrl);
    const widgetBaseUrl = new URL(".", manifestUrl);

    const entryUrl = new URL(manifest.entry || "widget.html", widgetBaseUrl);
    const styleUrl = new URL(manifest.styles || "widget.css", widgetBaseUrl);
    const scriptUrl = new URL(manifest.script || "widget.js", widgetBaseUrl);
    const fieldsUrl = new URL(manifest.fields || "fields.json", widgetBaseUrl);

    const [html, css, script, fieldsSchema, ...harnessScripts] = await Promise.all([
      fetchText(entryUrl),
      fetchText(styleUrl),
      fetchText(scriptUrl),
      fetchJson(fieldsUrl),
      ...HARNESS_URLS.map((url) => fetchText(url))
    ]);

    state.selectedManifest = manifest;
    state.selectedManifestUrl = manifestUrl;
    state.fieldsSchema = fieldsSchema;
    state.fieldData = extractFieldData(fieldsSchema);

    renderWidgetMeta(widget, manifest);
    renderFields(fieldsSchema, state.fieldData);
    setDefaultEventPayload();
    renderIframe({ manifest, html, css, script, fieldsSchema, fieldData: state.fieldData, harnessScripts });

    setStatus(`Cargado: ${manifest.name || widget.name || widget.id}`);
    writeLog("info", "lab", `Widget cargado: ${widget.id}`, {
      manifest: manifestUrl.pathname,
      entry: entryUrl.pathname,
      fields: fieldsUrl.pathname
    });
  } catch (error) {
    setStatus("Error al cargar widget");
    writeLog("error", "lab", error.message, error);
  }
}

function renderWidgetMeta(widget, manifest) {
  elements.widgetMeta.replaceChildren();

  const title = document.createElement("strong");
  title.textContent = manifest.name || widget.name || widget.id;
  elements.widgetMeta.append(title);

  const description = document.createElement("span");
  description.textContent = manifest.description || widget.description || "Sin descripcion";
  elements.widgetMeta.append(description);
}

function renderFields(fieldsSchema, fieldData) {
  elements.fieldsList.replaceChildren();

  const keys = Object.keys(fieldData);

  if (keys.length === 0) {
    const empty = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = "fields";
    detail.textContent = "{}";
    empty.append(term, detail);
    elements.fieldsList.append(empty);
    return;
  }

  for (const key of keys) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    const schemaItem = Array.isArray(fieldsSchema)
      ? fieldsSchema.find((field) => field.name === key)
      : fieldsSchema[key];

    term.textContent = schemaItem?.label || key;
    detail.textContent = formatFieldValue(fieldData[key]);
    row.append(term, detail);
    elements.fieldsList.append(row);
  }
}

function renderIframe({ manifest, html, css, script, fieldsSchema, fieldData, harnessScripts }) {
  const documentHtml = buildIframeDocument({
    manifest,
    html,
    css,
    script,
    fieldsSchema,
    fieldData,
    harnessScripts
  });

  elements.frame.srcdoc = documentHtml;
}

function buildIframeDocument({ manifest, html, css, script, fieldsSchema, fieldData, harnessScripts }) {
  const bridgeScript = `
(() => {
  const source = ${JSON.stringify(WIDGET_SOURCE)};
  const safeValue = (value) => {
    if (typeof value === "undefined") {
      return undefined;
    }

    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return String(value);
    }
  };
  const send = (type, payload = {}) => {
    parent.postMessage({ source, type, ...payload }, "*");
  };
  const formatArg = (arg) => {
    if (typeof arg === "string") {
      return arg;
    }

    try {
      return JSON.stringify(safeValue(arg));
    } catch (error) {
      return String(arg);
    }
  };

  window.__LAB_FIELDS_SCHEMA__ = ${escapeScript(JSON.stringify(fieldsSchema))};
  window.__LAB_FIELDS__ = ${escapeScript(JSON.stringify(fieldData))};
  window.__LAB_WIDGET_MANIFEST__ = ${escapeScript(JSON.stringify(manifest))};
  window.__LAB_LOG__ = (level, message, data) => {
    send("LOG", { level, message: String(message), data: safeValue(data) });
  };

  for (const level of ["log", "info", "warn", "error"]) {
    const original = console[level] ? console[level].bind(console) : console.log.bind(console);
    console[level] = (...args) => {
      send("LOG", { level, message: args.map(formatArg).join(" "), data: safeValue(args) });
      original(...args);
    };
  }

  window.addEventListener("error", (event) => {
    send("LOG", {
      level: "error",
      message: event.message,
      data: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: safeValue(event.error)
      }
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    send("LOG", {
      level: "error",
      message: "Unhandled promise rejection",
      data: safeValue(event.reason)
    });
  });
})();
`;

  const harnessTags = harnessScripts
    .map((content) => `<script>${escapeScript(content)}</script>`)
    .join("\n");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(manifest.name || "Widget preview")}</title>
    <style>
      html,
      body {
        min-height: 100%;
        margin: 0;
      }

      body {
        display: grid;
        place-items: center;
        background: #101820;
        color: #ffffff;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 24px;
      }
    </style>
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>${escapeScript(bridgeScript)}</script>
    ${harnessTags}
    <script>${escapeScript(script)}</script>
  </body>
</html>`;
}

function emitWidgetLoad() {
  if (!state.selectedWidget) {
    return;
  }

  emitToWidget("onWidgetLoad", {
    fieldData: state.fieldData,
    widget: {
      id: state.selectedManifest?.id || state.selectedWidget.id,
      name: state.selectedManifest?.name || state.selectedWidget.name
    },
    channel: {
      id: "mock-channel",
      username: "losbroles",
      displayName: "LosBroles"
    },
    session: {
      data: {}
    }
  });
}

function emitEventReceived() {
  let payload;

  try {
    payload = JSON.parse(elements.eventPayload.value);
  } catch (error) {
    writeLog("error", "lab", "Event payload no es JSON valido", error);
    return;
  }

  emitToWidget("onEventReceived", payload);
}

function emitToWidget(eventName, detail) {
  const frameWindow = elements.frame.contentWindow;

  if (!frameWindow) {
    writeLog("error", "lab", "Iframe no disponible");
    return;
  }

  frameWindow.postMessage({
    source: LAB_SOURCE,
    type: "LAB_EMIT",
    eventName,
    detail
  }, "*");

  writeLog("info", "lab", `Emitido ${eventName}`, detail);
}

function handleWidgetMessage(event) {
  const data = event.data;

  if (!data || data.source !== WIDGET_SOURCE) {
    return;
  }

  if (data.type === "LOG") {
    writeLog(data.level || "log", "widget", data.message || "", data.data);
  }
}

function clearLogs() {
  state.logCount = 0;
  elements.logList.replaceChildren();
  updateLogCount();
}

function writeLog(level, source, message, data) {
  const normalizedLevel = ["log", "info", "warn", "error"].includes(level) ? level : "log";
  const item = document.createElement("li");
  const timestamp = new Date();
  item.className = `log-entry log-${normalizedLevel}`;

  const time = document.createElement("time");
  time.dateTime = timestamp.toISOString();
  time.textContent = timestamp.toLocaleTimeString();

  const sourceNode = document.createElement("span");
  sourceNode.className = "log-source";
  sourceNode.textContent = source;

  const messageNode = document.createElement("span");
  messageNode.className = "log-message";
  messageNode.textContent = message;

  item.append(time, sourceNode, messageNode);

  if (typeof data !== "undefined") {
    const detail = document.createElement("pre");
    detail.textContent = stringifyLogData(data);
    item.append(detail);
  }

  elements.logList.append(item);
  state.logCount += 1;
  updateLogCount();
  elements.logList.scrollTop = elements.logList.scrollHeight;
}

function updateLogCount() {
  elements.logCount.textContent = `${state.logCount} ${state.logCount === 1 ? "log" : "logs"}`;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function setDefaultEventPayload() {
  elements.eventPayload.value = JSON.stringify(DEFAULT_EVENT_PAYLOAD, null, 2);
}

function extractFieldData(fieldsSchema) {
  if (!fieldsSchema || typeof fieldsSchema !== "object") {
    return {};
  }

  const entries = Array.isArray(fieldsSchema)
    ? fieldsSchema
      .filter((field) => field && field.name)
      .map((field) => [field.name, field])
    : Object.entries(fieldsSchema);

  return Object.fromEntries(entries.map(([key, field]) => [key, getFieldDefault(field)]));
}

function getFieldDefault(field) {
  if (field && typeof field === "object") {
    if ("value" in field) {
      return field.value;
    }

    if ("default" in field) {
      return field.default;
    }

    if (field.type === "checkbox" || field.type === "boolean") {
      return false;
    }

    if (field.type === "number") {
      return 0;
    }
  }

  return "";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url.pathname}: ${response.status}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url.pathname}: ${response.status}`);
  }

  return response.text();
}

function formatFieldValue(value) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function stringifyLogData(data) {
  if (data instanceof Error) {
    return JSON.stringify({
      name: data.name,
      message: data.message,
      stack: data.stack
    }, null, 2);
  }

  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return String(data);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeScript(value) {
  return String(value)
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<!--/g, "<\\!--");
}
