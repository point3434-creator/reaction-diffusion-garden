# Complex Ginzburg–Landau garden mode

Status: approved by the user on 2026-11-03 (Build this design).

## Intent

Add a new equation with hypnotic spirals and evolving waves, alongside Garden,
Current, Heart, Quantum, and Mould. The user selected Complex Ginzburg–Landau
(CGL) before Navier–Stokes. Existing modes, materials, and music remain available.

## Approaches

- **CGL first — selected:** a distinct oscillating field with phase waves,
  spiral cores, and transitions toward disorder. It fits the existing grid and
  surface renderer.
- **Navier–Stokes first — deferred:** deepen the existing Stir fluid mechanism
  into a dedicated fluid mode, emphasizing vortices and transported dye.
- **Both together — deferred:** more scope and harder to assess each new model.

## Proposed experience

- Add a **Resonance** mode, identified as Complex Ginzburg–Landau in its description.
- Offer three tuned starting points: **Spiral Bloom**, **Wave Garden**, and
  **Phase Storm**, with visibly different, sustained behavior verified in-browser.
- Two controls adjust dispersion and nonlinear phase twist within tested limits.
- Painting disturbs the local oscillation; reseeding starts a fresh arrangement.
  Pause, speed, resizing, and returning to other modes retain their usual behavior.
- Derive surface ridges from phase and amplitude, so the existing materials have
  curved shapes to illuminate even where amplitude is nearly uniform. Phase
  supplies colour where the chosen material supports it; materials with their
  own colours keep those colours.
- Music can pulse the rendering and add bounded local disturbances on detected
  beats. With music off, the equation still sustains its own motion.

## Implementation proposal

Use the dimensionless cubic equation

    dA/dt = A + (1 + i*b) Laplacian(A) - (1 + i*c) |A|^2 A

with periodic boundaries and real/imaginary grid channels. Keep the physical
field separate from the derived display channels. Use a time step and integration
scheme qualified across the exposed controls; do not hide unstable integration
by clipping the physical field. Reuse the existing browser simulation interface,
WebGL material renderer, and source-splicing build. Keep the solver in its own
module so later GPU work can reuse the same equation and validation fixtures.
This first addition does not create a new GPU compute engine.

Names, presets, display mapping, and implementation details above are proposals,
not additional preferences attributed to the user.

## Acceptance checks

- The zero field remains zero. A spatially uniform field follows the independently
  known amplitude relaxation and phase rotation of this equation.
- A plane-wave fixture checks diffusion and phase coupling, including signs.
- Fixed seeded runs remain finite across all exposed preset/control limits;
  time-step refinement checks that integration is behaving consistently.
- Painting, clearing/reseeding, resizing, pause/resume, and mode switching work.
- Real WebGL checks exercise the new mode with existing materials and music;
  visual inspection confirms distinct evolving patterns and useful surface relief.
- Existing tests, generated-source checks, and Android asset staging still pass.

## Boundaries

No redesign of existing shaders, jukebox changes, new audio, Navier–Stokes mode,
3D volume simulation, or new APK release in this addition. Mobile performance
will be measured where available, not inferred from desktop tests.

## Reference

Aranson and Kramer, *The World of the Complex Ginzburg–Landau Equation*:
https://arxiv.org/abs/cond-mat/0106115

## Subsequent requests approved in the same conversation

The user asked for Quantum walls to look like actual glass and for floor colour
or effects, leaving the look to the implementer. Scope: transparent beveled
Quantum barriers, a saved colour picker with palette reset, and a toggleable
fine floor grid. Keep physical barriers and other models unchanged.

The user also reported slowing, clipping, and distortion with live beats and
recorded songs. Scope: diagnose the shared playback path and scheduling under
rendering load. Reproduced overdue-note bursts are corrected by skipping missed
steps while retaining the beat grid. Request playback buffering, adapt drawing
resolution under sustained slow frames, and preserve simulation resolution,
recording speed, transport behavior, and mixer levels. Actual audible improvement
on the user's output device remains a separate listening check.

Follow-up listening identified Amber Flow, Voronesque Gem, and stirring as worse
under load. A 30-second recorded-song profile with Amber Flow and stirring showed
the rendering loop remained continuously busy even at minimum drawing resolution;
stirring did return to sleep and observed resource counts remained bounded. Leave
one animation opportunity free after expensive visual frames during playback,
without catching up skipped visual work. Neon pulse decay must use elapsed time
since the kick so reduced rendering cadence does not stretch its musical timing.
