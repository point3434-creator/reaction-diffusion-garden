# Crystal Shell

Adapted from **Ray Marching Experiment 43**, created by **Stephane Cuillerdier
(@Aiekick), 2016**: <https://www.shadertoy.com/view/lstXRl>.

The source and this material adaptation are licensed under **Creative Commons
Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)**:
<https://creativecommons.org/licenses/by-nc-sa/3.0/>.
Legal code: <https://creativecommons.org/licenses/by-nc-sa/3.0/legalcode>.
This material is an exception to the repository's MIT license.

The original source also credits Inigo Quilez's shader
<https://www.shadertoy.com/view/Xds3zN> for its lighting helpers and notes that
it was tuned via XShade (<http://www.funparadigm.com/xshade/>). These credits
do not imply endorsement of the garden or its changes.

## Adaptation

The Crystal Shell functions and material-14 integration in `src/frag.glsl`
retain the original purple shell/green core, displacement relationships,
refraction ratio, and environment reflection/refraction weights. The garden
uses its own changing height field and lighting rather than the original
sphere, orbiting camera, sphere tracer, and step-count brightness. Recessed
surface normals and bounded cavity shading approximate the shell openings.
Texture filtering smooths details on small blobs. The compiled adaptation
and this attribution are also included in `web/index.html`.

## Original texture assets

The seven PNG files in `src/crystal-shell-assets/` are unmodified Shadertoy
built-in assets selected by the original shader: the grayscale pebble texture
(`iChannel1`) and the six faces of its studio cubemap (`iChannel0`). The
manifest in that directory records each original URL and SHA-256 checksum.
The texture assets retain their original ownership and are not relicensed
under the repository's MIT grant.

The build embeds their original bytes as data URLs, so the garden and Android
asset bundle do not need network access to display this material.

# Amber Flow

Adapted from **Ray Marching Experiment 35**, created by **Stephane Cuillerdier
(@Aiekick), 2015**: <https://www.shadertoy.com/view/4t2SWW>.
The original builds on the author's **Texture Experiment 1**:
<https://www.shadertoy.com/view/llSSWD>.

The source and this material adaptation are licensed under **Creative Commons
Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)**:
<https://creativecommons.org/licenses/by-nc-sa/3.0/>.
Legal code: <https://creativecommons.org/licenses/by-nc-sa/3.0/legalcode>.
This material is an exception to the repository's MIT license. These credits
do not imply endorsement.

The Amber Flow functions and material-16 integration in `src/frag.glsl`
retain the source's texture advection, sine distortion, animated mip level,
color remapping, displacement depth, and 0.6/0.8 environment weights. The
garden height field replaces the original sphere tracer and camera. Surface
slopes affect the garden lights; bounded cavity shading replaces sampled
ambient occlusion. Refraction uses the view ray and the reciprocal index of
1.2. A pixel-footprint floor filters fine details, and the reversed-edge
smoothstep is expressed with ordered edges for defined GLSL behavior.

`src/amber-flow-assets/surface.jpg` is the unmodified built-in texture selected
by the source's `iChannel1`. Its manifest records the original URL and SHA-256.
The source uses the same six studio cubemap faces as Crystal Shell; those
files and the GPU cubemap are shared. All bytes are embedded for offline use.
These assets retain their original ownership and are not relicensed under MIT.
The compiled adaptation and its attribution are included in `web/index.html`.

# Voronesque Gem

Adapted from **Voronesque Gem**, created by **Stephane Cuillerdier
(@Aiekick), 2016**: <https://www.shadertoy.com/view/XsdXDX>.
The source credits **Shane** for the Voronesque function and notes tuning via
XShade (<http://www.funparadigm.com/xshade/>).

The source and this adaptation are licensed under **Creative Commons
Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)**:
<https://creativecommons.org/licenses/by-nc-sa/3.0/>.
Legal code: <https://creativecommons.org/licenses/by-nc-sa/3.0/legalcode>.
This material is an exception to the repository's MIT license. These credits
do not imply endorsement.

The Voronesque functions and material-9 integration in `src/frag.glsl` retain
the procedural cell function, square-root displacement, drifting coordinates,
slowly orbiting color frame, and two reflective layers mixed at 0.45. The
garden maps these onto its own dome normals, with a position offset to vary
the cells across the dish, instead of tracing a separate sphere. Normal
sampling widens with pixel footprint to soften details on small blobs. Garden
lighting and a restrained beat highlight are added; the dish background stays
clear. The original studio cubemap is shared with Crystal Shell and Amber
Flow, using the unmodified assets recorded in `src/crystal-shell-assets/`.

The compiled adaptation and its attribution are included in `web/index.html`.
The material replaces Electricity; saved Electricity selections migrate to
Voronesque Gem. Existing Gemstone selections still migrate to Black Opal.
