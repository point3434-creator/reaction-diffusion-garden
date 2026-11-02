// Installed inside the application's closure, immediately before initial setup.
// Reuses the existing simulation, source picker and AudioContext; no second audio output.
(function installGardenUpdate() {
  if (document.getElementById('flowStrength')) return;
  state.currentFlow = 0.85;
  state.currentSpin = 0.65;
  CHEMS.current = Object.assign({}, CHEMS.garden, {
    stir: false,
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
    { name: 'Liquid Bloom', file: 'Liquid_Bloom.mp3', detail: '96 BPM · Late-night electronic hip-hop' },
    { name: 'Mycelium Dream · Violin', file: 'Mycelium_Dream_Violin.mp3', detail: '104 BPM · Psychedelic dub' },
    { name: 'Prism Orchard', file: 'Prism_Orchard.mp3', detail: '108 BPM · Xylophone-led groove' },
    { name: 'Neon Thistle', file: 'Neon_Thistle.mp3', detail: '116 BPM · Bagpipe electro-funk' },
    { name: 'Velvet Circuit', file: 'Velvet_Circuit.mp3', detail: '112 BPM · Psychedelic guitar funk' }
  ].concat(BEATS.map(function (beat, i) {
    return { name: beat.name, beat: i, detail: beat.bpm + ' BPM · Live beat · ' + beat.style };
  }));
  var host = document.createElement('div'); host.id = 'gardenScores'; host.className = 'group garden-scores';
  host.innerHTML = '<h3 class="eyebrow">Garden jukebox</h3><p class="note">Songs and live beats. One continuous playlist.</p>' +
    '<h2 id="gardenScoreTitle"></h2><p class="note" id="gardenScoreMeta"></p>' +
    '<div class="actions jukebox-transport"><button type="button" class="act" id="gardenScorePrev" aria-label="Previous track">Previous</button><button type="button" class="act" id="gardenScorePlay" aria-pressed="false">Play</button><button type="button" class="act" id="gardenScoreNext" aria-label="Next track">Next</button></div>' +
    '<div class="actions"><button type="button" class="act" id="gardenScoreRestart">Restart</button><button type="button" class="act" id="gardenScoreShuffle" aria-pressed="false">Shuffle</button><label class="score-loop"><input type="checkbox" id="gardenScoreLoop"> Repeat</label></div>' +
    '<label class="score-range" id="gardenScorePosition">Position <input id="gardenScoreSeek" type="range" min="0" max="1000" value="0" aria-label="Track position"></label>' +
    '<label class="score-range">Volume <input id="gardenScoreVolume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="Track volume"></label>' +
    '<p class="note" id="gardenScoreStatus" role="status"></p>' +
    '<label class="jukebox-search" for="gardenSongSearch">Find a song<input id="gardenSongSearch" type="search" placeholder="Search your library…" autocomplete="off"></label>' +
    '<div class="jukebox-index"><span id="gardenLibraryCount"></span><button type="button" class="act" id="gardenLibraryPlay" aria-pressed="false">▶ Play</button></div>' +
    '<p class="note jukebox-browse">Drag or swipe to browse · Double-click a song to play</p>' +
    '<div class="chips jukebox-library" id="gardenScoreLibrary" role="group" aria-label="Jukebox library"></div>' +
    '<p class="note" id="gardenLibraryEmpty" hidden>No matching tracks. Try another search.</p>' +
    '<div class="actions jukebox-manage"><button type="button" class="act" id="gardenAudioLoad" disabled>Add songs</button><button type="button" class="act" id="gardenSongRemove" hidden>Remove song</button></div>' +
    '<input id="gardenAudioFiles" type="file" accept="audio/*" multiple hidden disabled>' +
    '<p class="note" id="gardenLibraryStatus" role="status">Opening your saved library…</p>' +
    '<p class="note jukebox-help">Live beats play for two minutes. Repeat keeps the current song or beat playing.</p>' +
    '<p class="note">Added songs stay in this browser at this address. Adding the same filename replaces that song.</p>';
  var sound = document.querySelector('[data-pane="sound"]'); sound.insertBefore(host, sound.firstChild);
  $('beats').hidden = true;
  var selected = 0, activeSource = '', jukeboxSource = '', urls = new Map(), shuffle = false, upcoming = [], history = [];
  var beatElapsed = 0, beatStarted = null, beatLength = 120000;
  function isBeat() { return tracks[selected].beat !== undefined; }
  function source() { return urls.get(tracks[selected].file) || 'audio/' + tracks[selected].file; }
  function ownsSelection() {
    return isBeat() ? beats.idx === tracks[selected].beat && (beats.on || beats.paused) :
      activeSource && audio.getAttribute('src') === activeSource;
  }
  function playing() { return ownsSelection() && (isBeat() ? beats.on : !audio.paused && music.on && music.mode === 'song'); }
  function elapsed() { return beatElapsed + (beatStarted === null ? 0 : performance.now() - beatStarted); }
  function clock(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  function refresh() {
    var ours = ownsSelection(), on = playing();
    if (on && isBeat() && beatStarted === null) beatStarted = performance.now();
    if ((!on || !isBeat()) && beatStarted !== null) { beatElapsed = elapsed(); beatStarted = null; }
    $('gardenScorePlay').textContent = on ? 'Pause' : 'Play';
    $('gardenScorePlay').setAttribute('aria-pressed', String(!!on));
    $('gardenLibraryPlay').textContent = on ? 'Ⅱ Pause' : '▶ Play';
    $('gardenLibraryPlay').setAttribute('aria-pressed', String(!!on));
    $('gardenLibraryPlay').setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + tracks[selected].name);
    $('gardenScorePosition').hidden = isBeat();
    $('gardenScoreSeek').disabled = isBeat();
    $('gardenScoreSeek').value = !isBeat() && ours && Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.currentTime / audio.duration * 1000) : 0;
    // Keep ownership even when navigation leaves an older source in the media element.
    sound.classList.toggle('jukebox-media', !!jukeboxSource && audio.getAttribute('src') === jukeboxSource);
    if (ours && isBeat()) $('gardenScoreStatus').textContent = (on ? 'Live beat · ' : 'Paused · ') + clock(elapsed() / 1000) + ' / 2:00';
    else if (ours && !audio.error && Number.isFinite(audio.duration)) $('gardenScoreStatus').textContent = clock(audio.currentTime) + ' / ' + clock(audio.duration);
  }
  // External song, microphone and Stop controls also update the shared transport.
  var originalSetMusicOn = setMusicOn;
  setMusicOn = function (on, mode) { originalSetMusicOn(on, mode); refresh(); };
  function showSelection(i) {
    selected = i; activeSource = '';
    beatElapsed = 0; beatStarted = null;
    $('gardenScoreTitle').textContent = tracks[i].name; $('gardenScoreMeta').textContent = tracks[i].detail;
    $('gardenScoreStatus').textContent = 'Choose Play to listen.';
    Array.from($('gardenScoreLibrary').children).forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
    $('gardenSongRemove').hidden = !tracks[i].local;
    refresh();
  }
  function choose(i, autoplay) {
    stopMusic(); showSelection(i);
    if (autoplay) start();
  }
  function start() {
    if (isBeat()) {
      setBeatVolume(Number($('gardenScoreVolume').value));
      if (beats.paused && beats.idx === tracks[selected].beat) resumeBeat();
      else { beatElapsed = 0; beatStarted = null; startBeat(tracks[selected].beat); }
      refresh(); return;
    }
    stopMusic();
    if (audio.getAttribute('src') !== source()) { audio.src = source(); }
    activeSource = source(); jukeboxSource = activeSource; songName = tracks[selected].name;
    audio.loop = $('gardenScoreLoop').checked; audio.volume = Number($('gardenScoreVolume').value);
    startSong();
  }
  function play() {
    if (!playing()) { start(); return; }
    if (isBeat()) pauseBeat();
    else { audio.pause(); setMusicOn(false); }
    refresh();
  }
  function advance(autoplay) {
    var next = (selected + 1) % tracks.length;
    if (shuffle) {
      if (!upcoming.length) {
        upcoming = tracks.map(function (_, i) { return i; }).filter(function (i) { return i !== selected; });
        for (var j = upcoming.length - 1; j > 0; j--) {
          var k = Math.floor(Math.random() * (j + 1)), item = upcoming[j]; upcoming[j] = upcoming[k]; upcoming[k] = item;
        }
      }
      next = upcoming.pop();
    }
    history.push(selected); choose(next, autoplay);
  }
  var library = $('gardenScoreLibrary'), search = $('gardenSongSearch');
  function filterLibrary() {
    var query = search.value.trim().toLowerCase(), count = 0;
    Array.from(library.children).forEach(function (b, i) {
      b.hidden = !(tracks[i].name + ' ' + (tracks[i].file || '')).toLowerCase().includes(query);
      if (!b.hidden) count++;
    });
    $('gardenLibraryCount').textContent = (query ? count + ' of ' : '') + tracks.length + ' tracks';
    $('gardenLibraryEmpty').hidden = count > 0;
  }
  function renderLibrary() {
    library.replaceChildren();
    tracks.forEach(function (track, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.setAttribute('aria-label', track.name); b.setAttribute('aria-pressed', String(i === selected));
      var number = document.createElement('span'); number.className = 'jukebox-number'; number.setAttribute('aria-hidden', 'true'); number.textContent = String(i + 1).padStart(2, '0');
      var title = document.createElement('span'); title.className = 'jukebox-track'; title.textContent = track.name;
      var kind = document.createElement('small'); kind.textContent = track.local ? 'Your song' : track.file ? 'Garden soundtrack' : 'Live beat · 2 minutes'; title.appendChild(kind);
      b.append(number, title); b.title = track.name;
      b.addEventListener('click', function () { var on = playing(); history = []; upcoming = []; choose(i, on); }); library.appendChild(b);
      b.addEventListener('dblclick', function (event) { event.preventDefault(); if (!playing()) start(); });
    });
    filterLibrary();
  }
  search.addEventListener('input', function () { filterLibrary(); library.scrollTop = 0; });
  library.addEventListener('keydown', function (event) {
    var rows = Array.from(library.children).filter(function (b) { return !b.hidden; });
    var index = rows.indexOf(document.activeElement), next;
    if (event.key === 'ArrowDown') next = Math.min(index + 1, rows.length - 1);
    else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else return;
    if (rows[next]) { event.preventDefault(); rows[next].focus(); }
  });
  // Touch and wheels keep native scrolling; mouse dragging never activates a row.
  var drag = null, suppressClick = false;
  library.addEventListener('pointerdown', function (event) {
    suppressClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.clientX >= library.getBoundingClientRect().left + library.clientWidth) return;
    drag = { id: event.pointerId, y: event.clientY, top: library.scrollTop, moved: false };
  });
  library.addEventListener('pointermove', function (event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (!(event.buttons & 1)) { endDrag(); return; }
    if (!drag.moved && Math.abs(event.clientY - drag.y) > 5) {
      drag.moved = true; suppressClick = true; library.setPointerCapture(event.pointerId); library.classList.add('dragging');
    }
    if (drag.moved) { event.preventDefault(); library.scrollTop = drag.top + drag.y - event.clientY; }
  });
  function endDrag() { drag = null; library.classList.remove('dragging'); }
  library.addEventListener('pointerleave', function () { if (drag && !drag.moved) endDrag(); });
  library.addEventListener('pointerup', endDrag);
  library.addEventListener('pointercancel', function () { suppressClick = false; endDrag(); });
  library.addEventListener('lostpointercapture', endDrag);
  library.addEventListener('click', function (event) {
    if (suppressClick && event.detail !== 0) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  renderLibrary();
  $('gardenScorePlay').addEventListener('click', play);
  $('gardenLibraryPlay').addEventListener('click', play);
  $('gardenScoreNext').addEventListener('click', function () { advance(playing()); });
  $('gardenScorePrev').addEventListener('click', function () {
    var on = playing(), previous = history.length ? history.pop() : (selected + tracks.length - 1) % tracks.length;
    upcoming = []; choose(previous, on);
  });
  $('gardenScoreShuffle').addEventListener('click', function () {
    shuffle = !shuffle; upcoming = []; this.setAttribute('aria-pressed', String(shuffle));
  });
  $('gardenScoreRestart').addEventListener('click', function () {
    if (isBeat()) { choose(selected, playing()); }
    else if (ownsSelection()) { audio.currentTime = 0; refresh(); }
    else start();
  });
  $('gardenScoreSeek').addEventListener('input', function () { if (!isBeat() && ownsSelection() && Number.isFinite(audio.duration)) audio.currentTime = Number(this.value) / 1000 * audio.duration; });
  $('gardenScoreVolume').addEventListener('input', function () { audio.volume = Number(this.value); setBeatVolume(Number(this.value)); });
  $('gardenScoreLoop').addEventListener('change', function () { if (!isBeat() && ownsSelection()) audio.loop = this.checked; });
  $('gardenAudioLoad').addEventListener('click', function () { $('gardenAudioFiles').click(); });
  function libraryBusy(busy) {
    $('gardenAudioLoad').disabled = busy; $('gardenAudioFiles').disabled = busy; $('gardenSongRemove').disabled = busy;
  }
  function addRecording(filename, blob) {
    var track = tracks.find(function (t) { return t.file && t.file.toLowerCase() === filename.toLowerCase(); });
    if (!track) {
      track = { name: filename.replace(/\.[^.]+$/, '').replace(/_/g, ' '), file: filename, detail: 'Your library · Imported song', local: true };
      tracks.push(track);
    }
    var old = urls.get(track.file), url = URL.createObjectURL(blob);
    var active = activeSource && audio.getAttribute('src') === activeSource && track === tracks[selected];
    var resume = active && !audio.paused;
    urls.set(track.file, url);
    if (active) {
      activeSource = url; jukeboxSource = url; audio.src = url;
      if (resume) startSong(); else refresh();
    }
    if (old) URL.revokeObjectURL(old);
    return track;
  }
  $('gardenAudioFiles').addEventListener('change', async function () {
    var files = Array.from(this.files || []), count = 0, saved = 0;
    this.value = '';
    if (!files.length) return;
    libraryBusy(true); $('gardenLibraryStatus').textContent = 'Adding songs…';
    for (var file of files) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|aif|aiff|webm)$/i.test(file.name)) continue;
      var track = addRecording(file.name, file); count++; upcoming = []; renderLibrary();
      try { await gardenSongStore.put(file); track.stored = true; saved++; } catch (_) { /* Still playable for this visit. */ }
    }
    $('gardenLibraryStatus').textContent = !count ? 'Choose audio files to add to your library.' : saved === count ?
      count + ' song' + (count === 1 ? '' : 's') + ' saved in this browser.' :
      saved + ' of ' + count + ' songs saved. Could not save the rest; those changes are available for this session only.';
    libraryBusy(false);
  });
  $('gardenSongRemove').addEventListener('click', async function () {
    var track = tracks[selected];
    if (!track.local) return;
    libraryBusy(true);
    if (track.stored) {
      try { await gardenSongStore.remove(track.file); }
      catch (_) { $('gardenLibraryStatus').textContent = 'Could not remove the saved song. Try again.'; libraryBusy(false); return; }
    }
    var index = tracks.indexOf(track), current = tracks[selected], removingSelected = current === track;
    if (removingSelected && ownsSelection() && !music.micStream) stopMusic();
    tracks.splice(index, 1); upcoming = []; history = [];
    if (removingSelected) showSelection(Math.min(index, tracks.length - 1));
    else selected = tracks.indexOf(current);
    URL.revokeObjectURL(urls.get(track.file)); urls.delete(track.file); renderLibrary();
    $('gardenLibraryStatus').textContent = 'Removed ' + track.name + ' from your library.'; libraryBusy(false);
  });
  ['play','pause','ended','timeupdate','loadedmetadata'].forEach(function (name) { audio.addEventListener(name, refresh); });
  audio.addEventListener('ended', function () {
    if (!isBeat() && ownsSelection() && !$('gardenScoreLoop').checked) advance(true);
  });
  var beatClock = setInterval(function () {
    if (!isBeat() || !playing()) return;
    if (elapsed() >= beatLength) {
      if ($('gardenScoreLoop').checked) { beatElapsed = elapsed() % beatLength; beatStarted = performance.now(); }
      else { advance(true); return; }
    }
    refresh();
  }, 250);
  audio.addEventListener('error', function () {
    if (activeSource && audio.getAttribute('src') === activeSource) {
      setMusicOn(false); $('gardenScoreStatus').textContent = 'This recording could not be played. Try again or load a local recording.'; refresh();
    }
  });
  window.addEventListener('pagehide', function (event) {
    if (!event.persisted) { clearInterval(beatClock); urls.forEach(function (url) { URL.revokeObjectURL(url); }); }
  });
  choose(0);
  gardenSongStore.load().then(function (records) {
    records.forEach(function (record) { addRecording(record.filename, record.blob).stored = true; });
    upcoming = []; renderLibrary();
    $('gardenLibraryStatus').textContent = records.length ? 'Your saved songs are ready.' : 'Add songs to grow your library.';
  }).catch(function () {
    $('gardenLibraryStatus').textContent = 'Saved songs could not be opened. Added songs may be available for this session only.';
  }).finally(function () { libraryBusy(false); });
})();
