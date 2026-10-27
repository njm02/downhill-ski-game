# DOWNHILL SKI

A complete browser alpine arcade game built with JavaScript, p5.js, MediaPipe Tasks Vision, and Vite. All mountain art is procedural and original.

## Run in VS Code

Install Node.js 22 LTS (or newer supported LTS), open this folder in VS Code, and run:

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite (normally http://127.0.0.1:5173). Use a modern Chrome or Edge browser. VS Code Live Server is also supported (see Go Live below). Do not open index.html as a file:// URL.

```sh
npm test        # core gameplay and orientation checks
npm run build  # production files in dist/
npm run preview
```

The installer copies MediaPipe WASM files into public/wasm. The hand model is included in public/models. No camera frames are uploaded; inference runs in your browser. The game works locally without a backend. Google Fonts is an optional visual enhancement; system fonts are the fallback.

## Play

- Arrow keys or A/D steer; automatic downhill travel.
- Pass between the red gate poles for 10 base points. Consecutive gates increase the multiplier: 2× at 5 gates, 3× at 10, and 4× at 15. Missing a gate resets the streak and multiplier without subtracting points. The HUD shows the current streak; results show your best streak.
- A tree collision or insufficient-height contact with another skier ends your run. Rocks end your run unless cleared at sufficient jump height; survive up to 90 seconds.
- Escape or Pause stops the timer. Resume includes a new countdown.
- Sound starts muted. Toggle it in the header.
- Best score is saved locally when browser storage is available.
- Keyboard steering is also available during webcam play.

## Two-fist controls

1. Select **Webcam · two-fist wrist rotation**, then **Enable camera & calibrate**. Only this explicit action asks for camera permission.
2. Keep two upright, slightly relaxed fists near your chest, both fully visible. Hold still for about two seconds. Use even lighting and keep wrists and knuckles visible.
3. Rotate each fist counterclockwise together to go left, clockwise together to go right, as seen in the mirrored preview. Hands should stay in place. This is **not** steering-wheel motion, and the line between the hands is never used.
4. Adjust sensitivity or reverse direction if your physical interpretation differs. Preview shows the palm landmark geometry, and L/R show neutral-relative orientation estimates matched to stable hand identities (L/R are initial mirrored-preview sides). Recenter pauses play for fresh calibration.
5. If tightly closed fists occlude landmarks, relax them. Keep the two-fist wrist-rotation gesture.

### Honest tracking limitations

The estimator uses the in-plane angle of the four MCP knuckle bases of **each individual hand**, corrects image aspect ratio and mirror sign, and calibrates each hand separately. Both hands use the same visual rotation sign. Wrist proximity maintains hand identity across frames, avoiding unstable handedness labels; wrist positions never determine steering. Keep hands separated rather than crossing them. It averages the two calibrated angles, rejects opposing turns while allowing unequal same-direction rotations, applies a 4° dead zone, limits steering, and smooths over time. Loss of either hand gently centers steering. Calibration requires both stable hands.

This measures projected hand orientation, **not perfect 3D wrist pronation/supination**. Rotations that do not change the visible knuckle-row angle cannot be measured reliably. A fully clenched fist may obscure the geometry; handedness can also become unstable under occlusion. Physical webcam testing is required to confirm your intended twisting motion, rotation direction, calibration stability, lighting, and sensitivity. Neither head tilt nor gaze tracking is included.

Inference is throttled to about 15 Hz on the main thread; rendering runs independently at display rate. Some laptops may show small inference stalls. CPU inference was chosen for broader compatibility. Keyboard play has no inference cost.

## Structure

- `sketch.js`: p5 lifecycle, UI, state transitions, audio, storage
- `src/game.js`: world-space procedural course, swept collision checks, scoring, timing
- `src/renderer.js`: perspective rendering, mountain scenery, original trees/rocks/skiers, trails
- `src/input.js`: interchangeable normalized keyboard and calibrated hand inputs
- `tests/game.test.js`: scoring, collision, timer, corridor, complete-course navigation, orientation

A smooth centerline connects gates with progressively wider lateral sweeps. Gates narrow from 90 toward 68 world units and spacing decreases from 540 toward 370. Speed rises from 240 to 560 units/second, with stronger acceleration in the final 30 seconds. Ordinary obstacles and moving skiers stay outside the central corridor. Isolated rocks on gate approaches offer a jump or a clear dodge on either side; these are spaced apart to allow recovery and jump cooldown. Moving skiers appear further down the course, encountered earlier in the run, with increasing frequency. Obstacle density rises from 8 to 20 obstacles per gate section, with more frequent approach rocks and riders. Wider lateral sweeps demand more carving; maximum lateral speed is 360 units/second to keep the faster route achievable. The rendered snow surface now includes broad rollers, cross-slope folds, taller banks, and stronger terrain shading. These elevations are visual; they do not automatically launch the skier or alter collision radii. This scoring version uses a separate local personal-best record so older scores remain stored separately. Collision checks are independent of rendered sizes; gate poles are visual markers and not lethal obstacles.

## Troubleshooting

Camera denied: allow camera access for localhost in browser settings, then enable again, or select keyboard. Camera busy: close other apps using it. Model errors: confirm public/models/hand_landmarker.task exists and rerun npm install to restore WASM files. Camera APIs require localhost or HTTPS. Switching back to keyboard stops the camera.

Reference inspiration: https://minireview.io/sports/grand-mountain-adventure
MediaPipe API reference: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js

### This machine

The initial workspace had no Node.js installation on PATH. Verification used an official Node 22 runtime extracted into `/tmp/node-v22.14.0-darwin-arm64`. You can run `./start.command` now (or double-click it in Finder); it uses installed Node first and that temporary runtime second. Install Node.js permanently for standard npm commands and future sessions after temporary files are cleared. Dependencies and the hand model are already installed in this checkout.

The Vite configuration includes a project-confined file guard to support the colon in this folder's `ux:ui essentials` parent name. The server binds only to loopback.

Verified: twelve automated tests, production build, browser title/countdown/live scoring/pause/resume/collision-results/restart flow, and HTTP delivery of the model/WASM. Physical camera calibration and gesture accuracy still require testing with your hands.

Webcam setup now opens the preview automatically and displays calibration progress beside the enable button. Clicking Hit the slopes before enabling webcam starts camera setup. Calibration tolerates small landmark jitter and brief detection gaps; it still requires two steady hands.

The roll estimator now fits the knuckle row (MCP landmarks 5, 9, 13, 17), highlighted cyan in the preview. Hold knuckles facing the camera and rotate both fists sideways in place, like turning two small knobs on the same plane. Wrist-to-knuckle direction no longer drives steering. Translation and uniform apparent-size changes cancel out; strongly edge-on rows are rejected using relative landmark depth as a validity check only. Synthetic tests cover translation, depth/scale, wrist pitching, and equal left/right roll. Real perspective changes and landmark prediction errors can still affect the estimate; physical testing remains necessary. Refresh and recalibrate after this update.

### Opening from VS Code

The **Go Live** button now works through a browser import map. If you prefer Vite, use **Terminal → New Terminal**, run `./start.command`, and leave that terminal running. The launcher starts Vite and opens Google Chrome automatically. Alternatively, with Node installed, run `npm run dev` and open the printed URL.

## Alpine graphics update

The original p5 renderer now uses an elevated oblique camera, world-anchored snow elevation and lighting, snow-laden evergreen silhouettes, long blue-gray shadows, faceted rocks, distant forest, carved ski grooves, and turning powder spray. The skier has a compact downhill posture, backpack, bindings, and curved ski tips. All art remains procedural; no Grand Mountain Adventure assets are included. Game physics, gate placement, and hand tracking are unchanged by this visual update.

Resort scenery includes alternating wooden fencing and orange mesh safety netting, piste signs, groomed service-track lines, snowy chalets, faceted mountain ridges, and animated two-way gondola/chairlift crossings. Infrastructure remains outside the reachable skiing area, with lift cables crossing overhead. A wider camera framing makes the resort edges visible without changing physics or hand input.

## Jumping

Press Space during play, or quickly thrust both fists upward together while both remain visible. First hold steady briefly until the indicator says “Jump ready.” Quickly lift both fists at least about 2% of the camera image height within roughly 0.4 seconds. A slight delay between hands is allowed. After the cooldown, another slight upward lift triggers the next jump without lowering first; the indicator shows readiness. Jump detection reads wrist positions independently of the steering orientation filter, so edge-on knuckles do not block it. A single hand, slow lift, tracking reacquisition, or holding hands high should not repeatedly trigger jumps. Hand position controls jumping only; steering still uses wrist rotation.

Jumps last 0.85 seconds with a 1.25-second takeoff cooldown. Rocks can be cleared during the middle of the arc; trees always remain dangerous; other skiers can be cleared above 48 units of jump height. Jump before reaching a rock, not at impact. The skier rises above its ground shadow and stops leaving ski grooves while airborne. Pausing freezes the jump; restarting resets it. The exact gesture threshold needs physical webcam testing with your lighting and framing.

## Mountain race features

Three signed forks split into a blue main piste and a gold expert route, then merge again. Expert sections last 4,800 world units and alternate far left, far right, then far left. Their outer lines sit around 590 units from the slope center, with sharper 150-unit-wide slalom swings and smooth entry/exit transitions. Terrain banks account for both pistes so the outer route stays visibly groomed. Choose either gate at each fork station: the expert gate is narrower and awards double base points (20 before the streak multiplier). Missing the unused alternative does not break your streak. Expert routes include isolated rocks; ordinary obstacles are kept clear of both route corridors.

Blue-chevron snow ramps launch automatically when crossed. Press Space or thrust both fists up within 0.3 seconds before the lip for a higher, longer boost. Steer around a ramp to stay grounded. Broad terrain folds remain visual; marked ramps provide physical launches. Landing zones are cleared of approach rocks.

The course progresses through Resort Piste, Pine Forest, Powder Bowl, and Summit Race, with denser forest scenery, open rocky powder terrain, and race markers. Surviving 90 seconds reaches the finish arch and spectators, shows a short finish celebration, then results including expert gates and ramp boosts. Collisions still end the run immediately. Physical webcam timing needs testing with your camera.

## VS Code Go Live

Open this project folder in VS Code, open `index.html`, then click **Go Live** (or **Open with Live Server**). Open the resulting localhost URL in Chrome. Raw browser imports are mapped to the installed local dependencies, and webcam assets load from `public/`. Run `npm install` first if `node_modules` is missing. Refresh an already-open Live Server tab after this update. Do not double-click the HTML file into a `file://` URL; module loading and camera access require a local server. `npm run dev` remains supported.

## Webcam orientation

Selecting Webcam opens a larger, centered translucent practice dialog and requests the camera. Hold both fists upright to calibrate, then make a quick left twist, right twist, and small upward lift. There are no turn holds or neutral resets. Practice uses a lighter steering threshold and accepts a 2.5% image-height upward movement of both wrists; in-race jump detection is unchanged. Completion goes straight to the race countdown.

Live tracking, sensitivity, retry/recalibration, and Back to keyboard (also Escape) remain available. After calibration, “Skip practice & start” lets you proceed if recognition is troublesome. The main title panel and webcam window are larger; the canvas still fills the browser viewport. Physical webcam testing is needed to confirm comfort with your framing.

## Jump scoring and clearance

Jump anywhere using the upward two-fist gesture or Space; no ramp is required. Time takeoff before a rock or rider so you reach sufficient clearance (32 units for rocks, 48 for riders). Trees cannot be cleared. Free jumps do not award points by themselves. Each terrain ramp awards 10 points once; a timed takeoff boost awards 25 instead. The score toast confirms the award.

Title and orientation panels are slightly smaller again, with a larger 4:3 webcam preview in both practice and in-game tracking. Short screens retain a larger preview and allow the dialog to scroll.

## Rendering performance

Terrain mesh heights and lighting are cached by visible world row instead of resampled each frame; old rows are discarded. The game canvas renders at one pixel per CSS pixel to reduce Retina fill cost while HTML text stays sharp. Hand tracking tries the GPU delegate first, falling back to CPU if initialization fails, and landmark overlays only redraw after a new inference. The practice camera preview is now up to 560 pixels wide (460 on shorter screens), with a 420-pixel in-game tracking panel. Real frame-rate improvement and GPU support depend on the laptop and require live webcam testing.

Practice now includes an original looping fist diagram for each gesture. Wrist markers stay fixed for left/right rotations; both fists translate upward only for jump. Direction arrows, short captions, and the mirror-view label explain how to copy it. On laptop widths the diagram and webcam sit side by side. Reduced-motion preferences use a static end pose with arrows instead. Gesture recognition thresholds are unchanged.

Free-jump recognition no longer requires holding still to arm: once both wrists are visible, a roughly 2% upward lift within a short motion window triggers a jump, independently of ramps and knuckle orientation. No downward reset is required: after the 1.25-second cooldown, lift both fists slightly again from their current position. Holding still does not repeatedly launch. Tracking loss clears the motion baseline. The tutorial drawings use simplified closed side-view grips.

The practice illustration is enlarged and uses straight left/right arrows. Free-jump detection accepts a small simultaneous upward movement (1.8% of image height within 350 ms, with a modest speed threshold). It does not require a downstroke or steady hold. Cooldown movement is discarded to prevent repeat jumps from one lift; tracking loss resets the baseline.

## First-person view

Choose **Camera view → First person · through your goggles** on the start screen. The lower forward-facing perspective follows your horizontal position directly, with skis and pole grips at the bottom of the view, subtle carving motion, a mountain skyline, and camera lift during jumps. Both keyboard and webcam controls work as before. Gates, scores, collisions, and jump timing use the same world simulation in both views.

Press Escape and use the camera selector in Pause to switch views mid-run. Third person remains the default. The first-person rendering is still procedural 2.5D, not a full 3D mountain. Automated tests cover projection and render execution in all four sections; visual comfort and obstacle readability need playtesting on your screen.

First-person skis now angle smoothly into steering input (about 10 degrees at full turn). Gondola and chairlift cables sit roughly three times higher above the snow, with matching taller support towers outside the skiable corridor. Lifts remain rendering-only scenery and never participate in obstacle collisions.

## Minimal opening window

The game opens with a centered rounded translucent panel containing only the title and four pill buttons. First select Third person or First person; this enables Keyboard and Camera. Keyboard immediately starts the countdown. Camera replaces the chooser with the centered preview/practice window and requests camera access. Completing practice (or skipping after calibration) starts the race. Back to choices returns to the chooser and stops the webcam. The Pause menu still supports switching camera views.

## 3D alpine renderer — first playable milestone

An optional Three.js prototype is available: actual snow terrain, procedural 3D skier/trees/rocks, sunlight, soft shadow maps, distance fog, ski trails, gates, ramps, AI riders, and a finish arch. Both view modes and existing keyboard/webcam controls share the same gameplay simulation. The new look is an initial stylized alpine foundation, not a finished recreation of Grand Mountain Adventure.

Use **Pause → Graphics → Classic** for the original renderer. Classic is the default again. Launch `?graphics=3d` to preview the experimental renderer; unsupported WebGL automatically falls back. Go Live remains supported through the local Three.js import map. Run `npm install` after pulling these changes to install the new dependency.

The 3D milestone has not yet ported the detailed gondola/chalet/fence scenery, fork signs and colored route ribbons, or snow spray. Those remain in Classic. Expert gates, scoring, jumping, and collisions still work in 3D. Terrain streams in bounded chunks with shared model geometry/materials. Rendering elevation is visual: takeoff and collision thresholds still come from the existing game model. Live webcam performance and first-person comfort need user playtesting.


### Alpine graphics in gameplay

The game uses the Alpine 3D renderer with its human-proportioned skier, branch-based trees, weathered rocks, quieter mountain backdrop, warm lighting, and textured scrolling snow. Both camera views use the existing gameplay and input systems. Pause → Graphics → Classic restores the original renderer; `?graphics=classic` also opens it directly. Resort buildings, netting, and gondolas are not included in this renderer. Physical webcam performance and the final appearance in motion still need a play check.
