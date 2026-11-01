/* Black Pearl — all sound is synthesised here (no audio files). */
(function (g) {
  'use strict';
  var ctx = null, master = null, noiseBuf = null, waterGain = null, padGain = null, enabled = true, muffled = false, night = 0;
  var SCALE = [0, 2, 4, 7, 9]; // major pentatonic

  function init() {
    if (ctx) return;
    var AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = enabled ? 0.9 : 0;
    master.connect(ctx.destination);

    // pink-ish noise buffer, reused for water, splashes and the crow
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
    // river
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    waterGain = ctx.createGain(); waterGain.gain.value = 0.10;
    src.connect(lp); lp.connect(waterGain); waterGain.connect(master); src.start();
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
    var lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    // a very quiet drone that opens up at night
    padGain = ctx.createGain(); padGain.gain.value = 0.0;
    padGain.connect(master);
    [130.81, 196.0, 261.63].forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (i - 1) * 0.0015);
      var og = ctx.createGain(); og.gain.value = i === 2 ? 0.35 : 1;
      o.connect(og); og.connect(padGain); o.start();
    });
    applyLevels();
  }
  function applyLevels() {
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(enabled ? (muffled ? 0.3 : 0.9) : 0, t, 0.08);
    padGain.gain.setTargetAtTime(0.012 + 0.03 * night, t, 0.8);
  }
  function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setEnabled(b) { enabled = !!b; applyLevels(); }
  function setMuffled(b) { muffled = !!b; applyLevels(); }
  function setNight(n) { night = n; applyLevels(); }

  function tone(freq, dur, type, vol, when, glideTo) {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g1 = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g1); g1.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, type, freq, q, vol, when, sweepTo) {
    if (!ctx || !enabled) return;
    var t = ctx.currentTime + (when || 0);
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    var g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g1); g1.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function note(step, base) {
    var s = Math.max(0, Math.min(9, step | 0));
    var semis = SCALE[s % 5] + 12 * Math.floor(s / 5);
    return (base || 523.25) * Math.pow(2, semis / 12);
  }

  function play(name, arg) {
    if (!ctx || !enabled) return;
    switch (name) {
      case 'diya':
        var f = note(arg || 0);
        tone(f, 1.1, 'sine', 0.2); tone(f * 2, 0.7, 'triangle', 0.05); break;
      case 'lotus':
        tone(note(2), 1.4, 'sine', 0.16); tone(note(4), 1.4, 'sine', 0.13, 0.07); tone(note(5), 1.6, 'sine', 0.1, 0.14); break;
      case 'koi':
        noise(0.28, 'highpass', 1800, 0.7, 0.14); tone(note(5), 0.9, 'sine', 0.16, 0.05); tone(note(7), 0.9, 'sine', 0.12, 0.12); break;
      case 'lantern':
        tone(note(0, 392), 1.6, 'sine', 0.14); tone(note(3, 392), 1.8, 'sine', 0.14, 0.18); tone(note(5, 392), 2.0, 'sine', 0.12, 0.36); break;
      case 'hit':
        tone(150, 0.3, 'sine', 0.4, 0, 48); noise(0.16, 'lowpass', 900, 0.8, 0.3); break;
      case 'shield':
        tone(note(4), 0.5, 'triangle', 0.18, 0, note(0)); noise(0.12, 'highpass', 2400, 0.7, 0.1); break;
      case 'caw': // Jack's chatter
        for (var i = 0; i < 4; i++) noise(0.09, 'bandpass', 2300 - i * 120, 6, 0.13, i * 0.12, 1500);
        break;
      case 'low':
        tone(98, 0.22, 'sine', 0.22); tone(98, 0.22, 'sine', 0.16, 0.24); break;
      case 'best':
        tone(note(2), 1.2, 'sine', 0.16); tone(note(4), 1.2, 'sine', 0.16, 0.12); tone(note(7), 1.6, 'sine', 0.16, 0.24); break;
      case 'wish':
        tone(note(4, 392), 1.4, 'sine', 0.14); tone(note(5, 392), 1.4, 'sine', 0.14, 0.14); tone(note(7, 392), 1.8, 'sine', 0.14, 0.28); break;
      case 'over':
        tone(note(4, 392), 1.4, 'sine', 0.16, 0, note(2, 392)); tone(note(0, 392), 2.0, 'sine', 0.14, 0.4, note(0, 349)); break;
      case 'ui':
        tone(660, 0.07, 'triangle', 0.07); break;
    }
  }
  g.Sound = { unlock: unlock, play: play, setEnabled: setEnabled, setMuffled: setMuffled, setNight: setNight };
})(window);
