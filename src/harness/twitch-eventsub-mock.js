(function () {
  const LAB_SOURCE = "losbroles-widget-lab";
  const handlers = new Map();

  function log(level, message, data) {
    if (typeof window.__LAB_LOG__ === "function") {
      window.__LAB_LOG__(level, message, data);
    }
  }

  function getHandlers(type) {
    if (!handlers.has(type)) {
      handlers.set(type, new Set());
    }

    return handlers.get(type);
  }

  window.TwitchEventSubMock = {
    on(type, handler) {
      getHandlers(type).add(handler);
      return () => this.off(type, handler);
    },
    off(type, handler) {
      if (handlers.has(type)) {
        handlers.get(type).delete(handler);
      }
    },
    emit(type, event) {
      const payload = { type, event };

      for (const handler of getHandlers(type)) {
        handler(payload);
      }

      window.dispatchEvent(new CustomEvent("twitch:eventsub", { detail: payload }));
      log("info", `Twitch EventSub mock emitted ${type}`, payload);
    },
    clear() {
      handlers.clear();
    }
  };

  window.addEventListener("message", (event) => {
    const data = event.data;

    if (!data || data.source !== LAB_SOURCE || data.type !== "TWITCH_EVENTSUB_EMIT") {
      return;
    }

    window.TwitchEventSubMock.emit(data.eventType, data.event);
  });

  log("info", "Twitch EventSub mock ready");
})();

