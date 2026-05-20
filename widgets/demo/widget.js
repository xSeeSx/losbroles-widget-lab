(function () {
  const title = document.querySelector("#demoTitle");
  const message = document.querySelector("#demoMessage");
  const counter = document.querySelector("#demoCounter");
  const events = document.querySelector("#demoEvents");

  const state = {
    count: 0,
    maxEvents: 5,
    showCounter: true
  };

  function applyFields(fieldData = {}) {
    const widgetTitle = fieldData.title || "LosBroles Widget Lab";
    const accentColor = fieldData.accentColor || "#22c55e";

    state.maxEvents = Number(fieldData.maxEvents || 5);
    state.showCounter = fieldData.showCounter !== false;

    document.documentElement.style.setProperty("--demo-accent", accentColor);
    title.textContent = widgetTitle;
    message.textContent = "onWidgetLoad received";
    renderCounter();
  }

  function renderCounter() {
    counter.hidden = !state.showCounter;
    counter.textContent = `${state.count} ${state.count === 1 ? "event" : "events"}`;
  }

  function appendEvent(payload = {}) {
    const event = payload.event || {};
    const data = event.data || {};
    const listener = payload.listener || "unknown-listener";
    const displayName = event.displayName || event.name || data.displayName || data.nick || "Anonymous";
    const amount = typeof event.amount === "number" ? ` x${event.amount}` : "";
    const text = event.message || data.text || "";
    const item = document.createElement("li");

    item.textContent = `${listener}: ${displayName}${amount}${text ? ` - ${text}` : ""}`;
    events.prepend(item);

    while (events.children.length > state.maxEvents) {
      events.lastElementChild.remove();
    }

    state.count += 1;
    message.textContent = `Latest event from ${displayName}`;
    renderCounter();
  }

  window.addEventListener("onWidgetLoad", (event) => {
    applyFields(event.detail?.fieldData);
    console.info("onWidgetLoad received", event.detail);
  });

  window.addEventListener("onEventReceived", (event) => {
    appendEvent(event.detail);
    console.info("onEventReceived received", event.detail);
  });

  window.addEventListener("onSessionUpdate", (event) => {
    console.info("onSessionUpdate received", event.detail);
  });

  window.addEventListener("twitch:eventsub", (event) => {
    const payload = event.detail || {};
    const twitchEvent = payload.event || {};
    const item = document.createElement("li");

    item.textContent = `${payload.type}: ${twitchEvent.title || "Twitch EventSub"}`;
    events.prepend(item);

    while (events.children.length > state.maxEvents) {
      events.lastElementChild.remove();
    }

    state.count += 1;
    message.textContent = `Latest Twitch event: ${payload.type}`;
    renderCounter();
    console.info("twitch:eventsub received", payload);
  });

  try {
    const socket = new WebSocket("wss://worker.mock/ws");

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "widget.ready",
        widget: "demo"
      }));
      console.info("worker websocket open");
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const item = document.createElement("li");

      item.textContent = `worker: ${payload.type}`;
      events.prepend(item);

      while (events.children.length > state.maxEvents) {
        events.lastElementChild.remove();
      }

      state.count += 1;
      message.textContent = `Latest Worker message: ${payload.type}`;
      renderCounter();
      console.info("worker websocket message", payload);
    });

    socket.addEventListener("close", (event) => {
      console.info("worker websocket close", {
        code: event.code,
        reason: event.reason
      });
    });
  } catch (error) {
    console.warn("worker websocket unavailable", error);
  }

  if (typeof window.__LAB_LOG__ === "function") {
    window.__LAB_LOG__("info", "Demo widget script ready");
  }
})();
