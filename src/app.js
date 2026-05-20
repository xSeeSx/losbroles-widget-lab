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

const state = {
  widgets: [],
  selectedWidget: null,
  selectedManifest: null,
  selectedManifestUrl: null,
  fieldsSchema: {},
  fieldData: {},
  seFixtures: {},
  twitchPredictionFixtures: {},
  prediction: createDefaultPredictionState(),
  activePayloadType: "widgetLoad",
  payloadDrafts: {},
  logCount: 0
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  writeLog("info", "lab", "Inicializando laboratorio");

  try {
    await Promise.all([
      loadSEFixtures(),
      loadTwitchPredictionFixtures()
    ]);
    renderPredictionControls();
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

  elements.clearLogsButton.addEventListener("click", clearLogs);
  elements.frame.addEventListener("load", () => {
    if (state.selectedWidget) {
      writeLog("info", "lab", `Iframe cargado: ${state.selectedWidget.id}`);
    }
  });

  window.addEventListener("message", handleWidgetMessage);
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
    resetPayloadDrafts();
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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
