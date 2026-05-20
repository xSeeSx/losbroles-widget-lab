(function () {
  function log(level, message, data) {
    if (typeof window.__LAB_LOG__ === "function") {
      window.__LAB_LOG__(level, message, data);
    }
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

  window.__LAB_NATIVE_WORKER__ = window.Worker;
  window.Worker = LabWorkerMock;
  window.WorkerMock = LabWorkerMock;
  window.__LAB_WORKER_MOCK__ = {
    create(scriptUrl) {
      return new LabWorkerMock(scriptUrl);
    }
  };

  log("info", "Worker mock ready");
})();

