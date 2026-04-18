# Neon Trail Integration For test-slots

This repository now exposes an embed-friendly version of the game plus a small host SDK.

## Files to use

- `embed.html`: iframe-safe game shell for another app or repo
- `game.js`: runtime, scoring, and integration bridge
- `neon-trail-embed.js`: host-side helper for mounting the iframe and listening to events

## Host-side example

```html
<div id="neon-trail-slot"></div>
<script src="/games/neon-trail/neon-trail-embed.js"></script>
<script>
  const walletAddress = window.currentWalletAddress || null;

  const game = window.NeonTrailEmbed.create({
    mount: "#neon-trail-slot",
    src: "/games/neon-trail/embed.html",
    height: "760px",
    autoStart: false,
    playerContext: {
      playerId: "slot-user-42",
      walletAddress,
    },
    rewardPolicy: {
      pointsPerRewardUnit: 5000,
      rewardNameSingular: "spin",
      rewardNamePlural: "spins",
      rewardDecimals: 0,
      wholeUnitsOnly: true,
      maxDailyRewardUnits: 5,
      awardedRewardUnitsToday: window.playerSpinState?.awardedToday || 0,
    },
    orientationPolicy: {
      requireLandscape: true,
      attemptOrientationLock: true,
      fullscreenOnStart: true,
    },
    onReady() {
      console.log("Neon Trail ready");
    },
    onState(snapshot) {
      console.log("live score", snapshot.score, snapshot.rewardPreview.display);
      console.log("points to next spin", snapshot.rewardPreview.pointsToNextUnit);
      console.log("spins left today", snapshot.rewardPreview.remainingAfterClaim);
    },
    onOrientationChange(snapshot) {
      console.log("orientation blocked?", snapshot.orientation.blocked);
    },
    onRunEnd(summary) {
      console.log("final summary", summary);
      // Send this to your backend to convert score into spin credits.
      // Never trust a browser score directly for production payouts.
      fetch("/api/rewards/neon-trail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          game: "neon-trail",
          runId: summary.runId,
          score: summary.score,
          distanceMeters: summary.distanceMeters,
          rewardPreview: summary.rewardPreview,
        }),
      }).then(async (response) => {
        const result = await response.json();
        game.setRewardPolicy({
          awardedRewardUnitsToday: result.awardedRewardUnitsToday,
        });
      });
    },
  });

  document.getElementById("start-button")?.addEventListener("click", () => {
    game.startRun({ regenerate: true });
  });
</script>
```

## Events emitted by the game

- `ready`: embed loaded and ready to receive commands
- `state`: throttled snapshot of score, distance, speed, mode, and reward preview
- `run-start`: a new run began
- `run-end`: run finished with final score, distance, and reward preview
- `player-context`: player or wallet context was updated
- `reward-policy`: reward conversion policy was updated
- `orientation-change`: current viewport/orientation status changed
- `orientation-policy`: orientation requirements were updated

## Commands accepted by the game

Post these through the SDK or directly via `postMessage`:

- `start-run`
- `restart-run`
- `request-state`
- `set-player-context`
- `set-reward-policy`
- `set-orientation-policy`

## Wallet and reward flow

Recommended flow for `test-slots`:

1. Connect the wallet in the host app, not inside the iframe.
2. Pass the wallet address into the game through `playerContext`.
3. Treat score as input into a strict conversion of `5000 points = 1 spin`.
4. Set `wholeUnitsOnly: true` and `maxDailyRewardUnits: 5`.
5. Pass the current `awardedRewardUnitsToday` count from your backend into the game.
6. Listen for `run-end` and send the final score to your backend.
7. Let the backend verify eligibility and award no more than 5 spins per wallet per day.

## Reward preview fields

The emitted `rewardPreview` now includes:

- `amount`: claimable spins for this run after the daily cap is applied
- `wholeUnits`: uncapped whole spins earned from the score
- `claimableUnits`: same as `amount` for strict whole-spin mode
- `remainingDailyRewardUnits`: how many spins can still be awarded today
- `remainingAfterClaim`: how many spins would remain today after awarding this run
- `awardedRewardUnitsToday`: how many spins the backend says were already awarded today
- `dailyCapReached`: whether the 5-spin daily limit is already exhausted
- `cappedByDailyLimit`: whether this run earned more spins than can still be awarded today
- `pointsToNextUnit`: points still needed to reach the next spin threshold

## Portrait-first app flow

If `Elite Slotes` stays portrait-first, use a dedicated route, modal, or webview screen for Neon Trail:

1. Open the game in its own screen.
2. Pass `orientationPolicy.requireLandscape = true`.
3. Let the game show its rotate-device overlay until the phone is sideways.
4. Optionally set `fullscreenOnStart = true` so supported browsers try to enter fullscreen before locking landscape.

This avoids trying to force a landscape game into the same portrait slot UI layout.

## Security note

The emitted score is client-side state. That is acceptable for prototypes, internal demos, or off-chain leaderboards. It is not sufficient for production token payouts on its own. Real rewards should be verified and authorized server-side.