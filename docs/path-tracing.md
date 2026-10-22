# Path tracing in the garden

## Design

The path tracer is an optional WebGL 2 renderer for the existing simulated dish.
It preserves the overhead camera, field, palettes, material selection, lights,
painting, soundtrack and save/record controls. The existing real-time renderer is
the startup default, including on phones. No runtime dependency or server is added.
This changes rendering; the physics still run on the CPU.

The new renderer traces sampled light paths through a finite triangle heightfield
with a closed base and sides, above a matte floor. It uses diffuse scattering,
mirror reflection, Fresnel glass reflection/refraction, total internal reflection,
and distance-dependent colored absorption. Material appearances are deliberately
simplified physical models: no spectral dispersion, volume scattering or thin-film
interference is claimed. Direct area-light samples and indirect bounces illuminate
the dish. Small refractive caustics can remain noisy.

The surface prepass uses the actual `heightOf()` profile and tint, in RGBA16F.
The old shadow prepass continues to use `blockerOf()` and is unchanged.
The tracer accumulates linear radiance in two RGBA32F targets; a separate display
pass tone maps and encodes the result. Target allocation requires
`EXT_color_buffer_float` and complete framebuffers. Path shader or allocation
failure affects only the optional mode. Context restoration recreates its resources.
The floor retains Heart scars and recovery, Quantum walls and potential, and Mould
food and walls from the field metadata. These remain visual annotations of the
existing physics, rather than invented three-dimensional obstacles.

## Interaction and budgets

- Look → Rendering → Path traced selects the new mode for this visit.
- Preview uses six surface events and at most 262,144 internal pixels.
- Fine uses eight surface events and at most 786,432 internal pixels.
- Moving or audio-reactive scenes use six events and at most 98,304 pixels.
- Pause & refine pauses the simulation and soundtrack, allowing a still to settle.
- Still scenes accumulate up to 4,096 samples. Painting, field changes, material,
  palette, background, effective lighting or render size changes reset that history.
- Noise seeds advance independently of history resets. Moving scenes never reuse
  radiance from old geometry. Paused path-traced sun lighting stays fixed until
  playback resumes; moving lamps and device tilt still update and reset the image.

The trace is bounded by the selected event budget and a finite cell traversal
budget. Exhausted traversal is terminated conservatively, not reported as an open
sky miss. This and the finite event count are deliberate quality approximations.
The preview budget retains the five surface events needed for light to pass
through glass, bounce off the floor, and return through glass to the environment.
The output canvas keeps its normal size, with the internal image scaled to fit.
GPU performance depends on device, browser, resolution and geometry; a software
renderer test is not a hardware performance benchmark.

## Implementation plan and acceptance

1. Add independently testable render budgets and history invalidation policy.
   Verify static accumulation, scene/field reset, live seed progression, sample cap.
2. Add `src/pathtrace.glsl`, exact triangle traversal and stochastic transport.
   Compile and render the real shader; check known top, bottom, side, grazing,
   Fresnel/TIR and empty-field cases with an independent reference.
3. Add `src/pathtrace.js` for targets, GL state restoration, UI and invalidation.
   Extend `tools/splice.py` so the delivered HTML remains self-contained and checked.
4. Exercise WebGL mode switching, pixels, accumulation, edits, resize, unsupported
   capability, shader/allocation failure and context restoration in browser tests.
5. Run existing chemistry, recovery/input, audio, responsive UI and Android asset
   checks; review the combined diff before proposing integration.

## References

- [PBRT: A Simple Path Tracer](https://pbr-book.org/4ed/Light_Transport_I_Surface_Reflection/A_Simple_Path_Tracer)
- [PBRT: Dielectric BSDF](https://pbr-book.org/4ed/Reflection_Models/Dielectric_BSDF)
- [Khronos: EXT_color_buffer_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/)
