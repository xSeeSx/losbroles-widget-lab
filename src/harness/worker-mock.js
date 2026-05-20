(function () {
  const LAB_SOURCE = "losbroles-widget-lab";
  const WIDGET_SOURCE = "losbroles-widget-lab-widget";
  const DEFAULT_SESSION_ID = "mock-session-id";
  const connections = new Map();
  const NativeWebSocket = window.WebSocket;
  let nextConnectionId = 1;
  let interceptWorkerWebSocket = true;
  let workerUrl = "";

  function log(level, message, data) {
    if (typeof window.__LAB_LOG__ === "function") {
      window.__LAB_LOG__(level, message, data);
    }
  }

  function sendToLab(type, payload = {}) {
    parent.postMessage({ source: WIDGET_SOURCE, type, ...payload }, "*");
  }

  function clone(value) {
    if (typeof value === "undefined") {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }

  function parseSocketMessage(data) {
    if (typeof data !== "string") {
      return data;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      return data;
    }
  }

  function stringifySocketMessage(payload) {
    return typeof payload === "string" ? payload : JSON.stringify(payload);
  }

  function isWorkerSocketUrl(url) {
    return String(url || "").includes("/ws");
  }

  function shouldIntercept(url) {
    return interceptWorkerWebSocket && isWorkerSocketUrl(url);
  }

  function emitWorkerConsole(entry) {
    sendToLab("WORKER_WS_LOG", {
      entry: {
        timestamp: new Date().toISOString(),
        ...entry
      }
    });
  }

  function emitSocketEvent(socket, event) {
    socket.dispatchEvent(event);

    const handler = socket[`on${event.type}`];

    if (typeof handler === "function") {
      handler.call(socket, event);
    }
  }

  function createCloseEvent(type, options) {
    if (typeof CloseEvent === "function") {
      return new CloseEvent(type, options);
    }

    const event = new Event(type);
    event.code = options.code;
    event.reason = options.reason;
    event.wasClean = options.wasClean;
    return event;
  }

  class LabWorkerMock extends EventTarget {
    constructor(scriptUrl) {
      super();
      this.scriptUrl = String(scriptUrl);
      this.onmessage = null;
      this.onerror = null;
      log("info", "Worker mock created", { scriptUrl: this.scriptUrl });
    }

    postMessage(message) {
      const response = {
        mocked: true,
        scriptUrl: this.scriptUrl,
        echo: message
      };

      queueMicrotask(() => {
        const event = new MessageEvent("message", { data: response });

        if (typeof this.onmessage === "function") {
          this.onmessage(event);
        }

        this.dispatchEvent(event);
      });
    }

    terminate() {
      log("info", "Worker mock terminated", { scriptUrl: this.scriptUrl });
    }
  }

  class LabWebSocketMock extends EventTarget {
    constructor(url, protocols) {
      super();

      if (!shouldIntercept(url) && typeof NativeWebSocket === "function") {
        return typeof protocols === "undefined"
          ? new NativeWebSocket(url)
          : new NativeWebSocket(url, protocols);
      }

      this.id = `mock-ws-${nextConnectionId}`;
      nextConnectionId += 1;
      this.url = String(url);
      this.protocol = "";
      this.extensions = "";
      this.binaryType = "blob";
      this.bufferedAmount = 0;
      this.readyState = LabWebSocketMock.CONNECTING;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;

      connections.set(this.id, this);
      emitWorkerConsole({
        kind: "connection.opening",
        connectionId: this.id,
        url: this.url,
        summary: "Opening mocked Worker WebSocket"
      });

      queueMicrotask(() => {
        if (this.readyState !== LabWebSocketMock.CONNECTING) {
          return;
        }

        this.readyState = LabWebSocketMock.OPEN;
        emitSocketEvent(this, new Event("open"));
        emitWorkerConsole({
          kind: "connection.open",
          connectionId: this.id,
          url: this.url,
          summary: "Mocked Worker WebSocket open"
        });
        this.receive({
          type: "welcome",
          session_id: DEFAULT_SESSION_ID
        });
      });
    }

    send(data) {
      if (this.readyState !== LabWebSocketMock.OPEN) {
        throw new DOMException("WebSocket is not open", "InvalidStateError");
      }

      emitWorkerConsole({
        kind: "message.from-widget",
        connectionId: this.id,
        url: this.url,
        summary: "Widget sent message to Worker mock",
        payload: parseSocketMessage(data)
      });
      log("info", "Worker WebSocket mock received widget message", {
        connectionId: this.id,
        payload: parseSocketMessage(data)
      });
    }

    close(code = 1000, reason = "mock closed") {
      if (this.readyState === LabWebSocketMock.CLOSED || this.readyState === LabWebSocketMock.CLOSING) {
        return;
      }

      this.readyState = LabWebSocketMock.CLOSING;
      queueMicrotask(() => {
        this.readyState = LabWebSocketMock.CLOSED;
        connections.delete(this.id);
        emitSocketEvent(this, createCloseEvent("close", { code, reason, wasClean: true }));
        emitWorkerConsole({
          kind: "connection.close",
          connectionId: this.id,
          url: this.url,
          summary: "Mocked Worker WebSocket closed",
          payload: { code, reason }
        });
      });
    }

    receive(payload) {
      if (this.readyState !== LabWebSocketMock.OPEN) {
        return;
      }

      const data = stringifySocketMessage(payload);
      emitSocketEvent(this, new MessageEvent("message", { data }));
      emitWorkerConsole({
        kind: "message.to-widget",
        connectionId: this.id,
        url: this.url,
        summary: summarizePayload(payload),
        payload: clone(payload)
      });
    }
  }

  LabWebSocketMock.CONNECTING = 0;
  LabWebSocketMock.OPEN = 1;
  LabWebSocketMock.CLOSING = 2;
  LabWebSocketMock.CLOSED = 3;

  function summarizePayload(payload) {
    if (!payload || typeof payload !== "object") {
      return String(payload);
    }

    if (payload.type === "welcome") {
      return `welcome ${payload.session_id || ""}`.trim();
    }

    if (payload.type === "bridge.error") {
      return `bridge.error ${payload.error?.code || ""}`.trim();
    }

    const event = payload.event || {};
    const outcomes = Array.isArray(event.outcomes) ? event.outcomes : [];
    const points = outcomes.reduce((total, outcome) => total + Number(outcome.channel_points || 0), 0);

    return `${payload.type || "message"} ${event.title || ""} users=${outcomes.reduce((total, outcome) => total + Number(outcome.users || 0), 0)} points=${points}`.trim();
  }

  function broadcast(payload) {
    let delivered = 0;

    for (const socket of connections.values()) {
      socket.receive(payload);
      delivered += 1;
    }

    emitWorkerConsole({
      kind: "broadcast",
      connectionId: "*",
      url: workerUrl || "mock",
      summary: `Broadcast delivered to ${delivered} mocked WebSocket connection${delivered === 1 ? "" : "s"}`,
      payload: clone(payload)
    });

    return delivered;
  }

  function sendWelcome() {
    return broadcast({
      type: "welcome",
      session_id: DEFAULT_SESSION_ID
    });
  }

  function sendBridgeError(payload) {
    return broadcast(payload || {
      type: "bridge.error",
      error: {
        code: "mock_bridge_error",
        message: "Simulated Worker bridge error"
      }
    });
  }

  function configure(nextConfig = {}) {
    interceptWorkerWebSocket = nextConfig.interceptWebSocket !== false;
    workerUrl = String(nextConfig.workerUrl || "");
    emitWorkerConsole({
      kind: "config",
      connectionId: "-",
      url: workerUrl,
      summary: `WebSocket interception ${interceptWorkerWebSocket ? "enabled" : "disabled"}`,
      payload: {
        interceptWebSocket: interceptWorkerWebSocket,
        workerUrl
      }
    });
  }

  window.__LAB_NATIVE_WORKER__ = window.Worker;
  window.__LAB_NATIVE_WEBSOCKET__ = NativeWebSocket;
  window.Worker = LabWorkerMock;
  window.WebSocket = LabWebSocketMock;
  window.WebSocket.CONNECTING = LabWebSocketMock.CONNECTING;
  window.WebSocket.OPEN = LabWebSocketMock.OPEN;
  window.WebSocket.CLOSING = LabWebSocketMock.CLOSING;
  window.WebSocket.CLOSED = LabWebSocketMock.CLOSED;
  window.WorkerMock = LabWorkerMock;
  window.__LAB_WORKER_MOCK__ = {
    create(scriptUrl) {
      return new LabWorkerMock(scriptUrl);
    },
    configure,
    broadcast,
    sendWelcome,
    sendBridgeError,
    get connections() {
      return Array.from(connections.keys());
    },
    get interceptWebSocket() {
      return interceptWorkerWebSocket;
    }
  };

  window.addEventListener("message", (event) => {
    const data = event.data;

    if (!data || data.source !== LAB_SOURCE) {
      return;
    }

    if (data.type === "WORKER_MOCK_CONFIG") {
      configure(data.config);
      return;
    }

    if (data.type === "WORKER_MOCK_WELCOME") {
      sendWelcome();
      return;
    }

    if (data.type === "WORKER_MOCK_BRIDGE_ERROR") {
      sendBridgeError(data.payload);
      return;
    }

    if (data.type === "WORKER_MOCK_BROADCAST") {
      broadcast(data.payload);
    }
  });

  log("info", "Worker mock ready");
})();
