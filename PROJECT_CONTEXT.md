# Downhill Ski — Project Context

## Overview

Downhill Ski is a locally run browser arcade game built with JavaScript, p5.js, Three.js, MediaPipe Tasks Vision, and Vite. The player automatically travels downhill, steers through gates, avoids obstacles, and jumps over rocks or ramps. A run lasts up to 90 seconds.

The current default presentation is first-person with the Alpine 3D renderer. The original p5 renderer remains available from **Pause → Graphics**. Third-person view remains available from **Pause → Camera View**.

## Run and verify

```sh
npm install
npm run dev
```

Open the localhost URL Vite prints in Chrome. Do not open `index.html` with a `file://` URL. Camera access requires localhost or HTTPS and is requested only after selecting Camera.

Other commands:

```sh
npm test
npm run build
npm run preview
```

`start.command` is a macOS launcher for the local server. The repository includes the MediaPipe hand model and WASM runtime files under `public/`.

## Controls and current interaction

- Keyboard: Left/Right arrows or A/D to steer; Space to jump; Escape to pause.
- Face / eyes: eye-line orientation measures head tilt; hold upright to calibrate, tilt toward either shoulder to steer (3° dead zone, full steering at 25°). While tilt is neutral (within 6°), lifting the chin about 12° triggers a jump. Lower the chin to rearm; Space also jumps. Tracking loss centers steering. Required face practice checks left tilt, right tilt, and a chin-lift jump before automatically starting; retry resets practice.
- Hands: rotate both fists together at the wrists to steer. The current full-steering target is about 40 degrees, with a neutral dead zone. Translation between hands is not a steering input.
- Camera jump: lift both fists upward from their recent resting position. The detector permits a short delay between hands, scales the threshold to apparent hand size, and uses a cooldown. This gesture is still experimental and needs physical webcam tuning.
- Camera setup includes a practice flow for calibration, left/right turns, and jump. Webcam frames are processed in-browser.

## Game rules

- Pass through a gate for 10 points. There are no expert gates or multiplier points in the current game.
- Missing a gate scores nothing. Obstacles such as trees, rocks, other skiers, bears, and yetis can end a run; bears and yetis begin after the opening stretch, warn with tracks and one shaking entrance tree, then run across the piste from the treeline; jumping clears rocks and sufficiently high jumps can clear skiers.
- Marked ramps launch the skier; a timed jump input near the lip can boost the jump.
- Speed and course challenge increase through the run. Procedural routes include forks and several mountain sections.
- Best score is saved locally when browser storage is available.

## Source map

- `index.html`, `style.css`: game UI, welcome screen, HUD, practice dialog, and tutorial illustration.
- `sketch.js`: p5 lifecycle, UI state changes, camera startup, keyboard/camera input routing, timer, sound, and results flow.
- `src/game.js`: procedural course, gates, scoring, collision checks, moving skiers and warned wildlife crossings, ramps, jumping, and section progression.
- `src/input.js`: hand orientation estimation/calibration, keyboard input, MediaPipe setup, camera preview/debug drawing.
- `src/face-input.js`: MediaPipe face tracking, eye-line head tilt, calibration, and preview; local model in `public/models/face_landmarker.task`.
- `src/jump-gesture.js`: two-wrist upward-motion jump detector.
- `src/tutorial.js`: practice gesture flow and completion checks.
- `src/renderer3d.js`: active Alpine renderer, camera modes, terrain tiles, skier, ramps, trees, gates, and HUD-facing scene state.
- `src/alpine-assets.js`, `src/tree-model.js`, `src/first-person-glove.js`: shared 3D scenery and first-person assets.
- `src/renderer.js`: original p5 renderer.
- `assets/tutorial-fists.png`: first-person practice illustration.
- `vite.config.js`: Vite game build and local path handling.
- `tests/`: gameplay, jump gesture, tutorial, and renderer tests.

## Build entries and local previews

Vite builds the game from `index.html`. The tutorial fist art is a transparent project asset used by Hands practice. Gameplay scenery uses the shared tree model and Alpine asset modules.

## Current caveats

- Camera hand tracking and jump sensitivity need testing with the target webcam, lighting, and hand distance.
- The jump detector was recently made more responsive; if it misses lifts, tune thresholds in `src/jump-gesture.js` and update `tests/jump.test.js` to cover small, staggered lifts and ordinary jitter.
- The 3D renderer has had changes to ramp ride-up, skis, camera steering, mountains, and compact overlays. Check both first- and third-person views after changes.
- Keep README feature descriptions aligned with the current game: parts of the longer README describe older states, including expert gates, multipliers, sound controls, and older jump thresholds.
- Production build currently emits a Vite warning about large JavaScript chunks; it still completes successfully.

## Working conventions

- Keep game physics and webcam tracking decoupled: renderers consume game state, while input modules return normalized steering and jump events.
- Preserve keyboard play when modifying camera controls.
- Use delta-time movement and keep procedural scenery deterministic where possible.
- For visual changes, check the relevant browser view, including mobile sizing if UI layout changes.
- Do not remove standalone design studies unless they are explicitly no longer needed.
