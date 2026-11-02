#!/usr/bin/env python3
"""Execute focused path-tracing checks with native surfaceless EGL and GLES 3.

Optional local complement to the required Playwright browser suite:
    python3 tests/pathtrace-egl.test.py

Requires native libEGL with an OpenGL ES 3 implementation (Mesa llvmpipe works).
No Python packages are required. Missing libraries or unavailable contexts fail
explicitly; this script never reports an unavailable renderer as a passed test.
It does not cover DOM controls, WebGL extension availability, or context recovery.
"""
import argparse
import ctypes as C
import json
import math
import os
import sys
from pathlib import Path
import re

os.environ.setdefault('EGL_PLATFORM', 'surfaceless')
os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE', '1')
os.environ.setdefault('MESA_SHADER_CACHE_DIR', '/tmp/rdg-mesa-shader-cache')
P, I, U, F = C.c_void_p, C.c_int, C.c_uint, C.c_float
IP, UP, FP = C.POINTER(I), C.POINTER(U), C.POINTER(F)


class GLES:
    def __init__(self):
        self.egl = C.CDLL('libEGL.so.1')
        for name, result, args in [
            ('eglGetDisplay', P, [P]), ('eglInitialize', U, [P, IP, IP]),
            ('eglGetError', U, []), ('eglBindAPI', U, [U]),
            ('eglChooseConfig', U, [P, IP, C.POINTER(P), I, IP]),
            ('eglCreateContext', P, [P, P, P, IP]),
            ('eglMakeCurrent', U, [P, P, P, P]),
            ('eglGetProcAddress', P, [C.c_char_p]),
            ('eglDestroyContext', U, [P, P]), ('eglTerminate', U, [P]),
        ]:
            f = getattr(self.egl, name)
            f.restype, f.argtypes = result, args
        self.display = self.egl.eglGetDisplay(None)
        major, minor = I(), I()
        assert self.egl.eglInitialize(self.display, C.byref(major), C.byref(minor)), hex(self.egl.eglGetError())
        assert self.egl.eglBindAPI(0x30A0)
        attrs = (I * 13)(0x3040, 0x40, 0x3033, 1, 0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3021, 8, 0x3038)
        config, count = P(), I()
        assert self.egl.eglChooseConfig(self.display, attrs, C.byref(config), 1, C.byref(count)) and count.value
        self.context = self.egl.eglCreateContext(self.display, config, None, (I * 3)(0x3098, 3, 0x3038))
        assert self.context, hex(self.egl.eglGetError())
        assert self.egl.eglMakeCurrent(self.display, None, None, self.context), hex(self.egl.eglGetError())
        self.functions = {}
        self.info = {'egl': f'{major.value}.{minor.value}'}
        for key, enum in [('vendor', 0x1F00), ('renderer', 0x1F01), ('version', 0x1F02), ('glsl', 0x8B8C)]:
            self.info[key] = self.fn('glGetString', C.c_char_p, U)(enum).decode()

    def fn(self, name, result, *args):
        if name not in self.functions:
            address = self.egl.eglGetProcAddress(name.encode())
            assert address, f'{name} unavailable'
            self.functions[name] = C.CFUNCTYPE(result, *args)(address)
        return self.functions[name]

    def error(self, stage):
        result = self.fn('glGetError', U)()
        assert result == 0, f'{stage}: GL error {hex(result)}'

    def compile(self, kind, source):
        shader = self.fn('glCreateShader', U, U)(kind)
        text = source.encode()
        ptr = C.c_char_p(text)
        length = I(len(text))
        self.fn('glShaderSource', None, U, I, C.POINTER(C.c_char_p), IP)(shader, 1, C.byref(ptr), C.byref(length))
        self.fn('glCompileShader', None, U)(shader)
        status, log_length = I(), I()
        self.fn('glGetShaderiv', None, U, U, IP)(shader, 0x8B81, C.byref(status))
        self.fn('glGetShaderiv', None, U, U, IP)(shader, 0x8B84, C.byref(log_length))
        log = C.create_string_buffer(max(1, log_length.value))
        self.fn('glGetShaderInfoLog', None, U, I, IP, P)(shader, len(log), None, log)
        assert status.value, log.value.decode()
        return shader, log.value.decode()

    def program(self, vertex, fragment):
        program = self.fn('glCreateProgram', U)()
        self.compile_logs = []
        for kind, source in [(0x8B31, vertex), (0x8B30, fragment)]:
            shader, log = self.compile(kind, source)
            self.compile_logs.append(log)
            self.fn('glAttachShader', None, U, U)(program, shader)
        self.fn('glLinkProgram', None, U)(program)
        status, length = I(), I()
        self.fn('glGetProgramiv', None, U, U, IP)(program, 0x8B82, C.byref(status))
        self.fn('glGetProgramiv', None, U, U, IP)(program, 0x8B84, C.byref(length))
        log = C.create_string_buffer(max(1, length.value))
        self.fn('glGetProgramInfoLog', None, U, I, IP, P)(program, len(log), None, log)
        assert status.value, log.value.decode()
        self.fn('glUseProgram', None, U)(program)
        self.prog = program
        self.uniforms = {}
        count = I()
        self.fn('glGetProgramiv', None, U, U, IP)(program, 0x8B86, C.byref(count))
        for index in range(count.value):
            name, size, typ, n = C.create_string_buffer(256), I(), U(), I()
            self.fn('glGetActiveUniform', None, U, U, I, IP, IP, UP, P)(program, index, 256, C.byref(n), C.byref(size), C.byref(typ), name)
            self.uniforms[name.value.decode().removesuffix('[0]')] = (typ.value, size.value)
        return program

    def uniform(self, name, value):
        if name not in self.uniforms:
            return
        typ, size = self.uniforms[name]
        loc = self.fn('glGetUniformLocation', I, U, C.c_char_p)(self.prog, name.encode())
        floats = {0x1406: 1, 0x8B50: 2, 0x8B51: 3, 0x8B52: 4}
        ints = {0x1404: 1, 0x8B53: 2, 0x8B54: 3, 0x8B55: 4, 0x8B56: 1, 0x8B5E: 1}
        values = value if isinstance(value, list) else [value]
        if typ in floats:
            components = floats[typ]
            assert len(values) == components * size, (name, typ, size, value)
            self.fn(f'glUniform{components}fv', None, I, I, FP)(loc, size, (F * len(values))(*values))
        elif typ in ints:
            components = ints[typ]
            assert len(values) == components * size, (name, typ, size, value)
            self.fn(f'glUniform{components}iv', None, I, I, IP)(loc, size, (I * len(values))(*values))
        elif typ == 0x1405:
            self.fn('glUniform1uiv', None, I, I, UP)(loc, size, (U * len(values))(*values))
        else:
            raise AssertionError(f'Unsupported uniform type {name}: {hex(typ)}')

    def texture(self, unit, width, height, values=None, floating=False, target_float=False):
        texture = U()
        self.fn('glGenTextures', None, I, UP)(1, C.byref(texture))
        self.bind(unit, texture.value)
        for enum, value in [(0x2801, 0x2600 if target_float else 0x2601), (0x2800, 0x2600 if target_float else 0x2601), (0x2802, 0x812F), (0x2803, 0x812F)]:
            self.fn('glTexParameteri', None, U, U, I)(0x0DE1, enum, value)
        array = None if values is None else ((F if floating or target_float else C.c_ubyte) * len(values))(*values)
        internal = 0x8814 if target_float else (0x881A if floating else 0x8058)
        self.fn('glTexImage2D', None, U, I, I, I, I, I, U, U, P)(0x0DE1, 0, internal, width, height, 0, 0x1908, 0x1406 if floating or target_float else 0x1401, array)
        self.error('texture allocation')
        return texture.value

    def bind(self, unit, texture):
        self.fn('glActiveTexture', None, U)(0x84C0 + unit)
        self.fn('glBindTexture', None, U, U)(0x0DE1, texture)

    def framebuffer(self, texture):
        fbo = U()
        self.fn('glGenFramebuffers', None, I, UP)(1, C.byref(fbo))
        self.fn('glBindFramebuffer', None, U, U)(0x8D40, fbo.value)
        self.fn('glFramebufferTexture2D', None, U, U, U, U, I)(0x8D40, 0x8CE0, 0x0DE1, texture, 0)
        status = self.fn('glCheckFramebufferStatus', U, U)(0x8D40)
        assert status == 0x8CD5, f'Framebuffer status {hex(status)}'
        return fbo.value

    def triangle(self):
        vertices = (F * 6)(-1, -1, 3, -1, -1, 3)
        buffer = U()
        self.fn('glGenBuffers', None, I, UP)(1, C.byref(buffer))
        self.fn('glBindBuffer', None, U, U)(0x8892, buffer.value)
        self.fn('glBufferData', None, U, C.c_ssize_t, P, U)(0x8892, C.sizeof(vertices), vertices, 0x88E4)
        loc = self.fn('glGetAttribLocation', I, U, C.c_char_p)(self.prog, b'aPos')
        assert loc >= 0
        self.fn('glEnableVertexAttribArray', None, U)(loc)
        self.fn('glVertexAttribPointer', None, U, I, U, C.c_ubyte, I, P)(loc, 2, 0x1406, 0, 0, None)

    def draw(self, fbo, width, height):
        self.fn('glBindFramebuffer', None, U, U)(0x8D40, fbo)
        self.fn('glViewport', None, I, I, I, I)(0, 0, width, height)
        self.fn('glDrawArrays', None, U, I, I)(0x0004, 0, 3)
        self.error('draw')

    def read(self, width, height):
        data = (F * (width * height * 4))()
        self.fn('glReadPixels', None, I, I, I, I, U, U, P)(0, 0, width, height, 0x1908, 0x1406, data)
        self.error('readback')
        return list(data)

    def close(self):
        self.egl.eglMakeCurrent(self.display, None, None, None)
        self.egl.eglDestroyContext(self.display, self.context)
        self.egl.eglTerminate(self.display)


