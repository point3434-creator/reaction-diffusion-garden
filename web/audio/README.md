# Garden soundtrack recordings

The player expects these exact files in this directory:

- Liquid_Bloom.mp3
- Mycelium_Dream_Violin.mp3
- Prism_Orchard.mp3
- Neon_Thistle.mp3
- Velvet_Circuit.mp3

The recordings are not included in this commit: the available GitHub connector can commit source text but cannot transfer the large audio attachments from the chat runtime.

The supplied chat download `Garden_Audio_For_GitHub.zip` contains this `web/audio/` directory and all five original MP3s. Extract it at the repository root and commit the MP3s normally. Alternatively run:

```sh
python tools/import-garden-audio.py /path/to/Reaction_Diffusion_Garden_Liquid_Current_Glass_Garden.html
```

The Sound tab also supports loading the downloaded recordings directly from your device without uploading them anywhere. Existing synthesized beats remain available without these files.
