#!/usr/bin/env python3
"""Re-inline the editable sources into web/index.html.

The app ships as one file, web/index.html, so it can be opened anywhere and dropped into the
Android app's assets. The pieces that are easiest to work on in isolation live in src/ and are
spliced into the page by this script:

  src/style.css    -> the page's <style> block
  src/frag.glsl    -> the fragment shader (the `FRAG` template literal)
  src/heart.js     -> the excitable-tissue model
  src/quantum.js   -> the Schrödinger model
  src/beats.js     -> the beat engine and the five loops

Run with --check to see whether the page already matches src/ (exit code 1 if not).
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / 'web' / 'index.html'
SRC = ROOT / 'src'


def between(text, start, end, start_inclusive=True):
    a = text.index(start)
    if not start_inclusive:
        a += len(start)
    b = text.index(end, a + len(start))
    return a, b


def splice(html):
    # the stylesheet
    a, b = between(html, '<style>', '</style>', start_inclusive=False)
    html = html[:a] + '\n' + (SRC / 'style.css').read_text() + html[b:]
    # the shader
    frag = (SRC / 'frag.glsl').read_text().rstrip('\n')
    assert '`' not in frag and '${' not in frag, 'the shader must not contain backticks or ${'
    a = html.index('  var FRAG = `')
    b = html.index('\n`;', a) + len('\n`;')
    html = html[:a] + '  var FRAG = `' + frag + '\n`;' + html[b:]
    # the models and the beats, each delimited by the comment that opens the next block
    blocks = [
        ('heart.js', '// Excitable tissue (Barkley\'s model)', '// The Schrödinger equation on the same grid'),
        ('quantum.js', '// The Schrödinger equation on the same grid', '// A hue (degrees) as pigment shares that sum to 1.'),
        ('beats.js', '  // ---- beats: five original loops', '  // ---- tilt: the light stays put'),
    ]
    for name, start, end in blocks:
        src = (SRC / name).read_text()
        src = '\n'.join(l for l in src.split('\n') if not l.startswith("if (typeof module !== 'undefined') module.exports"))
        a, b = between(html, start, end)
        html = html[:a] + src.rstrip('\n') + '\n\n' + html[b:]
    return html


def main():
    html = PAGE.read_text()
    out = splice(html)
    if '--check' in sys.argv:
        if out == html:
            print('web/index.html matches src/')
            return 0
        print('web/index.html differs from src/; run tools/splice.py to update it')
        return 1
    PAGE.write_text(out)
    print('spliced src/ into web/index.html (%d bytes)' % len(out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
