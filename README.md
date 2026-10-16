# Reaction–diffusion garden

Three physics simulations and a slime mould in one dish, painted with a finger, lit by thirteen materials, and driven by sound.

It started as a toy for Turing patterns: two chemicals, two rules, every pattern on a leopard. It grew a heart, a Schrödinger equation, a slime mould, a studio's worth of surface materials, five original beats, a phone build, and a glass panel to hold it all. Everything runs on the device, in one HTML file, with no servers, no accounts, and nothing sent anywhere.

## What's in the dish

**Garden** is the Gray–Scott reaction–diffusion model. Chemical A feeds in, chemical B washes out, and the one reaction A + 2B → 3B makes B wherever B already is. Because A diffuses twice as fast as B, blobs of B starve their neighbours, and that short-range growth with long-range inhibition is the whole recipe for spots, stripes, coral, fingerprints and dividing cells. Eight presets sit along the curve where the chemistry has a second steady state; drag the map to explore it. A preset grows out of whatever is in the dish, and when none of it can live under the new one (Storm into Spots, say), new seeds go in. The ninth, Atlas, grows them all at once: the band along that curve is straightened out over the dish, with the feed rising from one end to the other and the kill running across, so every cell reacts at its own feed and kill, and pointing at the dish shows where on the map you are. Stir turns a drag into a current: a fluid flow, after Jos Stam's stable fluids, runs under the chemistry and carries it along, so coral wraps into spirals and spots smear into streaks and pinch back into spots (hold Shift to stir without leaving the brush). Every stroke founds a lineage: B carries the colour of the stroke it descends from, so where lineages meet, you can see who outgrew whom. A photo can seed the dish: its dark places become dots of B in the photo's own colours, and the preset decides what they grow into.

**Heart** is Barkley's model of excitable tissue. A cell fires when its neighbours push it over a threshold, then it must rest. A pacemaker gives you the rings of sinus rhythm; a wave broken by scar tissue or by a second stimulus in the first one's wake curls into a spiral that never stops, which is re-entry, the mechanism of flutter and fibrillation. Defibrillate fires every cell at once so every cell rests at once, and the spirals have nothing left to run on. A trace shows the whole dish's voltage like an ECG. The wavefront carries the colour of the stimulus that started it.

**Quantum** is the two-dimensional time-dependent Schrödinger equation, stepped with Visscher's staggered real/imaginary scheme so the total probability stays put. Drag to throw a packet: its magnitude is the hill, its phase is the colour, and the stripes run backwards through it because the phase moves at half the packet's speed. Paint walls, raise them with the barrier slider, and run the presets: Double slit (with a detector trace along the right edge), Tunnel, Trap (a coherent state orbiting in a bowl without spreading), Box and Free. Rewind turns time around: Visscher's scheme can be run backwards step for step, so the fringes beyond the double slit gather back through the slits into the packet that made them. Only what the absorbing edges swallowed stays gone.

**Mould** is Jeff Jones's agent model of *Physarum polycephalum*, the slime mould that grew the Tokyo rail map. Thousands of agents each look ahead at three points, turn toward the strongest trail, step, and lay trail where they land; the trail blurs and fades every step, so veins are the paths enough agents keep agreeing on. It is the garden's recipe turned inside out: short range, go where the others went; long range, forget. Paint food in a colour and the mould finds it by its scent, and the veins that feed on it take that colour; paint walls and it finds the way round; seed from a photo and the network grows into the picture in the picture's own hues. Reach sets how far the agents sense, which is the mesh size; fade sets how fast trail goes. Presets: Forage, Railway (a colony on the station and food where the towns are), Veins, Hyphae and Cells.

**Materials.** One height map is lit thirteen ways: Glass, Quicksilver, Velvet, Wax, Neon, Fire, Ice, Electricity, Contour, Iridescent, Prism, Watercolour and Letterpress. Fire, ice, electricity, contour and the iridescent film are animated; the prism bends blue more than red through graph paper under the dish. On a phone, tilting it moves the lights.

