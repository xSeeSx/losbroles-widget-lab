(function () {
  const LAB_SOURCE = "losbroles-widget-lab";
  const FAKE_API_TOKEN = "fake-api-token-never-real";
  const store = new Map();
  const counters = new Map([
    ["follower-total", 1284],
    ["subscriber-total", 76],
    ["tip-total", 435.25],
    ["cheer-total", 18450]
  ]);

  const defaultChannel = {
    id: "mock-channel-id",
    providerId: "mock-twitch-channel-id",
    username: "losbroles",
    displayName: "LosBroles",
    apiToken: FAKE_API_TOKEN,
    avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/mock-profile_image-70x70.png"
  };

  let sessionState = {
    data: {
      "follower-total": { count: 1284 },
      "subscriber-total": { count: 76 },
      "tip-total": { amount: 435.25, currency: "EUR" },
      "cheer-total": { amount: 18450 }
    }
  };

  let recentsState = [];
  let currencyState = {
    code: "EUR",
    symbol: "EUR",
    name: "Euro"
  };

  function log(level, message, data) {
    if (typeof window.__LAB_LOG__ === "function") {
      window.__LAB_LOG__(level, message, data);
    }
  }

  function clone(value) {
    if (typeof value === "undefined") {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }

  function sanitize(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cheerFilter(message) {
    const filtered = String(message ?? "").replace(/\b(cheer|bits)(\d+)\b/gi, "$1 $2");
    return Promise.resolve(sanitize(filtered));
  }

  function dispatch(eventName, detail) {
    window.dispatchEvent(new CustomEvent(eventName, { detail: clone(detail) }));
    log("info", `StreamElements mock dispatched ${eventName}`, detail);
  }

  function updateCountersFromSession(session) {
    const data = session?.data || {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "number") {
        counters.set(key, value);
      } else if (typeof value?.count === "number") {
        counters.set(key, value.count);
      } else if (typeof value?.amount === "number") {
        counters.set(key, value.amount);
      }
    }
  }

  function normalizeChannel(channel) {
    return {
      ...defaultChannel,
      ...(channel || {}),
      username: channel?.username || defaultChannel.username,
      apiToken: channel?.apiToken || FAKE_API_TOKEN
    };
  }

  function normalizeWidgetLoadPayload(payload = {}) {
    const session = clone(payload.session || sessionState);
    const recents = clone(payload.recents || recentsState);
    const currency = clone(payload.currency || currencyState);

    sessionState = session;
    recentsState = recents;
    currencyState = currency;
    updateCountersFromSession(session);

    return {
      fieldData: clone(payload.fieldData || window.__LAB_FIELDS__ || {}),
      channel: normalizeChannel(payload.channel),
      session,
      recents,
      currency,
      widget: clone(payload.widget || window.__LAB_WIDGET_MANIFEST__ || {})
    };
  }

  function normalizeEventReceivedPayload(payload = {}) {
    return {
      listener: payload.listener || "message",
      event: clone(payload.event || {})
    };
  }

  function getEventDisplayName(event) {
    return event.displayName
      || event.name
      || event.data?.displayName
      || event.data?.nick
      || event.data?.name
      || "Anonymous";
  }

  function rememberRecent(payload) {
    const event = payload.event || {};
    const recent = {
      type: payload.listener,
      name: getEventDisplayName(event),
      createdAt: event.createdAt || event.data?.time || new Date().toISOString(),
      event: clone(event)
    };

    recentsState = [recent, ...recentsState].slice(0, 20);
  }

  function applyKVStoreUpdate(payload) {
    if (payload.listener !== "kvstore:update") {
      return;
    }

    const event = payload.event || {};
    const key = event.key || event.data?.key;
    const value = Object.prototype.hasOwnProperty.call(event, "value")
      ? event.value
      : event.data?.value;

    if (key) {
      store.set(key, clone(value));
    }
  }

  function emitSEWidgetLoad(payload = {}) {
    const normalized = normalizeWidgetLoadPayload(payload);
    dispatch("onWidgetLoad", normalized);
    return normalized;
  }

  function emitSEEventReceived(payload = {}) {
    const normalized = normalizeEventReceivedPayload(payload);
    applyKVStoreUpdate(normalized);
    rememberRecent(normalized);
    dispatch("onEventReceived", normalized);
    return normalized;
  }

  function emitSESessionUpdate(payload = {}) {
    const session = clone(payload.session || payload || sessionState);
    sessionState = session;
    updateCountersFromSession(session);

    const normalized = { session };
    dispatch("onSessionUpdate", normalized);
    return normalized;
  }

  function setField(key, value) {
    if (!window.__LAB_FIELDS__ || typeof window.__LAB_FIELDS__ !== "object") {
      window.__LAB_FIELDS__ = {};
    }

    window.__LAB_FIELDS__[key] = value;
    log("info", `StreamElements mock field set: ${key}`, { key, value });
    return value;
  }

  window.SE_API = {
    store: {
      get(key) {
        return Promise.resolve(clone(store.get(key)));
      },
      set(key, value) {
        store.set(key, clone(value));
        return Promise.resolve(clone(value));
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
      get(counter) {
        return Promise.resolve(counters.get(counter) ?? 0);
      },
      set(counter, value) {
        counters.set(counter, Number(value) || 0);
        return Promise.resolve(counters.get(counter));
      },
      increment(counter, amount = 1) {
        const nextValue = (counters.get(counter) ?? 0) + Number(amount || 0);
        counters.set(counter, nextValue);
        return Promise.resolve(nextValue);
      }
    },
    sanitize,
    cheerFilter,
    setField,
    resumeQueue() {
      return Promise.resolve();
    }
  };

  window.setField = setField;
  window.emitSEWidgetLoad = emitSEWidgetLoad;
  window.emitSEEventReceived = emitSEEventReceived;
  window.emitSESessionUpdate = emitSESessionUpdate;

  window.__SE_MOCK__ = {
    dispatch,
    emitSEWidgetLoad,
    emitSEEventReceived,
    emitSESessionUpdate,
    setField,
    get fieldData() {
      return window.__LAB_FIELDS__ || {};
    },
    get store() {
      return store;
    }
  };

  window.addEventListener("message", (event) => {
    const data = event.data;

    if (!data || data.source !== LAB_SOURCE) {
      return;
    }

    if (data.type === "LAB_EMIT") {
      dispatch(data.eventName, data.detail);
      return;
    }

    if (data.type !== "SE_MOCK_EMIT") {
      return;
    }

    if (data.action === "widgetLoad") {
      emitSEWidgetLoad(data.payload);
    } else if (data.action === "eventReceived") {
      emitSEEventReceived(data.payload);
    } else if (data.action === "sessionUpdate") {
      emitSESessionUpdate(data.payload);
    } else {
      log("warn", `StreamElements mock ignored action: ${data.action}`, data.payload);
    }
  });

  log("info", "StreamElements mock ready");
})();
