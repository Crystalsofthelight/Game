(function attachNeonTrailEmbed(globalObject) {
  const GAME_SOURCE = "neon-trail-game";
  const HOST_SOURCE = "neon-trail-host";

  function resolveMount(target) {
    if (target instanceof HTMLElement) {
      return target;
    }

    if (typeof target === "string") {
      return document.querySelector(target);
    }

    return null;
  }

  function buildEmbedUrl(src, parentOrigin) {
    const url = new URL(src, window.location.href);
    if (parentOrigin && parentOrigin !== "null") {
      url.searchParams.set("parentOrigin", parentOrigin);
    }
    url.searchParams.set("embed", "1");
    return url.toString();
  }

  function create(options) {
    const mount = resolveMount(options.mount);
    if (!mount) {
      throw new Error("NeonTrailEmbed.create requires a valid mount element or selector.");
    }

    const iframe = document.createElement("iframe");
    iframe.src = buildEmbedUrl(options.src || "./embed.html", window.location.origin);
    iframe.title = options.title || "Neon Trail";
    iframe.allow = "autoplay; fullscreen";
    iframe.allowFullscreen = true;
    iframe.loading = options.loading || "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.style.width = options.width || "100%";
    iframe.style.height = options.height || "720px";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.background = "transparent";

    const allowedOrigin = options.allowedOrigin || new URL(iframe.src).origin;

    function post(type, payload) {
      if (!iframe.contentWindow) {
        return;
      }

      iframe.contentWindow.postMessage(
        {
          source: HOST_SOURCE,
          type,
          payload,
        },
        "*",
      );
    }

    function handleMessage(event) {
      if (event.source !== iframe.contentWindow) {
        return;
      }

      if (allowedOrigin && allowedOrigin !== "*" && event.origin !== allowedOrigin) {
        return;
      }

      const message = event.data;
      if (!message || message.source !== GAME_SOURCE) {
        return;
      }

      if (typeof options.onEvent === "function") {
        options.onEvent(message.type, message.payload);
      }

      switch (message.type) {
        case "ready":
          if (options.playerContext) {
            post("set-player-context", options.playerContext);
          }
          if (options.rewardPolicy) {
            post("set-reward-policy", options.rewardPolicy);
          }
          if (options.orientationPolicy) {
            post("set-orientation-policy", options.orientationPolicy);
          }
          if (options.autoStart) {
            post("start-run", { regenerate: true });
          }
          options.onReady?.(message.payload);
          break;
        case "state":
          options.onState?.(message.payload);
          break;
        case "run-start":
          options.onRunStart?.(message.payload);
          break;
        case "run-end":
          options.onRunEnd?.(message.payload);
          break;
        case "player-context":
          options.onPlayerContext?.(message.payload);
          break;
        case "reward-policy":
          options.onRewardPolicy?.(message.payload);
          break;
        case "orientation-change":
          options.onOrientationChange?.(message.payload);
          break;
        case "orientation-policy":
          options.onOrientationPolicy?.(message.payload);
          break;
        default:
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    mount.appendChild(iframe);

    return {
      iframe,
      startRun(config = {}) {
        post("start-run", config);
      },
      restartRun() {
        post("restart-run", {});
      },
      requestState(requestId) {
        post("request-state", { requestId: requestId || null });
      },
      setPlayerContext(playerContext) {
        post("set-player-context", playerContext);
      },
      setRewardPolicy(rewardPolicy) {
        post("set-reward-policy", rewardPolicy);
      },
      setOrientationPolicy(orientationPolicy) {
        post("set-orientation-policy", orientationPolicy);
      },
      destroy() {
        window.removeEventListener("message", handleMessage);
        iframe.remove();
      },
    };
  }

  globalObject.NeonTrailEmbed = { create };
})(window);