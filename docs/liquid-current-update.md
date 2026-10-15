# Liquid Current, glass UI and soundtrack integration

This change is based on main at 24d911ced1f33bf8ceafe5aecd3c376c8a05bd76. It preserves the newer shader transmission, existing stirring, other simulations and existing beat source rather than replacing the repository with the older standalone chat HTML.

## Included

- Current mode: real transport of A and all three pigment fields before the reaction-diffusion step, with flow/swirl controls and audio modulation.
- Fix for the missing `TAU` constant that crashed Current in the earlier chat HTML.
- Frosted green controls, contrasting text, and sparse non-interactive vine accents that disappear in full-screen mode.
- Five-track soundtrack selector connected to the existing audio route, with seeking, repeat, volume and local recording loading.
- Reproducible source splicing and seven Current numerical regression tests.

The flow is a prescribed artistic velocity field with bilinear semi-Lagrangian advection, not a full fluid solve and not guaranteed incompressible. Existing Garden stirring is unchanged.

## Build

```sh
python3 tools/splice.py
python3 tools/splice.py --check
node tests/current.test.js
```

Open the regenerated `web/index.html`. The branch build workflow also regenerates and commits that page without replacing existing sources.

## Remaining transfer

The five MP3 files are not in this commit. See `web/audio/README.md` for the audio bundle and importer. Prior chat-only revisions of the five live classic beats have not been transplanted over the newer repository beat engine in this patch. Those revised versions remain in the combined chat download.

No APK was produced by this change. Local testing covered the new code in the uploaded application; the branch build checks the current repository's source assembly separately.
