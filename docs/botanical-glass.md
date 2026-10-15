# Botanical glass — UI first

## Agreed artistic direction

This is an audiovisual artwork, not only a simulation utility. The PC experience is the visual and sonic reference; a future Lightweight profile should adapt the artwork to mobile budgets, rather than constrain the PC version. Keep one shared project with separate quality settings. These profiles and the GPU simulation backend are future work, not features delivered by this UI patch.

The aim is deliberate composition, motion, sound and restraint, not all effects at maximum. Preserve the original music and its dynamics. Future visual responses should distinguish percussion, bass, lead phrases and transitions instead of flashing every surface on every hit.

## This patch

- Green-tinted transparent panel with a real backdrop filter and fully opaque foreground text.
- Frosted button styling, including translucent selected states; hover must not silently replace selected glass with a bright fill.
- Two illustrated botanical sprigs attached to the panel corners, using asymmetric shaded leaves, veins and fixed brush marks. No frame-loop work and no pointer interception.
- Shared desktop/mobile styling, reduced-motion handling, high-contrast and no-backdrop-filter fallbacks.
- The same controls, simulation code, lighting shaders, music source and recording code as the existing branch. No new audio files and no GPU simulation changes.

`src/panel-art.js` is inlined after the existing garden update. It removes the old stage-level vine decoration and adds panel-level artwork. The original `src/style.css` remains intact; `src/garden-glass.css` supplies the override.

## Verification

Run `python3 tools/splice.py`, `npm run check`, `node tests/current.test.js`, then `node tests/glass-ui.test.js` after installing the existing Playwright dependency and Chromium.

The UI suite covers 10 viewport/theme combinations, translucency, foreground opacity, hit testing, scrolling, tab changes and full-screen decoration visibility. It uses the application's Canvas2D fallback to isolate UI behavior from headless software-GPU compilation. It is not a GPU benchmark, full browser certification or audio test.

Local preview checks additionally sampled text contrast on white, black, red, green and blue backdrops in both themes. This is a defined test set, not a blanket WCAG certification of every moving scene. The local preview used the prior uploaded application; branch CI tests the regenerated repository page.

## Next engine stage (not implemented)

Plan GPU-resident Current transport and chemistry separately. The full desktop quality profile should prioritize motion continuity, richer spatial detail, material lighting and musically composed responses. Lightweight should retain the same sonic identity and core interaction while reducing costly visual work. Use GPU acceleration on capable mobile hardware too; do not equate mobile with CPU-only. Compare actual frame timing at matched simulation settings before claiming speedups.
