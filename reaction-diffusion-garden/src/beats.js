  // ---- beats: five original loops, synthesized live, each an homage to a producer's feel ----
  // Nothing is sampled. Every drum, note and scratch is an oscillator or a burst of noise, shaped.
  var NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function N(s) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    return 12 * (parseInt(m[3], 10) + 1) + NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function ch() { return Array.prototype.map.call(arguments, N); }

  var BEATS = [
    {
      name: 'Drunk swing', after: 'J Dilla', bpm: 88, swing: 0.54,
      drums: { kick: 'x..x..x...x.....|x..x.....x..x...', snare: '....x.......x...|....x.......x..g', hat: 'x.x.x.xgx.x.x.x.|x.x.x.x.x.xgx.x.', ohat: '..............x.|................' },
      feel: { kickOff: [0, -22, 18, 8, -12], snareOff: 30, hatOff: -6, humanize: 8 },
      bus: { drumLP: 7500, musicLP: 3800, grit: 0.25, crackle: 0.6, verb: 0.08 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'F1', 3], [0, 6, 'F1', 2], [0, 10, 'Ab1', 1], [0, 12, 'F1', 3],
        [1, 0, 'Db1', 3], [1, 6, 'Db1', 2], [1, 11, 'Eb1', 1], [1, 12, 'Db1', 2],
        [2, 0, 'Bb1', 3], [2, 6, 'Bb1', 2], [2, 10, 'Db2', 1], [2, 12, 'Bb1', 3],
        [3, 0, 'C2', 3], [3, 6, 'C2', 2], [3, 10, 'Bb1', 1], [3, 12, 'C2', 2] ] },
      keys: { kind: 'rhodes', notes: [
        [0, 0, ch('F3', 'Ab3', 'C4', 'Eb4', 'G4'), 6], [0, 6, ch('F3', 'Ab3', 'C4', 'Eb4', 'G4'), 4],
        [1, 0, ch('Db3', 'F3', 'Ab3', 'C4'), 6], [1, 8, ch('Db3', 'F3', 'Ab3', 'C4'), 3],
        [2, 0, ch('Bb2', 'Db3', 'F3', 'Ab3', 'C4'), 6], [2, 6, ch('Bb2', 'Db3', 'F3', 'Ab3', 'C4'), 4],
        [3, 0, ch('C3', 'E3', 'G3', 'Bb3', 'Db4'), 6], [3, 8, ch('C3', 'E3', 'G3', 'Bb3'), 3] ] }
    },
    {
      name: 'G-funk', after: 'Dr. Dre', bpm: 93, swing: 0.5,
      drums: { kick: 'x......x..x.....|x......x..x..x..', snare: '....x.......x...|....x.......x...', clap: '....x.......x...|....x.......x...', hat: 'xgx.xgx.xgx.xgx.|xgx.xgx.xgx.xgxg', ohat: '................|..............x.' },
      feel: { kickOff: [0], snareOff: 0, hatOff: 0, humanize: 3 },
      bus: { drumLP: 12000, musicLP: 9000, grit: 0.08, crackle: 0, verb: 0.22 },
      bass: { kind: 'moog', notes: [
        [0, 0, 'G1', 3], [0, 3, 'G1', 1], [0, 6, 'Bb1', 2], [0, 10, 'G1', 2], [0, 14, 'F1', 1],
        [1, 0, 'G1', 3], [1, 3, 'G1', 1], [1, 6, 'Bb1', 2], [1, 10, 'G1', 2], [1, 14, 'F1', 1],
        [2, 0, 'Eb1', 3], [2, 3, 'Eb1', 1], [2, 6, 'G1', 2], [2, 10, 'Eb1', 2], [2, 14, 'F1', 1],
        [3, 0, 'F1', 3], [3, 3, 'F1', 1], [3, 6, 'A1', 2], [3, 10, 'F1', 2], [3, 12, 'F1', 1], [3, 14, 'D1', 1] ] },
      keys: { kind: 'stab', clean: true, notes: [
        [0, 2, ch('G3', 'Bb3', 'D4'), 1], [0, 6, ch('G3', 'Bb3', 'D4'), 1], [0, 10, ch('G3', 'Bb3', 'D4'), 1], [0, 14, ch('G3', 'Bb3', 'D4'), 1],
        [1, 2, ch('G3', 'Bb3', 'D4'), 1], [1, 6, ch('G3', 'Bb3', 'D4'), 1], [1, 10, ch('G3', 'Bb3', 'D4'), 1], [1, 14, ch('G3', 'Bb3', 'D4'), 1],
        [2, 2, ch('Eb3', 'G3', 'Bb3'), 1], [2, 6, ch('Eb3', 'G3', 'Bb3'), 1], [2, 10, ch('Eb3', 'G3', 'Bb3'), 1], [2, 14, ch('Eb3', 'G3', 'Bb3'), 1],
        [3, 2, ch('F3', 'A3', 'C4'), 1], [3, 6, ch('F3', 'A3', 'C4'), 1], [3, 10, ch('F3', 'A3', 'C4'), 1], [3, 14, ch('F3', 'A3', 'C4'), 1] ] },
      lead: [
        [0, 0, 'D5', 6, 0], [0, 6, 'F5', 4, 1], [0, 12, 'D5', 4, 1],
        [1, 0, 'G5', 4, 1], [1, 4, 'F5', 2, 1], [1, 6, 'D5', 6, 1], [1, 14, 'C5', 2, 1],
        [2, 0, 'D5', 8, 1], [2, 8, 'Bb4', 4, 1], [2, 12, 'C5', 4, 1],
        [3, 0, 'D5', 6, 1], [3, 8, 'G4', 8, 1] ]
    },
    {
      name: 'Chop & scratch', after: 'DJ Premier', bpm: 90, swing: 0.57,
      drums: { kick: 'x.....x.x.......|x.....x...x.x...', snare: '....x.......x...|....x.......x...', hat: 'x.x.x.x.x.x.x.x.|x.x.x.xgx.x.x.xg', ohat: '' },
      feel: { kickOff: [0, 6], snareOff: 10, hatOff: 0, humanize: 5 },
      bus: { drumLP: 9000, musicLP: 5500, grit: 0.35, crackle: 0.35, verb: 0.05 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'D1', 4], [0, 6, 'D1', 1], [0, 8, 'F1', 3],
        [1, 0, 'D1', 4], [1, 6, 'C1', 3], [1, 12, 'Bb1', 3],
        [2, 0, 'D1', 4], [2, 6, 'D1', 1], [2, 8, 'F1', 3],
        [3, 0, 'D1', 4], [3, 6, 'C1', 3], [3, 12, 'Bb1', 2] ] },
      keys: { kind: 'stab', notes: [
        [0, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [0, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [0, 6, ch('D3', 'F3', 'A3', 'C4'), 1], [0, 8, ch('F3', 'A3', 'C4'), 2], [0, 11, ch('F3', 'A3', 'C4'), 1], [0, 14, ch('D3', 'F3', 'A3', 'C4'), 1],
        [1, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [1, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [1, 6, ch('C3', 'E3', 'G3'), 2], [1, 10, ch('C3', 'E3', 'G3'), 1], [1, 12, ch('Bb2', 'D3', 'F3'), 2], [1, 14, ch('Bb2', 'D3', 'F3'), 1],
        [2, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [2, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [2, 6, ch('D3', 'F3', 'A3', 'C4'), 1], [2, 8, ch('F3', 'A3', 'C4'), 2], [2, 11, ch('F3', 'A3', 'C4'), 1], [2, 14, ch('D3', 'F3', 'A3', 'C4'), 1],
        [3, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [3, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [3, 6, ch('C3', 'E3', 'G3'), 2], [3, 10, ch('C3', 'E3', 'G3'), 1], [3, 12, ch('Bb2', 'D3', 'F3'), 1], [3, 13, ch('Bb2', 'D3', 'F3'), 1], [3, 14, ch('Bb2', 'D3', 'F3'), 1], [3, 15, ch('Bb2', 'D3', 'F3'), 1] ] },
      scratch: [[1, 14], [3, 8], [3, 9], [3, 10], [3, 11]]
    },
    {
      name: 'Shaolin dust', after: 'RZA', bpm: 86, swing: 0.53,
      drums: { kick: 'x.........x.....|x.....x...x.....', snare: '....x.......x...|....x.......x...', hat: 'x...x...x...x...|x...x.x.x...x...', ohat: '' },
      feel: { kickOff: [0, 14, -10], snareOff: 36, hatOff: 10, humanize: 16 },
      bus: { drumLP: 3800, musicLP: 3000, grit: 0.5, crackle: 0.9, verb: 0.12 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'C#1', 6], [0, 10, 'C#1', 3], [1, 0, 'C#1', 6], [1, 6, 'E1', 2], [1, 10, 'C#1', 3],
        [2, 0, 'A1', 6], [2, 10, 'A1', 3], [3, 0, 'G#1', 6], [3, 8, 'G#1', 2], [3, 12, 'G#1', 3] ] },
      piano: [
        [0, 0, 'C#4', 2], [0, 2, 'E4', 2], [0, 4, 'G#4', 4], [0, 8, 'G4', 2], [0, 10, 'E4', 2], [0, 12, 'C#4', 4],
        [1, 0, 'B3', 3], [1, 3, 'C#4', 3], [1, 6, 'A3', 2], [1, 8, 'B3', 4], [1, 12, 'C#4', 4],
        [2, 0, 'C#4', 2], [2, 2, 'E4', 2], [2, 4, 'G#4', 4], [2, 8, 'G4', 2], [2, 10, 'E4', 2], [2, 12, 'C#4', 4],
        [3, 0, 'B3', 3], [3, 3, 'C#4', 3], [3, 6, 'A3', 2], [3, 8, 'B3', 4], [3, 12, 'C#4', 4] ],
      strings: [[0, 0, ch('C#3', 'E3', 'G#3'), 32], [2, 0, ch('A2', 'C#3', 'E3'), 16], [3, 0, ch('G#2', 'C3', 'D#3', 'F#3'), 16]]
    },
    {
      name: 'Soul horns', after: 'Pete Rock', bpm: 95, swing: 0.58,
      drums: { kick: 'x..x......x.....|x..x.....x..x...', snare: '....x.......x...|....x.......x..g', hat: 'x.xgx.xgx.xgx.xg|x.xgx.xgx.xgx.xg', ohat: '..............x.|................' },
      feel: { kickOff: [0, -6, 10], snareOff: 12, hatOff: 0, humanize: 7 },
      bus: { drumLP: 8000, musicLP: 4500, grit: 0.2, crackle: 0.4, verb: 0.1 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'Eb1', 3], [0, 3, 'Eb1', 1], [0, 6, 'Bb1', 2], [0, 8, 'Eb1', 2], [0, 12, 'G1', 2], [0, 14, 'Ab1', 2],
        [1, 0, 'C2', 3], [1, 3, 'C2', 1], [1, 6, 'G1', 2], [1, 8, 'C2', 2], [1, 12, 'Eb2', 2], [1, 14, 'D2', 2],
        [2, 0, 'Ab1', 3], [2, 3, 'Ab1', 1], [2, 6, 'Eb2', 2], [2, 8, 'Ab1', 2], [2, 12, 'C2', 2], [2, 14, 'Bb1', 2],
        [3, 0, 'Bb1', 3], [3, 3, 'Bb1', 1], [3, 6, 'F2', 2], [3, 8, 'Bb1', 2], [3, 12, 'Ab1', 2], [3, 14, 'G1', 2] ] },
      keys: { kind: 'rhodes', warm: true, notes: [
        [0, 0, ch('Eb3', 'G3', 'Bb3', 'D4', 'F4'), 6], [0, 8, ch('Eb3', 'G3', 'Bb3', 'D4', 'F4'), 5],
        [1, 0, ch('C3', 'Eb3', 'G3', 'Bb3', 'D4'), 6], [1, 8, ch('C3', 'Eb3', 'G3', 'Bb3', 'D4'), 5],
        [2, 0, ch('Ab2', 'C3', 'Eb3', 'G3', 'Bb3'), 6], [2, 8, ch('Ab2', 'C3', 'Eb3', 'G3', 'Bb3'), 5],
        [3, 0, ch('Bb2', 'D3', 'Ab3', 'C4', 'G4'), 6], [3, 8, ch('Bb2', 'D3', 'Ab3', 'C4', 'G4'), 5] ] },
      horn: [[0, 0, ch('Eb4', 'G4'), 2], [0, 6, ch('Eb4', 'G4'), 1], [1, 0, ch('C4', 'Eb4'), 2],
             [2, 0, ch('C4', 'Eb4'), 2], [2, 6, ch('C4', 'Eb4'), 1], [2, 10, ch('Bb3', 'D4'), 1],
             [3, 0, ch('Bb3', 'D4'), 2], [3, 8, ch('F4', 'Ab4'), 2]]
    }
  ];

  var beats = { on: false, idx: -1, built: false, timer: null, step: 0, nextT: 0, bars: 4, lastLead: null };
  var bx = {};   // the studio's nodes

  function beatBuild() {
    if (beats.built) return;
    var ac = music.actx;
    bx.master = ac.createGain(); bx.master.gain.value = 0.8;
    bx.comp = ac.createDynamicsCompressor();
    bx.comp.threshold.value = -18; bx.comp.knee.value = 12; bx.comp.ratio.value = 3; bx.comp.attack.value = 0.004; bx.comp.release.value = 0.18;
    bx.out = ac.createGain(); bx.out.gain.value = 0.55;   // the compressor adds make-up gain; this takes it back
    bx.master.connect(bx.comp); bx.comp.connect(bx.out);
    bx.out.connect(music.analyser);
    bx.out.connect(ac.destination);
    // drums: through a tone filter and a touch of grit
    bx.drumLP = ac.createBiquadFilter(); bx.drumLP.type = 'lowpass'; bx.drumLP.Q.value = 0.5;
    bx.drumShape = ac.createWaveShaper(); bx.drumShape.curve = softCurve(0.2);
    bx.drums = ac.createGain(); bx.drums.gain.value = 1;
    bx.drums.connect(bx.drumLP); bx.drumLP.connect(bx.drumShape); bx.drumShape.connect(bx.master);
    // music: a warmer filter
    bx.musicLP = ac.createBiquadFilter(); bx.musicLP.type = 'lowpass'; bx.musicLP.Q.value = 0.7;
    bx.music = ac.createGain(); bx.music.gain.value = 0.9;
    bx.music.connect(bx.musicLP); bx.musicLP.connect(bx.master);
    // a short room, from a noise burst that decays
    bx.verb = ac.createConvolver(); bx.verb.buffer = impulse(ac, 1.1, 2.6);
    bx.verbGain = ac.createGain(); bx.verbGain.gain.value = 0.1;
    bx.verbSend = ac.createGain(); bx.verbSend.gain.value = 1;
    bx.verbSend.connect(bx.verb); bx.verb.connect(bx.verbGain); bx.verbGain.connect(bx.master);
    // vinyl crackle, looped
    bx.crackleGain = ac.createGain(); bx.crackleGain.gain.value = 0;
    bx.crackleGain.connect(bx.master);
    bx.noise = noiseBuffer(ac, 2.0);
    beats.built = true;
  }
  function softCurve(amount) {
    var n = 1024, c = new Float32Array(n), k = amount * 40 + 1;
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }
  function noiseBuffer(ac, secs) {
    var b = ac.createBuffer(1, Math.floor(ac.sampleRate * secs), ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function impulse(ac, secs, decay) {
    var len = Math.floor(ac.sampleRate * secs), b = ac.createBuffer(2, len, ac.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function crackleStart() {
    var ac = music.actx, B = BEATS[beats.idx];
    if (bx.crackle) { try { bx.crackle.stop(); } catch (e) {} }
    var len = Math.floor(ac.sampleRate * 3), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var r = Math.random();
      d[i] = r < 0.0008 ? (Math.random() * 2 - 1) * (0.3 + Math.random() * 0.7) : (Math.random() * 2 - 1) * 0.012;
    }
    var src = ac.createBufferSource(); src.buffer = b; src.loop = true;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    src.connect(lp); lp.connect(bx.crackleGain);
    bx.crackleGain.gain.value = 0.12 * B.bus.crackle;
    src.start();
    bx.crackle = src;
  }

  // ---- instruments; every one takes the time it should sound ----
  function env(g, t, a, peak, d, sustain, r, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(sustain * peak, t + a, d);
    g.gain.setTargetAtTime(0.0001, end, r);
  }
  function kick(t, vel, B) {
    var ac = music.actx, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    var lo = B.bus.drumLP < 5000 ? 42 : 48;
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(lo, t + 0.07);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.85 * vel, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.05, 0.14);
    o.connect(g); g.connect(bx.drums);
    // the click
    var n = ac.createBufferSource(), ng = ac.createGain(), hp = ac.createBiquadFilter();
    n.buffer = bx.noise; hp.type = 'bandpass'; hp.frequency.value = 2500; hp.Q.value = 0.8;
    ng.gain.setValueAtTime(0.2 * vel, t); ng.gain.setTargetAtTime(0.0001, t, 0.008);
    n.connect(hp); hp.connect(ng); ng.connect(bx.drums);
    o.start(t); o.stop(t + 0.7); n.start(t); n.stop(t + 0.05);
  }
  function snare(t, vel, B) {
    var ac = music.actx, n = ac.createBufferSource(), g = ac.createGain(), bp = ac.createBiquadFilter();
    n.buffer = bx.noise; bp.type = 'bandpass'; bp.frequency.value = B.bus.drumLP < 5000 ? 1600 : 2600; bp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.75 * vel, t + 0.003);
    g.gain.setTargetAtTime(0.0001, t + 0.01, 0.07);
    n.connect(bp); bp.connect(g); g.connect(bx.drums); g.connect(bx.verbSend);
    var o = ac.createOscillator(), og = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(B.bus.drumLP < 5000 ? 170 : 205, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    og.gain.setValueAtTime(0.45 * vel, t); og.gain.setTargetAtTime(0.0001, t + 0.01, 0.045);
    o.connect(og); og.connect(bx.drums);
    n.start(t); n.stop(t + 0.5); o.start(t); o.stop(t + 0.3);
  }
  function clap(t, vel) {
    var ac = music.actx;
    for (var i = 0; i < 3; i++) {
      var n = ac.createBufferSource(), g = ac.createGain(), bp = ac.createBiquadFilter();
      n.buffer = bx.noise; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.2;
      var tt = t + i * 0.011;
      g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.5 * vel, tt + 0.002);
      g.gain.setTargetAtTime(0.0001, tt + 0.004, i === 2 ? 0.09 : 0.012);
      n.connect(bp); bp.connect(g); g.connect(bx.drums); if (i === 2) g.connect(bx.verbSend);
      n.start(tt); n.stop(tt + 0.5);
    }
  }
  function hat(t, vel, open) {
    var ac = music.actx, n = ac.createBufferSource(), g = ac.createGain(), hp = ac.createBiquadFilter();
    n.buffer = bx.noise; hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * vel, t + 0.002);
    g.gain.setTargetAtTime(0.0001, t + 0.003, open ? 0.12 : 0.025);
    n.connect(hp); hp.connect(g); g.connect(bx.drums);
    n.start(t); n.stop(t + (open ? 0.7 : 0.2));
  }
  function bass(t, midi, dur, kind) {
    var ac = music.actx, f = hz(midi), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = kind === 'moog' ? 6 : 1;
    var o = ac.createOscillator(), o2 = ac.createOscillator();
    if (kind === 'moog') {
      o.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1200;
      lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(140, t + 0.25);
    } else {
      o.type = 'sine'; o2.type = 'triangle'; o2.detune.value = 3;
      lp.frequency.value = 320;
    }
    o.frequency.value = f; o2.frequency.value = f;
    var g2 = ac.createGain(); g2.gain.value = kind === 'moog' ? 0.5 : 0.35;
    var bl = kind === 'moog' ? 0.27 : 0.27;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(bl, t + 0.012);
    g.gain.setValueAtTime(bl, t + dur - 0.03);
    g.gain.setTargetAtTime(0.0001, t + dur - 0.03, 0.03);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bx.music);
    o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  function rhodes(t, midis, dur, warm) {
    var ac = music.actx;
    midis.forEach(function (m, i) {
      var f = hz(m), g = ac.createGain(), o = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o.detune.value = (i % 2 ? 4 : -4);
      o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = warm ? 0.12 : 0.22;
      var trem = ac.createOscillator(), tg = ac.createGain(); trem.frequency.value = 4.2; tg.gain.value = 0.12;
      trem.connect(tg); tg.connect(g.gain);
      var peak = 0.75 / Math.sqrt(midis.length);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.015);
      g.gain.setTargetAtTime(peak * 0.55, t + 0.015, 0.5);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bx.music); g.connect(bx.verbSend);
      o.start(t); o2.start(t); trem.start(t); o.stop(t + dur + 0.8); o2.stop(t + dur + 0.8); trem.stop(t + dur + 0.8);
    });
  }
  function stab(t, midis, dur, clean) {
    var ac = music.actx, g = ac.createGain(), bp = ac.createBiquadFilter(), sh = ac.createWaveShaper();
    bp.type = clean ? 'lowpass' : 'bandpass'; bp.frequency.value = clean ? 2600 : 1100; bp.Q.value = clean ? 0.8 : 1.6;
    sh.curve = softCurve(clean ? 0.05 : 0.6);
    midis.forEach(function (m, i) {
      var o = ac.createOscillator(), o2 = ac.createOscillator(), og = ac.createGain();
      o.type = clean ? 'triangle' : 'sawtooth'; o.frequency.value = hz(m); o.detune.value = i % 2 ? 6 : -6;
      o2.type = 'square'; o2.frequency.value = hz(m); og.gain.value = clean ? 0.15 : 0.35;
      o.connect(bp); o2.connect(og); og.connect(bp);
      o.start(t); o2.start(t); o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3);
    });
    var peak = (clean ? 0.85 : 1.05) / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.setTargetAtTime(peak * 0.4, t + 0.006, clean ? 0.12 : 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    bp.connect(sh); sh.connect(g); g.connect(bx.music); if (clean) g.connect(bx.verbSend);
  }
  function strings(t, midis, dur) {
    var ac = music.actx, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.5;
    var vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5; vg.gain.value = 6; vib.connect(vg);
    midis.forEach(function (m) {
      [-7, 7].forEach(function (d) {
        var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = d;
        vg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 1.0);
      });
    });
    var peak = 0.32 / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.45);
    g.gain.setValueAtTime(peak, t + dur - 0.3); g.gain.setTargetAtTime(0.0001, t + dur - 0.3, 0.35);
    lp.connect(g); g.connect(bx.music); g.connect(bx.verbSend);
    vib.start(t); vib.stop(t + dur + 1.0);
  }
  function piano(t, midi, dur) {
    var ac = music.actx, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2800;
    [-9, 9].forEach(function (d) {
      var o = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
      o.type = 'triangle'; o.frequency.value = hz(midi); o.detune.value = d;
      o2.type = 'sine'; o2.frequency.value = hz(midi) * 3; g2.gain.value = 0.06;
      o.connect(lp); o2.connect(g2); g2.connect(lp);
      o.start(t); o2.start(t); o.stop(t + 2.2); o2.stop(t + 2.2);
    });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.8, t + 0.005);
    g.gain.setTargetAtTime(0.0001, t + 0.03, Math.max(0.25, dur * 0.6));
    lp.connect(g); g.connect(bx.music); g.connect(bx.verbSend);
  }
  function lead(t, midi, dur, glide) {
    var ac = music.actx, f = hz(midi), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 1.5;
    var o = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
    o.type = 'sine'; o2.type = 'sawtooth'; g2.gain.value = 0.18;
    var from = glide && beats.lastLead ? hz(beats.lastLead) : f;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    o2.frequency.setValueAtTime(from, t); o2.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    var vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5.6; vg.gain.value = 9;
    vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.45, t + 0.03);
    g.gain.setValueAtTime(0.45, t + dur - 0.06); g.gain.setTargetAtTime(0.0001, t + dur - 0.06, 0.05);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bx.music); g.connect(bx.verbSend);
    o.start(t); o2.start(t); vib.start(t); o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3); vib.stop(t + dur + 0.3);
    beats.lastLead = midi;
  }
  function horn(t, midis, dur) {
    var ac = music.actx, g = ac.createGain(), bp = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.4;
    lp.type = 'lowpass'; lp.frequency.value = 3800;
    midis.forEach(function (m) {
      var o = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; g2.gain.value = 0.3;
      o.frequency.setValueAtTime(hz(m) * 0.89, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.07);
      o2.frequency.setValueAtTime(hz(m) * 0.89, t); o2.frequency.exponentialRampToValueAtTime(hz(m), t + 0.07);
      o.connect(bp); o2.connect(g2); g2.connect(bp);
      o.start(t); o2.start(t); o.stop(t + dur + 0.4); o2.stop(t + dur + 0.4);
    });
    var peak = 1.0 / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setTargetAtTime(peak * 0.5, t + 0.02, 0.18);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.09);
    bp.connect(lp); lp.connect(g); g.connect(bx.music); g.connect(bx.verbSend);
  }
  function scratch(t) {
    var ac = music.actx, n = ac.createBufferSource(), g = ac.createGain(), bp = ac.createBiquadFilter();
    n.buffer = bx.noise; bp.type = 'bandpass'; bp.Q.value = 5;
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.06); bp.frequency.exponentialRampToValueAtTime(500, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.01);
    g.gain.setValueAtTime(0.5, t + 0.06); g.gain.linearRampToValueAtTime(0.0001, t + 0.15);
    n.connect(bp); bp.connect(g); g.connect(bx.music);
    n.start(t); n.stop(t + 0.2);
  }

  // ---- the scheduler: a bar is 16 steps; drum strings are two bars that repeat; the music is four ----
  function pat(s) { return (s || '').replace(/[|\s]/g, ''); }
  function vel(ch) { return ch === 'x' ? 1 : ch === 'g' ? 0.45 : ch === 'o' ? 1 : 0; }
  function scheduleStep(step, t0) {
    var B = BEATS[beats.idx], ac = music.actx;
    var spb = 60 / B.bpm, st = spb / 4;
    var bar = Math.floor(step / 16) % beats.bars, s16 = step % 16, dstep = step % 32;
    var hum = B.feel.humanize / 1000;
    var sw = (s16 % 2 === 1) ? (2 * B.swing - 1) * st : 0;
    var t = t0 + sw;
    var d = B.drums, c;
    c = pat(d.kick)[dstep]; if (vel(c)) kick(t + B.feel.kickOff[Math.floor(step / 2) % B.feel.kickOff.length] / 1000 + (Math.random() - 0.5) * hum, vel(c), B);
    c = pat(d.snare)[dstep]; if (vel(c)) snare(t + B.feel.snareOff / 1000 + (Math.random() - 0.5) * hum, vel(c), B);
    c = pat(d.clap)[dstep]; if (vel(c)) clap(t + B.feel.snareOff / 1000 + 0.004, vel(c));
    c = pat(d.hat)[dstep]; if (vel(c)) hat(t + B.feel.hatOff / 1000 + (Math.random() - 0.5) * hum * 0.6, vel(c) * (0.8 + 0.2 * Math.random()), false);
    c = pat(d.ohat)[dstep]; if (vel(c)) hat(t + B.feel.hatOff / 1000, 0.8, true);
    function at(list, fn) {
      if (!list) return;
      for (var i = 0; i < list.length; i++) { var e = list[i]; if (e[0] === bar && e[1] === s16) fn(e); }
    }
    at(B.bass && B.bass.notes, function (e) { bass(t + 0.004, N(e[2]), e[3] * st, B.bass.kind); });
    at(B.keys && B.keys.notes, function (e) {
      if (B.keys.kind === 'rhodes') rhodes(t, e[2], e[3] * st, !!B.keys.warm);
      else stab(t, e[2], e[3] * st, !!B.keys.clean);
    });
    at(B.lead, function (e) { lead(t, N(e[2]), e[3] * st, e[4]); });
    at(B.piano, function (e) { piano(t + (Math.random() - 0.5) * hum, N(e[2]), e[3] * st); });
    at(B.strings, function (e) { strings(t, e[2], e[3] * st); });
    at(B.horn, function (e) { horn(t, e[2], e[3] * st); });
    at(B.scratch, function (e) { scratch(t); });
  }
  function beatTick() {
    var ac = music.actx, B = BEATS[beats.idx], st = 60 / B.bpm / 4;
    while (beats.nextT < ac.currentTime + 0.16) {
      scheduleStep(beats.step, beats.nextT);
      beats.step++;
      beats.nextT += st;
    }
  }
  function startBeat(i) {
    if (!ensureCtx()) { say('Audio is not available in this browser.'); return; }
    stopMusic();
    beatBuild();
    var B = BEATS[i];
    beats.idx = i; beats.on = true; beats.step = 0; beats.lastLead = null;
    beats.nextT = music.actx.currentTime + 0.08;
    bx.drumLP.frequency.value = B.bus.drumLP;
    bx.musicLP.frequency.value = B.bus.musicLP;
    bx.drumShape.curve = softCurve(B.bus.grit);
    bx.verbGain.gain.value = B.bus.verb;
    crackleStart();
    beats.timer = setInterval(beatTick, 30);
    beatTick();
    setMusicOn(true, 'beat');
    syncBeatChips();
    say('Playing ' + B.name + ', after ' + B.after);
  }
  function stopBeat() {
    if (!beats.on) return;
    beats.on = false;
    clearInterval(beats.timer); beats.timer = null;
    if (bx.crackle) { try { bx.crackle.stop(); } catch (e) {} bx.crackle = null; }
    beats.idx = -1;
    syncBeatChips();
  }
  function syncBeatChips() {
    var chips = $('beatChips').children;
    for (var i = 0; i < chips.length; i++) chips[i].setAttribute('aria-pressed', beats.on && i === beats.idx ? 'true' : 'false');
  }
  BEATS.forEach(function (B, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = B.name; b.title = 'After ' + B.after;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () { if (beats.on && beats.idx === i) { stopMusic(); } else startBeat(i); });
    $('beatChips').appendChild(b);
  });
