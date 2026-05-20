import {
  CHAT_USER_PROFILES,
  buildSEChatMessage,
  emitSEChatMessage
} from "./harness/se-chat-mock.js";

const LAB_SOURCE = "losbroles-widget-lab";
const WIDGET_SOURCE = "losbroles-widget-lab-widget";
const REGISTRY_URL = new URL("../widgets/registry.json", import.meta.url);
const HARNESS_URLS = [
  new URL("./harness/se-mock.js", import.meta.url),
  new URL("./harness/twitch-eventsub-mock.js", import.meta.url),
  new URL("./harness/worker-mock.js", import.meta.url)
];

const SE_FIXTURE_URLS = {
  widgetLoad: new URL("./fixtures/streamelements/widget-load.json", import.meta.url),
  chatMessage: new URL("./fixtures/streamelements/chat-message.json", import.meta.url),
  follow: new URL("./fixtures/streamelements/follow.json", import.meta.url),
  subscriber: new URL("./fixtures/streamelements/subscriber.json", import.meta.url),
  tip: new URL("./fixtures/streamelements/tip.json", import.meta.url),
  cheer: new URL("./fixtures/streamelements/cheer.json", import.meta.url),
  kvstoreUpdate: new URL("./fixtures/streamelements/kvstore-update.json", import.meta.url),
  sessionUpdate: new URL("./fixtures/streamelements/session-update.json", import.meta.url)
};

const TWITCH_PREDICTION_FIXTURE_URLS = {
  begin: new URL("./fixtures/twitch/predictions/begin.json", import.meta.url),
  progress: new URL("./fixtures/twitch/predictions/progress.json", import.meta.url),
  lock: new URL("./fixtures/twitch/predictions/lock.json", import.meta.url),
  end: new URL("./fixtures/twitch/predictions/end.json", import.meta.url)
};

const TWITCH_PREDICTION_TYPES = {
  begin: "channel.prediction.begin",
  progress: "channel.prediction.progress",
  lock: "channel.prediction.lock",
  end: "channel.prediction.end"
};

const REQUIRED_WIDGET_FIELDS = [
  "id",
  "name",
  "description",
  "version",
  "author",
  "category",
  "width",
  "height",
  "html",
  "css",
  "js",
  "fields",
  "mocks",
  "notes"
];

const SE_ACTIONS = {
  widgetLoad: {
    label: "onWidgetLoad",
    fixture: "widgetLoad",
    mockAction: "widgetLoad"
  },
  chatMessage: {
    label: "chat message",
    fixture: "chatMessage",
    mockAction: "eventReceived"
  },
  follow: {
    label: "follow",
    fixture: "follow",
    mockAction: "eventReceived"
  },
  subscriber: {
    label: "subscriber",
    fixture: "subscriber",
    mockAction: "eventReceived"
  },
  tip: {
    label: "tip",
    fixture: "tip",
    mockAction: "eventReceived"
  },
  cheer: {
    label: "cheer",
    fixture: "cheer",
    mockAction: "eventReceived"
  },
  kvstoreUpdate: {
    label: "kvstore:update",
    fixture: "kvstoreUpdate",
    mockAction: "eventReceived"
  }
};

const IMPORT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const IMPORT_PREVIEW_OPTION_VALUE = "__import_preview__";
const CRC32_TABLE = createCrc32Table();

