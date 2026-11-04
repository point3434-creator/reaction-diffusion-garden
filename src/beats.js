  // ---- beats: original loops, synthesized live for a hypnotic garden ----
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
      name: 'Dewdrop Swing', style: 'Floating keys & loose swing', bpm: 88, swing: 0.54,
      drums: { kick: 'x..x..x...x.....|x..x.....x..x...', snare: '....x.......x...|....x.......x..g', hat: 'x.x.x.xgx.x.x.x.|x.x.x.x.x.xgx.x.', ohat: '..............x.|................' },
      feel: { kickOff: [0, -22, 18, 8, -12], snareOff: 30, hatOff: -6, humanize: 8 },
      bus: { drumLP: 10500, musicLP: 5600, grit: 0.18, crackle: 0.18, verb: 0.09, drums: 1, music: 1.05, bass: 0.67 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'F1', 3], [0, 6, 'F1', 2], [0, 10, 'Ab1', 1], [0, 12, 'F1', 3],
        [1, 0, 'Db1', 3], [1, 6, 'Db1', 2], [1, 11, 'Eb1', 1], [1, 12, 'Db1', 2],
        [2, 0, 'Bb1', 3], [2, 6, 'Bb1', 2], [2, 10, 'Db2', 1], [2, 12, 'Bb1', 3],
        [3, 0, 'C2', 3], [3, 6, 'C2', 2], [3, 10, 'Bb1', 1], [3, 12, 'C2', 2] ] },
      keys: { kind: 'rhodes', notes: [
        [0, 0, ch('Ab3', 'C4', 'Eb4', 'G4'), 6], [0, 6, ch('Ab3', 'C4', 'Eb4', 'G4'), 4],
        [1, 0, ch('F3', 'Ab3', 'C4'), 6], [1, 8, ch('F3', 'Ab3', 'C4'), 3],
        [2, 0, ch('Db3', 'F3', 'Ab3', 'C4'), 6], [2, 6, ch('Db3', 'F3', 'Ab3', 'C4'), 4],
        [3, 0, ch('E3', 'G3', 'Bb3', 'Db4'), 6], [3, 8, ch('E3', 'G3', 'Bb3'), 3] ] }
    },
    {
      name: 'Sunlit Fern', style: 'Warm bass & drifting synths', bpm: 93, swing: 0.5,
      drums: { kick: 'x......x..x.....|x......x..x..x..', snare: '....x.......x...|....x.......x...', clap: '....x.......x...|....x.......x...', hat: 'xgx.xgx.xgx.xgx.|xgx.xgx.xgx.xgxg', ohat: '................|..............x.' },
      feel: { kickOff: [0], snareOff: 0, hatOff: 0, humanize: 3 },
      bus: { drumLP: 12500, musicLP: 8500, grit: 0.08, crackle: 0, verb: 0.12, drums: 0.9, music: 0.95, bass: 0.75 },
      bass: { kind: 'moog', notes: [
        [0, 0, 'G1', 3], [0, 3, 'G1', 1], [0, 6, 'Bb1', 2], [0, 10, 'G1', 2], [0, 14, 'F1', 1],
        [1, 0, 'G1', 3], [1, 3, 'G1', 1], [1, 6, 'Bb1', 2], [1, 10, 'G1', 2], [1, 14, 'F1', 1],
        [2, 0, 'Eb1', 3], [2, 3, 'Eb1', 1], [2, 6, 'G1', 2], [2, 10, 'Eb1', 2], [2, 14, 'F1', 1],
        [3, 0, 'F1', 3], [3, 3, 'F1', 1], [3, 6, 'A1', 2], [3, 10, 'F1', 2], [3, 12, 'F1', 1], [3, 14, 'D1', 1] ] },
      keys: { kind: 'stab', clean: true, notes: [
        [0, 2, ch('G3', 'Bb3', 'D4'), 1], [0, 6, ch('G3', 'Bb3', 'D4'), 1], [0, 10, ch('G3', 'Bb3', 'D4'), 1], [0, 14, ch('G3', 'Bb3', 'D4'), 1],
        [1, 2, ch('G3', 'Bb3', 'D4'), 1], [1, 6, ch('G3', 'Bb3', 'D4'), 1], [1, 10, ch('G3', 'Bb3', 'D4'), 1], [1, 14, ch('G3', 'Bb3', 'D4'), 1],
        [2, 2, ch('G3', 'Bb3', 'Eb4'), 1], [2, 6, ch('G3', 'Bb3', 'Eb4'), 1], [2, 10, ch('G3', 'Bb3', 'Eb4'), 1], [2, 14, ch('G3', 'Bb3', 'Eb4'), 1],
        [3, 2, ch('F3', 'A3', 'C4'), 1], [3, 6, ch('F3', 'A3', 'C4'), 1], [3, 10, ch('F3', 'A3', 'C4'), 1], [3, 14, ch('F3', 'A3', 'C4'), 1] ] },
      lead: [
        [0, 0, 'D5', 6, 0], [0, 6, 'F5', 4, 1], [0, 12, 'D5', 4, 1],
        [1, 0, 'G5', 4, 1], [1, 4, 'F5', 2, 1], [1, 6, 'D5', 6, 1], [1, 14, 'C5', 2, 1],
        [2, 0, 'D5', 8, 1], [2, 8, 'Bb4', 4, 1], [2, 12, 'C5', 4, 1],
        [3, 0, 'D5', 6, 1], [3, 8, 'G4', 8, 1] ]
    },
    {
      name: 'Bramble Breaks', style: 'Chopped keys & crisp breaks', bpm: 90, swing: 0.57,
      drums: { kick: 'x.....x.x.......|x.....x...x.x...', snare: '....x.......x...|....x.......x...', hat: 'x.x.x.x.x.x.x.x.|x.x.x.xgx.x.x.xg', ohat: '' },
      feel: { kickOff: [0, 6], snareOff: 10, hatOff: 0, humanize: 5 },
      bus: { drumLP: 11200, musicLP: 6500, grit: 0.24, crackle: 0.12, verb: 0.055, drums: 1, music: 1.05, bass: 0.7 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'D1', 4], [0, 6, 'D1', 1], [0, 8, 'F1', 3],
        [1, 0, 'D1', 4], [1, 6, 'C1', 3], [1, 12, 'Bb1', 3],
        [2, 0, 'D1', 4], [2, 6, 'D1', 1], [2, 8, 'F1', 3],
        [3, 0, 'D1', 4], [3, 6, 'C1', 3], [3, 12, 'Bb1', 2] ] },
      keys: { kind: 'stab', notes: [
        [0, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [0, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [0, 6, ch('D3', 'F3', 'A3', 'C4'), 1], [0, 8, ch('F3', 'A3', 'C4'), 2], [0, 11, ch('F3', 'A3', 'C4'), 1], [0, 14, ch('D3', 'F3', 'A3', 'C4'), 1],
        [1, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [1, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [1, 6, ch('C3', 'E3', 'G3'), 2], [1, 10, ch('C3', 'E3', 'G3'), 1], [1, 12, ch('F3', 'Bb3', 'D4'), 2], [1, 14, ch('F3', 'Bb3', 'D4'), 1],
        [2, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [2, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [2, 6, ch('D3', 'F3', 'A3', 'C4'), 1], [2, 8, ch('F3', 'A3', 'C4'), 2], [2, 11, ch('F3', 'A3', 'C4'), 1], [2, 14, ch('D3', 'F3', 'A3', 'C4'), 1],
        [3, 0, ch('D3', 'F3', 'A3', 'C4'), 2], [3, 3, ch('D3', 'F3', 'A3', 'C4'), 1], [3, 6, ch('C3', 'E3', 'G3'), 2], [3, 10, ch('C3', 'E3', 'G3'), 1], [3, 12, ch('F3', 'Bb3', 'D4'), 1], [3, 13, ch('F3', 'Bb3', 'D4'), 1], [3, 14, ch('F3', 'Bb3', 'D4'), 1], [3, 15, ch('F3', 'Bb3', 'D4'), 1] ] },
      scratch: [[1, 14], [3, 8], [3, 9], [3, 10], [3, 11]]
    },
    {
      name: 'Moonlit Moss', style: 'Nocturnal piano & misty strings', bpm: 86, swing: 0.53,
      drums: { kick: 'x.........x.....|x.....x...x.....', snare: '....x.......x...|....x.......x...', hat: 'x...x...x...x...|x...x.x.x...x...', ohat: '' },
      feel: { kickOff: [0, 14, -10], snareOff: 36, hatOff: 10, humanize: 16 },
      bus: { drumLP: 7800, musicLP: 5200, grit: 0.24, crackle: 0.22, verb: 0.13, drums: 1, music: 1, bass: 0.67 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'C#1', 6], [0, 10, 'C#1', 3], [1, 0, 'C#1', 6], [1, 6, 'E1', 2], [1, 10, 'C#1', 3],
        [2, 0, 'A1', 6], [2, 10, 'A1', 3], [3, 0, 'G#1', 6], [3, 8, 'G#1', 2], [3, 12, 'G#1', 3] ] },
      piano: [
        [0, 0, 'C#4', 2], [0, 2, 'E4', 2], [0, 4, 'G#4', 4], [0, 8, 'G4', 2], [0, 10, 'E4', 2], [0, 12, 'C#4', 4],
        [1, 0, 'B3', 3], [1, 3, 'C#4', 3], [1, 6, 'A3', 2], [1, 8, 'B3', 4], [1, 12, 'C#4', 4],
        [2, 0, 'C#4', 2], [2, 2, 'E4', 2], [2, 4, 'G#4', 4], [2, 8, 'G4', 2], [2, 10, 'E4', 2], [2, 12, 'C#4', 4],
        [3, 0, 'B3', 3], [3, 3, 'C#4', 3], [3, 6, 'A3', 2], [3, 8, 'B3', 4], [3, 12, 'C#4', 4] ],
      strings: [[0, 0, ch('E3', 'G#3', 'C#4'), 32], [2, 0, ch('E3', 'A3', 'C#4'), 16], [3, 0, ch('F#3', 'G#3', 'C4', 'D#4'), 16]]
    },
    {
      name: 'Marigold Brass', style: 'Soft brass & soulful swing', bpm: 95, swing: 0.58,
      drums: { kick: 'x..x......x.....|x..x.....x..x...', snare: '....x.......x...|....x.......x..g', hat: 'x.xgx.xgx.xgx.xg|x.xgx.xgx.xgx.xg', ohat: '..............x.|................' },
      feel: { kickOff: [0, -6, 10], snareOff: 12, hatOff: 0, humanize: 7 },
      bus: { drumLP: 10800, musicLP: 6800, grit: 0.14, crackle: 0.12, verb: 0.09, drums: 0.95, music: 1, bass: 0.67 },
      bass: { kind: 'sub', notes: [
        [0, 0, 'Eb1', 3], [0, 3, 'Eb1', 1], [0, 6, 'Bb1', 2], [0, 8, 'Eb1', 2], [0, 12, 'G1', 2], [0, 14, 'Ab1', 2],
        [1, 0, 'C2', 3], [1, 3, 'C2', 1], [1, 6, 'G1', 2], [1, 8, 'C2', 2], [1, 12, 'Eb2', 2], [1, 14, 'D2', 2],
        [2, 0, 'Ab1', 3], [2, 3, 'Ab1', 1], [2, 6, 'Eb2', 2], [2, 8, 'Ab1', 2], [2, 12, 'C2', 2], [2, 14, 'Bb1', 2],
        [3, 0, 'Bb1', 3], [3, 3, 'Bb1', 1], [3, 6, 'F2', 2], [3, 8, 'Bb1', 2], [3, 12, 'Ab1', 2], [3, 14, 'G1', 2] ] },
      keys: { kind: 'rhodes', warm: true, notes: [
        [0, 0, ch('G3', 'Bb3', 'D4', 'F4'), 4], [0, 8, ch('G3', 'Bb3', 'D4', 'F4'), 3],
        [1, 0, ch('Eb3', 'G3', 'Bb3', 'D4'), 4], [1, 8, ch('Eb3', 'G3', 'Bb3', 'D4'), 3],
        [2, 0, ch('Eb3', 'G3', 'Bb3', 'C4'), 4], [2, 8, ch('Eb3', 'G3', 'Bb3', 'C4'), 3],
        [3, 0, ch('Ab3', 'C4', 'D4', 'G4'), 4], [3, 8, ch('Ab3', 'C4', 'D4', 'G4'), 3] ] },
      horn: [[0, 2, ch('Eb4', 'G4'), 2], [0, 6, ch('Eb4', 'G4'), 1], [1, 2, ch('C4', 'Eb4'), 2],
             [2, 2, ch('C4', 'Eb4'), 2], [2, 6, ch('C4', 'Eb4'), 1], [2, 10, ch('Bb3', 'D4'), 1],
             [3, 2, ch('Bb3', 'D4'), 2], [3, 10, ch('F4', 'Ab4'), 2]]
    },
    {
      name: 'Neon Canopy', style: 'Clarinet, mellow horns & driving pulse', bpm: 126, swing: 0.5, bars: 8, leadKind: 'clarinet', hornKind: 'mellow',
      drums: { kick: 'x...x...x...x...|x...x...x...x...', snare: '', clap: '....x.......x...|....x.......x...', hat: 'x...x...x...x...|x...x...x...x..g', ohat: '..x...x...x...x.|..x...x...x...x.' },
      feel: { kickOff: [0], snareOff: 4, hatOff: 0, humanize: 2 },
      bus: { drumLP: 12000, musicLP: 7200, grit: 0.1, crackle: 0, verb: 0.11, drums: 1.12, music: 0.92, bass: 0.8 },
      // Bass answers each kick; the upper voices carry the changing chord colors.
      bass: { kind: 'sub', notes: [
        [0, 2, 'F1', 1.5], [0, 6, 'F1', 1.5], [0, 10, 'C2', 1.5], [0, 14, 'F1', 1.5],
        [1, 2, 'F1', 1.5], [1, 6, 'Ab1', 1.5], [1, 10, 'C2', 1.5], [1, 14, 'Eb2', 1], [1, 15, 'C2', 1],
        [2, 2, 'Db2', 1.5], [2, 6, 'Db2', 1.5], [2, 10, 'Ab1', 1.5], [2, 14, 'Db2', 1.5],
        [3, 2, 'Db2', 1.5], [3, 6, 'Ab1', 1.5], [3, 10, 'C2', 1.5], [3, 14, 'Eb2', 1.5],
        [4, 2, 'Ab1', 1.5], [4, 6, 'Ab1', 1.5], [4, 10, 'Eb2', 1.5], [4, 14, 'Ab1', 1.5],
        [5, 2, 'Ab1', 1.5], [5, 6, 'C2', 1.5], [5, 10, 'Eb2', 1.5], [5, 14, 'Bb1', 1], [5, 15, 'Ab1', 1],
        [6, 2, 'Eb2', 1.5], [6, 6, 'Eb2', 1.5], [6, 10, 'Bb1', 1.5], [6, 14, 'Eb2', 1.5],
        [7, 2, 'Eb2', 1.5], [7, 6, 'Bb1', 1.5], [7, 10, 'G1', 1.5], [7, 14, 'C2', 1.5] ] },
      keys: { kind: 'rhodes', warm: true, notes: [
        [0, 1, ch('Ab3', 'C4', 'Eb4', 'G4'), 8], [0, 11, ch('C4', 'Eb4', 'G4'), 3],
        [1, 1, ch('Ab3', 'C4', 'Eb4', 'G4'), 6], [1, 10, ch('C4', 'Eb4', 'G4'), 4],
        [2, 1, ch('Ab3', 'C4', 'Eb4', 'F4'), 8], [2, 11, ch('C4', 'Eb4', 'F4'), 3],
        [3, 1, ch('Ab3', 'C4', 'Eb4', 'F4'), 6], [3, 10, ch('C4', 'Eb4', 'F4'), 4],
        [4, 1, ch('Bb3', 'C4', 'Eb4', 'G4'), 8], [4, 11, ch('C4', 'Eb4', 'G4'), 3],
        [5, 1, ch('Bb3', 'C4', 'Eb4', 'G4'), 6], [5, 10, ch('C4', 'Eb4', 'G4'), 4],
        [6, 1, ch('G3', 'C4', 'F4', 'Bb4'), 8], [6, 11, ch('C4', 'F4', 'Bb4'), 3],
        [7, 1, ch('G3', 'C4', 'F4', 'Bb4'), 6], [7, 10, ch('C4', 'F4', 'Bb4'), 4] ] },
      lead: [
        [0, 3, 'C4', 2], [0, 7, 'Eb4', 3], [0, 13, 'G4', 2],
        [1, 5, 'F4', 3], [1, 11, 'Eb4', 3],
        [2, 3, 'C4', 2], [2, 7, 'Eb4', 3], [2, 13, 'F4', 2],
        [3, 5, 'Eb4', 3], [3, 11, 'C4', 3],
        [4, 3, 'C4', 2], [4, 7, 'Eb4', 3], [4, 13, 'G4', 2],
        [5, 5, 'Eb4', 3], [5, 11, 'C4', 3],
        [6, 3, 'Bb3', 2], [6, 7, 'C4', 3], [6, 13, 'F4', 2],
        [7, 5, 'Eb4', 3], [7, 12, 'G3', 3] ],
      // A small brass section: low cushions and upper trumpet answers leave the reed room to speak.
      horn: [
        [0, 0, ch('Ab3', 'C4', 'Eb4'), 1.25], [0, 10, ch('C5'), 2],
        [1, 1, ch('Ab4'), 2], [1, 9, ch('C4', 'Eb4'), 1.25], [1, 14, ch('G4'), 1.5],
        [2, 0, ch('Ab3', 'C4', 'F4'), 1.25], [2, 10, ch('Eb5'), 2],
        [3, 1, ch('C5'), 2], [3, 9, ch('Ab3', 'F4'), 1.25],
        [4, 0, ch('C4', 'Eb4', 'G4'), 1.25], [4, 10, ch('Bb4'), 2],
        [5, 1, ch('G4'), 2], [5, 9, ch('C4', 'Eb4'), 1.25], [5, 14, ch('Eb5'), 1.5],
        [6, 0, ch('G3', 'C4', 'F4'), 1.25], [6, 10, ch('Bb4'), 2],
        [7, 1, ch('G4'), 2], [7, 9, ch('Bb3', 'C4', 'F4'), 1.25] ]
    }
  ];

  var beats = { on: false, paused: false, idx: -1, built: false, timer: null, step: 0, nextT: 0, bars: 4, lastLead: null, volume: 1 };
  var bx = {};   // the studio's nodes

  function beatBuild() {
    if (beats.built) return;
    var ac = music.actx;
    bx.master = ac.createGain(); bx.master.gain.value = 0.8;
    bx.comp = ac.createDynamicsCompressor();
    bx.comp.threshold.value = -13; bx.comp.knee.value = 8; bx.comp.ratio.value = 2.2; bx.comp.attack.value = 0.018; bx.comp.release.value = 0.14;
    bx.out = ac.createGain(); bx.out.gain.value = 0.55;   // the compressor adds make-up gain; this takes it back
    bx.master.connect(bx.comp); bx.comp.connect(bx.out);
    bx.out.connect(music.analyser);
    bx.out.connect(ac.destination);
    // drums: through a tone filter and a touch of grit
    bx.drumLP = ac.createBiquadFilter(); bx.drumLP.type = 'lowpass'; bx.drumLP.Q.value = 0.5;
    bx.drumShape = ac.createWaveShaper(); bx.drumShape.curve = softCurve(0.2); bx.drumShape.oversample = '2x';
    bx.drums = ac.createGain(); bx.drums.gain.value = 1;
    bx.drums.connect(bx.drumLP); bx.drumLP.connect(bx.drumShape); bx.drumShape.connect(bx.master);
    // Keep chord roots and room wash out of the bass lane.
    bx.musicHP = ac.createBiquadFilter(); bx.musicHP.type = 'highpass'; bx.musicHP.frequency.value = 140; bx.musicHP.Q.value = 0.7;
    bx.musicBody = ac.createBiquadFilter(); bx.musicBody.type = 'peaking'; bx.musicBody.frequency.value = 340; bx.musicBody.Q.value = 0.8; bx.musicBody.gain.value = -2.5;
    bx.musicLP = ac.createBiquadFilter(); bx.musicLP.type = 'lowpass'; bx.musicLP.Q.value = 0.7;
    bx.music = ac.createGain(); bx.music.gain.value = 0.9;
    bx.music.connect(bx.musicHP); bx.musicHP.connect(bx.musicBody); bx.musicBody.connect(bx.musicLP); bx.musicLP.connect(bx.master);
    bx.bass = ac.createGain(); bx.bass.gain.value = 1;
    bx.bassHP = ac.createBiquadFilter(); bx.bassHP.type = 'highpass'; bx.bassHP.frequency.value = 27; bx.bassHP.Q.value = 0.7;
    bx.bass.connect(bx.bassHP); bx.bassHP.connect(bx.master);
    // a short room, from a noise burst that decays
    bx.verb = ac.createConvolver(); bx.verb.buffer = impulse(ac, 0.65, 3.2);
    bx.verbGain = ac.createGain(); bx.verbGain.gain.value = 0.1;
    bx.verbSend = ac.createGain(); bx.verbSend.gain.value = 0.5;
    bx.verbHP = ac.createBiquadFilter(); bx.verbHP.type = 'highpass'; bx.verbHP.frequency.value = 400; bx.verbHP.Q.value = 0.7;
    bx.verbLP = ac.createBiquadFilter(); bx.verbLP.type = 'lowpass'; bx.verbLP.frequency.value = 5000; bx.verbLP.Q.value = 0.7;
    bx.verbSend.connect(bx.verbHP); bx.verbHP.connect(bx.verb); bx.verb.connect(bx.verbLP); bx.verbLP.connect(bx.verbGain); bx.verbGain.connect(bx.master);
    // vinyl crackle, looped
    bx.crackleGain = ac.createGain(); bx.crackleGain.gain.value = 0;
    bx.crackleGain.connect(bx.master);
    bx.noise = noiseBuffer(ac, 2.0);
    beats.built = true;
  }
  function softCurve(amount) {
    // Unity small-signal gain: grit rounds peaks without turning quiet tails up.
    var n = 1025, c = new Float32Array(n), k = amount * 2;
    for (var i = 0; i < n; i++) { var x = i * 2 / (n - 1) - 1; c[i] = x / (1 + k * Math.abs(x)); }
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
    var lo = B.bus.drumLP < 8000 ? 46 : 52;
    o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(lo, t + 0.045);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.84 * vel, t + 0.003);
    g.gain.setTargetAtTime(0.0001, t + 0.025, 0.085);
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
    n.buffer = bx.noise; bp.type = 'bandpass'; bp.frequency.value = B.bus.drumLP < 8000 ? 2200 : 2900; bp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.75 * vel, t + 0.003);
    g.gain.setTargetAtTime(0.0001, t + 0.01, 0.055);
    n.connect(bp); bp.connect(g); g.connect(bx.drums); g.connect(bx.verbSend);
    var o = ac.createOscillator(), og = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(B.bus.drumLP < 8000 ? 180 : 215, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.04);
    og.gain.setValueAtTime(0.3 * vel, t); og.gain.setTargetAtTime(0.0001, t + 0.01, 0.035);
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
    n.buffer = bx.noise; hp.type = 'highpass'; hp.frequency.value = 5200;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * vel, t + 0.002);
    g.gain.setTargetAtTime(0.0001, t + 0.003, open ? 0.085 : 0.018);
    n.connect(hp); hp.connect(g); g.connect(bx.drums);
    n.start(t); n.stop(t + (open ? 0.7 : 0.2));
  }
  function bass(t, midi, dur, kind) {
    var ac = music.actx, f = hz(midi), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = kind === 'moog' ? 1.8 : 0.7;
    var o = ac.createOscillator(), o2 = ac.createOscillator();
    if (kind === 'moog') {
      o.type = 'sawtooth'; o2.type = 'sine';
      lp.frequency.setValueAtTime(750, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    } else {
      o.type = 'sine'; o2.type = 'triangle'; o2.detune.value = 1200;
      lp.frequency.value = 520;
    }
    o.frequency.value = f; o2.frequency.value = f;
    var g2 = ac.createGain(); g2.gain.value = kind === 'moog' ? 0.3 : 0.24;
    var bl = kind === 'moog' ? 0.3 : 0.34;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(bl, t + 0.012);
    g.gain.setValueAtTime(bl, t + dur - 0.045);
    g.gain.setTargetAtTime(0.0001, t + dur - 0.045, 0.022);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bx.bass);
    o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  function rhodes(t, midis, dur, warm) {
    var ac = music.actx;
    midis.forEach(function (m, i) {
      var f = hz(m), g = ac.createGain(), o = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o.detune.value = (i % 2 ? 4 : -4);
      o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = warm ? 0.24 : 0.32;
      var trem = ac.createOscillator(), tg = ac.createGain(), tremGain = ac.createGain();
      trem.frequency.value = 4.2; tg.gain.value = 0.12; tremGain.gain.value = 0.88;
      // Tremolo multiplies the envelope; it must not keep released notes ringing.
      trem.connect(tg); tg.connect(tremGain.gain);
      var peak = 0.72 / Math.sqrt(midis.length);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.015);
      g.gain.setTargetAtTime(peak * 0.55, t + 0.015, 0.5);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.09);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(tremGain); tremGain.connect(bx.music); tremGain.connect(bx.verbSend);
      o.start(t); o2.start(t); trem.start(t); o.stop(t + dur + 0.8); o2.stop(t + dur + 0.8); trem.stop(t + dur + 0.8);
    });
  }
  function stab(t, midis, dur, clean) {
    var ac = music.actx, g = ac.createGain(), bp = ac.createBiquadFilter(), sh = ac.createWaveShaper();
    bp.type = clean ? 'lowpass' : 'bandpass'; bp.frequency.value = clean ? 2600 : 950; bp.Q.value = clean ? 0.8 : 0.85;
    sh.curve = softCurve(clean ? 0.05 : 0.3); sh.oversample = '2x';
    midis.forEach(function (m, i) {
      var o = ac.createOscillator(), o2 = ac.createOscillator(), og = ac.createGain();
      o.type = clean ? 'triangle' : 'sawtooth'; o.frequency.value = hz(m); o.detune.value = i % 2 ? 6 : -6;
      o2.type = 'square'; o2.frequency.value = hz(m); og.gain.value = clean ? 0.15 : 0.35;
      o.connect(bp); o2.connect(og); og.connect(bp);
      o.start(t); o2.start(t); o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3);
    });
    var peak = (clean ? 0.55 : 1) / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.setTargetAtTime(peak * 0.4, t + 0.006, clean ? 0.12 : 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    // Shape the already-enveloped chord so summed oscillators cannot overload the shaper.
    bp.connect(g); g.connect(sh); sh.connect(bx.music); if (clean) sh.connect(bx.verbSend);
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
    var peak = 0.2 / Math.sqrt(midis.length);
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
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.46, t + 0.005);
    g.gain.setTargetAtTime(0.0001, t + 0.03, Math.max(0.18, dur * 0.4));
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
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.03);
    g.gain.setValueAtTime(0.3, t + dur - 0.06); g.gain.setTargetAtTime(0.0001, t + dur - 0.06, 0.05);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bx.music); g.connect(bx.verbSend);
    o.start(t); o2.start(t); vib.start(t); o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3); vib.stop(t + dur + 0.3);
    beats.lastLead = midi;
  }
  function clarinet(t, midi, dur) {
    var ac = music.actx, f = hz(midi), o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    // A rounded reed tone, led by odd harmonics; no pitch scoop or continuous vibrato.
    if (!bx.clarinetWave) bx.clarinetWave = ac.createPeriodicWave(new Float32Array(8), new Float32Array([0, 1, 0.04, 0.42, 0.02, 0.14, 0.01, 0.05]));
    o.setPeriodicWave(bx.clarinetWave); o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = Math.min(2600, f * 6); lp.Q.value = 0.5;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.028);
    g.gain.setTargetAtTime(0.145, t + 0.028, 0.06);
    g.gain.setTargetAtTime(0, t + dur, 0.045);
    g.gain.setValueAtTime(0, t + dur + 0.3);
    o.connect(lp); lp.connect(g); g.connect(bx.music); g.connect(bx.verbSend);
    // A very quiet breath layer shares the note envelope and release.
    var breath = ac.createBufferSource(), breathHP = ac.createBiquadFilter(), breathGain = ac.createGain();
    breath.buffer = bx.noise; breathHP.type = 'highpass'; breathHP.frequency.value = 1200; breathGain.gain.value = 0.012;
    breath.connect(breathHP); breathHP.connect(breathGain); breathGain.connect(lp);
    o.start(t); breath.start(t); o.stop(t + dur + 0.3); breath.stop(t + dur + 0.3);
  }
  function horn(t, midis, dur, kind) {
    var ac = music.actx, g = ac.createGain(), bp = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
    var mellow = kind === 'mellow';
    bp.type = 'bandpass'; bp.frequency.value = mellow ? 1150 : 1450; bp.Q.value = mellow ? 0.65 : 0.9;
    lp.type = 'lowpass'; lp.frequency.value = mellow ? 2600 : 3800;
    midis.forEach(function (m) {
      var o = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; g2.gain.value = mellow ? 0.12 : 0.3;
      if (mellow) {
        o.frequency.value = hz(m); o2.frequency.value = hz(m);
      } else {
        o.frequency.setValueAtTime(hz(m) * 0.89, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.07);
        o2.frequency.setValueAtTime(hz(m) * 0.89, t); o2.frequency.exponentialRampToValueAtTime(hz(m), t + 0.07);
      }
      o.connect(bp); o2.connect(g2); g2.connect(bp);
      o.start(t); o2.start(t); o.stop(t + dur + (mellow ? 0.24 : 0.4)); o2.stop(t + dur + (mellow ? 0.24 : 0.4));
    });
    var peak = (mellow ? 0.32 : 0.65) / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setTargetAtTime(peak * (mellow ? 0.6 : 0.5), t + 0.02, mellow ? 0.055 : 0.18);
    g.gain.setTargetAtTime(0.0001, t + dur, mellow ? 0.045 : 0.09);
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

  // ---- the scheduler: a bar is 16 steps; drums repeat every two bars; music follows the track's phrase ----
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
    at(B.lead, function (e) {
      if (B.leadKind === 'clarinet') clarinet(t, N(e[2]), e[3] * st);
      else lead(t, N(e[2]), e[3] * st, e[4]);
    });
    at(B.piano, function (e) { piano(t + (Math.random() - 0.5) * hum, N(e[2]), e[3] * st); });
    at(B.strings, function (e) { strings(t, e[2], e[3] * st); });
    at(B.horn, function (e) { horn(t, e[2], e[3] * st, B.hornKind); });
    at(B.scratch, function (e) { scratch(t); });
  }
  function beatTick() {
    var ac = music.actx, B = BEATS[beats.idx], st = 60 / B.bpm / 4;
    // A late UI frame must not start a backlog of past notes all at once.
    // Leave room for negative humanization offsets and keep the original beat grid.
    var earliest = ac.currentTime + 0.035;
    if (beats.nextT < earliest) {
      var missed = Math.ceil((earliest - beats.nextT) / st);
      beats.step += missed; beats.nextT += missed * st;
    }
    while (beats.nextT < ac.currentTime + 0.35) {
      scheduleStep(beats.step, beats.nextT);
      beats.step++;
      beats.nextT += st;
    }
  }
  function startBeat(i) {
    if (!ensureCtx()) { say('Audio is not available in this browser.'); return; }
    stopMusic();
    beats.idx = i; beats.step = 0; beats.lastLead = null;
    runBeat();
  }
  function runBeat() {
    beatBuild();
    var B = BEATS[beats.idx];
    beats.bars = B.bars || 4;
    beats.on = true; beats.paused = false;
    beats.nextT = music.actx.currentTime + 0.08;
    bx.out.gain.value = 0.55 * beats.volume;
    bx.drumLP.frequency.value = B.bus.drumLP;
    bx.musicLP.frequency.value = B.bus.musicLP;
    bx.drums.gain.value = B.bus.drums;
    bx.music.gain.value = B.bus.music;
    bx.bass.gain.value = B.bus.bass;
    bx.drumShape.curve = softCurve(B.bus.grit);
    bx.verbGain.gain.value = B.bus.verb;
    crackleStart();
    beats.timer = setInterval(beatTick, 30);
    beatTick();
    setMusicOn(true, 'beat');
    syncBeatChips();
    say('Playing ' + B.name + ' — ' + B.style);
  }
  function silenceBeat() {
    clearInterval(beats.timer); beats.timer = null;
    if (bx.crackle) { try { bx.crackle.stop(); } catch (e) {} bx.crackle = null; }
    // Retire this graph so queued notes and reverb cannot return on the next start.
    if (bx.out) { bx.out.gain.value = 0; bx.out.disconnect(); }
    beats.built = false; bx = {};
  }
  function pauseBeat() {
    if (!beats.on) return;
    // Resume at the next audible step, not beyond the look-ahead queue we retire.
    var st = 60 / BEATS[beats.idx].bpm / 4;
    beats.step -= Math.min(beats.step, Math.max(0, Math.floor((beats.nextT - music.actx.currentTime) / st)));
    silenceBeat();
    beats.on = false; beats.paused = true;
    setMusicOn(false);
    syncBeatChips();
  }
  function resumeBeat() {
    if (!beats.paused || !ensureCtx()) return;
    runBeat();
  }
  function setBeatVolume(volume) {
    beats.volume = Math.max(0, Math.min(1, volume));
    if (bx.out) bx.out.gain.value = beats.on ? 0.55 * beats.volume : 0;
  }
  function stopBeat() {
    if (!beats.on && !beats.paused) return;
    silenceBeat();
    beats.on = false; beats.paused = false; beats.idx = -1;
    beats.step = 0; beats.nextT = 0; beats.lastLead = null;
    syncBeatChips();
  }
  function syncBeatChips() {
    var chips = $('beatChips').children;
    for (var i = 0; i < chips.length; i++) chips[i].setAttribute('aria-pressed', beats.on && i === beats.idx ? 'true' : 'false');
  }
  BEATS.forEach(function (B, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = B.name; b.title = B.style;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () { if (beats.on && beats.idx === i) { stopMusic(); } else startBeat(i); });
    $('beatChips').appendChild(b);
  });
