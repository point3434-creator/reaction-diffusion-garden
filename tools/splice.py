#!/usr/bin/env python3
"""Re-inline src/ into web/index.html, including the Liquid Current update.
Run with --check to detect a stale generated page. MP3s are kept in web/audio/.
Existing shader, stirring, physics and beat sources remain authoritative.
"""
import base64
import json
import pathlib
import re
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
    # Remove only our generated extension block, never the original application.
    html = re.sub(r'  // BEGIN GARDEN UPDATE\n.*?  // END GARDEN UPDATE\n\n', '', html, flags=re.S)
    a, b = between(html, '<style>', '</style>', start_inclusive=False)
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    css += '\n' + (SRC / 'garden-glass.css').read_text(encoding='utf-8')
    html = html[:a] + '\n' + css + html[b:]
    frag = (SRC / 'frag.glsl').read_text(encoding='utf-8').rstrip('\n')
    assert '`' not in frag and '${' not in frag, 'the shader must not contain backticks or ${'
    a = html.index('  var FRAG = `')
    b = html.index('\n`;', a) + len('\n`;')
    html = html[:a] + '  var FRAG = `' + frag + '\n`;' + html[b:]
    assets = SRC / 'crystal-shell-assets'
    manifest = json.loads((assets / 'manifest.json').read_text(encoding='utf-8'))
    textures = ['data:image/png;base64,' + base64.b64encode((assets / item['file']).read_bytes()).decode('ascii')
                for item in manifest['files']]
    amber = 'data:image/jpeg;base64,' + base64.b64encode((SRC / 'amber-flow-assets' / 'surface.jpg').read_bytes()).decode('ascii')
    texture_block = '  // BEGIN MATERIAL TEXTURES\n  var CRYSTAL_SHELL_TEXTURES = ' + json.dumps(textures) + ';\n'
    texture_block += '  var AMBER_FLOW_TEXTURE = ' + json.dumps(amber) + ';\n'
    texture_block += (SRC / 'material-textures.js').read_text(encoding='utf-8')
    texture_block += '  // END MATERIAL TEXTURES\n'
    html = re.sub(r'  // BEGIN MATERIAL TEXTURES\n.*?  // END MATERIAL TEXTURES\n', '', html, flags=re.S)
    html = html.replace('  var FRAG = `', texture_block + '  var FRAG = `')
    blocks = [
        ('heart.js', "// Excitable tissue (Barkley's model)", '// The Schrödinger equation on the same grid'),
        ('quantum.js', '// The Schrödinger equation on the same grid', "// A slime mould (Jones's agent model"),
        ('mould.js', "// A slime mould (Jones's agent model", '// Stirring: a fluid flow'),
        ('stir.js', '// Stirring: a fluid flow', '// A hue (degrees) as pigment shares that sum to 1.'),
        ('beats.js', '  // ---- beats:', '  // ---- tilt: the light stays put'),
    ]
    for name, start, end in blocks:
        src = (SRC / name).read_text(encoding='utf-8')
        src = '\n'.join(line for line in src.split('\n') if not line.startswith("if (typeof module !== 'undefined') module.exports"))
        a, b = between(html, start, end)
        html = html[:a] + src.rstrip('\n') + '\n\n' + html[b:]
    # Current uses the same photo seeding and snare-clearing operation as Garden.
    html = html.replace("sim.kind === 'garden' || sim.kind === 'mould'", "sim.kind === 'garden' || sim.kind === 'current' || sim.kind === 'mould'")
    html = re.sub(r"(function clearPatch\(strength\) \{\s*)if \(!sim \|\| sim.kind !== 'garden'\) return;", r"\1if (!sim || (sim.kind !== 'garden' && sim.kind !== 'current')) return;", html)
    current = (SRC / 'current.js').read_text(encoding='utf-8')
    current = '\n'.join(line for line in current.splitlines() if not line.startswith("if (typeof module !== 'undefined') module.exports"))
    update = (SRC / 'song-library.js').read_text(encoding='utf-8')
    update += '\n' + (SRC / 'garden-update.js').read_text(encoding='utf-8')
    update += '\n' + (SRC / 'panel-art.js').read_text(encoding='utf-8')
    cgl = (SRC / 'cgl.js').read_text(encoding='utf-8')
    cgl = '\n'.join(line for line in cgl.splitlines() if not line.startswith("if (typeof module !== 'undefined') module.exports"))
    audio_budget = (SRC / 'audio-render-budget.js').read_text(encoding='utf-8')
    audio_budget = '\n'.join(line for line in audio_budget.splitlines() if not line.startswith("if (typeof module !== 'undefined') module.exports"))
    block = '  // BEGIN GARDEN UPDATE\n' + audio_budget + '\n' + cgl + '\n' + current + '\n' + update + '\n  // END GARDEN UPDATE\n\n'
    marker = '  // ---- go ----'
    if html.count(marker) != 1:
        raise ValueError('Expected one application startup marker; refusing an ambiguous splice')
    return html.replace(marker, block + marker)


def main():
    html = PAGE.read_text(encoding='utf-8')
    out = splice(html)
    if '--check' in sys.argv:
        if out == html:
            print('web/index.html matches src/')
            return 0
        print('web/index.html differs from src/; run tools/splice.py to update it')
        return 1
    PAGE.write_text(out, encoding='utf-8')
    print('spliced src/ into web/index.html (%d bytes)' % len(out.encode('utf-8')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
