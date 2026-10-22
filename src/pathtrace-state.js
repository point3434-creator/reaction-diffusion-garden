// Pure policy shared by the browser renderer and its focused regression tests.
function pathTraceSize(width, height, quality, moving) {
  var budget = moving ? 98304 : quality === 'fine' ? 786432 : 262144;
  var scale = Math.min(1, Math.sqrt(budget / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

function createPathTraceHistory() {
  return {
    samples: 0, seed: 0, key: null,
    begin: function (key, changed, moving) {
      var reset = this.key !== key || changed || moving;
      if (reset) this.samples = 0;
      this.key = key;
      return reset;
    },
    commit: function () {
      this.samples = Math.min(4096, this.samples + 1);
      this.seed = (this.seed + 1) >>> 0;
    },
    reset: function () { this.samples = 0; this.key = null; }
  };
}
if (typeof module !== 'undefined') module.exports = { pathTraceSize, createPathTraceHistory };
