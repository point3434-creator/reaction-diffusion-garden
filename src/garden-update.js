// Installed inside the application's closure, immediately before initial setup.
// Reuses the existing simulation, source picker and AudioContext; no second audio output.
(function installGardenUpdate() {
  if (document.getElementById('flowStrength')) return;
  state.currentFlow = 0.85;
  state.currentSpin = 0.65;
  CHEMS.current = Object.assign({}, CHEMS.garden, {
    lede: 'A flowing garden: paint living ribbons and let the current carry them into eddies.',
    hint: 'Paint a ribbon; the current carries the chemistry along'
  });
  var button = document.createElement('button');
  button.type = 'button'; button.className = 'chip'; button.dataset.chem = 'current';
  button.textContent = 'Current'; button.setAttribute('aria-pressed', 'false');
  $('chem').insertBefore(button, $('chem').children[1]);
  var sliders = document.querySelector('.tune .sliders');
  sliders.insertAdjacentHTML('beforeend', '<label id="flowWrap" hidden><span>flow</span><input id="flowStrength" type="range" min="0" max="2" step="0.01" value="0.85"><output id="flowStrengthOut">0.85</output></label><label id="spinWrap" hidden><span>swirl</span><input id="flowSpeed" type="range" min="0.1" max="1.8" step="0.01" value="0.65"><output id="flowSpeedOut">0.65</output></label>');
  function adaptCurrent(s) {
    var step = s.step, resize = s.resample;
    s.step = function (f, k, steps) {
      var on = music && music.on;
      var flow = state.currentFlow * (on ? .82 + .65 * music.loud + .24 * music.bass : 1);
      var spin = state.currentSpin * (on ? .92 + .24 * music.high : 1);
      step(f, k, steps, flow, spin);
    };
    s.resample = function (w, h) { return adaptCurrent(resize(w, h)); };
    return s;
  }
  var originalFresh = freshSim;
  freshSim = function (w, h) {
    if (state.chem !== 'current') return originalFresh(w, h);
    var s = adaptCurrent(createCurrent(w, h)); s.seed(7); return s;
  };
  var originalSync = syncUI;
  syncUI = function () {
    originalSync();
    var active = state.chem === 'current';
    $('flowWrap').hidden = !active; $('spinWrap').hidden = !active;
    $('flowStrength').value = state.currentFlow; $('flowSpeed').value = state.currentSpin;
    $('flowStrengthOut').value = state.currentFlow.toFixed(2);
    $('flowSpeedOut').value = state.currentSpin.toFixed(2);
    fill($('flowStrength')); fill($('flowSpeed'));
    if (active) Array.from(dotsEl.children).forEach(function (dot, i) { dot.setAttribute('class', i === state.preset ? 'dot on' : 'dot'); });
  };
  $('flowStrength').addEventListener('input', function () { state.currentFlow = Number(this.value); syncUI(); });
  $('flowSpeed').addEventListener('input', function () { state.currentSpin = Number(this.value); syncUI(); });

  // Sparse, non-interactive botanical accents; never cover controls or block painting.
  stage.insertAdjacentHTML('beforeend', '<svg class="garden-vine vine-left" viewBox="0 0 180 640" aria-hidden="true"><defs><linearGradient id="gardenLeaf" x2="1" y2="1"><stop stop-color="#9dc490"/><stop offset="1" stop-color="#426a51"/></linearGradient></defs><path class="stem" d="M85 630 C43 533 124 451 85 361 S33 208 99 16"/><path class="leaf" d="M78 502 C109 480 121 454 120 428 C94 437 75 463 69 487 Z"/><path class="leaf ochre" d="M72 353 C43 333 28 306 32 280 C60 291 77 319 81 342 Z"/><path class="leaf" d="M76 211 C108 191 124 162 120 139 C94 147 73 176 68 200 Z"/><path class="leaf plum" d="M89 82 C62 65 54 41 58 20 C79 34 90 51 95 73 Z"/></svg><svg class="garden-vine vine-right" viewBox="0 0 180 460" aria-hidden="true"><path class="stem" d="M78 8 C123 88 64 188 103 263 S111 391 75 452"/><path class="leaf ochre" d="M91 132 C64 113 48 85 50 60 C77 68 94 99 99 121 Z"/><path class="leaf" d="M92 259 C120 242 136 216 133 192 C104 205 90 228 84 247 Z"/><path class="leaf plum" d="M105 359 C77 342 66 319 70 298 C93 309 107 333 112 350 Z"/></svg>');

  var tracks = [
    ['Liquid Bloom', 'Liquid_Bloom.mp3', '96 BPM · Late-night electronic hip-hop'],
    ['Mycelium Dream · Violin', 'Mycelium_Dream_Violin.mp3', '104 BPM · Psychedelic dub'],
    ['Prism Orchard', 'Prism_Orchard.mp3', '108 BPM · Xylophone-led groove'],
    ['Neon Thistle', 'Neon_Thistle.mp3', '116 BPM · Bagpipe electro-funk'],
    ['Velvet Circuit', 'Velvet_Circuit.mp3', '112 BPM · Psychedelic guitar funk']
  ];
  var host = document.createElement('div'); host.id = 'gardenScores'; host.className = 'group garden-scores';
  host.innerHTML = '<h3 class="eyebrow">Garden soundtrack</h3><div class="chips" id="gardenScoreLibrary" role="group" aria-label="Garden soundtrack"></div><h2 id="gardenScoreTitle"></h2><p class="note" id="gardenScoreMeta"></p><div class="actions"><button type="button" class="act" id="gardenScorePlay">Play</button><button type="button" class="act" id="gardenScoreRestart">Restart</button><label class="score-loop"><input type="checkbox" id="gardenScoreLoop" checked> Repeat</label></div><label class="score-range">Position <input id="gardenScoreSeek" type="range" min="0" max="1000" value="0" aria-label="Track position"></label><label class="score-range">Volume <input id="gardenScoreVolume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="Track volume"></label><p class="note" id="gardenScoreStatus" role="status"></p><button type="button" class="act" id="gardenAudioLoad">Load downloaded recordings</button><input id="gardenAudioFiles" type="file" accept="audio/*" multiple hidden>';
  var sound = document.querySelector('[data-pane="sound"]'); sound.insertBefore(host, sound.firstChild);
  var selected = 0, activeSource = '', urls = new Map();
  function source() { return urls.get(tracks[selected][1]) || 'audio/' + tracks[selected][1]; }
  function clock(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  function refresh() {
    var ours = activeSource && audio.getAttribute('src') === activeSource;
    $('gardenScorePlay').textContent = ours && !audio.paused ? 'Pause' : 'Play';
    $('gardenScoreSeek').value = ours && Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.currentTime / audio.duration * 1000) : 0;
    if (ours && !audio.error && Number.isFinite(audio.duration)) $('gardenScoreStatus').textContent = clock(audio.currentTime) + ' / ' + clock(audio.duration);
  }
  function choose(i) {
    stopMusic(); selected = i; activeSource = '';
    $('gardenScoreTitle').textContent = tracks[i][0]; $('gardenScoreMeta').textContent = tracks[i][2];
    $('gardenScoreStatus').textContent = 'Choose Play, or load the recordings saved from chat.';
    Array.from($('gardenScoreLibrary').children).forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
    refresh();
  }
  function play() {
    if (activeSource && audio.getAttribute('src') === activeSource && !audio.paused) { audio.pause(); setMusicOn(false); refresh(); return; }
    stopMusic();
    if (audio.getAttribute('src') !== source()) { audio.src = source(); }
    activeSource = source(); songName = tracks[selected][0];
    audio.loop = $('gardenScoreLoop').checked; audio.volume = Number($('gardenScoreVolume').value);
    startSong();
  }
  tracks.forEach(function (track, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = track[0];
    b.addEventListener('click', function () { choose(i); }); $('gardenScoreLibrary').appendChild(b);
  });
  $('gardenScorePlay').addEventListener('click', play);
  $('gardenScoreRestart').addEventListener('click', function () { if (activeSource && audio.getAttribute('src') === activeSource) audio.currentTime = 0; else play(); });
  $('gardenScoreSeek').addEventListener('input', function () { if (audio.getAttribute('src') === activeSource && Number.isFinite(audio.duration)) audio.currentTime = Number(this.value) / 1000 * audio.duration; });
  $('gardenScoreVolume').addEventListener('input', function () { audio.volume = Number(this.value); });
  $('gardenScoreLoop').addEventListener('change', function () { if (activeSource && audio.getAttribute('src') === activeSource) audio.loop = this.checked; });
  $('gardenAudioLoad').addEventListener('click', function () { $('gardenAudioFiles').click(); });
  $('gardenAudioFiles').addEventListener('change', function () {
    var count = 0;
    Array.from(this.files || []).forEach(function (file) {
      var track = tracks.find(function (t) { return t[1].toLowerCase() === file.name.toLowerCase(); });
      if (!track) return;
      if (urls.has(track[1])) URL.revokeObjectURL(urls.get(track[1]));
      urls.set(track[1], URL.createObjectURL(file)); count++;
    });
    this.value = ''; $('gardenScoreStatus').textContent = count ? count + ' recordings loaded locally.' : 'Choose the five named MP3 recordings from the soundtrack download.';
  });
  ['play','pause','ended','timeupdate','loadedmetadata'].forEach(function (name) { audio.addEventListener(name, refresh); });
  audio.addEventListener('error', function () {
    if (activeSource && audio.getAttribute('src') === activeSource) {
      setMusicOn(false); $('gardenScoreStatus').textContent = 'This recording is not in the checkout yet. Use Load downloaded recordings, or place the MP3s in web/audio/.'; refresh();
    }
  });
  window.addEventListener('pagehide', function () { urls.forEach(function (url) { URL.revokeObjectURL(url); }); });
  choose(0);
})();