**Keep.** Save picture saves the dish as a PNG at the size it is drawn; Record makes a video of it, with whatever the dish is listening to as the soundtrack (an MP4 where the browser can make one, otherwise WebM, up to five minutes). Both are named after the dish and the preset, and both stay on the device.

**Keys.** Space pauses, F is full screen, C clears, E erases, S stirs, R rewinds, N scatters, P saves a picture and V records; 1 to 9 pick a preset, and G, H, Q and M pick the dish.

**Sound.** A song file, the microphone, or a shared screen's audio (on a computer, which is how you listen to Spotify) drives the dish: kicks plant seeds, pace the heart or throw particles, pulse the surface and turn the colours; snares clear a patch in the garden; loudness sets the pace; the brightness of the sound picks the colour of new seeds. Five beats are built in, each an original loop in homage to one producer's feel, synthesized note by note as it plays: Drunk swing, G-funk, Chop & scratch, Shaolin dust and Soul horns. Nothing is sampled.

The Sound tab also includes five bundled recordings: **Liquid Bloom**, **Mycelium Dream · Violin**, **Prism Orchard**, **Neon Thistle**, and **Velvet Circuit**. Choose a track under Garden soundtrack and press Play. The original five synthesized beats remain available. Keep the `web/audio/` directory beside `web/index.html` when copying the web app; Android builds include the same recordings in their assets.

## Layout

```
web/index.html      the app; open it in a browser
web/audio/          the five bundled soundtrack recordings
src/                the pieces worth editing on their own, spliced into the page by tools/splice.py
  frag.glsl           the fragment shader: the height map, the lights, every material
  heart.js            the excitable-tissue model
  quantum.js          the Schrödinger model
  mould.js            the slime-mould model
  stir.js             the flow that stirs the garden
  beats.js            the synth engine and the five beats
  style.css           the stylesheet
  panel.html          the control panel's markup, for reference
android/            the Android app: a WebView serving the page from a private https origin
tools/              calibration scripts for the models, an offline renderer for the beats, screenshots
```

The simulations run on the CPU in plain JavaScript on a grid of a few hundred cells a side; the renderer is WebGL 2, with a flat 2D fallback. There are no dependencies at runtime.

## Running it

Open `web/index.html`. Everything works from a local file except the microphone and screen sharing, which browsers allow only on `https` pages and on files opened directly in Chrome.

