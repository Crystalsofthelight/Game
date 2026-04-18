const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const bestEl = document.getElementById("best");
const distanceEl = document.getElementById("distance");
const scoreEl = document.getElementById("score");
const spinsEarnedEl = document.getElementById("spinsEarned");
const spinsLeftEl = document.getElementById("spinsLeft");
const landingEl = document.getElementById("landing");
const trickEl = document.getElementById("trick");
const speedEl = document.getElementById("speed");
const statusEl = document.getElementById("status");
const startOverlayEl = document.getElementById("startOverlay");
const crashOverlayEl = document.getElementById("crashOverlay");
const crashTitleEl = document.getElementById("crashTitle");
const runSummaryEl = document.getElementById("runSummary");
const orientationOverlayEl = document.getElementById("orientationOverlay");
const requestLandscapeBtn = document.getElementById("requestLandscapeBtn");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");
const urlParams = new URLSearchParams(window.location.search);
const externalConfig = window.NEON_TRAIL_CONFIG || {};

const GAME_MESSAGE_SOURCE = "neon-trail-game";
const HOST_MESSAGE_SOURCE = "neon-trail-host";
const GAME_VERSION = "1.0.0";
const STATE_PUBLISH_INTERVAL = 250;

const STORAGE_DISTANCE_KEY = "neon-trail-best-distance";
const STORAGE_SCORE_KEY = "neon-trail-best-points";
const LEGACY_DISTANCE_KEY = "neon-trail-best-score";
const MAX_DT = 1 / 30;
const GRAVITY = 1750;
const WHEEL_BASE = 86;
const WHEEL_RADIUS = 18;
const BODY_HEIGHT = 30;
const BODY_HALF_LENGTH = 54;
const RENDER_SUSPENSION_TRAVEL = 6;
const RENDER_SUSPENSION_FOLLOW = 18;
const RENDER_SUSPENSION_ANGLE_FOLLOW = 14;
const RENDER_SUSPENSION_MAX_ANGLE = 0.14;
const TRACK_BUFFER = 5200;
const TRACK_BASELINE_RATIO = 0.72;
const TRACK_MIN_RATIO = 0.42;
const TRACK_MAX_RATIO = 0.82;
const DIFFICULTY_RAMP_DISTANCE = 26000;
const SPAWN_X = 180;
const HILL_STEEP_MIN = 90;
const HILL_STEEP_MAX = 150;
const STEEP_HILL_MIN = 130;
const STEEP_HILL_MAX = 210;
const BIG_GAP_LENGTH = 250;
const BIG_GAP_RUNUP = 260;
const BIG_GAP_LANDING = 360;
const AIR_TILT_STRENGTH = 440;
const GROUND_TILT_STRENGTH = 170;
const REAR_DRIVE_FORCE = 2300;
const REAR_DRIVE_TOP_SPEED = 1280;
const JUMP_FORCE = 520;
const JUMP_FORWARD_BOOST = 110;
const JUMP_BUFFER_TIME = 0.18;
const JUMP_COOLDOWN_TIME = 0.32;
const HILL_LEVEL_ASSIST = 220;
const CREST_LEVEL_ASSIST = 360;
const HILL_LEVEL_BLEND = 0.52;
const HILL_LEVEL_LIMIT = 0.75;
const AIR_ROTATION_DAMPING = 3.8;
const AIR_SELF_LEVEL_STRENGTH = 130;
const WHEEL_DAMPING = 0.992;
const CHASSIS_STIFFNESS = 0.3;
const CHASSIS_DAMPING = 0.16;
const TRACK_THICKNESS = 18;
const GAP_FAIL_MARGIN = 220;
const SAFE_UPSIDE_ANGLE = 2.2;
const SCORE_DISTANCE_RATE = 1 / (50 * 12);
const SCORE_AIRTIME_RATE = 42;
const SCORE_LANDING_TIME = 0.2;
const SCORE_LANDING_BONUS = 60;
const SCORE_CLEAN_LANDING_BONUS = 120;
const SCORE_BIG_AIR_TIME = 0.95;
const SCORE_BIG_AIR_BONUS = 180;
const SCORE_FLIP_BONUS = 300;
const AWARD_POPUP_LIFETIME = 1.2;
const LANDSCAPE_MOBILE_MAX_WIDTH = 960;

let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width * devicePixelRatio;
canvas.height = height * devicePixelRatio;
ctx.scale(devicePixelRatio, devicePixelRatio);

const input = {
  accelerate: false,
  jump: false,
  left: false,
  right: false,
};

const state = {
  mode: "menu",
  bike: null,
  airTime: 0,
  airRotation: 0,
  message: "Ready",
  messageTimer: 0,
  runTime: 0,
  maxDistance: 0,
  bestDistance: 0,
  bestScore: 0,
  score: 0,
  lastScoreX: 0,
  lastLandingAward: "--",
  lastTrickAward: "--",
  awardPopups: [],
  displaySpeed: 0,
  jumpBuffer: 0,
  jumpCooldown: 0,
};

const audio = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
  windOsc: null,
  windGain: null,
};

let cameraX = 0;
let lastTime = performance.now();
let trackPieces = [];
let nextTrackX = 0;
let plannedPieceIndex = 0;

const trackPlan = [
  "flat",
  "hill",
  "steep-hill",
  "jump",
  "gap",
  "speed-gap",
  "wave",
  "jump",
  "hill",
  "steep-hill",
  "gap",
  "speed-gap",
  "wave",
  "jump",
  "flat",
  "wave",
  "hill",
  "flat",
];

const openingTrackPlan = ["flat", "flat", "hill", "flat", "wave", "flat", "gap", "hill", "flat"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
}

