# Neon Trail

Neon Trail is a lightweight browser prototype for a side-scrolling stunt bike game inspired by arcade endless riders.

## How to run

Open `index.html` in a browser.

If you want to serve it locally instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Embed and integrate

This repo now includes an embed-friendly surface for another app or repository:

- `embed.html` for iframe embedding
- `neon-trail-embed.js` as a host-side helper
- `window.NeonTrailGame` inside the game iframe for direct control
- `postMessage` events for score, run start, run end, wallet context, reward policy updates, and orientation changes

See `docs/test-slots-integration.md` for a concrete integration flow aimed at a host repository like `test-slots`.

## Controls

- `Start Run` button to begin
- `Retry` button after crash
- `Space` or hold left mouse: accelerate
- `W` / `Up Arrow`: jump
- `A` / `Left Arrow`: tilt backward
- `D` / `Right Arrow`: tilt forward
- `R`: instant restart
- Mobile: on-screen `Tilt Back`, `Throttle`, `Jump`, `Tilt Front`

## Prototype scope

- Progressive track difficulty with smaller early gaps and harder late-run sections
- Rounded hills instead of angular straight-line rises
- Bike suspension feel with improved landing checks
- Rider crash detection and wipeout screen
- Score system based on distance, airtime, and landed flips
- Persistent best distance and best score using browser storage
- Lightweight synthesized engine, wind, and impact audio
- Endless run with start and retry flow

## Reward integration note

The default reward preview is now tuned for strict spin rewards: `5000 points = 1 spin`, with whole spins only and a default cap of `5` spins per day. The host app can pass how many spins were already awarded today so the preview reflects the remaining daily allowance. Client-side scores are still not secure enough for direct payouts, so treat the browser score as an input to your backend verification flow rather than the final source of truth.
