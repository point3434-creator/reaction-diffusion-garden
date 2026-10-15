# Garden soundtrack recordings

The player expects these exact files in this directory:

- Liquid_Bloom.mp3
- Mycelium_Dream_Violin.mp3
- Prism_Orchard.mp3
- Neon_Thistle.mp3
- Velvet_Circuit.mp3

All five original MP3 recordings are bundled here. Choose a track under Garden soundtrack in the Sound tab and press Play. The web app and Android asset build use these same files; the five synthesized beats remain available below them.

To restore the recordings from the original downloaded HTML, run:

```sh
python tools/import-garden-audio.py /path/to/Reaction_Diffusion_Garden_Velvet_Circuit.html
```

The Sound tab also supports replacing recordings locally from your device without uploading them anywhere. Keep the entire `web/` folder together when distributing the app so the relative `audio/` paths remain available.