const state = {
  widgets: [],
  selectedWidget: null,
  selectedManifest: null,
  selectedManifestUrl: null,
  importPreview: null,
  registry: null,
  fieldsSchema: {},
  fieldData: {},
  validationResults: [],
  debugEntries: [],
  debugMode: true,
  responsive: {
    preset: "1280x720",
    zoom: 0.75,
    background: "gray"
  },
  seFixtures: {},
  twitchPredictionFixtures: {},
  prediction: createDefaultPredictionState(),
  worker: {
    interceptWebSocket: true,
    workerUrl: "",
    connectionLogCount: 0
  },
  chat: {
    lastPayload: null,
    history: [],
    pending: []
  },
  frameReady: false,
  activePayloadType: "widgetLoad",
  payloadDrafts: {},
  logCount: 0
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  setupCollapsibleSections();
  bindEvents();
  writeLog("info", "lab", "Inicializando laboratorio");

  try {
    await Promise.all([
      loadSEFixtures(),
      loadTwitchPredictionFixtures()
    ]);
    renderPredictionControls();
    renderWorkerControls();
    renderChatHistory();
    renderChatPayload();
    applyDebugMode();
    applyResponsiveMode();
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
  elements.chatMessageInput = document.querySelector("#chatMessageInput");
  elements.chatProfileSelect = document.querySelector("#chatProfileSelect");
  elements.chatSendStreamerButton = document.querySelector("#chatSendStreamerButton");
  elements.chatSendViewerButton = document.querySelector("#chatSendViewerButton");
  elements.chatSendActionButton = document.querySelector("#chatSendActionButton");
  elements.chatEnterToggle = document.querySelector("#chatEnterToggle");
  elements.chatParseEmotesToggle = document.querySelector("#chatParseEmotesToggle");
  elements.chatBroadcastToggle = document.querySelector("#chatBroadcastToggle");
  elements.chatCopyPayloadButton = document.querySelector("#chatCopyPayloadButton");
  elements.chatHistoryCount = document.querySelector("#chatHistoryCount");
  elements.chatHistoryList = document.querySelector("#chatHistoryList");
  elements.chatLastPayload = document.querySelector("#chatLastPayload");
  elements.validateWidgetsButton = document.querySelector("#validateWidgetsButton");
  elements.validationSummary = document.querySelector("#validationSummary");
  elements.validationResults = document.querySelector("#validationResults");
  elements.importWidgetId = document.querySelector("#importWidgetId");
  elements.importWidgetName = document.querySelector("#importWidgetName");
  elements.importWidgetDescription = document.querySelector("#importWidgetDescription");
  elements.importWidgetWidth = document.querySelector("#importWidgetWidth");
  elements.importWidgetHeight = document.querySelector("#importWidgetHeight");
  elements.importWidgetHtml = document.querySelector("#importWidgetHtml");
  elements.importWidgetCss = document.querySelector("#importWidgetCss");
  elements.importWidgetJs = document.querySelector("#importWidgetJs");
  elements.importWidgetFields = document.querySelector("#importWidgetFields");
  elements.importPreviewButton = document.querySelector("#importPreviewButton");
  elements.importDownloadButton = document.querySelector("#importDownloadButton");
  elements.importCopyStructureButton = document.querySelector("#importCopyStructureButton");
  elements.importStatus = document.querySelector("#importStatus");
  elements.debugModeToggle = document.querySelector("#debugModeToggle");
  elements.copyDebugReportButton = document.querySelector("#copyDebugReportButton");
  elements.viewportPresetSelect = document.querySelector("#viewportPresetSelect");
  elements.zoomSelect = document.querySelector("#zoomSelect");
  elements.previewBackgroundSelect = document.querySelector("#previewBackgroundSelect");
  elements.reloadButton = document.querySelector("#reloadWidgetButton");
  elements.seActionButtons = Array.from(document.querySelectorAll("[data-se-action]"));
  elements.clearLogsButton = document.querySelector("#clearLogsButton");
  elements.eventPayload = document.querySelector("#eventPayload");
  elements.payloadError = document.querySelector("#payloadError");
  elements.payloadTypeLabel = document.querySelector("#payloadTypeLabel");
  elements.predictionTitle = document.querySelector("#predictionTitle");
  elements.predictionDuration = document.querySelector("#predictionDuration");
  elements.predictionOutcomeCount = document.querySelector("#predictionOutcomeCount");
  elements.predictionWinningOutcome = document.querySelector("#predictionWinningOutcome");
  elements.predictionOutcomes = document.querySelector("#predictionOutcomes");
  elements.predictionCreateButton = document.querySelector("#predictionCreateButton");
  elements.predictionVoteOneButton = document.querySelector("#predictionVoteOneButton");
  elements.predictionVoteTwoButton = document.querySelector("#predictionVoteTwoButton");
  elements.predictionVoteRandomButton = document.querySelector("#predictionVoteRandomButton");
  elements.predictionLockButton = document.querySelector("#predictionLockButton");
  elements.predictionEndOneButton = document.querySelector("#predictionEndOneButton");
  elements.predictionEndTwoButton = document.querySelector("#predictionEndTwoButton");
  elements.predictionCancelButton = document.querySelector("#predictionCancelButton");
  elements.predictionResetButton = document.querySelector("#predictionResetButton");
  elements.workerInterceptToggle = document.querySelector("#workerInterceptToggle");
  elements.workerUrlInput = document.querySelector("#workerUrlInput");
  elements.workerWelcomeButton = document.querySelector("#workerWelcomeButton");
  elements.workerErrorButton = document.querySelector("#workerErrorButton");
  elements.workerBeginButton = document.querySelector("#workerBeginButton");
  elements.workerProgressButton = document.querySelector("#workerProgressButton");
  elements.workerLockButton = document.querySelector("#workerLockButton");
  elements.workerEndButton = document.querySelector("#workerEndButton");
  elements.workerConnectionCount = document.querySelector("#workerConnectionCount");
  elements.workerConnectionList = document.querySelector("#workerConnectionList");
  elements.fieldsList = document.querySelector("#fieldsList");
  elements.previewShell = document.querySelector("#previewShell");
  elements.iframeViewport = document.querySelector("#iframeViewport");
  elements.frame = document.querySelector("#widgetFrame");
  elements.logList = document.querySelector("#logList");
  elements.logCount = document.querySelector("#logCount");
}

function bindEvents() {
  elements.widgetSelect.addEventListener("change", () => {
    if (elements.widgetSelect.value === IMPORT_PREVIEW_OPTION_VALUE) {
      return;
    }

    loadWidget(elements.widgetSelect.value);
  });

  elements.chatSendStreamerButton.addEventListener("click", () => {
    sendChatMessage("streamer");
  });
  elements.chatSendViewerButton.addEventListener("click", () => {
    sendChatMessage(elements.chatProfileSelect.value || "viewer");
  });
  elements.chatSendActionButton.addEventListener("click", () => {
    sendChatMessage(elements.chatProfileSelect.value || "viewer", { isAction: true });
  });
  elements.chatMessageInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !elements.chatEnterToggle.checked) {
      return;
    }

    event.preventDefault();
    sendChatMessage(elements.chatProfileSelect.value || "viewer");
  });
  elements.chatCopyPayloadButton.addEventListener("click", copyLastChatPayload);

  elements.validateWidgetsButton.addEventListener("click", validateWidgets);
  elements.importPreviewButton.addEventListener("click", previewImportedWidget);
  elements.importDownloadButton.addEventListener("click", downloadImportedWidgetPackage);
  elements.importCopyStructureButton.addEventListener("click", copyImportedFolderStructure);
  elements.debugModeToggle.addEventListener("change", () => {
    state.debugMode = elements.debugModeToggle.checked;
    applyDebugMode();
  });
  elements.copyDebugReportButton.addEventListener("click", copyDebugReport);
  elements.viewportPresetSelect.addEventListener("change", () => {
    state.responsive.preset = elements.viewportPresetSelect.value;
    applyResponsiveMode();
  });
  elements.zoomSelect.addEventListener("change", () => {
    state.responsive.zoom = Number(elements.zoomSelect.value);
    applyResponsiveMode();
  });
  elements.previewBackgroundSelect.addEventListener("change", () => {
    state.responsive.background = elements.previewBackgroundSelect.value;
    applyResponsiveMode();
  });

  elements.reloadButton.addEventListener("click", () => {
    if (state.importPreview) {
      previewImportedWidget();
      return;
    }

    if (state.selectedWidget) {
      loadWidget(state.selectedWidget.id);
    }
  });

  for (const button of elements.seActionButtons) {
    button.addEventListener("click", () => {
      handleSEAction(button.dataset.seAction);
    });
  }

  elements.eventPayload.addEventListener("input", () => {
    state.payloadDrafts[state.activePayloadType] = elements.eventPayload.value;
    validatePayloadEditor();
  });

  elements.predictionTitle.addEventListener("input", () => {
    state.prediction.title = elements.predictionTitle.value;
  });

  elements.predictionDuration.addEventListener("input", () => {
    state.prediction.durationSeconds = clampInteger(elements.predictionDuration.value, 1, 86400);
  });

  elements.predictionOutcomeCount.addEventListener("change", () => {
    setPredictionOutcomeCount(elements.predictionOutcomeCount.value);
  });

  elements.predictionWinningOutcome.addEventListener("change", () => {
    state.prediction.winningOutcomeId = elements.predictionWinningOutcome.value || null;
  });

  elements.predictionOutcomes.addEventListener("input", handlePredictionOutcomeInput);
  elements.predictionCreateButton.addEventListener("click", createPrediction);
  elements.predictionVoteOneButton.addEventListener("click", () => addVotesToOutcome(0));
  elements.predictionVoteTwoButton.addEventListener("click", () => addVotesToOutcome(1));
  elements.predictionVoteRandomButton.addEventListener("click", addRandomPredictionVotes);
  elements.predictionLockButton.addEventListener("click", lockPrediction);
  elements.predictionEndOneButton.addEventListener("click", () => endPrediction(0));
  elements.predictionEndTwoButton.addEventListener("click", () => endPrediction(1));
  elements.predictionCancelButton.addEventListener("click", cancelPrediction);
  elements.predictionResetButton.addEventListener("click", resetPrediction);

  elements.workerInterceptToggle.addEventListener("change", () => {
    state.worker.interceptWebSocket = elements.workerInterceptToggle.checked;
    sendWorkerConfig();
  });

  elements.workerUrlInput.addEventListener("input", () => {
    state.worker.workerUrl = elements.workerUrlInput.value.trim();
    sendWorkerConfig();
  });

  elements.workerWelcomeButton.addEventListener("click", sendWorkerWelcome);
  elements.workerErrorButton.addEventListener("click", sendWorkerBridgeError);
  elements.workerBeginButton.addEventListener("click", () => sendWorkerPrediction("begin"));
  elements.workerProgressButton.addEventListener("click", () => sendWorkerPrediction("progress"));
  elements.workerLockButton.addEventListener("click", () => sendWorkerPrediction("lock"));
  elements.workerEndButton.addEventListener("click", () => sendWorkerPrediction("end"));

  elements.clearLogsButton.addEventListener("click", clearLogs);
  elements.frame.addEventListener("load", () => {
    state.frameReady = true;

    if (state.selectedWidget) {
      writeLog("info", "lab", `Iframe cargado: ${state.selectedWidget.id}`);
      sendWorkerConfig();
      flushPendingChatMessages();
    }
  });

  window.addEventListener("message", handleWidgetMessage);
}

