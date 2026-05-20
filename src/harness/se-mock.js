(function () {
  const LAB_SOURCE = "losbroles-widget-lab";
  const store = new Map();

  function log(level, message, data) {
    if (typeof window.__LAB_LOG__ === "function") {
      window.__LAB_LOG__(level, message, data);
    }
  }

  function sanitize(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function dispatch(eventName, detail) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    log("info", `StreamElements mock dispatched ${eventName}`, detail);
  }

  window.SE_API = {
    store: {
      get(key) {
        return Promise.resolve(store.get(key));
      },
      set(key, value) {
        store.set(key, value);
        return Promise.resolve(value);
      },
      delete(key) {
        const deleted = store.delete(key);
        return Promise.resolve(deleted);
      },
      clear() {
        store.clear();
        return Promise.resolve();
      }
    },
    counters: {
      get() {
        return Promise.resolve(0);
      },
      set() {
        return Promise.resolve();
      },
      increment() {
        return Promise.resolve(1);
      }
    },
    cheerFilter(message) {
      return Promise.resolve(message);
    },
    resumeQueue() {
      return Promise.resolve();
    },
    sanitize
  };

  window.__SE_MOCK__ = {
    dispatch,
    get fieldData() {
      return window.__LAB_FIELDS__ || {};
    }
  };

  window.addEventListener("message", (event) => {
    const data = event.data;

    if (!data || data.source !== LAB_SOURCE || data.type !== "LAB_EMIT") {
      return;
    }

    dispatch(data.eventName, data.detail);
  });

  log("info", "StreamElements mock ready");
})();

