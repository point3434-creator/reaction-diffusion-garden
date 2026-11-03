# Resonance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add the approved Complex Ginzburg–Landau Resonance mode.

**Architecture:** A separate real/imaginary grid solver derives the existing R/G/Bl display channels. Small branches in the existing mode controller connect presets, controls, painting, audio impulses, resizing, and persistence. Existing shaders and audio remain unchanged.

**Tech Stack:** Vanilla JavaScript, typed arrays, WebGL2 renderer, Node tests, Playwright, Python source splicer.

**Spec:** docs/superpowers/specs/2026-11-03-cgl-garden-design.md

## Global Constraints

- Three presets: Spiral Bloom, Wave Garden, Phase Storm.
- Periodic boundaries; separate physical and display fields; no physical-field clipping to conceal instability.
- Reuse existing simulation/renderer; no new GPU compute engine or dependencies.
- Existing modes, materials, music, and browser song storage remain available.

## Review Focus

- Resize after manual parameter changes must preserve the evolving field and parameters.
- Clear then paint must work without NaN or stale display data.
- Music must not route CGL through Gray–Scott parameter or clearing operations.
- Restoring the saved mode must find its constructor and UI before startup.
- Extreme exposed dispersion/twist combinations must remain finite and time-step consistent.

### Task 1: Numerical solver

**Files:** create src/cgl.js and tests/cgl.test.js.

**Interfaces:** createCGL(w,h) returns kind=cgl, w,h, U,V (physical), R,G,Bl,A (display), step({b,c,dt},steps), seed(preset,rng), paint(cx,cy,radius,erase,pigment), clear(), resample(w,h), updateDisplay(). CGL_PRESETS supplies name,b,c,seed to integration.

- [x] Write independent zero, uniform analytic solution, discrete plane-wave, time-refinement, preset stability, paint/clear, and resize tests; run node --test tests/cgl.test.js and observe failure before solver exists.
- [x] Implement periodic five-point Laplacian with second-order explicit midpoint integration (dt=0.04 default; b in [-2,2], c in [-2,2]); keep phase/amplitude display conversion separate.
- [x] Tune deterministic initial conditions for the three presets; test long bounded runs and display contrast. Run solver tests until all pass.

### Task 2: Garden integration

**Files:** modify web/index.html, tools/splice.py, package.json, README.md; create tests/cgl-browser.test.js.

**Interfaces:** consume Task 1's constructor and presets. Route CGL through dedicated parameter/preset/frame branches; existing generic paint and rendering consume its compatibility fields.

- [x] Write browser tests for mode/presets, slider ranges, pause/evolution, paint/clear/reseed, persistence, resize, music impulses, and mode switching; observe missing mode failure.
- [x] Add the mode button and description, dispersion/twist controls, preset selection, frame stepping, startup persistence, and music branch. Hide unsupported map/photo/stir controls.
- [x] Embed cgl.js with tools/splice.py and add tests to npm test. Document the equation, visual mapping, and controls.
- [x] Run focused solver/browser checks, inspect real WebGL screenshots at desktop/mobile sizes, and verify generated sources.

### Task 3: Integrated verification and review

**Files:** feature diff, tests/artifacts, approved design and this plan.

- [ ] Run npm test, python tools/splice.py --check, git diff --check, and Android staging check; retain logs.
- [ ] Obtain one fresh independent review of the whole feature, explicitly checking Review Focus and the numerical/display boundary.
- [ ] Fix material findings with regression coverage, rerun affected checks, and inspect the final diff.
- [ ] Present the working preview and verified outcomes; keep any publication separate from the already authorized CI repair.