function lerpAngle(current, target, factor) {
  return current + normalizeAngle(target - current) * factor;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function worldToMeters(worldDistance) {
  return Math.max(0, Math.floor(worldDistance / 12));
}

function formatPoints(points) {
  return `${Math.round(points).toLocaleString()} pts`;
}

function formatAward(label, points) {
  return points > 0 ? `${label} +${points}` : "--";
}

function formatSpinCount(amount) {
  return `${amount} ${amount === 1 ? "spin" : "spins"}`;
}

function sanitizeFiniteNumber(value, fallback) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePlayerContext(playerContext = {}) {
  return {
    playerId: playerContext.playerId ? String(playerContext.playerId) : null,
    walletAddress: playerContext.walletAddress ? String(playerContext.walletAddress) : null,
  };
}

function normalizeRewardPolicy(rewardPolicy = {}) {
  const pointsPerRewardUnit = Math.max(1, sanitizeFiniteNumber(rewardPolicy.pointsPerRewardUnit, 5000));
  const rewardDecimals = Math.min(8, Math.max(0, Math.floor(sanitizeFiniteNumber(rewardPolicy.rewardDecimals, 0))));
  const fallbackRewardLabel = typeof rewardPolicy.rewardSymbol === "string" && rewardPolicy.rewardSymbol.trim()
    ? rewardPolicy.rewardSymbol.trim()
    : null;
  const rewardNameSingular = typeof rewardPolicy.rewardNameSingular === "string" && rewardPolicy.rewardNameSingular.trim()
    ? rewardPolicy.rewardNameSingular.trim()
    : fallbackRewardLabel || "spin";
  const rewardNamePlural = typeof rewardPolicy.rewardNamePlural === "string" && rewardPolicy.rewardNamePlural.trim()
    ? rewardPolicy.rewardNamePlural.trim()
    : fallbackRewardLabel || "spins";
  const wholeUnitsOnly = rewardPolicy.wholeUnitsOnly !== false;
  const maxDailyRewardUnits = Math.max(1, Math.floor(sanitizeFiniteNumber(rewardPolicy.maxDailyRewardUnits, 5)));
  const awardedRewardUnitsToday = clamp(
    Math.floor(sanitizeFiniteNumber(rewardPolicy.awardedRewardUnitsToday, 0)),
    0,
    maxDailyRewardUnits,
  );

  return {
    pointsPerRewardUnit,
    rewardDecimals,
    rewardNameSingular,
    rewardNamePlural,
    wholeUnitsOnly,
    maxDailyRewardUnits,
    awardedRewardUnitsToday,
  };
}

function normalizeOrientationPolicy(orientationPolicy = {}) {
  return {
    requireLandscape: orientationPolicy.requireLandscape !== false,
    attemptOrientationLock: orientationPolicy.attemptOrientationLock !== false,
    fullscreenOnStart: orientationPolicy.fullscreenOnStart === true,
    mobileMaxWidth: Math.max(480, sanitizeFiniteNumber(orientationPolicy.mobileMaxWidth, LANDSCAPE_MOBILE_MAX_WIDTH)),
  };
}

const integration = {
  embedMode: document.body.classList.contains("embedded") || urlParams.get("embed") === "1",
  parentOrigin: urlParams.get("parentOrigin") || "*",
  playerContext: normalizePlayerContext(externalConfig.playerContext),
  rewardPolicy: normalizeRewardPolicy(externalConfig.rewardPolicy),
  orientationPolicy: normalizeOrientationPolicy(externalConfig.orientationPolicy),
  runId: 0,
  lastPublishedAt: 0,
  lastPublishedSignature: "",
  lastOrientationSignature: "",
};

if (integration.embedMode) {
  document.body.classList.add("embedded");
}

function buildOrientationSnapshot() {
  const isLandscape = width >= height;
  const blocked = integration.orientationPolicy.requireLandscape && width <= integration.orientationPolicy.mobileMaxWidth && !isLandscape;

  return {
    blocked,
    isLandscape,
    viewportWidth: width,
    viewportHeight: height,
    requireLandscape: integration.orientationPolicy.requireLandscape,
    attemptOrientationLock: integration.orientationPolicy.attemptOrientationLock,
  };
}

function isOrientationBlocked() {
  return buildOrientationSnapshot().blocked;
}

function getRewardUnitLabel(amount) {
  return amount === 1 ? integration.rewardPolicy.rewardNameSingular : integration.rewardPolicy.rewardNamePlural;
}

function getRewardPreview(score = state.score) {
  const roundedScore = Math.max(0, Math.round(score));
  const rawAmount = roundedScore / integration.rewardPolicy.pointsPerRewardUnit;
  const wholeUnits = Math.floor(rawAmount);
  const remainingDailyRewardUnits = Math.max(0, integration.rewardPolicy.maxDailyRewardUnits - integration.rewardPolicy.awardedRewardUnitsToday);
  const cappedWholeUnits = Math.min(wholeUnits, remainingDailyRewardUnits);
  const cappedRawAmount = Math.min(rawAmount, remainingDailyRewardUnits);
  const pointsTowardNextUnit = roundedScore % integration.rewardPolicy.pointsPerRewardUnit;
  const pointsToNextUnit = pointsTowardNextUnit === 0 ? 0 : integration.rewardPolicy.pointsPerRewardUnit - pointsTowardNextUnit;
  const amount = integration.rewardPolicy.wholeUnitsOnly
    ? cappedWholeUnits
    : Number(cappedRawAmount.toFixed(integration.rewardPolicy.rewardDecimals));
  const displayAmount = integration.rewardPolicy.wholeUnitsOnly
    ? String(amount)
    : cappedRawAmount.toFixed(integration.rewardPolicy.rewardDecimals);
  const dailyCapReached = remainingDailyRewardUnits === 0;
  const remainingAfterClaim = Math.max(0, remainingDailyRewardUnits - amount);

  return {
    amount,
    rawAmount: Number(rawAmount.toFixed(integration.rewardPolicy.rewardDecimals)),
    cappedRawAmount: Number(cappedRawAmount.toFixed(integration.rewardPolicy.rewardDecimals)),
    display: `${displayAmount} ${getRewardUnitLabel(amount)}`,
    rewardNameSingular: integration.rewardPolicy.rewardNameSingular,
    rewardNamePlural: integration.rewardPolicy.rewardNamePlural,
    rewardDecimals: integration.rewardPolicy.rewardDecimals,
    pointsPerRewardUnit: integration.rewardPolicy.pointsPerRewardUnit,
    wholeUnitsOnly: integration.rewardPolicy.wholeUnitsOnly,
    wholeUnits,
    claimableUnits: amount,
    maxDailyRewardUnits: integration.rewardPolicy.maxDailyRewardUnits,
    awardedRewardUnitsToday: integration.rewardPolicy.awardedRewardUnitsToday,
    remainingDailyRewardUnits,
    remainingAfterClaim,
    dailyCapReached,
    cappedByDailyLimit: cappedWholeUnits < wholeUnits,
    pointsTowardNextUnit,
    pointsToNextUnit,
    progressToNextUnit: Number((pointsTowardNextUnit / integration.rewardPolicy.pointsPerRewardUnit).toFixed(4)),
  };
}

function formatEarnedSpinsDisplay(rewardPreview) {
  if (rewardPreview.cappedByDailyLimit) {
    return `${rewardPreview.claimableUnits}/${rewardPreview.wholeUnits}`;
  }

  return String(rewardPreview.claimableUnits);
}

function buildGameSnapshot(extra = {}) {
  return {
    version: GAME_VERSION,
    mode: state.mode,
    runId: integration.runId,
    score: Math.round(state.score),
    rawScore: Number(state.score.toFixed(2)),
    distanceMeters: worldToMeters(state.maxDistance),
    bestDistance: state.bestDistance,
    bestScore: state.bestScore,
    speedKmh: Math.round(state.displaySpeed),
    status: state.message,
    lastLandingAward: state.lastLandingAward,
    lastTrickAward: state.lastTrickAward,
    rewardPreview: getRewardPreview(state.score),
    orientation: buildOrientationSnapshot(),
    playerContext: { ...integration.playerContext },
    ...extra,
  };
}

function emitHostEvent(type, payload) {
  const detail = { type, ...payload };
  window.dispatchEvent(new CustomEvent(`neon-trail:${type}`, { detail }));

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      {
        source: GAME_MESSAGE_SOURCE,
        type,
        payload: detail,
      },
      integration.parentOrigin,
    );
  }
}

function publishGameState(now = performance.now(), force = false, extra = {}) {
  const snapshot = buildGameSnapshot(extra);
  const signature = JSON.stringify([
    snapshot.mode,
    snapshot.runId,
    snapshot.score,
    snapshot.distanceMeters,
    snapshot.speedKmh,
    snapshot.lastLandingAward,
    snapshot.lastTrickAward,
    snapshot.status,
    snapshot.orientation.blocked,
  ]);

  if (!force && now - integration.lastPublishedAt < STATE_PUBLISH_INTERVAL && signature === integration.lastPublishedSignature) {
    return;
  }

  integration.lastPublishedAt = now;
  integration.lastPublishedSignature = signature;
  emitHostEvent("state", snapshot);
}

function setPlayerContext(playerContext = {}) {
  integration.playerContext = normalizePlayerContext({
    ...integration.playerContext,
    ...playerContext,
  });
  emitHostEvent("player-context", buildGameSnapshot());
}

function setRewardPolicy(rewardPolicy = {}) {
  integration.rewardPolicy = normalizeRewardPolicy({
    ...integration.rewardPolicy,
    ...rewardPolicy,
  });
  emitHostEvent("reward-policy", buildGameSnapshot());
  publishGameState(performance.now(), true);
}

function setOrientationPolicy(orientationPolicy = {}) {
  integration.orientationPolicy = normalizeOrientationPolicy({
    ...integration.orientationPolicy,
    ...orientationPolicy,
  });
  updateOrientationOverlay(true);
  emitHostEvent("orientation-policy", buildGameSnapshot());
  publishGameState(performance.now(), true);
}