Size, in the Look tab, sets how big the patterns grow: Large, Medium or Small, with the dish always filling the window. In the garden, a smaller size slows diffusion instead of adding cells (by the square of the scale, which shrinks every length in the pattern by the scale), so it costs nothing to run; much below half size, spots and stripes are only a few cells across and lock to the grid's square cells. Seeds, the brush and photo dots shrink with the pattern. A growing garden reshapes itself to a new size, except from Large to Small: full-size spots would starve at half size, so the dish is redrawn at half size at once, twice over each way. The heart's wave fronts, the quantum dish's waves and the mould's veins are already only a few cells across, and slowing them down would push them below what the grid can hold (the heart's waves stop spreading at the top of the threshold slider), so these three zoom out on a finer grid instead: Medium has about twice the cells and Small four times, so a step at Small takes about four times the work, and a slow machine takes fewer steps a frame to keep up. A new size starts them again on the new grid, set up as their last preset set them up, with the sliders where they were.

Light, also in the Look tab, chooses what lights the dish. Studio is the room's own light, as it always was; on a phone, tilting it moves the light. Lamp hangs one warm lamp over the dish and Stage three coloured ones, red, green and blue; drag a lamp to move it, and the lamp height slider sets how high they hang, so a low lamp lights a small pool and throws long shadows. Sun is a low sun that goes round the dish once every 48 seconds, rising and sinking between 11 and 37 degrees. Under lamps and the sun the shadows are ray-traced: the dish is a height map, and every pixel follows a ray toward each light, in up to 21 steps that start a third of a cell apart and grow by a fifth each time, to see whether a dome rises into it, softening the shadow's edge by how big the light looks from there. The rays read a smooth copy of the heights drawn first at twice the grid's resolution; read straight off the grid, every shadow's edge was ragged a cell at a time. Stage costs up to 63 extra texture reads a pixel, which a slow graphics chip may feel. Where all three stage lamps reach, they add up to about one lamp's white, so a dome that hides one of them throws a shadow in the colour of the other two. Glass, Prism, Ice, Wax and Iridescent let light through: a ray crossing one of their domes is tinted by the dome's colour and dimmed by how far it travels inside it (Beer and Lambert's law: each colour fades exponentially with the path, faster the less of it the dome lets through), so their shadows come out coloured. Glass and Prism also act as lenses, gathering the light toward the middle of the shadow and leaving its rim darker, and Prism bends blue a little further than red; Ice and Wax scatter the light, so their shadows are soft, and Wax lets the least through. To do this the copy of the heights also carries each dome's colour. The glowing materials (Neon, Fire, Electricity, Contour) keep most of their own light. The page remembers the size, the light, the lamps' places and height, the dish, the colours, the material and the tab from one visit to the next.

To edit a model, the shader or the beats, change the file in `src/` and run `python3 tools/splice.py` to put it back into the page. `python3 tools/splice.py --check` tells you whether the page and `src/` agree.

## The Android app

`android/` holds a tiny app: one activity, one WebView, the page served out of the app's assets as if it came from `https://garden.app/` so the browser treats it as secure and lets it use the microphone. It asks for the mic the first time you tap Listen to the room, follows the phone's light or dark setting, keeps the screen awake, goes edge to edge in full-screen mode, and does not reload the dish when you rotate the phone.

It builds without Gradle, with the classic tools:

```
sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk-headless python3-pil
KEYSTORE=/path/to/garden.keystore KEYSTORE_PASS=yourpassword ./android/build.sh
```

The result is `android/build/garden.apk`, including about 28 MB of soundtrack recordings. Android updates an app in place only when every build is signed with the same key, so keep the keystore outside the repository and point the build at it; without one the script makes a fresh key, which installs as a new app rather than an update.

## Checking the physics

Run `npm run check` to verify the generated page and `npm test` for Current chemistry, browser recovery/input, soundtrack playback, and responsive UI regressions. Install the test browser with `npx playwright install chromium`. `python3 tests/android-assets.test.py` checks Android asset staging without requiring a full Android SDK; building and testing the APK on a device remains a separate check.

```
npm install
node tools/calibrate-heart.js      wave speed and width, spiral period, whether a shock quiets fibrillation
node tools/calibrate-quantum.js    packet speed and norm, double-slit fringes, tunnelling, the trap's orbit, rewinding
node tools/calibrate-mould.js      trail laid, dish covered, pieces of network, food reached; draws each preset to tools/out
node tools/render-beats.js         renders each beat to tools/out/*.wav with levels
node tools/screenshot.js quantum "Double slit" Contour dark
```

The heart runs at `a = 0.75, b = 0.06, ε = 0.02, dt = 0.05, D = 5` with a slowed recovery variable so waves are a few cells wide; a plane wave moves about 3.2 cells per time unit and a spiral turns every 9. The quantum dish uses `ħ = m = 1`, one cell per unit of length, `dt = 0.1`, and is stable for walls up to the barrier slider's maximum because `dt · (4 + V) < 2`.

## Credits

Alan Turing proposed reaction–diffusion as a mechanism for pattern formation in 1952; the Gray–Scott presets follow John Pearson's 1993 survey. The heart is Dwight Barkley's 1991 model. The quantum scheme is P. B. Visscher's from 1991. The slime mould is Jeff Jones's 2010 model, and the Railway preset is after Tero, Nakagaki and colleagues' 2010 Tokyo experiment. The stirring is Jos Stam's 1999 stable fluids. The page, the materials, the app and the beats were made in conversation with Claude.

## License

MIT. See `LICENSE`.