function setupCollapsibleSections() {
  const sections = Array.from(document.querySelectorAll(".control-panel > .panel-section"));

  sections.forEach((section) => {
    if (section.dataset.collapsibleReady === "true") {
      return;
    }

    const title = getPanelTitle(section);
    const content = document.createElement("div");
    const toggle = document.createElement("button");
    const collapsed = section.dataset.startCollapsed === "true";

    content.className = "panel-content";

    while (section.firstChild) {
      content.append(section.firstChild);
    }

    toggle.type = "button";
    toggle.className = "panel-toggle";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.textContent = title;
    content.hidden = collapsed;
    section.classList.toggle("is-collapsed", collapsed);
    section.append(toggle, content);
    section.dataset.collapsibleReady = "true";

    toggle.addEventListener("click", () => {
      const nextCollapsed = !content.hidden;
      content.hidden = nextCollapsed;
      section.classList.toggle("is-collapsed", nextCollapsed);
      toggle.setAttribute("aria-expanded", String(!nextCollapsed));
    });
  });
}

function getPanelTitle(section) {
  return section.dataset.panelTitle
    || section.querySelector("h2")?.textContent?.trim()
    || section.getAttribute("aria-label")
    || section.querySelector(".field-label")?.textContent?.trim()
    || "Panel";
}

function sendChatMessage(profileKey, options = {}) {
  const text = elements.chatMessageInput.value.trim();

  if (!text) {
    writeLog("warn", "chat", "No se envio chat: mensaje vacio");
    return;
  }

  const profile = CHAT_USER_PROFILES[profileKey] || CHAT_USER_PROFILES.viewer;
  const payload = buildSEChatMessage({
    text,
    profile,
    isAction: options.isAction === true,
    parseEmotes: elements.chatParseEmotesToggle.checked
  });
  const broadcast = elements.chatBroadcastToggle.checked;
  const modes = state.frameReady
    ? deliverChatPayload(payload, broadcast)
    : queueChatPayload(payload, broadcast);

  state.chat.lastPayload = payload;
  state.chat.history.unshift({
    timestamp: new Date().toISOString(),
    profile: profile.label,
    text: payload.detail.event.data.text,
    isAction: payload.detail.event.data.isAction,
    emoteCount: payload.detail.event.data.emotes.length
  });
  state.chat.history = state.chat.history.slice(0, 30);

  renderChatPayload();
  renderChatHistory();
  writeLog("info", "chat", "Chat message emitted as StreamElements onEventReceived", {
    dispatchModes: modes,
    targetCount: modes.length,
    payload
  });
}

function deliverChatPayload(payload, broadcast = false) {
  const frames = broadcast
    ? Array.from(document.querySelectorAll("iframe"))
    : [elements.frame];
  const modes = [];

  for (const frame of frames) {
    if (!frame?.contentWindow) {
      continue;
    }

    modes.push(emitSEChatMessage(frame.contentWindow, payload));
  }

  return modes;
}

function queueChatPayload(payload, broadcast = false) {
  state.chat.pending.push({ payload, broadcast });
  return ["queued-until-iframe-load"];
}

function flushPendingChatMessages() {
  if (state.chat.pending.length === 0) {
    return;
  }

  const pending = state.chat.pending.splice(0);

  for (const item of pending) {
    const modes = deliverChatPayload(item.payload, item.broadcast);
    writeLog("info", "chat", "Queued chat message emitted as StreamElements onEventReceived", {
      dispatchModes: modes,
      targetCount: modes.length,
      payload: item.payload
    });
  }
}

async function copyLastChatPayload() {
  if (!state.chat.lastPayload) {
    writeLog("warn", "chat", "No hay payload de chat para copiar");
    return;
  }

  try {
    await copyTextToClipboard(stringifyPayload(state.chat.lastPayload));
    writeLog("info", "chat", "Ultimo payload de chat copiado");
  } catch (error) {
    window.__LAST_CHAT_PAYLOAD__ = state.chat.lastPayload;
    writeLog("warn", "chat", "Payload de chat generado; copia automatica bloqueada", {
      error: serializeLogData(error),
      payload: state.chat.lastPayload
    });
  }
}

function renderChatPayload() {
  elements.chatLastPayload.value = state.chat.lastPayload
    ? stringifyPayload(state.chat.lastPayload)
    : "";
}

function renderChatHistory() {
  elements.chatHistoryList.replaceChildren();
  elements.chatHistoryCount.textContent = String(state.chat.history.length);

  for (const item of state.chat.history) {
    const row = document.createElement("li");
    const title = document.createElement("strong");
    const meta = document.createElement("span");

    row.className = "chat-history-entry";
    title.textContent = `${item.isAction ? "/me " : ""}${item.profile}`;
    meta.textContent = `${item.text}${item.emoteCount ? ` (${item.emoteCount} emotes)` : ""}`;
    row.append(title, meta);
    elements.chatHistoryList.append(row);
  }
}

async function loadSEFixtures() {
  const entries = await Promise.all(
    Object.entries(SE_FIXTURE_URLS).map(async ([key, url]) => [key, await fetchJson(url)])
  );

  state.seFixtures = Object.fromEntries(entries);
}

async function loadTwitchPredictionFixtures() {
  const entries = await Promise.all(
    Object.entries(TWITCH_PREDICTION_FIXTURE_URLS).map(async ([key, url]) => [key, await fetchJson(url)])
  );

  state.twitchPredictionFixtures = Object.fromEntries(entries);
}

async function loadRegistry() {
  setStatus("Cargando registry");
  const registry = await fetchJson(REGISTRY_URL);
  state.registry = registry;
  state.widgets = Array.isArray(registry.widgets) ? registry.widgets : [];

  if (state.widgets.length === 0) {
    throw new Error("widgets/registry.json no contiene widgets");
  }

  renderWidgetOptions();
  await loadWidget(state.widgets[0].id);
}

async function validateWidgets() {
  elements.validationSummary.textContent = "Validando widgets...";
  elements.validationResults.replaceChildren();
  setStatus("Validando widgets");

  try {
    const registry = await fetchJson(REGISTRY_URL);
    state.registry = registry;
    state.widgets = Array.isArray(registry.widgets) ? registry.widgets : [];
    renderWidgetOptions();
    const results = [];

    if (!Array.isArray(registry.widgets)) {
      results.push(createValidationResult("error", "registry", "widgets/registry.json debe contener un array widgets."));
    } else if (registry.widgets.length === 0) {
      results.push(createValidationResult("error", "registry", "widgets/registry.json no contiene widgets."));
    }

    for (const widget of state.widgets) {
      results.push(...await validateWidgetEntry(widget));
    }

    state.validationResults = results;
    renderValidationResults(results);
    setStatus("Validacion completada");
  } catch (error) {
    const results = [createValidationResult("error", "registry", `No se pudo cargar widgets/registry.json: ${error.message}`)];
    state.validationResults = results;
    renderValidationResults(results);
    setStatus("Error de validacion");
  }
}