async function tryEnterLandscapeMode() {
  if (!integration.orientationPolicy.attemptOrientationLock) {
    return;
  }

  if (integration.orientationPolicy.fullscreenOnStart && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch (_error) {
      // Ignore fullscreen failures.
    }
  }

  if (screen.orientation && typeof screen.orientation.lock === "function") {
    try {
      await screen.orientation.lock("landscape");
    } catch (_error) {
      // Ignore orientation lock failures.
    }
  }
}

function updateOrientationOverlay(force = false) {
  const orientation = buildOrientationSnapshot();
  if (orientationOverlayEl) {
    orientationOverlayEl.classList.toggle("hidden", !orientation.blocked);
  }
  document.body.classList.toggle("orientation-blocked", orientation.blocked);

  const signature = JSON.stringify([orientation.blocked, orientation.isLandscape, orientation.viewportWidth, orientation.viewportHeight]);
  if (force || integration.lastOrientationSignature !== signature) {
    integration.lastOrientationSignature = signature;
    emitHostEvent("orientation-change", buildGameSnapshot());
  }
}

function handleHostMessage(event) {
  const message = event.data;
  if (!message || message.source !== HOST_MESSAGE_SOURCE) {
    return;
  }

  if (event.origin && event.origin !== "null" && integration.parentOrigin === "*") {
    integration.parentOrigin = event.origin;
  }

  const payload = message.payload || {};
  switch (message.type) {
    case "start-run":
      startRun(payload.regenerate !== false);
      break;
    case "restart-run":
      startRun(true);
      break;
    case "request-state":
      emitHostEvent("state", buildGameSnapshot({ requestId: payload.requestId || null }));
      break;
    case "set-player-context":
      setPlayerContext(payload);
      break;
    case "set-reward-policy":
      setRewardPolicy(payload);
      break;
    case "set-orientation-policy":
      setOrientationPolicy(payload);
      break;
    default:
      break;
  }
}

function getCourseDifficulty(trackX) {
  return clamp((trackX - 320) / DIFFICULTY_RAMP_DISTANCE, 0, 1);
}

