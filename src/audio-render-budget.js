// Protect playback when the shared CPU/GPU cannot keep up with the scene.
// Only drawing resolution changes; simulation fields and musical time are untouched.
function createAudioRenderBudget() {
  var average = 16.7, elapsed = 0;
  return {
    scale: 1,
    sample: function (milliseconds, playing) {
      if (!playing) { this.scale = 1; average = 16.7; elapsed = 0; return this.scale; }
      if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > 1000) return this.scale;
      average += (milliseconds - average) * 0.1; elapsed += milliseconds;
      if (average > 40 && elapsed >= 1000) {
        this.scale = Math.max(0.4, this.scale * 0.8); elapsed = 0;
      } else if (average < 22 && elapsed >= 5000) {
        this.scale = Math.min(1, this.scale + 0.05); elapsed = 0;
      }
      return this.scale;
    }
  };
}
if (typeof module !== 'undefined') module.exports = { createAudioRenderBudget };