async function validateWidgetEntry(widget) {
  const widgetId = widget?.id || "sin-id";
  const results = [];

  if (!widget || typeof widget !== "object") {
    return [createValidationResult("error", widgetId, "La entrada del registry no es un objeto.")];
  }

  for (const field of REQUIRED_WIDGET_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(widget, field) || widget[field] === "" || typeof widget[field] === "undefined") {
      results.push(createValidationResult("error", widgetId, `Falta el campo obligatorio ${field}.`));
    }
  }

  if (!Number.isFinite(Number(widget.width)) || Number(widget.width) < 1) {
    results.push(createValidationResult("error", widgetId, "width debe ser un numero positivo."));
  }

  if (!Number.isFinite(Number(widget.height)) || Number(widget.height) < 1) {
    results.push(createValidationResult("error", widgetId, "height debe ser un numero positivo."));
  }

  const fileChecks = [
    ["html", "text"],
    ["css", "text"],
    ["js", "text"],
    ["fields", "json"],
    ["mocks", "json"]
  ];

  for (const [field, type] of fileChecks) {
    if (!widget[field]) {
      continue;
    }

    try {
      const url = resolveWidgetUrl(widget[field]);

      if (type === "json") {
        await fetchJson(url);
      } else {
        await fetchText(url);
      }

      results.push(createValidationResult("ok", widgetId, `${field} carga correctamente: ${widget[field]}`));
    } catch (error) {
      results.push(createValidationResult("error", widgetId, `${field} no carga: ${widget[field]} (${error.message})`));
    }
  }

  return results;
}

function createValidationResult(level, widgetId, message) {
  return {
    level,
    widgetId,
    message,
    timestamp: new Date().toISOString()
  };
}