function getResolvedPieceKind(kind, difficulty) {
  if (difficulty < 0.18 && kind === "jump") {
    return "wave";
  }
  if (difficulty < 0.24 && kind === "steep-hill") {
    return "hill";
  }
  if (difficulty < 0.42 && kind === "speed-gap") {
    return "gap";
  }
  return kind;
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function loadHighScore() {
  try {
    const distanceValue = localStorage.getItem(STORAGE_DISTANCE_KEY) ?? localStorage.getItem(LEGACY_DISTANCE_KEY) ?? "0";
    const parsedDistance = Number.parseInt(distanceValue, 10);
    const parsedScore = Number.parseInt(localStorage.getItem(STORAGE_SCORE_KEY) || "0", 10);
    state.bestDistance = Number.isFinite(parsedDistance) ? parsedDistance : 0;
    state.bestScore = Number.isFinite(parsedScore) ? parsedScore : 0;
  } catch (_error) {
    state.bestDistance = 0;
    state.bestScore = 0;
  }
}

function saveHighScore() {
  try {
    localStorage.setItem(STORAGE_DISTANCE_KEY, String(state.bestDistance));
    localStorage.setItem(STORAGE_SCORE_KEY, String(state.bestScore));
  } catch (_error) {
    // Ignore persistence failures.
  }
}

function ensureAudio() {
  if (audio.ctx) {
    if (audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }
    return;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  audio.ctx = new AudioCtx();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.18;
  audio.master.connect(audio.ctx.destination);

  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineOsc.type = "sawtooth";
  audio.engineGain = audio.ctx.createGain();
  audio.engineGain.gain.value = 0.0001;
  audio.engineOsc.connect(audio.engineGain);
  audio.engineGain.connect(audio.master);
  audio.engineOsc.start();

  audio.windOsc = audio.ctx.createOscillator();
  audio.windOsc.type = "triangle";
  audio.windGain = audio.ctx.createGain();
  audio.windGain.gain.value = 0.0001;
  audio.windOsc.connect(audio.windGain);
  audio.windGain.connect(audio.master);
  audio.windOsc.start();
}

function playPulse(frequency, duration, gain, type) {
  if (!audio.ctx || !audio.master) {
    return;
  }

  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const amp = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(audio.master);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function updateAudio(dt) {
  if (!audio.ctx || !audio.engineOsc || !audio.engineGain || !audio.windOsc || !audio.windGain || !state.bike) {
    return;
  }

  const running = state.mode === "running";
  const speed = Math.max(0, state.displaySpeed);
  const engineTarget = running ? (input.accelerate ? 0.12 : 0.05) + speed * 0.001 : 0.0001;
  const windTarget = running && !state.bike.rear.grounded && !state.bike.front.grounded ? 0.08 + state.airTime * 0.05 : 0.0001;
  audio.engineGain.gain.value += (engineTarget - audio.engineGain.gain.value) * Math.min(1, dt * 8);
  audio.windGain.gain.value += (windTarget - audio.windGain.gain.value) * Math.min(1, dt * 6);
  audio.engineOsc.frequency.value = 65 + speed * 1.9 + (input.accelerate ? 24 : 0);
  audio.windOsc.frequency.value = 160 + speed * 2.4;
}

function showOverlay(mode) {
  startOverlayEl.classList.toggle("hidden", mode !== "menu");
  crashOverlayEl.classList.toggle("hidden", mode !== "crashed");
  updateOrientationOverlay();
}

function createWheel(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    grounded: false,
    contactAngle: 0,
  };
}

function requestJump() {
  state.jumpBuffer = JUMP_BUFFER_TIME;
}

function queueAwardPopup(label, points, worldX, worldY, color) {
  if (points <= 0) {
    return;
  }

  state.awardPopups.push({
    label,
    points,
    worldX,
    worldY,
    color,
    age: 0,
  });
}

function updateAwardPopups(dt) {
  if (state.awardPopups.length === 0) {
    return;
  }

  state.awardPopups = state.awardPopups.filter((popup) => {
    popup.age += dt;
    return popup.age < AWARD_POPUP_LIFETIME;
  });
}

function getTrackBaseY() {
  return height * TRACK_BASELINE_RATIO;
}

function getTrackMinY() {
  return height * TRACK_MIN_RATIO;
}

function getTrackMaxY() {
  return height * TRACK_MAX_RATIO;
}

function clampTrackY(y) {
  return clamp(y, getTrackMinY(), getTrackMaxY());
}

function normalizeTrackEndY(y, pullToBase = 0.16) {
  return clampTrackY(lerp(y, getTrackBaseY(), pullToBase));
}

function getLastTrackEnd() {
  if (trackPieces.length === 0) {
    return { x: 0, y: getTrackBaseY(), angle: 0 };
  }
  const piece = trackPieces[trackPieces.length - 1];
  return piece.getEnd();
}

function createLinePiece({ startX, startY, length, endY }) {
  const endX = startX + length;
  const angle = Math.atan2(endY - startY, length);

  return {
    type: "line",
    xStart: startX,
    xEnd: endX,
    getPointAtX(x) {
      if (x < startX || x > endX) {
        return null;
      }
      const t = (x - startX) / length;
      return {
        x,
        y: lerp(startY, endY, t),
        angle,
        normalX: Math.sin(angle),
        normalY: -Math.cos(angle),
      };
    },
    draw(ctx2d) {
      ctx2d.beginPath();
      ctx2d.moveTo(startX, startY);
      ctx2d.lineTo(endX, endY);
      ctx2d.stroke();
    },
    getEnd() {
      return { x: endX, y: endY, angle };
    },
  };
}

function createRoundedSlopePiece({ startX, startY, length, endY }) {
  const endX = startX + length;
  const deltaY = endY - startY;

  return {
    type: "rounded-slope",
    xStart: startX,
    xEnd: endX,
    getPointAtX(x) {
      if (x < startX || x > endX) {
        return null;
      }
      const t = (x - startX) / length;
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
      const y = startY + deltaY * eased;
      const slope = (deltaY * Math.PI * 0.5 * Math.sin(Math.PI * t)) / length;
      const angle = Math.atan2(slope, 1);
      return {
        x,
        y,
        angle,
        normalX: Math.sin(angle),
        normalY: -Math.cos(angle),
      };
    },
    draw(ctx2d) {
      ctx2d.beginPath();
      let moved = false;
      const sampleStep = Math.max(14, Math.min(24, length / 18));
      for (let x = startX; x < endX; x += sampleStep) {
        const point = this.getPointAtX(x);
        if (!point) {
          continue;
        }
        if (!moved) {
          ctx2d.moveTo(point.x, point.y);
          moved = true;
        } else {
          ctx2d.lineTo(point.x, point.y);
        }
      }
      const endPoint = this.getPointAtX(endX);
      if (!moved) {
        ctx2d.moveTo(endPoint.x, endPoint.y);
      } else {
        ctx2d.lineTo(endPoint.x, endPoint.y);
      }
      ctx2d.stroke();
    },
    getEnd() {
      const endPoint = this.getPointAtX(endX);
      return { x: endPoint.x, y: endPoint.y, angle: endPoint.angle };
    },
  };
}

function createWavePiece({ startX, startY, length, amplitude, cycles }) {
  const endX = startX + length;
  return {
    type: "wave",
    xStart: startX,
    xEnd: endX,
    getPointAtX(x) {
      if (x < startX || x > endX) {
        return null;
      }
      const t = (x - startX) / length;
      const y = startY + Math.sin(t * Math.PI * cycles) * amplitude;
      const slope = (Math.cos(t * Math.PI * cycles) * amplitude * Math.PI * cycles) / length;
      const angle = Math.atan2(slope, 1);
      return {
        x,
        y,
        angle,
        normalX: Math.sin(angle),
        normalY: -Math.cos(angle),
      };
    },
    draw(ctx2d) {
      ctx2d.beginPath();
      for (let x = startX; x <= endX; x += 18) {
        const point = this.getPointAtX(x);
        if (!point) {
          continue;
        }
        if (x === startX) {
          ctx2d.moveTo(point.x, point.y);
        } else {
          ctx2d.lineTo(point.x, point.y);
        }
      }
      const endPoint = this.getPointAtX(endX);
      ctx2d.lineTo(endPoint.x, endPoint.y);
      ctx2d.stroke();
    },
    getEnd() {
      const endPoint = this.getPointAtX(endX);
      return { x: endPoint.x, y: endPoint.y, angle: endPoint.angle };
    },
  };
}

function createGapPieces({ startX, startY, runUp, gapLength, landingLength, landingStartY, landingEndY }) {
  const ramp = createLinePiece({ startX, startY, length: runUp, endY: startY - 6 });
  const landingStartX = startX + runUp + gapLength;
  const landing = createLinePiece({ startX: landingStartX, startY: landingStartY, length: landingLength, endY: landingEndY });
  return [ramp, landing];
}

function createSpeedGapPieces({ startX, startY, dropY, runUpLength, gapLength, landingStartY, landingEndY, landingLength }) {
  const dive = createLinePiece({ startX, startY, length: 180, endY: dropY });
  const diveEnd = dive.getEnd();
  const charge = createLinePiece({ startX: diveEnd.x, startY: diveEnd.y, length: runUpLength, endY: diveEnd.y + 6 });
  const chargeEnd = charge.getEnd();
  const landingStartX = chargeEnd.x + gapLength;
  const landing = createLinePiece({ startX: landingStartX, startY: landingStartY, length: landingLength, endY: landingEndY });
  return [dive, charge, landing];
}

function createJumpPieces({ startX, startY, runUp, launchEndY, tableLength, landingStartY, landingEndY, landingLength }) {
  const launch = createLinePiece({ startX, startY, length: runUp, endY: launchEndY });
  const mid = launch.getEnd();
  const table = createLinePiece({ startX: mid.x, startY: mid.y, length: tableLength, endY: mid.y });
  const landStart = table.getEnd();
  const landing = createLinePiece({ startX: landStart.x, startY: landingStartY, length: landingLength, endY: landingEndY });
  return [launch, table, landing];
}

function appendPiece(kind) {
  const end = getLastTrackEnd();
  const difficulty = getCourseDifficulty(end.x);
  const resolvedKind = getResolvedPieceKind(kind, difficulty);

  if (resolvedKind === "flat") {
    trackPieces.push(
      createLinePiece({
        startX: end.x,
        startY: end.y,
        length: randomBetween(lerp(640, 420, difficulty), lerp(880, 640, difficulty)),
        endY: normalizeTrackEndY(end.y + randomBetween(-10, 10), lerp(0.08, 0.14, difficulty)),
      }),
    );
    return;
  }

  if (resolvedKind === "hill") {
    const peakY = clampTrackY(end.y - randomBetween(lerp(40, HILL_STEEP_MIN, difficulty), lerp(76, HILL_STEEP_MAX, difficulty)));
    trackPieces.push(
      createRoundedSlopePiece({
        startX: end.x,
        startY: end.y,
        length: randomBetween(lerp(480, 360, difficulty), lerp(640, 520, difficulty)),
        endY: peakY,
      }),
    );
    const hillEnd = getLastTrackEnd();
    trackPieces.push(
      createRoundedSlopePiece({
        startX: hillEnd.x,
        startY: hillEnd.y,
        length: randomBetween(lerp(420, 300, difficulty), lerp(620, 460, difficulty)),
        endY: normalizeTrackEndY(end.y + randomBetween(-16, 14), lerp(0.18, 0.24, difficulty)),
      }),
    );
    return;
  }

  if (resolvedKind === "steep-hill") {
    const peakY = clampTrackY(end.y - randomBetween(lerp(88, STEEP_HILL_MIN, difficulty), lerp(128, STEEP_HILL_MAX, difficulty)));
    trackPieces.push(
      createRoundedSlopePiece({
        startX: end.x,
        startY: end.y,
        length: randomBetween(lerp(380, 320, difficulty), lerp(520, 440, difficulty)),
        endY: peakY,
      }),
    );
    const steepEnd = getLastTrackEnd();
    trackPieces.push(
      createRoundedSlopePiece({
        startX: steepEnd.x,
        startY: steepEnd.y,
        length: randomBetween(lerp(380, 340, difficulty), lerp(620, 560, difficulty)),
        endY: normalizeTrackEndY(end.y + randomBetween(-14, 20), lerp(0.22, 0.28, difficulty)),
      }),
    );
    return;
  }

  if (resolvedKind === "wave") {
    const maxWaveUp = end.y - getTrackMinY() - 14;
    const maxWaveDown = getTrackMaxY() - end.y - 14;
    const targetAmplitude = lerp(18, 42, difficulty);
    const amplitude = clamp(Math.min(targetAmplitude, maxWaveUp, maxWaveDown), 12, targetAmplitude);
    trackPieces.push(
      createWavePiece({
        startX: end.x,
        startY: end.y,
        length: lerp(720, 620, difficulty),
        amplitude,
        cycles: lerp(1.6, 2.6, difficulty),
      }),
    );
    return;
  }

  if (resolvedKind === "jump") {
    const launchEndY = clampTrackY(end.y - lerp(72, 110, difficulty));
    const landingStartY = clampTrackY(launchEndY + lerp(48, 72, difficulty));
    const landingEndY = normalizeTrackEndY(end.y + randomBetween(-6, 10), lerp(0.22, 0.28, difficulty));
    trackPieces.push(
      ...createJumpPieces({
        startX: end.x,
        startY: end.y,
        runUp: lerp(200, 220, difficulty),
        launchEndY,
        tableLength: lerp(94, 70, difficulty),
        landingStartY,
        landingEndY,
        landingLength: lerp(300, 240, difficulty),
      }),
    );
    return;
  }

  if (resolvedKind === "gap") {
    const landingStartY = clampTrackY(end.y + lerp(18, 44, difficulty));
    const landingEndY = normalizeTrackEndY(end.y + randomBetween(-4, 16), lerp(0.24, 0.3, difficulty));
    trackPieces.push(
      ...createGapPieces({
        startX: end.x,
        startY: end.y,
        runUp: lerp(220, 170, difficulty),
        gapLength: lerp(92, 180, difficulty),
        landingLength: lerp(360, 300, difficulty),
        landingStartY,
        landingEndY,
      }),
    );
    return;
  }

  if (resolvedKind === "speed-gap") {
    const dropY = clampTrackY(end.y + randomBetween(lerp(26, 42, difficulty), lerp(48, 84, difficulty)));
    const landingStartY = clampTrackY(dropY - randomBetween(lerp(20, 34, difficulty), lerp(40, 62, difficulty)));
    const landingEndY = normalizeTrackEndY(end.y + randomBetween(-10, 10), lerp(0.28, 0.34, difficulty));
    trackPieces.push(
      ...createSpeedGapPieces({
        startX: end.x,
        startY: end.y,
        dropY,
        runUpLength: lerp(210, BIG_GAP_RUNUP, difficulty),
        gapLength: lerp(160, BIG_GAP_LENGTH, difficulty),
        landingStartY,
        landingEndY,
        landingLength: lerp(420, BIG_GAP_LANDING, difficulty),
      }),
    );
    return;
  }

  trackPieces.push(createLinePiece({ startX: end.x, startY: end.y, length: 500, endY: end.y }));
}

function seedTrack() {
  trackPieces = [];
  nextTrackX = 0;
  plannedPieceIndex = 0;
  const baseY = getTrackBaseY();
  trackPieces.push(createLinePiece({ startX: -400, startY: baseY, length: 820, endY: baseY }));
  for (const pieceKind of openingTrackPlan) {
    if (getLastTrackEnd().x >= TRACK_BUFFER * 0.42) {
      break;
    }
    appendPiece(pieceKind);
  }
  while (getLastTrackEnd().x < TRACK_BUFFER) {
    appendPiece(trackPlan[plannedPieceIndex % trackPlan.length]);
    plannedPieceIndex += 1;
  }
  nextTrackX = getLastTrackEnd().x;
}

function extendTrack() {
  while (nextTrackX < cameraX + width + TRACK_BUFFER) {
    appendPiece(trackPlan[plannedPieceIndex % trackPlan.length]);
    plannedPieceIndex += 1;
    nextTrackX = getLastTrackEnd().x;
  }
}

function getTrackSurfacePoint(x) {
  for (const piece of trackPieces) {
    const point = piece.getPointAtX(x);
    if (point) {
      return point;
    }
  }
  return null;
}

function resetBike() {
  const rearX = SPAWN_X;
  const groundY = getTrackSurfacePoint(rearX)?.y ?? height * 0.72;
  const frontX = rearX + WHEEL_BASE;
  const frontGroundY = getTrackSurfacePoint(frontX)?.y ?? groundY;
  const rear = createWheel(rearX, groundY - WHEEL_RADIUS - 1);
  const front = createWheel(frontX, frontGroundY - WHEEL_RADIUS - 1);

  state.bike = {
    rear,
    front,
    angle: Math.atan2(front.y - rear.y, front.x - rear.x),
    lastAngle: 0,
    renderCenterX: 0,
    renderCenterY: 0,
    renderAngle: 0,
  };

  state.bike.lastAngle = state.bike.angle;
  state.airTime = 0;
  state.airRotation = 0;
  state.message = "Cruising";
  state.messageTimer = 0;
  state.runTime = 0;
  state.maxDistance = 0;
  state.score = 0;
  state.lastScoreX = (rear.x + front.x) * 0.5;
  state.lastLandingAward = "--";
  state.lastTrickAward = "--";
  state.awardPopups = [];
  state.displaySpeed = 0;
  state.jumpBuffer = 0;
  state.jumpCooldown = 0;
  cameraX = 0;
  syncRenderBike(true, 0);
}

function syncRenderBike(snap = false, dt = 0) {
  if (!state.bike) {
    return;
  }

  const rear = state.bike.rear;
  const front = state.bike.front;
  const targetCenterX = (rear.x + front.x) * 0.5;
  const targetCenterY = (rear.y + front.y) * 0.5 - BODY_HEIGHT;
  const targetAngle = Math.atan2(front.y - rear.y, front.x - rear.x);

  if (snap) {
    state.bike.renderCenterX = targetCenterX;
    state.bike.renderCenterY = targetCenterY;
    state.bike.renderAngle = targetAngle;
    return;
  }

  const follow = Math.min(1, dt * RENDER_SUSPENSION_FOLLOW);
  const angleFollow = Math.min(1, dt * RENDER_SUSPENSION_ANGLE_FOLLOW);
  state.bike.renderCenterX = targetCenterX;
  state.bike.renderCenterY += (targetCenterY - state.bike.renderCenterY) * follow;
  state.bike.renderAngle = lerpAngle(state.bike.renderAngle, targetAngle, angleFollow);
  state.bike.renderCenterY = clamp(
    state.bike.renderCenterY,
    targetCenterY - RENDER_SUSPENSION_TRAVEL,
    targetCenterY + RENDER_SUSPENSION_TRAVEL,
  );
  state.bike.renderAngle = targetAngle + clamp(normalizeAngle(state.bike.renderAngle - targetAngle), -RENDER_SUSPENSION_MAX_ANGLE, RENDER_SUSPENSION_MAX_ANGLE);
}

function startRun(regenerate = true) {
  void tryEnterLandscapeMode();
  ensureAudio();
  if (regenerate || trackPieces.length === 0) {
    seedTrack();
  }
  resetBike();
  integration.runId += 1;
  integration.lastPublishedAt = 0;
  integration.lastPublishedSignature = "";
  state.mode = "running";
  showOverlay(state.mode);
  emitHostEvent("run-start", buildGameSnapshot({ startedAt: Date.now() }));
  publishGameState(performance.now(), true);
}

function crashRun(reason) {
  if (state.mode !== "running") {
    return;
  }

  state.mode = "crashed";
  state.message = "Wipeout";
  state.messageTimer = 1.4;
  const runMeters = worldToMeters(state.maxDistance);
  const runPoints = Math.round(state.score);
  let didImprove = false;
  if (runMeters > state.bestDistance) {
    state.bestDistance = runMeters;
    didImprove = true;
  }
  if (runPoints > state.bestScore) {
    state.bestScore = runPoints;
    didImprove = true;
  }
  if (didImprove) {
    saveHighScore();
  }
  const runRewardPreview = getRewardPreview(runPoints);
  crashTitleEl.textContent = reason;
  runSummaryEl.textContent = `Run: ${runMeters} m | Score: ${formatPoints(runPoints)} | Spins Earned: ${formatSpinCount(runRewardPreview.claimableUnits)} | Spins Left Today: ${formatSpinCount(runRewardPreview.remainingAfterClaim)} | Best Distance: ${state.bestDistance} m | Best Score: ${formatPoints(state.bestScore)}`;
  showOverlay(state.mode);
  emitHostEvent(
    "run-end",
    buildGameSnapshot({
      reason,
      score: runPoints,
      rawScore: Number(state.score.toFixed(2)),
      distanceMeters: runMeters,
      rewardPreview: runRewardPreview,
      endedAt: Date.now(),
    }),
  );
  publishGameState(performance.now(), true);
  playPulse(88, 0.28, 0.12, "square");
}

function integrateWheel(wheel, dt) {
  wheel.grounded = false;
  wheel.vy += GRAVITY * dt;
  wheel.x += wheel.vx * dt;
  wheel.y += wheel.vy * dt;
}

function solveChassis(dt) {
  const rear = state.bike.rear;
  const front = state.bike.front;
  const dx = front.x - rear.x;
  const dy = front.y - rear.y;
  const distance = Math.hypot(dx, dy) || 1;
  const diff = (distance - WHEEL_BASE) / distance;
  const offsetX = dx * diff * 0.5;
  const offsetY = dy * diff * 0.5;

  front.x -= offsetX;
  front.y -= offsetY;
  rear.x += offsetX;
  rear.y += offsetY;

  const relVx = front.vx - rear.vx;
  const relVy = front.vy - rear.vy;
  const alongX = dx / distance;
  const alongY = dy / distance;
  const alongSpeed = relVx * alongX + relVy * alongY;
  const impulse = ((distance - WHEEL_BASE) * CHASSIS_STIFFNESS + alongSpeed * CHASSIS_DAMPING) * dt;

  front.vx -= alongX * impulse;
  front.vy -= alongY * impulse;
  rear.vx += alongX * impulse;
  rear.vy += alongY * impulse;
}

function applyAngularImpulse(amount) {
  const rear = state.bike.rear;
  const front = state.bike.front;
  const dx = front.x - rear.x;
  const dy = front.y - rear.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = -dy / distance;
  const ny = dx / distance;

  front.vx += nx * amount;
  front.vy += ny * amount;
  rear.vx -= nx * amount;
  rear.vy -= ny * amount;
}

function getAngularSpeed() {
  const rear = state.bike.rear;
  const front = state.bike.front;
  const dx = front.x - rear.x;
  const dy = front.y - rear.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = -dy / distance;
  const ny = dx / distance;
  return (front.vx - rear.vx) * nx + (front.vy - rear.vy) * ny;
}

function hasMissedTrack(wheel, surface) {
  if (wheel.y > height + GAP_FAIL_MARGIN) {
    return true;
  }

  if (!surface) {
    return wheel.y > height;
  }

  return wheel.y > surface.y + GAP_FAIL_MARGIN;
}

function resolveWheelTrack(wheel, allowDrive, dt) {
  const point = getTrackSurfacePoint(wheel.x);
  if (!point) {
    return;
  }

  const dx = wheel.x - point.x;
  const dy = wheel.y - point.y;
  const normalDistance = dx * point.normalX + dy * point.normalY;
  if (normalDistance < -WHEEL_RADIUS || normalDistance > WHEEL_RADIUS + TRACK_THICKNESS) {
    return;
  }

  const penetration = WHEEL_RADIUS - normalDistance;
  if (penetration < 0) {
    return;
  }

  wheel.x += point.normalX * penetration;
  wheel.y += point.normalY * penetration;
  wheel.grounded = true;
  wheel.contactAngle = point.angle;

  const tangentX = Math.cos(point.angle);
  const tangentY = Math.sin(point.angle);
  const normalSpeed = wheel.vx * point.normalX + wheel.vy * point.normalY;
  let tangentSpeed = wheel.vx * tangentX + wheel.vy * tangentY;

  tangentSpeed *= WHEEL_DAMPING;
  if (allowDrive && input.accelerate) {
    tangentSpeed = clamp(tangentSpeed + REAR_DRIVE_FORCE * dt, -170, REAR_DRIVE_TOP_SPEED);
  }

  wheel.vx = point.normalX * Math.max(0, normalSpeed) + tangentX * tangentSpeed;
  wheel.vy = point.normalY * Math.max(0, normalSpeed) + tangentY * tangentSpeed;
}

function applyTilt(dt) {
  const rear = state.bike.rear;
  const front = state.bike.front;
  let direction = 0;
  if (input.left) {
    direction -= 1;
  }
  if (input.right) {
    direction += 1;
  }
  if (direction === 0) {
    return;
  }

  const grounded = rear.grounded || front.grounded;
  const strength = grounded ? GROUND_TILT_STRENGTH : AIR_TILT_STRENGTH;
  applyAngularImpulse(direction * strength * dt);
}

function applyGroundLevelAssist(dt) {
  const rear = state.bike.rear;
  const front = state.bike.front;
  const bikeAngle = Math.atan2(front.y - rear.y, front.x - rear.x);

  if (rear.grounded && !front.grounded && Math.abs(rear.contactAngle) < HILL_LEVEL_LIMIT) {
    const targetAngle = rear.contactAngle * 0.28;
    const error = normalizeAngle(bikeAngle - targetAngle);
    applyAngularImpulse(-clamp(error / 0.4, -1, 1) * CREST_LEVEL_ASSIST * dt);
    return;
  }

  if (rear.grounded && front.grounded) {
    const targetAngle = ((rear.contactAngle + front.contactAngle) * 0.5) * HILL_LEVEL_BLEND;
    if (Math.abs(targetAngle) < HILL_LEVEL_LIMIT) {
      const error = normalizeAngle(bikeAngle - targetAngle);
      applyAngularImpulse(-clamp(error / 0.45, -1, 1) * HILL_LEVEL_ASSIST * dt);
    }
  }
}

function applyAirStability(dt) {
  const rear = state.bike.rear;
  const front = state.bike.front;
  if (rear.grounded || front.grounded) {
    return;
  }

  const angularSpeed = getAngularSpeed();
  applyAngularImpulse(-angularSpeed * AIR_ROTATION_DAMPING * dt);

  if (input.left || input.right) {
    return;
  }

  const bikeAngle = Math.atan2(front.y - rear.y, front.x - rear.x);
  const levelError = normalizeAngle(bikeAngle);
  applyAngularImpulse(-clamp(levelError / 0.8, -1, 1) * AIR_SELF_LEVEL_STRENGTH * dt);
}

function tryJump() {
  if (state.jumpBuffer <= 0 || state.jumpCooldown > 0) {
    return;
  }

  const rear = state.bike.rear;
  const front = state.bike.front;
  const grounded = rear.grounded || front.grounded;
  if (!grounded) {
    return;
  }

  const trackPoint = getTrackSurfacePoint((rear.x + front.x) * 0.5) || getTrackSurfacePoint(rear.x) || getTrackSurfacePoint(front.x);
  const jumpAngle = trackPoint ? trackPoint.angle : 0;
  const tangentX = Math.cos(jumpAngle);
  const tangentY = Math.sin(jumpAngle);
  const normalX = -Math.sin(jumpAngle);
  const normalY = -Math.cos(jumpAngle);

  rear.vx += tangentX * JUMP_FORWARD_BOOST + normalX * JUMP_FORCE;
  rear.vy += tangentY * JUMP_FORWARD_BOOST + normalY * JUMP_FORCE;
  front.vx += tangentX * JUMP_FORWARD_BOOST + normalX * JUMP_FORCE;
  front.vy += tangentY * JUMP_FORWARD_BOOST + normalY * JUMP_FORCE;

  rear.x += normalX * 3;
  rear.y += normalY * 3;
  front.x += normalX * 3;
  front.y += normalY * 3;
  rear.grounded = false;
  front.grounded = false;
  state.jumpBuffer = 0;
  state.jumpCooldown = JUMP_COOLDOWN_TIME;
  playPulse(260, 0.1, 0.05, "triangle");
}

function updateBike(dt) {
  extendTrack();
  state.runTime += dt;
  state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
  state.jumpCooldown = Math.max(0, state.jumpCooldown - dt);

  const bike = state.bike;
  const rear = bike.rear;
  const front = bike.front;

  integrateWheel(rear, dt);
  integrateWheel(front, dt);
  applyTilt(dt);

  for (let iteration = 0; iteration < 5; iteration += 1) {
    solveChassis(dt);
    resolveWheelTrack(rear, true, dt);
    resolveWheelTrack(front, false, dt);
  }

  applyGroundLevelAssist(dt);
  applyAirStability(dt);
  tryJump();

  bike.angle = Math.atan2(front.y - rear.y, front.x - rear.x);
  const rotationDelta = normalizeAngle(bike.angle - bike.lastAngle);
  bike.lastAngle = bike.angle;

  const midpointX = (rear.x + front.x) * 0.5;
  const midpointY = (rear.y + front.y) * 0.5;
  const grounded = rear.grounded || front.grounded;
  const trackPoint = getTrackSurfacePoint(midpointX);
  const trackAngle = trackPoint ? trackPoint.angle : 0;
  const angleError = Math.abs(normalizeAngle(bike.angle - trackAngle));

  if (!grounded) {
    state.airTime += dt;
    state.airRotation += rotationDelta;
    state.score += dt * SCORE_AIRTIME_RATE;
  } else if (state.airTime > 0) {
    const flips = Math.floor(Math.abs(state.airRotation) / (Math.PI * 2));
    const trickPoints = flips * SCORE_FLIP_BONUS;
    let landingLabel = "";
    let landingPoints = 0;
    if (state.airTime > SCORE_BIG_AIR_TIME) {
      landingLabel = "Big Air Landing";
      landingPoints = SCORE_BIG_AIR_BONUS;
    } else if (state.airTime > 0.55) {
      landingLabel = "Clean Landing";
      landingPoints = SCORE_CLEAN_LANDING_BONUS;
    } else if (state.airTime > SCORE_LANDING_TIME) {
      landingLabel = "Landing";
      landingPoints = SCORE_LANDING_BONUS;
    }

    if (trickPoints > 0) {
      const trickLabel = flips === 1 ? "1 Flip" : `${flips} Flips`;
      state.score += trickPoints;
      state.lastTrickAward = formatAward(trickLabel, trickPoints);
      queueAwardPopup(trickLabel, trickPoints, midpointX, midpointY - 96, "#63f3ff");
      playPulse(220 + flips * 36, 0.15, 0.08, "triangle");
    }

    if (landingPoints > 0) {
      state.score += landingPoints;
      state.lastLandingAward = formatAward(landingLabel, landingPoints);
      queueAwardPopup(landingLabel, landingPoints, midpointX, midpointY - 132, "#9fffaf");
    }

    if (trickPoints > 0 && landingPoints > 0) {
      state.message = `${state.lastTrickAward} | ${state.lastLandingAward}`;
      state.messageTimer = 1.4;
    } else if (trickPoints > 0) {
      state.message = state.lastTrickAward;
      state.messageTimer = 1.4;
    } else if (state.airTime > SCORE_BIG_AIR_TIME) {
      state.message = state.lastLandingAward;
      state.messageTimer = 1.2;
      playPulse(204, 0.12, 0.06, "triangle");
    } else if (landingPoints > 0) {
      state.message = state.lastLandingAward;
      state.messageTimer = 1.1;
      playPulse(176, 0.1, 0.05, "sine");
    }
    state.airTime = 0;
    state.airRotation = 0;
  }

  if (grounded && angleError > SAFE_UPSIDE_ANGLE) {
    crashRun("Upside Down");
    return;
  }

  if (grounded && angleError > 1.42 && !(rear.grounded && front.grounded)) {
    crashRun("Bad Landing");
    return;
  }

  const rearSurface = getTrackSurfacePoint(rear.x);
  const frontSurface = getTrackSurfacePoint(front.x);
  if (hasMissedTrack(rear, rearSurface)) {
    crashRun("Missed The Gap");
    return;
  }
  if (hasMissedTrack(front, frontSurface)) {
    crashRun("Missed The Gap");
    return;
  }
  if (midpointY > height + GAP_FAIL_MARGIN * 0.6) {
    crashRun("Missed The Gap");
    return;
  }

  const avgForward = Math.max(0, (rear.vx + front.vx) * 0.5);
  const targetSpeed = (avgForward / 12) * 3.6;
  state.displaySpeed += (targetSpeed - state.displaySpeed) * Math.min(1, dt * 8);
  const progressedX = Math.max(state.lastScoreX, midpointX);
  state.score += (progressedX - state.lastScoreX) * SCORE_DISTANCE_RATE;
  state.lastScoreX = progressedX;
  state.maxDistance = Math.max(state.maxDistance, midpointX - SPAWN_X);
  cameraX += (midpointX - width * 0.34 - cameraX) * 0.08;
  syncRenderBike(false, dt);
  updateAwardPopups(dt);

  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (state.messageTimer === 0) {
    state.message = grounded ? "Cruising" : state.airTime > 0.6 ? "Big Air" : "Airborne";
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#08111f");
  sky.addColorStop(0.45, "#13132a");
  sky.addColorStop(1, "#241235");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < 20; index += 1) {
    const x = ((index * 317) - cameraX * 0.08) % (width + 180);
    const y = 90 + (index % 6) * 72;
    const radius = 1.2 + (index % 3) * 1.2;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc((x + width + 180) % (width + 180), y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHorizonGlow() {
  const glow = ctx.createRadialGradient(width * 0.7, height * 0.3, 20, width * 0.7, height * 0.3, 280);
  glow.addColorStop(0, "rgba(255, 179, 92, 0.22)");
  glow.addColorStop(1, "rgba(255, 179, 92, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawTrack() {
  ctx.save();
  ctx.translate(-cameraX, 0);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(99, 243, 255, 0.98)";
  ctx.lineWidth = 10;
  ctx.shadowColor = "rgba(99, 243, 255, 0.72)";
  ctx.shadowBlur = 18;
  for (const piece of trackPieces) {
    piece.draw(ctx);
  }

  ctx.strokeStyle = "rgba(8, 15, 30, 0.9)";
  ctx.lineWidth = 4;
  ctx.shadowBlur = 0;
  for (const piece of trackPieces) {
    piece.draw(ctx);
  }
  ctx.restore();
}

function drawBike() {
  if (!state.bike) {
    return;
  }

  const rear = state.bike.rear;
  const front = state.bike.front;
  const rearX = rear.x - cameraX;
  const rearY = rear.y;
  const frontX = front.x - cameraX;
  const frontY = front.y;
  const centerX = state.bike.renderCenterX - cameraX;
  const centerY = state.bike.renderCenterY;
  const angle = state.bike.renderAngle;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  ctx.strokeStyle = "rgba(114, 247, 255, 0.98)";
  ctx.lineWidth = 3.5;
  ctx.shadowColor = "rgba(99, 243, 255, 0.86)";
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.moveTo(-BODY_HALF_LENGTH, 10);
  ctx.lineTo(-8, -8);
  ctx.lineTo(BODY_HALF_LENGTH * 0.78, -8);
  ctx.lineTo(BODY_HALF_LENGTH, 2);
  ctx.lineTo(BODY_HALF_LENGTH * 0.82, 10);
  ctx.lineTo(-BODY_HALF_LENGTH, 10);
  ctx.stroke();

  ctx.fillStyle = "rgba(12, 34, 62, 0.72)";
  ctx.beginPath();
  ctx.moveTo(-BODY_HALF_LENGTH + 2, 9);
  ctx.lineTo(-6, -6);
  ctx.lineTo(BODY_HALF_LENGTH * 0.74, -6);
  ctx.lineTo(BODY_HALF_LENGTH - 8, 2);
  ctx.lineTo(BODY_HALF_LENGTH * 0.74, 8);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(173, 250, 255, 0.94)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(22, -24);
  ctx.lineTo(30, -13);
  ctx.stroke();

  ctx.fillStyle = "rgba(165, 246, 255, 0.95)";
  ctx.beginPath();
  ctx.ellipse(31, -11, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(132, 248, 255, 0.88)";
  ctx.lineWidth = 2.2;
  ctx.shadowColor = "rgba(99, 243, 255, 0.62)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(centerX - BODY_HALF_LENGTH * 0.7 * Math.cos(angle) - 10 * Math.sin(angle), centerY - BODY_HALF_LENGTH * 0.7 * Math.sin(angle) + 10 * Math.cos(angle));
  ctx.lineTo(rearX, rearY - WHEEL_RADIUS + 4);
  ctx.moveTo(centerX + BODY_HALF_LENGTH * 0.55 * Math.cos(angle) - 10 * Math.sin(angle), centerY + BODY_HALF_LENGTH * 0.55 * Math.sin(angle) + 10 * Math.cos(angle));
  ctx.lineTo(frontX, frontY - WHEEL_RADIUS + 4);
  ctx.stroke();

  for (const wheel of [rear, front]) {
    const x = wheel.x - cameraX;
    const y = wheel.y;
    ctx.strokeStyle = "rgba(133, 248, 255, 0.95)";
    ctx.fillStyle = "rgba(6, 17, 30, 0.96)";
    ctx.lineWidth = 3.6;
    ctx.shadowColor = "rgba(99, 243, 255, 0.82)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(x, y, WHEEL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(194, 255, 255, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, WHEEL_RADIUS - 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  const trailStartX = rearX - 8;
  const trailStartY = rearY + 2;
  const trailLength = clamp(state.displaySpeed * 1.8, 30, 240);
  const trail = ctx.createLinearGradient(trailStartX - trailLength, trailStartY, trailStartX, trailStartY);
  trail.addColorStop(0, "rgba(99, 243, 255, 0)");
  trail.addColorStop(0.6, "rgba(99, 243, 255, 0.36)");
  trail.addColorStop(1, "rgba(99, 243, 255, 0.92)");
  ctx.strokeStyle = trail;
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(99, 243, 255, 0.6)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(trailStartX, trailStartY);
  ctx.lineTo(trailStartX - trailLength, trailStartY);
  ctx.stroke();
}

function drawAwardPopups() {
  if (state.awardPopups.length === 0) {
    return;
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '600 18px "Chakra Petch", sans-serif';

  for (const popup of state.awardPopups) {
    const progress = popup.age / AWARD_POPUP_LIFETIME;
    const alpha = 1 - progress;
    const x = popup.worldX - cameraX;
    const y = popup.worldY - progress * 44;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = popup.color;
    ctx.shadowColor = popup.color;
    ctx.shadowBlur = 18;
    ctx.fillText(`${popup.label} +${popup.points}`, x, y);
  }

  ctx.restore();
}

function render() {
  drawBackground();
  drawHorizonGlow();
  drawTrack();
  drawBike();
  drawAwardPopups();
}

function updateHud() {
  if (!state.bike) {
    return;
  }
  const rewardPreview = getRewardPreview(state.score);
  distanceEl.textContent = `${worldToMeters(state.maxDistance)} m`;
  bestEl.textContent = formatPoints(state.bestScore);
  scoreEl.textContent = formatPoints(state.score);
  spinsEarnedEl.textContent = formatEarnedSpinsDisplay(rewardPreview);
  spinsLeftEl.textContent = String(rewardPreview.remainingAfterClaim);
  landingEl.textContent = state.lastLandingAward;
  trickEl.textContent = state.lastTrickAward;
  speedEl.textContent = `${Math.round(state.displaySpeed)} km/h`;
  statusEl.textContent = state.message;
}

function setControl(name, active) {
  input[name] = active;
}

function bindTouchButtons() {
  const buttons = document.querySelectorAll("[data-control]");
  for (const button of buttons) {
    const control = button.dataset.control;
    const activePointers = new Set();

    const activate = (event) => {
      event.preventDefault();
      ensureAudio();
      if (typeof event.pointerId === "number") {
        activePointers.add(event.pointerId);
        if (typeof button.setPointerCapture === "function") {
          try {
            button.setPointerCapture(event.pointerId);
          } catch (_error) {
            // Ignore capture issues.
          }
        }
      }
      if (control === "jump") {
        requestJump();
      }
      setControl(control, true);
      button.dataset.active = "true";
    };

    const deactivate = (event) => {
      event.preventDefault();
      if (typeof event.pointerId === "number") {
        activePointers.delete(event.pointerId);
      } else {
        activePointers.clear();
      }
      if (activePointers.size === 0) {
        setControl(control, false);
        button.dataset.active = "false";
      }
    };

    button.addEventListener("pointerdown", activate);
    button.addEventListener("pointerup", deactivate);
    button.addEventListener("pointercancel", deactivate);
    button.addEventListener("lostpointercapture", deactivate);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  }
}

function handleKey(event, isDown) {
  if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.code)) {
    event.preventDefault();
  }
  if (isDown) {
    ensureAudio();
  }

  switch (event.code) {
    case "Space":
      input.accelerate = isDown;
      break;
    case "KeyW":
    case "ArrowUp":
      if (isDown && !input.jump) {
        requestJump();
      }
      input.jump = isDown;
      break;
    case "KeyA":
    case "ArrowLeft":
      input.left = isDown;
      break;
    case "KeyD":
    case "ArrowRight":
      input.right = isDown;
      break;
    case "KeyR":
      if (isDown) {
        startRun(true);
      }
      break;
    default:
      break;
  }
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, MAX_DT);
  lastTime = now;

  if (state.mode === "running" && !isOrientationBlocked()) {
    updateBike(dt);
  } else if (state.bike) {
    state.bike.rear.vx *= 0.95;
    state.bike.front.vx *= 0.95;
    state.displaySpeed *= 0.92;
    syncRenderBike(false, dt);
  }

  updateAudio(dt);
  updateHud();
  render();
  publishGameState(now, false);
  requestAnimationFrame(frame);
}

function exposePublicApi() {
  window.NeonTrailGame = {
    startRun(options = {}) {
      startRun(options.regenerate !== false);
    },
    restartRun() {
      startRun(true);
    },
    getState() {
      return buildGameSnapshot();
    },
    setPlayerContext,
    setRewardPolicy,
    setOrientationPolicy,
    tryEnterLandscapeMode,
    requestState() {
      publishGameState(performance.now(), true);
      return buildGameSnapshot();
    },
  };
}

window.addEventListener("resize", () => {
  resize();
  seedTrack();
  if (state.mode !== "menu") {
    resetBike();
  }
  updateOrientationOverlay(true);
  publishGameState(performance.now(), true);
});
window.addEventListener("keydown", (event) => handleKey(event, true));
window.addEventListener("keyup", (event) => handleKey(event, false));
window.addEventListener("mousedown", () => {
  ensureAudio();
  input.accelerate = true;
});
window.addEventListener("mouseup", () => {
  input.accelerate = false;
});
window.addEventListener("message", handleHostMessage);
window.addEventListener("blur", () => {
  input.accelerate = false;
  input.jump = false;
  input.left = false;
  input.right = false;
  state.jumpBuffer = 0;
});

startBtn.addEventListener("click", () => startRun(true));
retryBtn.addEventListener("click", () => startRun(true));
requestLandscapeBtn?.addEventListener("click", () => {
  void tryEnterLandscapeMode();
});

bindTouchButtons();
loadHighScore();
seedTrack();
resetBike();
showOverlay(state.mode);
updateHud();
exposePublicApi();
emitHostEvent("ready", buildGameSnapshot({ embedMode: integration.embedMode }));
publishGameState(performance.now(), true);
requestAnimationFrame(frame);