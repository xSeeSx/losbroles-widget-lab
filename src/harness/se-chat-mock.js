const LAB_SOURCE = "losbroles-widget-lab";

export const TWITCH_EMOTES = {
  Kappa: "25",
  PogChamp: "305954156",
  LUL: "425618",
  BibleThump: "86",
  SeemsGood: "64138"
};

export const CHAT_USER_PROFILES = {
  streamer: {
    label: "Streamer",
    displayName: "LosBroles",
    nick: "losbroles",
    userId: "133649243",
    channel: "losbroles",
    badges: ["broadcaster/1"],
    tags: {
      badges: "broadcaster/1",
      color: "#9146FF",
      "display-name": "LosBroles",
      mod: "0",
      subscriber: "0",
      turbo: "0",
      "user-id": "133649243",
      "room-id": "133649243",
      "user-type": ""
    }
  },
  viewer: {
    label: "Viewer normal",
    displayName: "ViewerTest",
    nick: "viewertest",
    userId: "mock-viewer-001",
    channel: "losbroles",
    badges: [],
    tags: {
      badges: "",
      color: "#1E90FF",
      "display-name": "ViewerTest",
      mod: "0",
      subscriber: "0",
      turbo: "0",
      "user-id": "mock-viewer-001",
      "room-id": "133649243",
      "user-type": ""
    }
  },
  mod: {
    label: "Mod",
    displayName: "ViewerTest",
    nick: "viewertest",
    userId: "mock-viewer-001",
    channel: "losbroles",
    badges: ["mod/1"],
    tags: {
      badges: "moderator/1",
      color: "#1E90FF",
      "display-name": "ViewerTest",
      mod: "1",
      subscriber: "0",
      turbo: "0",
      "user-id": "mock-viewer-001",
      "room-id": "133649243",
      "user-type": ""
    }
  },
  subscriber: {
    label: "Subscriber",
    displayName: "ViewerTest",
    nick: "viewertest",
    userId: "mock-viewer-001",
    channel: "losbroles",
    badges: ["subscriber/12"],
    tags: {
      badges: "subscriber/12",
      color: "#1E90FF",
      "display-name": "ViewerTest",
      mod: "0",
      subscriber: "1",
      turbo: "0",
      "user-id": "mock-viewer-001",
      "room-id": "133649243",
      "user-type": ""
    }
  }
};

export function buildSEChatMessage({
  text = "",
  profile = CHAT_USER_PROFILES.viewer,
  isAction = false,
  parseEmotes = true,
  now = Date.now(),
  id = createMessageId()
} = {}) {
  const normalizedProfile = normalizeProfile(profile);
  const messageText = normalizeMessageText(text, isAction);
  const emotes = parseEmotes ? parseTwitchEmotes(messageText) : [];
  const timestamp = Number(now);
  const tags = {
    ...normalizedProfile.tags,
    emotes: buildEmotesTag(emotes),
    flags: "",
    id,
    mod: normalizedProfile.tags.mod || "0",
    "room-id": normalizedProfile.tags["room-id"] || "133649243",
    subscriber: normalizedProfile.tags.subscriber || "0",
    "tmi-sent-ts": String(timestamp),
    turbo: normalizedProfile.tags.turbo || "0",
    "user-id": normalizedProfile.userId,
    "user-type": normalizedProfile.tags["user-type"] || ""
  };

  return {
    detail: {
      listener: "message",
      event: {
        data: {
          time: timestamp,
          tags,
          nick: normalizedProfile.nick,
          userId: normalizedProfile.userId,
          displayName: normalizedProfile.displayName,
          displayColor: tags.color,
          badges: clone(normalizedProfile.badges),
          channel: normalizedProfile.channel,
          text: messageText,
          isAction,
          emotes,
          msgId: id
        }
      }
    }
  };
}

export function emitSEChatMessage(iframeWindow, payload) {
  if (!iframeWindow) {
    throw new Error("Iframe no disponible");
  }

  const detail = clone(payload?.detail || payload);

  try {
    iframeWindow.dispatchEvent(new iframeWindow.CustomEvent("onEventReceived", { detail }));
    return "dispatchEvent";
  } catch (error) {
    iframeWindow.postMessage({
      source: LAB_SOURCE,
      type: "SE_MOCK_EMIT",
      action: "eventReceived",
      payload: detail
    }, "*");
    return "postMessage";
  }
}

function normalizeProfile(profile) {
  if (typeof profile === "string") {
    return CHAT_USER_PROFILES[profile] || CHAT_USER_PROFILES.viewer;
  }

  return profile || CHAT_USER_PROFILES.viewer;
}

function normalizeMessageText(text, isAction) {
  const value = String(text ?? "");

  if (!isAction) {
    return value;
  }

  return value.replace(/^\/me\s+/i, "");
}

function parseTwitchEmotes(text) {
  const emotes = [];
  const tokenPattern = /\S+/g;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    const name = match[0];
    const id = TWITCH_EMOTES[name];

    if (!id) {
      continue;
    }

    const start = match.index;
    const end = start + name.length - 1;

    emotes.push({
      type: "twitch",
      name,
      id,
      gif: false,
      urls: {
        "1": `https://static-cdn.jtvnw.net/emoticons/v1/${id}/1.0`,
        "2": `https://static-cdn.jtvnw.net/emoticons/v1/${id}/2.0`,
        "4": `https://static-cdn.jtvnw.net/emoticons/v1/${id}/4.0`
      },
      start,
      end
    });
  }

  return emotes;
}

function buildEmotesTag(emotes) {
  const rangesById = new Map();

  for (const emote of emotes) {
    const ranges = rangesById.get(emote.id) || [];
    ranges.push(`${emote.start}-${emote.end}`);
    rangesById.set(emote.id, ranges);
  }

  return Array.from(rangesById.entries())
    .map(([id, ranges]) => `${id}:${ranges.join(",")}`)
    .join("/");
}

function createMessageId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