class ShaderChecks:
    def __init__(self, root):
        html = (root / 'web/index.html').read_text()
        self.vertex = json.loads(re.search(r'var VERT = (".*?");', html).group(1))
        shader = root / 'src/pathtrace.glsl'
        if not shader.is_file():
            raise RuntimeError(f'Required shader is missing: {shader}')
        self.source = shader.read_text()
        main = re.search(r'\bvoid\s+main\s*\(\s*\)\s*\{', self.source)
        if not main:
            raise RuntimeError('Path-tracing shader has no main function')
        self.functions = self.source[:main.start()]
        self.gl = GLES()
        self.passed = 0
        print('Native renderer: ' + json.dumps(self.gl.info), flush=True)

    def program(self, source):
        self.gl.program(self.vertex, source)
        self.gl.triangle()
        self.gl.uniform('uSurface', 0)
        self.gl.uniform('uPrevious', 1)

    def surface(self, height_at, bump=4, span=(16, 12), cells=(5, 4)):
        # Rows are stored in GL order; the contract maps world Y downward and
        # flips texel Y. A plane varying in both X and Y detects orientation bugs.
        values = []
        for row in range(cells[1]):
            y = (cells[1] - 1 - row) * span[1] / (cells[1] - 1)
            for col in range(cells[0]):
                x = col * span[0] / (cells[0] - 1)
                values.extend((height_at(x, y) / bump, 0.8, 0.3, 0.12))
        self.gl.texture(0, *cells, values, floating=True)
        self.gl.uniform('uBump', bump)
        self.gl.uniform('uTexSize', list(span))

    def output(self, width, height):
        texture = self.gl.texture(2, width, height, target_float=True)
        return self.gl.framebuffer(texture)

    def pass_check(self, name):
        self.passed += 1
        print('PASS ' + name, flush=True)

    @staticmethod
    def number(x):
        return format(float(x), '.9g') + ('.0' if '.' not in format(float(x), '.9g') and 'e' not in format(float(x), '.9g') else '')

    @classmethod
    def vector(cls, values):
        return 'vec3(' + ','.join(cls.number(v) for v in values) + ')'

    @staticmethod
    def near(actual, expected, label, tolerance=2e-4):
        assert math.isfinite(actual), f'{label}: nonfinite {actual}'
        assert math.isclose(actual, expected, rel_tol=tolerance, abs_tol=tolerance), f'{label}: expected {expected}, got {actual}'

    def rays(self, name, cases, height_at, function='traceSolid', setup=None):
        origins = ','.join(self.vector(case['origin']) for case in cases)
        directions = ','.join(self.vector(case['direction']) for case in cases)
        distances = ','.join(self.number(case.get('max', 100)) for case in cases)
        count = len(cases)
        main = f'''
void main() {{
  const vec3 origins[{count}] = vec3[{count}]({origins});
  const vec3 directions[{count}] = vec3[{count}]({directions});
  const float distances[{count}] = float[{count}]({distances});
  int i = int(gl_FragCoord.x);
  RayHit hit;
  bool exhausted = false;
  bool found = {function}(origins[i], directions[i], distances[i], hit, exhausted);
  if (int(gl_FragCoord.y) == 0) outColor = found ? vec4(hit.t, hit.normal) : vec4(-1.0);
  else outColor = vec4(found ? 1.0 : 0.0, exhausted ? 1.0 : 0.0, found ? float(hit.kind) : -1.0, 1.0);
}}
'''
        self.program(self.functions + main)
        self.surface(height_at)
        if setup:
            for uniform, value in setup.items():
                self.gl.uniform(uniform, value)
        fbo = self.output(count, 2)
        self.gl.draw(fbo, count, 2)
        pixels = self.gl.read(count, 2)
        for index, case in enumerate(cases):
            first = pixels[index * 4:index * 4 + 4]
            second = pixels[(count + index) * 4:(count + index) * 4 + 4]
            label = name + ': ' + case['name']
            found = case.get('t') is not None
            assert bool(second[0]) == found, f'{label}: hit={bool(second[0])}, expected {found}'
            assert second[1] == 0, f'{label}: unexpectedly exhausted traversal'
            if found:
                self.near(first[0], case['t'], label + ' distance')
                for axis, (actual, expected) in enumerate(zip(first[1:], case.get('normal', first[1:]))):
                    self.near(actual, expected, label + f' normal[{axis}]')
                assert int(second[2]) == case.get('kind', 0), f'{label}: hit kind {second[2]}'
        self.pass_check(name + f' ({count} independent rays)')

    def geometry(self):
        cases = [
            {'name': 'top from above', 'origin': (7, 5, 5), 'direction': (0, 0, -1), 't': 3, 'normal': (0, 0, 1)},
            {'name': 'top from inside', 'origin': (7, 5, 1), 'direction': (0, 0, 1), 't': 1, 'normal': (0, 0, 1)},
            {'name': 'base from below', 'origin': (7, 5, -2), 'direction': (0, 0, 1), 't': 2, 'normal': (0, 0, -1)},
            {'name': 'base from inside', 'origin': (7, 5, 1), 'direction': (0, 0, -1), 't': 1, 'normal': (0, 0, -1)},
            {'name': 'right exit', 'origin': (7, 5, 1), 'direction': (1, 0, 0), 't': 9, 'normal': (1, 0, 0)},
            {'name': 'left exit', 'origin': (7, 5, 1), 'direction': (-1, 0, 0), 't': 7, 'normal': (-1, 0, 0)},
            {'name': 'lower exit', 'origin': (7, 5, 1), 'direction': (0, 1, 0), 't': 7, 'normal': (0, 1, 0)},
            {'name': 'upper exit', 'origin': (7, 5, 1), 'direction': (0, -1, 0), 't': 5, 'normal': (0, -1, 0)},
            {'name': 'side entry', 'origin': (-2, 5, 1), 'direction': (1, 0, 0), 't': 2, 'normal': (-1, 0, 0)},
            {'name': 'horizontal ray above slab', 'origin': (-2, 5, 3), 'direction': (1, 0, 0)},
            {'name': 'ray points away', 'origin': (7, 5, 5), 'direction': (0, 0, 1)},
            {'name': 'intersection beyond tMax', 'origin': (7, 5, 5), 'direction': (0, 0, -1), 'max': 2.5},
        ]
        self.rays('Closed slab top, base, sides, misses, and distance limit', cases, lambda x, y: 2)

        slope_x, slope_y = 0.0625, 0.125
        height_at = lambda x, y: 1 + slope_x * x + slope_y * y
        norm = math.sqrt(1 + slope_x * slope_x + slope_y * slope_y)
        normal = (-slope_x / norm, -slope_y / norm, 1 / norm)
        slope_cases = []
        for x, y in [(5.5, 4.5), (6.5, 5.5), (3.25, 1.25), (3.25, 10.75)]:
            slope_cases.append({'name': f'vertical ray at {x},{y}', 'origin': (x, y, 6), 'direction': (0, 0, -1),
                                't': 6 - height_at(x, y), 'normal': normal})
        d = (0.5, 0.25, -1)
        length = math.sqrt(sum(v * v for v in d))
        direction = tuple(v / length for v in d)
        origin = (1, 1, 6)
        distance = (height_at(origin[0], origin[1]) - origin[2]) / (direction[2] - slope_x * direction[0] - slope_y * direction[1])
        slope_cases.append({'name': 'oblique ray', 'origin': origin, 'direction': direction, 't': distance, 'normal': normal})
        self.rays('Triangulated plane distances, normals, and Y orientation', slope_cases, height_at)

        scene_cases = [
            {'name': 'solid before floor', 'origin': (7, 5, 5), 'direction': (0, 0, -1), 't': 3, 'kind': 0},
            {'name': 'floor below base', 'origin': (7, 5, -0.1), 'direction': (0, 0, -1), 't': 0.25, 'kind': 1},
            {'name': 'light from above', 'origin': (4, 3, 10), 'direction': (0, 0, -1), 't': 2, 'kind': 2},
            {'name': 'light from below', 'origin': (4, 3, 6), 'direction': (0, 0, 1), 't': 2, 'kind': 2},
        ]
        self.rays('Scene nearest hits and double-sided area light', scene_cases, lambda x, y: 2, 'traceScene',
                  {'uLight': 1, 'uLamp': [0.25, 0.25, 8, 1, 0.75, 0.25, 8, 0, 0.5, 0.75, 8, 0]})

        # The scene contract bounds traversal to 1024 cells. This ray stays
        # above the flat slab but within the mesh bounds; its long version must
        # report uncertainty rather than claim that the unvisited cells are clear.
        self.program(self.functions + '''
void main() {
  RayHit hit;
  bool exhausted = false;
  float limit = gl_FragCoord.x < 1.0 ? 10.0 : 2000.0;
  bool found = traceScene(vec3(0.25, 0.5, 3.0), vec3(1.0, 0.0, 0.0), limit, hit, exhausted);
  outColor = vec4(found ? 1.0 : 0.0, exhausted ? 1.0 : 0.0, 0.0, 1.0);
}
''')
        self.surface(lambda x, y: 2, span=(1536, 1), cells=(1537, 2))
        self.gl.uniform('uLight', 0)
        fbo = self.output(2, 1)
        self.gl.draw(fbo, 2, 1)
        pixels = self.gl.read(2, 1)
        assert pixels[:2] == [0, 0], f'Short clear ray was not a definite miss: {pixels[:2]}'
        assert pixels[4:6] == [0, 1], f'Over-budget ray was treated as a definite miss: {pixels[4:6]}'
        self.pass_check('Traversal exhaustion stays distinct from a verified clear ray')

    def fresnel(self):
        # Exact unpolarized dielectric Fresnel equations provide an independent
        # oracle, including refraction from both sides of an interface.
        cases = [(1, 1, 1.5), (1, 1, 1), (1, 1.5, 1), (0, 1, 1.5), (0.5, 1.5, 1), (0.5, 1, 1.5)]
        args = ','.join(self.vector(case) for case in cases)
        main = f'''
void main() {{
  const vec3 args[{len(cases)}] = vec3[{len(cases)}]({args});
  vec3 a = args[int(gl_FragCoord.x)];
  outColor = vec4(fresnelDielectric(a.x, a.y, a.z), 0.0, 0.0, 1.0);
}}
'''
        self.program(self.functions + main)
        fbo = self.output(len(cases), 1)
        self.gl.draw(fbo, len(cases), 1)
        values = self.gl.read(len(cases), 1)[::4]
        for (cos_i, eta_i, eta_t), actual in zip(cases, values):
            sin_t_squared = (eta_i / eta_t) ** 2 * (1 - cos_i ** 2)
            if sin_t_squared >= 1:
                expected = 1
            else:
                cos_t = math.sqrt(1 - sin_t_squared)
                rs = (eta_i * cos_i - eta_t * cos_t) / (eta_i * cos_i + eta_t * cos_t)
                rp = (eta_t * cos_i - eta_i * cos_t) / (eta_t * cos_i + eta_i * cos_t)
                expected = (rs * rs + rp * rp) / 2
            self.near(actual, expected, f'Fresnel cos={cos_i}, {eta_i}->{eta_t}', 1e-5)
        self.pass_check('Dielectric Fresnel: normal incidence, equal indices, grazing, and total internal reflection')

    def chemical_floor(self):
        # Diagnose the production floor function directly: geometry, lighting,
        # and stochastic noise cannot hide missing chemical annotations. The
        # CPU field's first rows are the top of the dish, without a GL Y flip.
        self.program(self.functions + '''
void main() {
  vec2 uv = vec2(0.5, gl_FragCoord.x < 1.0 ? 0.25 : 0.75);
  outColor = vec4(floorTint(uv * uTexSize), 1.0);
}
''')
        self.surface(lambda x, y: 0)
        field_width, field_height = 8, 8
        field = self.gl.texture(3, field_width, field_height, [0] * (field_width * field_height * 4), floating=True)
        self.gl.uniform('uField', 3)
        self.gl.uniform('uMat', 0)
        fbo = self.output(2, 1)

        def render(chemistry, metadata):
            values = []
            for row in range(field_height):
                for column in range(field_width):
                    values.extend((0, 0, 0, metadata if row < field_height // 2 else 0))
            data = (F * len(values))(*values)
            self.gl.bind(3, field)
            self.gl.fn('glTexSubImage2D', None, U, I, I, I, I, I, U, U, P)(
                0x0DE1, 0, 0, 0, field_width, field_height, 0x1908, 0x1406, data)
            self.gl.uniform('uChem', chemistry)
            self.gl.draw(fbo, 2, 1)
            pixels = self.gl.read(2, 1)
            assert all(math.isfinite(value) and 0 <= value <= 1 for value in pixels), 'Invalid chemical floor color'
            return pixels[:3], pixels[4:7]

        cases = [(1, 'Heart scar', -1), (1, 'Heart recovery', 0.5),
                 (2, 'Quantum wall', -1), (2, 'Quantum potential', -0.2),
                 (3, 'Mould wall', -1), (3, 'Mould food', -0.2)]
        failures = []
        for theme, background in [(0, [0.03, 0.04, 0.06]), (1, [0.85, 0.82, 0.75])]:
            self.gl.uniform('uLightTheme', theme)
            self.gl.uniform('uBg', background)
            for chemistry, name, metadata in cases:
                baseline_top, baseline_bottom = render(chemistry, 0)
                marked_top, marked_bottom = render(chemistry, metadata)
                delta = max(abs(a - b) for a, b in zip(marked_top, baseline_top))
                if delta <= 1e-4:
                    failures.append(f'{name}, theme={theme}: metadata {metadata} leaves floor unchanged (delta={delta:.6g})')
                if max(abs(a - b) for a, b in zip(marked_bottom, baseline_bottom)) > 1e-6:
                    failures.append(f'{name}, theme={theme}: annotation leaked to unmarked lower half or Y was flipped')
            garden = render(0, 0)
            for metadata in [-1, -0.2, 0.5]:
                marked = render(0, metadata)
                if max(abs(a - b) for before, after in zip(garden, marked) for a, b in zip(before, after)) > 1e-6:
                    failures.append(f'Garden, theme={theme}: field alpha incorrectly changes floor color')
        assert not failures, '\n'.join(failures)
        self.pass_check('Heart, Quantum, and Mould floor annotations remain visible and correctly oriented in both themes')

    def rendering(self):
        self.program(self.source)
        width, height = 48, 36
        bump = 4
        self.surface(lambda x, y: 0.12 + 2.3 * math.exp(-((x - 6) ** 2 + (y - 5) ** 2) / 10)
                     + 1.5 * math.exp(-((x - 11) ** 2 + (y - 8) ** 2) / 6), bump=bump, cells=(17, 13))
        previous = self.gl.texture(1, width, height, [0] * (width * height * 4), target_float=True)
        fbo = self.output(width, height)
        defaults = {
            'uResolution': [width, height], 'uTilt': [0, 0], 'uGlow': 0.3, 'uLightTheme': 0,
            'uBg': [0.03, 0.04, 0.06], 'uMat': 0, 'uLight': 1, 'uBounces': 4, 'uSamples': 0, 'uSeed': 12345,
            'uLamp': [0.25, 0.25, 7, 1, 0.75, 0.35, 7, 1, 0.5, 0.8, 7, 1],
            'uLampCol': [8, 2, 1, 1, 5, 2, 1, 2, 8], 'uSun': [0.5, 0.70710678, 0.5], 'uSunCol': [1, 0.85, 0.65],
        }
        for uniform, value in defaults.items():
            self.gl.uniform(uniform, value)

        def render(samples=0, seed=12345, bounces=4, history=(0, 0, 0, 1)):
            data = (F * (width * height * 4))(*(list(history) * (width * height)))
            self.gl.bind(1, previous)
            self.gl.fn('glTexSubImage2D', None, U, I, I, I, I, I, U, U, P)(0x0DE1, 0, 0, 0, width, height, 0x1908, 0x1406, data)
            for uniform, value in [('uSamples', samples), ('uSeed', seed), ('uBounces', bounces)]:
                self.gl.uniform(uniform, value)
            self.gl.draw(fbo, width, height)
            result = self.gl.read(width, height)
            assert all(math.isfinite(v) for v in result), 'Path sample returned NaN or infinity'
            assert min(result) >= -1e-6, 'Path sample returned negative radiance'
            return result

        fresh = render()
        rgb = [value for index, value in enumerate(fresh) if index % 4 != 3]
        assert max(rgb) - min(rgb) > 0.01, 'Rendered image is empty or flat'
        assert max(rgb) > 1, 'Radiance was clipped or bright emitter did not render in the HDR target'
        assert all(abs(value - 1) < 1e-6 for value in fresh[3::4]), 'Unexpected output alpha'
        self.pass_check('Actual shader renders nontrivial finite, nonnegative, unclamped HDR pixels')

        stale = render(history=(13, 21, 34, 1))
        assert max(abs(a - b) for a, b in zip(fresh, stale)) < 1e-6, 'First sample depends on stale history'
        history = (3, 2, 1, 1)
        averaged = render(samples=4, history=history)
        for index, value in enumerate(averaged):
            expected = (4 * history[index % 4] + fresh[index]) / 5
            self.near(value, expected, f'Running mean component {index}', 2e-5)
        self.pass_check('Progressive accumulation ignores stale sample zero and computes the running mean')

        another_seed = render(seed=54321)
        assert max(abs(a - b) for a, b in zip(fresh, another_seed)) > 1e-4, 'Changing the sample seed had no effect'
        one_bounce = render(bounces=1)
        assert max(abs(a - b) for a, b in zip(fresh, one_bounce)) > 1e-4, 'Multiple bounces had no observable effect'
        self.pass_check('Stochastic seed and multiple bounces independently change the sampled radiance')

    def glass_transport(self):
        # A camera path through a closed glass slab reaches the floor, then must
        # cross the base and top again before it can collect environment light.
        # Four events cut off this common path; adding samples cannot repair it.
        # Use a wide, clear slab and central pixels to exclude side-wall escapes.
        self.program(self.source)
        width = height = 16
        self.surface(lambda x, y: 2, span=(256, 256), cells=(2, 2))
        self.gl.texture(0, 2, 2, [0.5, 1, 1, 1] * 4, floating=True)
        self.gl.texture(1, width, height, [0] * (width * height * 4), target_float=True)
        self.gl.texture(3, 1, 1, [0, 0, 0, 0], floating=True)
        fbo = self.output(width, height)
        for uniform, value in {
            'uField': 3, 'uChem': 0, 'uResolution': [width, height], 'uTilt': [0, 0],
            'uGlow': 0, 'uLightTheme': 1, 'uBg': [0.9, 0.9, 0.9], 'uMat': 0,
            'uLight': 0, 'uSamples': 0,
        }.items():
            self.gl.uniform(uniform, value)
        luminance = {4: [], 6: []}
        for seed in range(1, 17):
            self.gl.uniform('uSeed', seed)
            for depth in (4, 6):
                self.gl.uniform('uBounces', depth)
                self.gl.draw(fbo, width, height)
                pixels = self.gl.read(width, height)
                for y in range(4, 12):
                    for x in range(4, 12):
                        i = (y * width + x) * 4
                        value = sum(a * b for a, b in zip(pixels[i:i + 3], (0.2126, 0.7152, 0.0722)))
                        assert math.isfinite(value) and value >= 0, 'Invalid glass transport radiance'
                        luminance[depth].append(value)
        four, six = (sum(luminance[depth]) / len(luminance[depth]) for depth in (4, 6))
        recovered = sum(b > a + 1e-3 for a, b in zip(luminance[4], luminance[6])) / len(luminance[4])
        assert six > max(0.05, four * 3), f'Glass floor transport remains truncated: depth4={four:.6f}, depth6={six:.6f}'
        assert recovered > 0.5, f'Only {recovered:.1%} of central glass samples recovered floor illumination'
        self.pass_check(f'Six-event budget retains glass/floor/glass transport (1024 paired samples; luminance {four:.4f} -> {six:.4f})')

    def run(self):
        try:
            self.geometry()
            self.fresnel()
            self.chemical_floor()
            self.rendering()
            self.glass_transport()
            print(f'{self.passed} native path-tracing checks passed (GLES; browser suite remains required).', flush=True)
        finally:
            self.gl.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        ShaderChecks(args.root).run()
    except (AssertionError, OSError, RuntimeError) as error:
        print('FAIL native path-tracing checks: ' + str(error), file=sys.stderr, flush=True)
        raise SystemExit(1)