function renderValidationResults(results) {
  const errorCount = results.filter((result) => result.level === "error").length;
  const okCount = results.filter((result) => result.level === "ok").length;
  elements.validationSummary.textContent = `${errorCount} errores, ${okCount} comprobaciones correctas`;
  elements.validationSummary.className = `validation-summary ${errorCount > 0 ? "has-errors" : "is-ok"}`;
  elements.validationResults.replaceChildren();

  for (const result of results) {
    const item = document.createElement("li");
    item.className = `validation-result validation-${result.level}`;
    item.textContent = `[${result.widgetId}] ${result.message}`;
    elements.validationResults.append(item);
  }
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

function showImportPreviewOption(manifest) {
  let option = elements.widgetSelect.querySelector(`option[value="${IMPORT_PREVIEW_OPTION_VALUE}"]`);

  if (!option) {
    option = document.createElement("option");
    option.value = IMPORT_PREVIEW_OPTION_VALUE;
    option.disabled = true;
    elements.widgetSelect.prepend(option);
  }

  option.textContent = `Import preview: ${manifest.name || manifest.id}`;
  elements.widgetSelect.value = IMPORT_PREVIEW_OPTION_VALUE;
}

function clearImportPreviewOption() {
  elements.widgetSelect.querySelector(`option[value="${IMPORT_PREVIEW_OPTION_VALUE}"]`)?.remove();
}

async function previewImportedWidget() {
  let draft;

  try {
    draft = readImportDraft();
  } catch (error) {
    setImportStatus(error.message, "error");
    writeLog("error", "import", "Import widget no valido", error);
    return;
  }

  setImportStatus("Preparando preview sin guardar...", "info");
  setStatus("Preparando import preview");

  try {
    const harnessScripts = await Promise.all(HARNESS_URLS.map((url) => fetchText(url)));
    const fieldData = extractFieldData(draft.fieldsSchema);

    state.frameReady = false;
    state.importPreview = draft;
    state.selectedWidget = draft.manifest;
    state.selectedManifest = draft.manifest;
    state.selectedManifestUrl = null;
    state.fieldsSchema = draft.fieldsSchema;
    state.fieldData = fieldData;

    renderWidgetMeta(draft.manifest);
    showImportPreviewOption(draft.manifest);
    renderFields(draft.fieldsSchema, fieldData);
    resetPayloadDrafts();
    renderIframe({
      manifest: draft.manifest,
      html: draft.html,
      css: draft.css,
      script: draft.script,
      fieldsSchema: draft.fieldsSchema,
      fieldData,
      harnessScripts
    });
    applyPreviewDimensions(draft.manifest.width, draft.manifest.height, state.responsive.zoom);

    setStatus(`Import preview: ${draft.manifest.name}`);
    setImportStatus("Preview generado. No se ha guardado nada en GitHub ni en el repo.", "ok");
    writeLog("info", "import", `Preview importado sin guardar: ${draft.manifest.id}`, {
      id: draft.manifest.id,
      size: `${draft.manifest.width}x${draft.manifest.height}`,
      files: draft.files.map((file) => file.path)
    });
  } catch (error) {
    setStatus("Error en import preview");
    setImportStatus(`No se pudo crear el preview: ${error.message}`, "error");
    writeLog("error", "import", "Error al previsualizar widget importado", error);
  }
}

function downloadImportedWidgetPackage() {
  let draft;

  try {
    draft = readImportDraft();
  } catch (error) {
    setImportStatus(error.message, "error");
    writeLog("error", "import", "No se pudo generar el paquete", error);
    return;
  }

  try {
    const blob = createZipBlob(draft.files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${draft.manifest.id}-widget-package.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    setImportStatus("Paquete descargado. Extraelo en el repo y commitea los archivos para guardarlo de verdad.", "ok");
    writeLog("info", "import", `Paquete generado: ${link.download}`, {
      files: draft.files.map((file) => file.path)
    });
  } catch (error) {
    setImportStatus(`No se pudo descargar el paquete: ${error.message}`, "error");
    writeLog("error", "import", "Error al descargar paquete de widget", error);
  }
}

async function copyImportedFolderStructure() {
  let draft;

  try {
    draft = readImportDraft();
  } catch (error) {
    setImportStatus(error.message, "error");
    writeLog("error", "import", "No se pudo copiar la estructura", error);
    return;
  }

  const structure = buildImportFolderStructure(draft);

  try {
    await copyTextToClipboard(structure);
    setImportStatus("Estructura copiada. Anade esos archivos al repo y commitea para persistir.", "ok");
    writeLog("info", "import", `Estructura copiada: widgets/${draft.manifest.id}/`, {
      registryEntry: draft.manifest
    });
  } catch (error) {
    window.__LAST_IMPORT_FOLDER_STRUCTURE__ = structure;
    setImportStatus("El navegador bloqueo la copia automatica. La estructura queda en __LAST_IMPORT_FOLDER_STRUCTURE__.", "error");
    writeLog("warn", "import", "Estructura generada; copia automatica bloqueada", {
      error: serializeLogData(error),
      structure
    });
  }
}

function readImportDraft() {
  const errors = [];
  const id = elements.importWidgetId.value.trim();
  const name = elements.importWidgetName.value.trim();
  const description = elements.importWidgetDescription.value.trim();
  const width = parseImportDimension(elements.importWidgetWidth.value, "width", errors);
  const height = parseImportDimension(elements.importWidgetHeight.value, "height", errors);
  const html = elements.importWidgetHtml.value;
  const css = elements.importWidgetCss.value;
  const script = elements.importWidgetJs.value;
  const fieldsRaw = elements.importWidgetFields.value.trim() || "{}";
  let fieldsSchema = {};

  if (!id) {
    errors.push("id es obligatorio.");
  } else if (!IMPORT_ID_PATTERN.test(id)) {
    errors.push("id solo puede usar minusculas, numeros y guiones, empezando por letra o numero.");
  }

  if (!name) {
    errors.push("name es obligatorio.");
  }

  try {
    fieldsSchema = JSON.parse(fieldsRaw);

    if (!fieldsSchema || (typeof fieldsSchema !== "object" && !Array.isArray(fieldsSchema))) {
      errors.push("fields JSON debe ser un objeto o array JSON.");
    }
  } catch (error) {
    errors.push(`fields JSON invalido: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  const manifest = buildImportedWidgetManifest({
    id,
    name,
    description,
    width,
    height
  });
  const draft = {
    manifest,
    html,
    css,
    script,
    fieldsSchema
  };

  return {
    ...draft,
    files: buildImportedWidgetFiles(draft)
  };
}

function parseImportDimension(value, label, errors) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    errors.push(`${label} debe ser un numero positivo.`);
    return 1;
  }

  return parsed;
}

function buildImportedWidgetManifest({ id, name, description, width, height }) {
  return {
    id,
    name,
    description: description || "Widget importado manualmente.",
    version: "0.1.0",
    author: "manual-import",
    category: "imported",
    width,
    height,
    html: `widgets/${id}/widget.html`,
    css: `widgets/${id}/widget.css`,
    js: `widgets/${id}/widget.js`,
    fields: `widgets/${id}/fields.json`,
    mocks: `widgets/${id}/mocks/index.json`,
    notes: "Generado con Import widget. Para persistirlo, commitea estos archivos y registra la entrada en widgets/registry.json."
  };
}

function buildImportedWidgetFiles(draft) {
  const basePath = `widgets/${draft.manifest.id}`;
  const mocks = {
    events: [],
    notes: "Empty mocks index generated by Import widget."
  };

  return [
    {
      path: `${basePath}/widget.json`,
      content: `${stringifyPayload(draft.manifest)}\n`
    },
    {
      path: `${basePath}/widget.html`,
      content: ensureTrailingNewline(draft.html)
    },
    {
      path: `${basePath}/widget.css`,
      content: ensureTrailingNewline(draft.css)
    },
    {
      path: `${basePath}/widget.js`,
      content: ensureTrailingNewline(draft.script)
    },
    {
      path: `${basePath}/fields.json`,
      content: `${stringifyPayload(draft.fieldsSchema)}\n`
    },
    {
      path: `${basePath}/mocks/index.json`,
      content: `${stringifyPayload(mocks)}\n`
    }
  ];
}

function buildImportFolderStructure(draft) {
  return [
    `widgets/${draft.manifest.id}/`,
    "  widget.json",
    "  widget.html",
    "  widget.css",
    "  widget.js",
    "  fields.json",
    "  mocks/",
    "    index.json",
    "",
    "Registry entry to add in widgets/registry.json:",
    stringifyPayload(draft.manifest),
    "",
    "Real persistence requires committing these files to the repository."
  ].join("\n");
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function setImportStatus(message, level = "info") {
  elements.importStatus.textContent = message;
  elements.importStatus.className = `import-status ${level === "ok" ? "import-ok" : ""} ${level === "error" ? "import-error" : ""}`.trim();
}

async function loadWidget(widgetId) {
  const widget = state.widgets.find((item) => item.id === widgetId);

  if (!widget) {
    writeLog("error", "lab", `Widget no encontrado: ${widgetId}`);
    return;
  }

  setStatus(`Cargando ${widget.name || widget.id}`);
  state.frameReady = false;
  state.selectedWidget = widget;
  state.selectedManifest = widget;
  state.selectedManifestUrl = REGISTRY_URL;
  state.importPreview = null;
  clearImportPreviewOption();
  elements.widgetSelect.value = widget.id;

  try {
    const entryUrl = resolveWidgetUrl(widget.html);
    const styleUrl = resolveWidgetUrl(widget.css);
    const scriptUrl = resolveWidgetUrl(widget.js);
    const fieldsUrl = resolveWidgetUrl(widget.fields);

    const [html, css, script, fieldsSchema, ...harnessScripts] = await Promise.all([
      fetchText(entryUrl),
      fetchText(styleUrl),
      fetchText(scriptUrl),
      fetchJson(fieldsUrl),
      ...HARNESS_URLS.map((url) => fetchText(url))
    ]);

    state.fieldsSchema = fieldsSchema;
    state.fieldData = extractFieldData(fieldsSchema);

    renderWidgetMeta(widget);
    renderFields(fieldsSchema, state.fieldData);
    resetPayloadDrafts();
    renderIframe({ manifest: widget, html, css, script, fieldsSchema, fieldData: state.fieldData, harnessScripts });

    setStatus(`Cargado: ${widget.name || widget.id}`);
    writeLog("info", "lab", `Widget cargado: ${widget.id}`, {
      registry: REGISTRY_URL.pathname,
      entry: entryUrl.pathname,
      css: styleUrl.pathname,
      js: scriptUrl.pathname,
      fields: fieldsUrl.pathname,
      size: `${widget.width}x${widget.height}`
    });
  } catch (error) {
    setStatus("Error al cargar widget");
    writeLog("error", "lab", error.message, error);
  }
}

function renderWidgetMeta(widget) {
  elements.widgetMeta.replaceChildren();

  const title = document.createElement("strong");
  title.textContent = widget.name || widget.id;
  elements.widgetMeta.append(title);

  const description = document.createElement("span");
  description.textContent = `${widget.description || "Sin descripcion"} ${widget.version ? `v${widget.version}` : ""} ${widget.category ? `- ${widget.category}` : ""} ${widget.width && widget.height ? `- ${widget.width}x${widget.height}` : ""}`;
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

function resetPayloadDrafts() {
  const nextActiveType = SE_ACTIONS[state.activePayloadType] ? state.activePayloadType : "widgetLoad";
  state.payloadDrafts = {};

  for (const key of Object.keys(SE_ACTIONS)) {
    state.payloadDrafts[key] = stringifyPayload(buildSEPayload(key));
  }

  setActivePayload(nextActiveType);
}

function buildSEPayload(actionKey) {
  const action = SE_ACTIONS[actionKey];
  const fixture = cloneJson(state.seFixtures[action.fixture] || {});

  if (actionKey === "widgetLoad") {
    fixture.fieldData = cloneJson(state.fieldData);
    fixture.widget = {
      id: state.selectedManifest?.id || state.selectedWidget?.id || "demo",
      name: state.selectedManifest?.name || state.selectedWidget?.name || "Demo widget",
      version: state.selectedManifest?.version || "0.1.0"
    };
  }

  return fixture;
}

function setActivePayload(actionKey) {
  state.activePayloadType = actionKey;
  elements.eventPayload.value = state.payloadDrafts[actionKey] || stringifyPayload(buildSEPayload(actionKey));
  elements.payloadTypeLabel.textContent = SE_ACTIONS[actionKey].label;

  for (const button of elements.seActionButtons) {
    button.classList.toggle("is-active", button.dataset.seAction === actionKey);
  }

  validatePayloadEditor();
}

function handleSEAction(actionKey) {
  if (!SE_ACTIONS[actionKey]) {
    writeLog("error", "lab", `Accion StreamElements no soportada: ${actionKey}`);
    return;
  }

  state.payloadDrafts[state.activePayloadType] = elements.eventPayload.value;

  if (state.activePayloadType !== actionKey) {
    setActivePayload(actionKey);
  }

  const payload = parsePayloadEditor();

  if (!payload) {
    return;
  }

  state.payloadDrafts[actionKey] = stringifyPayload(payload);
  emitSEPayload(actionKey, payload);
}

function validatePayloadEditor() {
  try {
    JSON.parse(elements.eventPayload.value);
    clearPayloadError();
    return true;
  } catch (error) {
    setPayloadError(`JSON invalido: ${error.message}`);
    return false;
  }
}

function parsePayloadEditor() {
  try {
    clearPayloadError();
    return JSON.parse(elements.eventPayload.value);
  } catch (error) {
    setPayloadError(`JSON invalido: ${error.message}`);
    writeLog("error", "lab", "Payload JSON no valido", error);
    return null;
  }
}

function setPayloadError(message) {
  elements.payloadError.textContent = message;
  elements.payloadError.hidden = false;
}

function clearPayloadError() {
  elements.payloadError.textContent = "";
  elements.payloadError.hidden = true;
}

function applyDebugMode() {
  document.body.classList.toggle("debug-off", !state.debugMode);
  elements.debugModeToggle.checked = state.debugMode;
}

async function copyDebugReport() {
  const report = buildDebugReport();

  try {
    await copyTextToClipboard(report);
    writeLog("info", "lab", "Debug report copiado al portapapeles");
  } catch (error) {
    window.__LAST_DEBUG_REPORT__ = report;
    writeLog("warn", "lab", "Debug report generado; el navegador bloqueo la copia automatica", {
      error: serializeLogData(error),
      report
    });
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      copyTextFallback(text);
      return;
    }
  }

  copyTextFallback(text);
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("document.execCommand('copy') no copio el texto");
  }
}

function buildDebugReport() {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    page: window.location.href,
    selectedWidget: state.selectedWidget,
    responsive: state.responsive,
    validationResults: state.validationResults,
    logs: state.debugEntries,
    workerConnections: Array.from(elements.workerConnectionList.querySelectorAll(".worker-connection-entry")).map((item) => item.textContent)
  }, null, 2);
}

function applyResponsiveMode() {
  const [width, height] = state.responsive.preset.split("x").map((value) => Number.parseInt(value, 10));
  const zoom = Number(state.responsive.zoom) || 1;

  elements.viewportPresetSelect.value = state.responsive.preset;
  elements.zoomSelect.value = String(zoom);
  elements.previewBackgroundSelect.value = state.responsive.background;

  applyPreviewDimensions(width, height, zoom);
  applyPreviewBackground();
}

function applyPreviewDimensions(width, height, zoom) {
  elements.iframeViewport.style.width = `${width * zoom}px`;
  elements.iframeViewport.style.height = `${height * zoom}px`;
  elements.frame.style.width = `${width}px`;
  elements.frame.style.height = `${height}px`;
  elements.frame.style.transform = `scale(${zoom})`;
  elements.frame.style.transformOrigin = "top left";
}

function applyPreviewBackground() {
  elements.previewShell.classList.remove("preview-bg-transparent", "preview-bg-gray", "preview-bg-chroma", "preview-bg-dark");
  elements.previewShell.classList.add(`preview-bg-${state.responsive.background}`);
}

function createDefaultPredictionState() {
  return {
    id: "prediction-0001",
    title: "Quien gana la siguiente ronda?",
    durationSeconds: 60,
    status: "idle",
    startedAt: null,
    locksAt: null,
    lockedAt: null,
    endedAt: null,
    winningOutcomeId: "outcome-1",
    outcomes: [
      createPredictionOutcome(1),
      createPredictionOutcome(2)
    ]
  };
}

function createPredictionOutcome(number) {
  return {
    id: `outcome-${number}`,
    title: `Opcion ${number}`,
    color: number % 2 === 0 ? "pink" : "blue",
    users: 0,
    channelPoints: 0
  };
}

function renderPredictionControls() {
  elements.predictionTitle.value = state.prediction.title;
  elements.predictionDuration.value = String(state.prediction.durationSeconds);
  elements.predictionOutcomeCount.value = String(state.prediction.outcomes.length);
  renderPredictionWinningOptions();
  renderPredictionOutcomeRows();
}

function renderPredictionWinningOptions() {
  elements.predictionWinningOutcome.replaceChildren();

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "sin ganador";
  elements.predictionWinningOutcome.append(emptyOption);

  for (const outcome of state.prediction.outcomes) {
    const option = document.createElement("option");
    option.value = outcome.id;
    option.textContent = `${outcome.id} - ${outcome.title}`;
    elements.predictionWinningOutcome.append(option);
  }

  if (!state.prediction.outcomes.some((outcome) => outcome.id === state.prediction.winningOutcomeId)) {
    state.prediction.winningOutcomeId = state.prediction.outcomes[0]?.id || null;
  }

  elements.predictionWinningOutcome.value = state.prediction.winningOutcomeId || "";
}

function renderPredictionOutcomeRows() {
  elements.predictionOutcomes.replaceChildren();

  state.prediction.outcomes.forEach((outcome, index) => {
    const row = document.createElement("div");
    row.className = "prediction-outcome-row";
    row.append(
      createPredictionInput(index, "title", `Opcion ${index + 1}`, outcome.title, "text"),
      createPredictionInput(index, "users", "Usuarios", outcome.users, "number"),
      createPredictionInput(index, "channelPoints", "Puntos", outcome.channelPoints, "number")
    );
    elements.predictionOutcomes.append(row);
  });
}

function createPredictionInput(index, field, label, value, type) {
  const wrapper = document.createElement("label");
  const labelNode = document.createElement("span");
  const input = document.createElement("input");

  labelNode.className = "field-label";
  labelNode.textContent = label;
  input.className = "text-input";
  input.type = type;
  input.value = String(value);
  input.dataset.outcomeIndex = String(index);
  input.dataset.outcomeField = field;

  if (type === "number") {
    input.min = "0";
    input.step = "1";
  }

  wrapper.append(labelNode, input);
  return wrapper;
}

function handlePredictionOutcomeInput(event) {
  const input = event.target;
  const index = Number(input.dataset.outcomeIndex);
  const field = input.dataset.outcomeField;

  if (!field || Number.isNaN(index) || !state.prediction.outcomes[index]) {
    return;
  }

  if (field === "title") {
    state.prediction.outcomes[index].title = input.value;
    renderPredictionWinningOptions();
    return;
  }

  state.prediction.outcomes[index][field] = clampInteger(input.value, 0, 999999999);
}

function setPredictionOutcomeCount(value) {
  syncPredictionFromControls();

  const nextCount = clampInteger(value, 2, 10);
  elements.predictionOutcomeCount.value = String(nextCount);
  resizePredictionOutcomes(nextCount);
  renderPredictionControls();
}

function syncPredictionFromControls() {
  state.prediction.title = elements.predictionTitle.value.trim() || "Prediccion de prueba";
  state.prediction.durationSeconds = clampInteger(elements.predictionDuration.value, 1, 86400);
  state.prediction.winningOutcomeId = elements.predictionWinningOutcome.value || null;

  for (const input of elements.predictionOutcomes.querySelectorAll("[data-outcome-field]")) {
    const index = Number(input.dataset.outcomeIndex);
    const field = input.dataset.outcomeField;

    if (!state.prediction.outcomes[index]) {
      continue;
    }

    if (field === "title") {
      state.prediction.outcomes[index].title = input.value.trim() || `Opcion ${index + 1}`;
    } else {
      state.prediction.outcomes[index][field] = clampInteger(input.value, 0, 999999999);
    }
  }

  resizePredictionOutcomes(clampInteger(elements.predictionOutcomeCount.value, 2, 10));
}

function resizePredictionOutcomes(nextCount) {
  while (state.prediction.outcomes.length < nextCount) {
    state.prediction.outcomes.push(createPredictionOutcome(state.prediction.outcomes.length + 1));
  }

  state.prediction.outcomes = state.prediction.outcomes.slice(0, nextCount);

  if (!state.prediction.outcomes.some((outcome) => outcome.id === state.prediction.winningOutcomeId)) {
    state.prediction.winningOutcomeId = state.prediction.outcomes[0]?.id || null;
  }
}

function createPrediction() {
  syncPredictionFromControls();
  startPredictionWindow();
  state.prediction.status = "active";
  state.prediction.lockedAt = null;
  state.prediction.endedAt = null;
  emitTwitchPredictionPayload(buildPredictionPayload("begin"));
}

function addVotesToOutcome(index) {
  syncPredictionFromControls();
  ensurePredictionStarted();
  addPredictionVote(index, 1, 500);
  renderPredictionControls();
  emitTwitchPredictionPayload(buildPredictionPayload("progress"));
}

function addRandomPredictionVotes() {
  syncPredictionFromControls();
  ensurePredictionStarted();

  for (let index = 0; index < state.prediction.outcomes.length; index += 1) {
    const users = Math.floor(Math.random() * 4) + 1;
    const points = users * (Math.floor(Math.random() * 9) + 2) * 100;
    addPredictionVote(index, users, points);
  }

  renderPredictionControls();
  emitTwitchPredictionPayload(buildPredictionPayload("progress"));
}

function addPredictionVote(index, users, points) {
  const outcome = state.prediction.outcomes[index];

  if (!outcome) {
    writeLog("warn", "lab", `No existe la opcion ${index + 1} para sumar votos`);
    return;
  }

  outcome.users += users;
  outcome.channelPoints += points;
}

function lockPrediction() {
  syncPredictionFromControls();
  ensurePredictionStarted();
  state.prediction.status = "locked";
  state.prediction.lockedAt = new Date().toISOString();
  emitTwitchPredictionPayload(buildPredictionPayload("lock"));
}

function endPrediction(winnerIndex) {
  syncPredictionFromControls();
  ensurePredictionStarted();

  const winner = state.prediction.outcomes[winnerIndex];

  if (!winner) {
    writeLog("warn", "lab", `No existe la opcion ${winnerIndex + 1} para finalizar`);
    return;
  }

  state.prediction.status = "resolved";
  state.prediction.winningOutcomeId = winner.id;
  state.prediction.endedAt = new Date().toISOString();
  renderPredictionWinningOptions();
  emitTwitchPredictionPayload(buildPredictionPayload("end"));
}

function cancelPrediction() {
  syncPredictionFromControls();
  ensurePredictionStarted();
  state.prediction.status = "canceled";
  state.prediction.winningOutcomeId = null;
  state.prediction.endedAt = new Date().toISOString();
  renderPredictionWinningOptions();
  emitTwitchPredictionPayload(buildPredictionPayload("end"));
}

function resetPrediction() {
  state.prediction = createDefaultPredictionState();
  renderPredictionControls();
  writeLog("info", "lab", "Evento emitido: twitch.prediction.reset", {
    timestamp: new Date().toISOString(),
    summary: summarizePredictionState()
  });
}

function ensurePredictionStarted() {
  if (!state.prediction.startedAt || ["idle", "resolved", "canceled"].includes(state.prediction.status)) {
    startPredictionWindow();
    state.prediction.status = "active";
  }
}

function startPredictionWindow() {
  const startedAt = new Date();
  state.prediction.startedAt = startedAt.toISOString();
  state.prediction.locksAt = new Date(startedAt.getTime() + state.prediction.durationSeconds * 1000).toISOString();
  state.prediction.lockedAt = null;
  state.prediction.endedAt = null;
}

function buildPredictionPayload(stage) {
  const type = TWITCH_PREDICTION_TYPES[stage];
  const fixture = cloneJson(state.twitchPredictionFixtures[stage] || {
    type,
    subscription: { type },
    event: {}
  });
  const event = {
    ...fixture.event,
    id: state.prediction.id,
    broadcaster_user_id: "mock-channel-id",
    broadcaster_user_login: "losbroles",
    broadcaster_user_name: "LosBroles",
    title: state.prediction.title,
    outcomes: buildPredictionOutcomes(stage === "end"),
    started_at: state.prediction.startedAt
  };

  if (stage === "begin" || stage === "progress") {
    event.locks_at = state.prediction.locksAt;
    delete event.locked_at;
    delete event.ended_at;
    delete event.status;
    delete event.winning_outcome_id;
  }

  if (stage === "lock") {
    event.locked_at = state.prediction.lockedAt || new Date().toISOString();
    delete event.locks_at;
    delete event.ended_at;
    delete event.status;
    delete event.winning_outcome_id;
  }

  if (stage === "end") {
    event.status = state.prediction.status === "canceled" ? "canceled" : "resolved";
    event.winning_outcome_id = event.status === "resolved" ? state.prediction.winningOutcomeId : null;
    event.ended_at = state.prediction.endedAt || new Date().toISOString();
    delete event.locks_at;
    delete event.locked_at;
  }

  return {
    ...fixture,
    type,
    subscription: {
      ...fixture.subscription,
      type
    },
    event
  };
}

function buildPredictionOutcomes(includeWinnings) {
  return state.prediction.outcomes.map((outcome, index) => {
    const isWinner = state.prediction.winningOutcomeId === outcome.id;

    return {
      id: outcome.id,
      title: outcome.title,
      color: outcome.color || (index % 2 === 0 ? "blue" : "pink"),
      users: outcome.users,
      channel_points: outcome.channelPoints,
      top_predictors: buildTopPredictors(outcome, index, includeWinnings && isWinner)
    };
  });
}

function buildTopPredictors(outcome, index, includeWinnings) {
  if (outcome.users < 1 || outcome.channelPoints < 1) {
    return [];
  }

  const used = Math.max(1, Math.round(outcome.channelPoints / Math.max(1, outcome.users)));
  const predictor = {
    user_id: `mock-predictor-${String(index + 1).padStart(3, "0")}`,
    user_login: `prediction_user_${index + 1}`,
    user_name: `PredictionUser${index + 1}`,
    channel_points_used: used
  };

  if (includeWinnings) {
    predictor.channel_points_won = Math.round(used * 1.6);
  }

  return [predictor];
}

function emitTwitchPredictionPayload(payload) {
  const frameWindow = elements.frame.contentWindow;
  const timestamp = new Date().toISOString();
  const summary = summarizePredictionPayload(payload);

  if (!frameWindow) {
    writeLog("error", "lab", "Iframe no disponible");
    return;
  }

  frameWindow.postMessage({
    source: LAB_SOURCE,
    type: "TWITCH_EVENTSUB_EMIT",
    payload
  }, "*");

  writeLog("info", "lab", `Evento emitido: ${payload.type}`, {
    timestamp,
    summary,
    payload
  });
}

function summarizePredictionPayload(payload) {
  const outcomes = payload.event.outcomes || [];

  return {
    type: payload.type,
    title: payload.event.title,
    status: payload.event.status || state.prediction.status,
    winning_outcome_id: payload.event.winning_outcome_id || null,
    total_users: outcomes.reduce((total, outcome) => total + Number(outcome.users || 0), 0),
    total_channel_points: outcomes.reduce((total, outcome) => total + Number(outcome.channel_points || 0), 0),
    outcomes: outcomes.map((outcome) => ({
      id: outcome.id,
      title: outcome.title,
      users: outcome.users,
      channel_points: outcome.channel_points
    }))
  };
}

function summarizePredictionState() {
  return {
    title: state.prediction.title,
    status: state.prediction.status,
    outcome_count: state.prediction.outcomes.length,
    winning_outcome_id: state.prediction.winningOutcomeId,
    total_users: state.prediction.outcomes.reduce((total, outcome) => total + outcome.users, 0),
    total_channel_points: state.prediction.outcomes.reduce((total, outcome) => total + outcome.channelPoints, 0)
  };
}

function renderWorkerControls() {
  elements.workerInterceptToggle.checked = state.worker.interceptWebSocket;
  elements.workerUrlInput.value = state.worker.workerUrl;
  updateWorkerConnectionCount();
}

function sendWorkerConfig() {
  postToWidgetFrames({
    source: LAB_SOURCE,
    type: "WORKER_MOCK_CONFIG",
    config: {
      interceptWebSocket: state.worker.interceptWebSocket,
      workerUrl: state.worker.workerUrl
    }
  });
}

function sendWorkerWelcome() {
  const payload = {
    type: "welcome",
    session_id: "mock-session-id"
  };

  postWorkerBroadcast("WORKER_MOCK_WELCOME", payload, "Worker welcome");
}

function sendWorkerBridgeError() {
  const payload = {
    type: "bridge.error",
    error: {
      code: "mock_bridge_error",
      message: "Simulated Worker bridge error"
    }
  };

  postWorkerBroadcast("WORKER_MOCK_BRIDGE_ERROR", payload, "Worker bridge.error");
}

function sendWorkerPrediction(stage) {
  syncPredictionFromControls();

  if (stage === "begin") {
    startPredictionWindow();
    state.prediction.status = "active";
    state.prediction.lockedAt = null;
    state.prediction.endedAt = null;
  } else {
    ensurePredictionStarted();
  }

  if (stage === "lock") {
    state.prediction.status = "locked";
    state.prediction.lockedAt = new Date().toISOString();
  }

  if (stage === "end") {
    state.prediction.status = "resolved";
    state.prediction.endedAt = new Date().toISOString();
    state.prediction.winningOutcomeId = state.prediction.winningOutcomeId || state.prediction.outcomes[0]?.id || null;
  }

  const payload = buildPredictionPayload(stage);
  postWorkerBroadcast("WORKER_MOCK_BROADCAST", payload, `Worker ${payload.type}`);
}

function postWorkerBroadcast(type, payload, label) {
  postToWidgetFrames({
    source: LAB_SOURCE,
    type,
    payload
  });

  writeLog("info", "lab", `${label} broadcast solicitado`, {
    timestamp: new Date().toISOString(),
    summary: summarizeWorkerPayload(payload),
    payload
  });
}

function postToWidgetFrames(message) {
  const frames = document.querySelectorAll("iframe");

  for (const frame of frames) {
    frame.contentWindow?.postMessage(message, "*");
  }
}

function summarizeWorkerPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return String(payload);
  }

  if (payload.type === "welcome") {
    return {
      type: payload.type,
      session_id: payload.session_id
    };
  }

  if (payload.type === "bridge.error") {
    return {
      type: payload.type,
      code: payload.error?.code,
      message: payload.error?.message
    };
  }

  return summarizePredictionPayload(payload);
}

function appendWorkerConnectionLog(entry) {
  const item = document.createElement("li");
  const title = document.createElement("strong");
  const meta = document.createElement("code");

  item.className = "worker-connection-entry";
  title.textContent = `${entry.kind || "worker"} - ${entry.summary || ""}`;
  meta.textContent = `${entry.timestamp || new Date().toISOString()} | ${entry.connectionId || "-"} | ${entry.url || ""}`;
  item.append(title, meta);

  if (entry.payload) {
    const payload = document.createElement("code");
    payload.textContent = stringifyLogData(entry.payload);
    item.append(payload);
  }

  elements.workerConnectionList.prepend(item);

  while (elements.workerConnectionList.children.length > 40) {
    elements.workerConnectionList.lastElementChild.remove();
  }

  state.worker.connectionLogCount += 1;
  updateWorkerConnectionCount();
}

function updateWorkerConnectionCount() {
  elements.workerConnectionCount.textContent = String(state.worker.connectionLogCount);
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
        background: transparent;
        color: #ffffff;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 0;
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

function emitSEPayload(actionKey, payload) {
  const frameWindow = elements.frame.contentWindow;
  const action = SE_ACTIONS[actionKey];

  if (!frameWindow) {
    writeLog("error", "lab", "Iframe no disponible");
    return;
  }

  frameWindow.postMessage({
    source: LAB_SOURCE,
    type: "SE_MOCK_EMIT",
    action: action.mockAction,
    payload
  }, "*");

  writeLog("info", "lab", `Emitido ${action.label}`, payload);
}

function handleWidgetMessage(event) {
  const data = event.data;

  if (!data || data.source !== WIDGET_SOURCE) {
    return;
  }

  if (data.type === "LOG") {
    writeLog(data.level || "log", "widget", data.message || "", data.data);
  } else if (data.type === "WORKER_WS_LOG") {
    appendWorkerConnectionLog(data.entry || {});
  }
}

function clearLogs() {
  state.logCount = 0;
  state.debugEntries = [];
  elements.logList.replaceChildren();
  updateLogCount();
}

function writeLog(level, source, message, data) {
  const normalizedLevel = ["log", "info", "warn", "error"].includes(level) ? level : "log";
  const item = document.createElement("li");
  const timestamp = new Date();
  const entry = {
    timestamp: timestamp.toISOString(),
    level: normalizedLevel,
    source,
    message,
    data: serializeLogData(data)
  };
  item.className = `log-entry log-${normalizedLevel} ${source === "widget" ? "log-from-widget" : ""}`;

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
  state.debugEntries.push(entry);

  if (state.debugEntries.length > 500) {
    state.debugEntries.shift();
  }

  updateLogCount();
  elements.logList.scrollTop = elements.logList.scrollHeight;
}

function updateLogCount() {
  elements.logCount.textContent = `${state.logCount} ${state.logCount === 1 ? "log" : "logs"}`;
}

function setStatus(message) {
  elements.status.textContent = message;
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

function stringifyPayload(payload) {
  return JSON.stringify(payload, null, 2);
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

function serializeLogData(data) {
  if (typeof data === "undefined") {
    return undefined;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack
    };
  }

  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    return String(data);
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const { date, time } = getZipDosDateTime(new Date());
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path.replaceAll("\\", "/"));
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const localOffset = offset;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const centralOffset = offset;
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/zip"
  });
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  return table;
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getZipDosDateTime(dateValue) {
  const year = Math.max(1980, dateValue.getFullYear());

  return {
    date: ((year - 1980) << 9) | ((dateValue.getMonth() + 1) << 5) | dateValue.getDate(),
    time: (dateValue.getHours() << 11) | (dateValue.getMinutes() << 5) | Math.floor(dateValue.getSeconds() / 2)
  };
}

function resolveWidgetUrl(path) {
  return new URL(path, window.location.href);
}

function clampInteger(value, min, max) {
  const number = Number.parseInt(value, 10);

  if (Number.isNaN(number)) {
    return min;
  }

  return Math.min(Math.max(number, min), max);
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
