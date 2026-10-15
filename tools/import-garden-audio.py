#!/usr/bin/env python3
"""Copy the five soundtrack MP3s from a folder or extract them from the chat HTML.
Usage: python tools/import-garden-audio.py path/to/downloads-or-combined.html
Never changes music, uploads data, or commits files. Uses the Python standard library.
"""
import argparse
import base64
import json
import pathlib
import re

NAMES = ['Liquid_Bloom.mp3', 'Mycelium_Dream_Violin.mp3', 'Prism_Orchard.mp3', 'Neon_Thistle.mp3', 'Velvet_Circuit.mp3']
ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=pathlib.Path)
    args = parser.parse_args()
    source = args.source.expanduser()
    data = {}
    if source.is_dir():
        for name in NAMES:
            path = source / name
            if not path.is_file():
                parser.error('Missing recording: ' + str(path))
            data[name] = path.read_bytes()
    elif source.is_file() and source.suffix.lower() in ('.html', '.htm'):
        text = source.read_text(encoding='utf-8')
        match = re.search(r'var\s+library\s*=\s*(?=\[)', text)
        if not match:
            parser.error('No embedded soundtrack library found in this HTML')
        library, _ = json.JSONDecoder().raw_decode(text[match.end():])
        titles = ['Liquid Bloom', 'Mycelium Dream', 'Prism Orchard', 'Neon Thistle', 'Velvet Circuit']
        for title, name in zip(titles, NAMES):
            candidates = [track for track in library if track.get('title', '').startswith(title)]
            if len(candidates) != 1:
                parser.error('Missing or ambiguous track: ' + title)
            src = candidates[0].get('src', '')
            prefix = 'data:audio/mpeg;base64,'
            if not src.startswith(prefix):
                parser.error('Track is not an embedded MP3: ' + title)
            data[name] = base64.b64decode(src[len(prefix):], validate=True)
    else:
        parser.error('Supply a folder containing the MP3s or the combined HTML from chat')
    for name, audio in data.items():
        if len(audio) < 1000 or not (audio.startswith(b'ID3') or (audio[0] == 255 and audio[1] & 224 == 224)):
            parser.error('File is not an MP3: ' + name)
    destination = ROOT / 'web' / 'audio'
    destination.mkdir(parents=True, exist_ok=True)
    for name, audio in data.items():
        (destination / name).write_bytes(audio)
    print('Imported all five recordings into web/audio/. Review and commit them normally.')


if __name__ == '__main__':
    main()
