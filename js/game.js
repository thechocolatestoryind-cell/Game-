/* Black Pearl — game engine.
   A paper boat carries one diya down an endless river. The diya's flame is your life
   AND your only light once night falls. */
(function (g) {
  'use strict';

  var IM = Assets.img, D = Store.data;
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function mod(a, n) { return ((a % n) + n) % n; }
  var FONT = '"Iowan Old Style","Palatino Linotype",Palatino,"Noto Serif",Georgia,serif';

  var bgC = document.getElementById('bg'), wC = document.getElementById('world');
  var bg = bgC.getContext('2d'), cx = wC.getContext('2d');
  var maskC = document.createElement('canvas'), mx = maskC.getContext('2d');

  /* ---------- layout (all gameplay units are "wu"; screen px = wu * U) ---------- */
  var W = 1, H = 1, DPR = 1, U = 1, HOR = 0, BAND = 1, BX = 0, BXP = 0, BXA = 0;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, window.innerWidth); H = Math.max(220, window.innerHeight);
    [bgC, wC].forEach(function (c) {
      c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
      c.style.width = W + 'px'; c.style.height = H + 'px';
    });
    maskC.width = Math.ceil(W * DPR * 0.5); maskC.height = Math.ceil(H * DPR * 0.5);
    var portrait = H > W;
    U = clamp(Math.min(W / 760, H / 430), 0.55, 2.4);
    HOR = Math.round(H * (portrait ? 0.30 : 0.37));
    BAND = H - HOR;
    BXP = W * (portrait ? 0.24 : 0.25);
    BXA = portrait ? W * 0.5 : W * 0.70;
    BX = G.mode === 'attract' ? BXA : BXP;
  }
  function DY(d) { return HOR + BAND * (0.14 + 0.74 * d); }
  function KS(d) { return lerp(0.62, 1.12, d) * U; }

  /* ---------- definitions ---------- */
  var DEF = {
    rock_small: { img: 'coral',      w: 120, hw: 42, hd: 0.055, hurt: 1, sink: 0.10 },   // coral reef
    rock_big:   { img: 'wreck_teal', w: 150, hw: 56, hd: 0.07,  hurt: 1, sink: 0.22 },   // sunken wreck
    log:        { img: 'wreck_rust', w: 175, hw: 72, hd: 0.035, hurt: 1, sink: 0.28 },   // drifting wreck
    reeds:      { img: 'tentacle',   w: 84,  hw: 22, hd: 0.04,  hurt: 1, sink: 0.03 },   // tentacle
    pad:        { img: 'lily_pad',   w: 100, hw: 42, hd: 0.07,  slow: 1 },
    crow:       { img: 'monkey',     w: 100, hw: 40, hd: 0.06,  hurt: 1 },               // Jack the Monkey
    diya:       { img: 'coin',       w: 44,  hw: 30, hd: 0.08,  pick: 'diya',    light: 70 },   // Aztec gold
    lotus:      { img: 'barrel',     w: 54,  hw: 32, hd: 0.08,  pick: 'lotus' },                 // rum
    koi:        { img: 'kraken',     w: 96,  hw: 34, hd: 0.08,  pick: 'koi' },                  // the Kraken
    lantern:    { img: 'heart',      w: 54,  hw: 32, hd: 0.09,  pick: 'lantern', light: 120 }   // Davy Jones' heart
  };

  var DAYLEN = 24000; // wu per full day (2,400 m)
  var KF = [[0, [1, 0, 0]], [0.30, [1, 0, 0]], [0.43, [0, 1, 0]], [0.54, [0, 0, 1]], [0.86, [0, 0, 1]], [0.93, [0, 1, 0]], [1, [1, 0, 0]]];
  function skyTarget(p) {
    for (var i = 1; i < KF.length; i++) {
      if (p <= KF[i][0]) {
        var a = KF[i - 1], b = KF[i], t = (p - a[0]) / (b[0] - a[0]);
        return [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)];
      }
    }
    return [1, 0, 0];
  }

  /* ---------- state ---------- */
  var G = {
    mode: 'attract', cam: 0, t: 0, speed: 0,
    d: 0.5, dT: 0.5, dPrev: 0.5, lf: 1,
    flame: 100, shield: false, swift: 0, wish: 0, hitIv: 0, slow: 0, pads: false,
    streak: 0, ents: [], fx: [], front: 0, first: true,
    nextLotus: 0, nextKoi: 0, nextLantern: 0, sinceDiya: 0, crowAt: 0, crowQ: 0,
    sk: [0, 1, 0], pOff: 0.41, shake: 0, dying: 0, wakeT: 0, lowT: 0, tick: 0, saveT: 0, prevCyc: 0,
    run: null, keys: { up: false, down: false }, drag: null
  };
  var hooks = { frame: null, over: null, wish: null, toast: null };

  function cyc() { return mod(G.cam / DAYLEN + G.pOff, 1); }
  function mk(type, wx, d, extra) {
    var e = { type: type, def: DEF[type], wx: wx, d: clamp(d, 0.05, 0.95), ph: Math.random() * TAU, deco: G.mode === 'attract' };
    if (extra) for (var k in extra) e[k] = extra[k];
    G.ents.push(e); return e;
  }

  /* ---------- spawner ---------- */
  var P = {
    diyas: function (x) {
      var n = 4 + ((Math.random() * 3) | 0), d0 = rnd(0.2, 0.8), d1 = clamp(d0 + rnd(-0.4, 0.4), 0.12, 0.88);
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), s = t * t * (3 - 2 * t);
        mk('diya', x + i * 74, lerp(d0, d1, s));
      }
      return n * 74;
    },
    rocks: function (x, diff) {
      var d = rnd(0.12, 0.88), big = Math.random() < 0.35 + 0.3 * diff, len = 140;
      mk(big ? 'rock_big' : 'rock_small', x, d);
      if (Math.random() < 0.4 + 0.3 * diff) {
        var d2 = clamp(d + (Math.random() < 0.5 ? -1 : 1) * rnd(0.3, 0.5), 0.1, 0.9);
        if (Math.abs(d2 - d) < 0.28) d2 = d > 0.5 ? d - 0.34 : d + 0.34;
        mk(Math.random() < 0.5 ? 'rock_small' : 'rock_big', x + rnd(90, 200), d2); len = 290;
      }
      return len;
    },
    log: function (x, diff) {
      mk('log', x, rnd(0.2, 0.8), { vx: rnd(20, 45), vd: rnd(-0.05, 0.05) * (0.5 + diff) });
      return 230;
    },
    reeds: function (x, diff) {
      var c = rnd(0.25, 0.75), hw = lerp(0.23, 0.15, diff);
      for (var col = 0; col < 2; col++) {
        for (var d = 0.06; d <= 0.96; d += 0.09) {
          if (Math.abs(d - c) < hw) continue;
          if (col && Math.random() < 0.4) continue;
          mk('reeds', x + col * 46 + rnd(-8, 8), d);
        }
      }
      return 120;
    },
    gate: function (x, diff) {
      var c = rnd(0.3, 0.7), gap = lerp(0.36, 0.30, diff);
      mk('rock_big', x, c - gap / 2 - 0.02);
      mk('rock_big', x + rnd(-20, 20), c + gap / 2 + 0.02);
      mk('diya', x + 8, c);
      return 190;
    },
    pads: function (x) {
      var n = 3 + ((Math.random() * 2) | 0), d = rnd(0.2, 0.8);
      for (var i = 0; i < n; i++) mk('pad', x + i * 70 + rnd(-10, 10), d + rnd(-0.12, 0.12));
      return n * 70 + 40;
    },
    risk: function (x) {
      var c = rnd(0.38, 0.62), s = Math.random() < 0.5 ? -1 : 1, off = [0.32, 0.24, 0.21, 0.24, 0.32];
      mk('rock_big', x + 150, c);
      for (var i = 0; i < 5; i++) mk('diya', x + i * 64 + 20, c + s * off[i]);
      return 330;
    }
  };
  function ensureWorld() {
    var need = G.cam + W / U + 700;
    var guard = 0;
    while (G.front < need && guard++ < 12) spawnNext();
  }
  function spawnNext() {
    var m = G.cam / 10, diff = clamp(m / 3000, 0, 1), x = G.front, name;
    if (G.first) { name = 'diyas'; G.first = false; }
    else if (G.sinceDiya > lerp(1900, 3000, diff)) name = Math.random() < 0.55 ? 'diyas' : 'risk';
    else {
      var opts = [['rocks', 3], ['pads', m > 40 ? 1.2 : 0.4], ['risk', m > 200 ? 1.2 : 0]];
      if (m > 120) opts.push(['log', 1.8]);
      if (m > 260) opts.push(['reeds', 1.4 + diff]);
      if (m > 500) opts.push(['gate', 1 + diff * 1.5]);
      var tot = 0, i; for (i = 0; i < opts.length; i++) tot += opts[i][1];
      var r = Math.random() * tot; name = 'rocks';
      for (i = 0; i < opts.length; i++) { r -= opts[i][1]; if (r <= 0) { name = opts[i][0]; break; } }
    }
    var len = P[name](x, diff);
    var gap = lerp(340, 215, diff) + rnd(0, 110);
    var px = x + len + gap * 0.5;
    if (x > G.nextLotus) { if (!G.shield) mk('lotus', px, rnd(0.2, 0.8)); G.nextLotus = x + rnd(1700, 2800); }
    else if (x > G.nextKoi) { mk('koi', px, rnd(0.2, 0.8)); G.nextKoi = x + rnd(2800, 4200); }
    else if (x > G.nextLantern) { mk('lantern', px, rnd(0.2, 0.8)); G.nextLantern = x + rnd(2100, 3300); }
    G.sinceDiya = (name === 'diyas' || name === 'risk' || name === 'gate') ? 0 : G.sinceDiya + len + gap;
    G.front = x + len + gap;
  }
  function spawnCrow() {
    var lead = 1.1, v = Math.max(G.speed, 200);
    mk('crow', G.cam + W / U + 1.85 * v * lead, G.d + rnd(-0.12, 0.12), { vx: -0.85 * v });
    Sound.play('caw');
  }

  /* ---------- fx ---------- */
  function ring(wx, d, r, color, life, a) { G.fx.push({ k: 'ring', wx: wx, d: d, t: 0, life: life || 0.7, r: r, color: color || '255,255,255', a: a == null ? 0.55 : a }); }
  function label(wx, d, text) { G.fx.push({ k: 'txt', wx: wx, d: d, t: 0, life: 1.5, text: text }); }
  function haptic(ms) { if (D.settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { } } }

  /* ---------- gameplay events ---------- */
  function bwx() { return G.cam; } // the boat sits at screen x = BX, which is world x = cam
  function collect(e) {
    var r = G.run, k = e.def.pick, bw = bwx();
    if (k === 'diya') {
      G.flame = Math.min(100, G.flame + 7); D.diyas++; r.diyas++; G.streak++;
      r.streak = Math.max(r.streak, G.streak); D.streakBest = Math.max(D.streakBest, r.streak);
      Sound.play('diya', G.streak - 1);
      ring(e.wx, e.d, 34, '255,214,120');
    } else if (k === 'lotus') {
      G.shield = true; D.lotus++; r.lotus++; Sound.play('lotus');
      ring(e.wx, e.d, 48, '240,120,170', 0.9); label(bw, G.d, 'Rum shield');
    } else if (k === 'koi') {
      G.swift = 4.5; D.koi++; r.koi++; Sound.play('koi');
      ring(e.wx, e.d, 52, '255,255,255', 0.9); label(bw, G.d, "Kraken's surge");
    } else if (k === 'lantern') {
      G.wish = 9; D.lantern++; r.lantern++; Sound.play('lantern');
      ring(e.wx, e.d, 56, '255,196,110', 1); label(bw, G.d, "Heart's glow");
    }
    D.pairBest = Math.max(D.pairBest, (r.koi > 0 ? 1 : 0) + (r.lotus > 0 ? 1 : 0));
    Store.saveSoon(); checkWishes();
  }
  function hurt() {
    if (G.swift > 0 || G.hitIv > 0) return;
    if (G.shield) {
      G.shield = false; G.hitIv = 1.1; Sound.play('shield'); label(bwx(), G.d, 'Shield spent');
      ring(bwx(), G.d, 56, '240,120,170', 0.8); return;
    }
    G.flame -= 24; G.hitIv = 1.5; G.slow = 1; G.streak = 0; G.run.lastHit = G.cam; G.shake = 0.28;
    Sound.play('hit'); haptic(45);
    if (G.flame <= 0) { G.flame = 0; die(); }
  }
  function checkWishes() {
    var out = Store.evaluate(G.run);
    if (out.length) {
      Sound.play('wish');
      out.forEach(function (w) { if (G.run) G.run.granted.push(w.name); if (hooks.wish) hooks.wish(w); });
    }
  }
  function die() {
    if (G.mode !== 'play') return;
    G.mode = 'dying'; G.dying = 0; G.streak = 0;
    Sound.play('over'); haptic([60, 40, 90]);
    Store.save();
  }

  /* ---------- update ---------- */
  function worldTick(dt, collide) {
    ensureWorld();
    var tg = skyTarget(cyc());
    for (var i = 0; i < 3; i++) G.sk[i] += (tg[i] - G.sk[i]) * Math.min(1, dt * 1.6);

    var bw = bwx(), onPad = false, ents = G.ents;
    for (var n = ents.length - 1; n >= 0; n--) {
      var e = ents[n], df = e.def;
      if (e.vx) e.wx += e.vx * dt;
      if (e.vd) { e.d += e.vd * dt; if (e.d < 0.1 || e.d > 0.9) { e.vd = -e.vd; e.d = clamp(e.d, 0.1, 0.9); } }
      var dx = e.wx - bw;
      if (dx < -520) { ents.splice(n, 1); continue; }
      if (!collide || e.deco) continue;

      if (df.pick && G.wish > 0 && dx > -60 && dx < 210) { // lantern light draws things in
        e.d += (G.d - e.d) * Math.min(1, dt * 4.5);
        e.wx += (bw - e.wx) * Math.min(1, dt * 2.4);
        dx = e.wx - bw;
      }
      if (Math.abs(dx) < df.hw + 54 && Math.abs(e.d - G.d) < df.hd + 0.04) {
        if (df.pick) { collect(e); ents.splice(n, 1); continue; }
        if (df.hurt && !e.hit) { e.hit = true; hurt(); }
        if (df.slow) onPad = true;
      }
      if (df.pick === 'diya' && dx < -60 && !e.miss) { e.miss = true; G.streak = 0; }
      if (e.type === 'crow' && !e.hit && !e.counted && dx < -70) { e.counted = true; D.crows++; G.run.crows++; }
    }
    G.pads = onPad;

    for (var f = G.fx.length - 1; f >= 0; f--) { G.fx[f].t += dt; if (G.fx[f].t > G.fx[f].life) G.fx.splice(f, 1); }
  }

  function stepAttract(dt) {
    G.t += dt;
    G.speed += (70 - G.speed) * Math.min(1, dt * 2);
    G.cam += G.speed * dt;
    G.dT = 0.5 + 0.28 * Math.sin(G.t * 0.35);
    G.dPrev = G.d; G.d += (G.dT - G.d) * (1 - Math.exp(-dt * 3));
    G.flame = 100; G.lf += (1 - G.lf) * Math.min(1, dt * 3);
    // the river remembers: every diya you ever lit drifts here
    var want = Math.min(D.diyas, 70), have = 0;
    for (var i = 0; i < G.ents.length; i++) if (G.ents[i].lit) have++;
    if (have < want) {
      var e = mk('diya', G.cam + W / U + rnd(0, 900), rnd(0.08, 0.92), { lit: true, w: 34, deco: true });
      if (have < want - 6) e.wx = G.cam + rnd(-100, W / U + 900); // fill the river on first show
    }
    G.wakeT -= dt;
    if (G.wakeT <= 0) { G.wakeT = 0.14; ring(bwx() - 40, G.d, 34, '255,255,255', 1, 0.25); }
    worldTick(dt, false);
  }

  function stepPlay(dt) {
    G.t += dt;
    var r = G.run, m = G.cam / 10, diff = clamp(m / 3000, 0, 1);
    G.hitIv = Math.max(0, G.hitIv - dt); G.swift = Math.max(0, G.swift - dt); G.wish = Math.max(0, G.wish - dt);
    G.slow = Math.max(0, G.slow - dt * 0.7); G.shake = Math.max(0, G.shake - dt);

    var vt = 230 + 250 * (1 - Math.exp(-m / 2500));
    if (G.swift > 0) vt *= 1.55;
    vt *= 1 - 0.42 * G.slow;
    if (G.pads) vt *= 0.72;
    G.speed += (vt - G.speed) * Math.min(1, dt * 3.5);
    G.cam += G.speed * dt;

    if (G.keys.up || G.keys.down) G.dT = clamp(G.dT + ((G.keys.down ? 1 : 0) - (G.keys.up ? 1 : 0)) * dt * 1.25, 0.02, 0.98);
    G.dPrev = G.d; G.d = clamp(G.d + (G.dT - G.d) * (1 - Math.exp(-dt * 11)), 0.02, 0.98);

    G.flame -= (3.0 + 2.0 * diff) * dt * (G.swift > 0 ? 0.5 : 1);
    G.lf += (G.flame / 100 - G.lf) * Math.min(1, dt * 4);

    if (m > 180 && G.t >= G.crowAt) {
      spawnCrow();
      G.crowAt = G.t + lerp(12, 6.5, diff) + rnd(0, 4);
      if (diff > 0.45 && Math.random() < 0.35) G.crowQ = 0.9;
    }
    if (G.crowQ > 0) { G.crowQ -= dt; if (G.crowQ <= 0) spawnCrow(); }

    G.wakeT -= dt;
    if (G.wakeT <= 0) { G.wakeT = 0.12; ring(bwx() - 40, G.d, 34, '255,255,255', 1, 0.25); }

    worldTick(dt, true);

    // bookkeeping
    r.dist = Math.floor(G.cam / 10);
    r.clean = (G.cam - r.lastHit) / 10;
    if (r.dist > D.best) D.best = r.dist;
    D.cleanBest = Math.max(D.cleanBest, r.clean);
    D.totalDist += G.speed * dt / 10;
    if (r.startBest > 0 && !r.passedBest && r.dist > r.startBest) {
      r.passedBest = true; Sound.play('best'); label(bwx(), G.d, 'New best');
      if (hooks.toast) hooks.toast('New best distance');
    }
    var cy = cyc();
    if (G.prevCyc < 0.9 && cy >= 0.9) { D.nights++; checkWishes(); }
    G.prevCyc = cy;

    if (G.flame < 22) { G.lowT -= dt; if (G.lowT <= 0) { G.lowT = 1.6; Sound.play('low'); } }
    G.tick += dt; if (G.tick > 0.5) { G.tick = 0; checkWishes(); Sound.setNight(G.sk[2]); }
    G.saveT += dt; if (G.saveT > 6) { G.saveT = 0; Store.saveSoon(); }
    if (G.flame <= 0) { G.flame = 0; die(); }
  }

  function stepDying(dt) {
    G.t += dt; G.dying += dt;
    G.speed *= Math.pow(0.03, dt); G.cam += G.speed * dt;
    G.lf += (0 - G.lf) * Math.min(1, dt * 2.6);
    G.dPrev = G.d;
    worldTick(dt, false);
    if (G.dying > 1.7) {
      G.mode = 'over';
      var r = G.run; D.totalDist = Math.round(D.totalDist);
      Store.save();
      if (hooks.over) hooks.over({ dist: r.dist, diyas: r.diyas, best: D.best, newBest: r.startBest > 0 ? r.dist > r.startBest : r.dist > 0, granted: r.granted.slice(), lotus: r.lotus, koi: r.koi, lantern: r.lantern });
    }
  }
  function stepOver(dt) { G.t += dt; worldTick(dt, false); }

  function step(dt) {
    switch (G.mode) {
      case 'attract': stepAttract(dt); break;
      case 'play': stepPlay(dt); break;
      case 'dying': stepDying(dt); break;
      case 'over': stepOver(dt); break;
    }
  }

  /* ---------- drawing helpers ---------- */
  function img(im, x, y, w, anchor, alpha) {
    if (!im || !im.naturalWidth) return;
    var h = w * im.naturalHeight / im.naturalWidth;
    if (alpha != null && alpha !== 1) cx.globalAlpha = alpha;
    cx.drawImage(im, x - w / 2, y - h * (anchor == null ? 1 : anchor), w, h);
    if (alpha != null && alpha !== 1) cx.globalAlpha = 1;
  }
  function ripple(x, y, rx, k, a) {
    cx.strokeStyle = 'rgba(255,255,255,' + (a == null ? 0.3 : a) + ')'; cx.lineWidth = 1.3 * k;
    cx.beginPath(); cx.ellipse(x, y, rx, rx * 0.16, 0, 0, TAU); cx.stroke();
  }
  function shadow(x, y, rx, a) {
    cx.fillStyle = 'rgba(8,24,40,' + (a == null ? 0.16 : a) + ')';
    cx.beginPath(); cx.ellipse(x, y, rx, rx * 0.14, 0, 0, TAU); cx.fill();
  }
  function layer(im, par, hWu, baseY) {
    if (!im.naturalWidth) return;
    var h = hWu * U, s = h / im.naturalHeight, w = im.naturalWidth * s;
    var off = -((G.cam * par * U) % w);
    for (var x = off; x < W; x += w) cx.drawImage(im, x, baseY - h, w + 1, h);
  }

  /* ---------- sky (own canvas, never darkened) ---------- */
  function drawSky() {
    bg.setTransform(DPR, 0, 0, DPR, 0, 0);
    var sk = G.sk, p = cyc(), t = G.t;
    bg.globalAlpha = 1; bg.fillStyle = '#0b1622'; bg.fillRect(0, 0, W, H);
    var sh = HOR + 40;
    bg.drawImage(IM.sky_day, 0, 0, W, sh);
    if (sk[1] > 0.005) { bg.globalAlpha = sk[1]; bg.drawImage(IM.sky_dusk, 0, 0, W, sh); }
    if (sk[2] > 0.005) { bg.globalAlpha = sk[2]; bg.drawImage(IM.sky_night, 0, 0, W, sh); }

    // stars
    if (sk[2] > 0.05 && IM.stars.naturalWidth) {
      var sH = sh, sW = sH * 1.5, so = mod(t * 2.5 + G.cam * 0.004, sW);
      for (var pass = 0; pass < 2; pass++) {
        bg.globalAlpha = sk[2] * 0.95 * (0.72 + 0.28 * Math.sin(t * 1.2 + pass * 2.4));
        for (var x = -so; x < W; x += sW) {
          if (pass) { bg.save(); bg.translate(x + sW, 0); bg.scale(-1, 1); bg.drawImage(IM.stars, 0, 0, sW, sH); bg.restore(); }
          else bg.drawImage(IM.stars, x, 0, sW, sH);
        }
      }
    }
    // sun and moon travel one arc each
    var q, ax, ay, a;
    if (p < 0.47) {
      q = p / 0.47; ax = lerp(0.1, 0.9, q) * W; ay = HOR + 20 * U - Math.sin(Math.PI * q) * HOR * 0.8;
      a = clamp(Math.sin(Math.PI * q) * 3, 0, 1);
      bg.globalAlpha = a; ibg(IM.sun, ax, ay, 62 * U);
    }
    if (p >= 0.5 && p < 0.96) {
      q = (p - 0.5) / 0.46; ax = lerp(0.1, 0.9, q) * W; ay = HOR + 20 * U - Math.sin(Math.PI * q) * HOR * 0.78;
      a = clamp(Math.sin(Math.PI * q) * 3, 0, 1);
      bg.globalAlpha = a; ibg(IM.moon, ax, ay, 44 * U);
    }
    // clouds
    var cloudA = 0.92 * sk[0] + 0.7 * sk[1] + 0.2 * sk[2], R = W / U + 520;
    bg.globalAlpha = cloudA;
    for (var i = 0; i < CLOUDS.length; i++) {
      var c = CLOUDS[i], xw = mod(c.x - (G.cam * c.par + t * c.dr), R) - 260;
      ibg(IM[c.img], xw * U, HOR * c.y, c.w * U);
    }
    // a flock, now and then, in daylight
    var ba = (sk[0] + sk[1] * 0.8) * 0.75;
    if (ba > 0.02) {
      var bw = mod(-t * 24 - G.cam * 0.04 + 1500, W / U + 1400) - 500;
      bg.globalAlpha = ba; ibg(IM.bird_flock, bw * U, HOR * 0.42 + Math.sin(t * 0.5) * 4, 86 * U);
    }
    bg.globalAlpha = 1;
  }
  function ibg(im, x, y, w) {
    if (!im || !im.naturalWidth) return;
    var h = w * im.naturalHeight / im.naturalWidth;
    bg.drawImage(im, x - w / 2, y - h / 2, w, h);
  }
  var CLOUDS = [
    { img: 'cloud_a', x: 60,   y: 0.30, w: 210, par: 0.10, dr: 7 },
    { img: 'cloud_b', x: 430,  y: 0.58, w: 120, par: 0.14, dr: 9 },
    { img: 'cloud_a', x: 780,  y: 0.16, w: 170, par: 0.08, dr: 5 },
    { img: 'cloud_b', x: 1130, y: 0.40, w: 140, par: 0.12, dr: 8 }
  ];

  /* ---------- water ---------- */
  var STREAKS = []; for (var si = 0; si < 18; si++) STREAKS.push({ x: rnd(0, 1400), d: rnd(0.04, 1), len: rnd(26, 64) });
  function drawWater() {
    var im = IM.water_tile, N = 9;
    if (im.naturalWidth) {
      var sw = im.naturalWidth, sh = im.naturalHeight / N;
      for (var i = 0; i < N; i++) {
        var f0 = Math.pow(i / N, 1.3), f1 = Math.pow((i + 1) / N, 1.3);
        var y0 = HOR + BAND * f0, y1 = HOR + BAND * f1, dm = (f0 + f1) / 2;
        var tw = sw * lerp(0.34, 0.95, dm) * U * 0.9, sp = lerp(0.62, 1.12, dm) * 0.95;
        var off = -((G.cam * sp * U + G.t * 9 * U) % tw);
        for (var x = off; x < W; x += tw) cx.drawImage(im, 0, i * sh, sw, sh, x, y0, tw + 1, y1 - y0 + 1);
      }
    }
    cx.fillStyle = 'rgba(10,40,72,0.44)'; cx.fillRect(0, HOR, W, BAND);
    var gd = cx.createLinearGradient(0, HOR + BAND * 0.35, 0, H);
    gd.addColorStop(0, 'rgba(6,24,48,0)'); gd.addColorStop(1, 'rgba(6,24,48,0.34)');
    cx.fillStyle = gd; cx.fillRect(0, HOR + BAND * 0.35, W, BAND * 0.65);
    var gr = cx.createLinearGradient(0, HOR, 0, HOR + BAND * 0.32);
    gr.addColorStop(0, 'rgba(208,224,240,0.34)'); gr.addColorStop(1, 'rgba(208,224,240,0)');
    cx.fillStyle = gr; cx.fillRect(0, HOR, W, BAND * 0.32);
    // a few flow lines so speed reads
    cx.lineCap = 'round';
    var R = W / U + 300;
    for (var s = 0; s < STREAKS.length; s++) {
      var st = STREAKS[s], k = KS(st.d), sp2 = lerp(0.62, 1.12, st.d);
      var xw = mod(st.x - G.cam * sp2, R) - 100, yy = DY(st.d) + Math.sin(s * 3.1) * 6 * k;
      cx.strokeStyle = 'rgba(255,255,255,0.16)'; cx.lineWidth = 1.5 * k;
      cx.beginPath(); cx.moveTo(xw * U, yy); cx.lineTo((xw + st.len) * U * (0.7 + 0.3 * st.d), yy); cx.stroke();
    }
  }

  /* ---------- best-distance bunting ---------- */
  var BUNT = ['#F4B01E', '#E2548C', '#3C86C8', '#E8EDF2'];
  function drawBestLine() {
    var r = G.run; if (!r || r.startBest < 40) return;
    var sx = BX + (r.startBest * 10 - G.cam) * U;
    if (sx < -80 || sx > W + 80) return;
    var d0 = 0.03, d1 = 0.97, y0 = DY(d0), y1 = DY(d1), k0 = KS(d0), k1 = KS(d1), h0 = 78 * k0, h1 = 78 * k1;
    cx.lineCap = 'round';
    cx.strokeStyle = '#6a4a32';
    cx.lineWidth = 3 * k0; cx.beginPath(); cx.moveTo(sx, y0); cx.lineTo(sx, y0 - h0); cx.stroke();
    cx.lineWidth = 3.4 * k1; cx.beginPath(); cx.moveTo(sx, y1); cx.lineTo(sx, y1 - h1); cx.stroke();
    var ax = sx, ay = y0 - h0, bx2 = sx, by2 = y1 - h1, cxp = sx + 26 * U, cyp = (ay + by2) / 2;
    cx.strokeStyle = 'rgba(232,237,242,0.8)'; cx.lineWidth = 1.2 * U;
    cx.beginPath(); cx.moveTo(ax, ay); cx.quadraticCurveTo(cxp, cyp, bx2, by2); cx.stroke();
    for (var i = 0; i < 9; i++) {
      var t = 0.07 + i * 0.108, u = 1 - t;
      var px = u * u * ax + 2 * u * t * cxp + t * t * bx2, py = u * u * ay + 2 * u * t * cyp + t * t * by2;
      var kk = lerp(k0, k1, t), sz = 8 * kk;
      cx.fillStyle = BUNT[i % 4];
      cx.beginPath(); cx.moveTo(px - sz, py); cx.lineTo(px + sz, py); cx.lineTo(px, py + sz * 2.2); cx.closePath(); cx.fill();
    }
    cx.font = '600 ' + (13 * k1) + 'px ' + FONT; cx.textAlign = 'left'; cx.textBaseline = 'middle';
    var tag = 'Your best  ' + r.startBest.toLocaleString() + ' m', tw = cx.measureText(tag).width;
    var tx = sx + 10 * k1, ty = y1 - h1 * 0.45;
    cx.fillStyle = 'rgba(15,30,46,0.82)'; cx.fillRect(tx - 6 * k1, ty - 11 * k1, tw + 12 * k1, 22 * k1);
    cx.fillStyle = '#E8EDF2'; cx.fillText(tag, tx, ty);
  }

  /* ---------- entities ---------- */
  var lights = [];
  function drawEnt(e) {
    var df = e.def, k = KS(e.d), y = DY(e.d), x = BX + (e.wx - G.cam) * U;
    var w0 = (e.w || df.w) * k;
    if (x < -w0 - 90 || x > W + w0 + 90) return;
    var im = IM[df.img]; if (!im.naturalWidth) return;
    var h = w0 * im.naturalHeight / im.naturalWidth, t = G.t, T = e.type;
    switch (T) {
      case 'rock_small': case 'rock_big':
        ripple(x, y, w0 * 0.5, k); img(im, x, y + h * df.sink, w0); break;
      case 'log':
        ripple(x, y, w0 * 0.5, k);
        cx.save(); cx.translate(x, y + Math.sin(t * 1.3 + e.ph) * 1.5 * k); cx.rotate(Math.sin(t * 0.9 + e.ph) * 0.02);
        img(im, 0, h * df.sink, w0); cx.restore(); break;
      case 'reeds':
        ripple(x, y, w0 * 0.45, k);
        cx.save(); cx.translate(x, y); cx.rotate(Math.sin(t * 1.1 + e.ph) * 0.03); img(im, 0, h * df.sink, w0); cx.restore(); break;
      case 'pad':
        img(im, x, y + Math.sin(t * 1.2 + e.ph) * k, w0, 0.5); break;
      case 'diya': { // Aztec gold: a slow turn so it catches the eye
        var sp = 0.8 + 0.2 * Math.cos(t * 2.2 + e.ph);
        ripple(x, y, w0 * 0.6, k, 0.28);
        cx.save(); cx.translate(x, y + Math.sin(t * 2 + e.ph) * 2 * k - h * 0.3); cx.scale(sp, 1); img(im, 0, 0, w0, 0.5); cx.restore();
        e.lx = x; e.ly = y - h * 0.3; e.lr = df.light * k * (e.w ? 0.7 : 1); lights.push(e); break; }
      case 'lotus': // rum barrel, bobbing
        ripple(x, y, w0 * 0.6, k, 0.28);
        cx.save(); cx.translate(x, y + Math.sin(t * 1.6 + e.ph) * 2 * k); cx.rotate(Math.sin(t * 1.2 + e.ph) * 0.08);
        img(im, 0, h * 0.2, w0); cx.restore(); break;
      case 'koi': { // the Kraken surfaces, then slips under again
        var u = ((t * 0.8 + e.ph) % 3.2) / 3.2;
        ripple(x, y, w0 * (0.4 + 0.2 * Math.sin(t * 2 + e.ph)), k, 0.3);
        if (u < 0.7) {
          var q = Math.sin(Math.PI * u / 0.7);
          cx.save(); cx.beginPath(); cx.rect(x - w0, y - 1200, w0 * 2, 1200); cx.clip();
          cx.translate(x, y + h * (1 - 0.9 * q)); cx.rotate(Math.sin(t * 2 + e.ph) * 0.03); img(im, 0, 0, w0, 1); cx.restore();
        }
        break; }
      case 'lantern': { // Davy Jones' heart, beating on the water
        var beat = 1 + 0.07 * Math.pow(Math.max(0, Math.sin(t * 4.2 + e.ph)), 6), hov = (26 + Math.sin(t * 1.3 + e.ph) * 4) * k;
        shadow(x, y, w0 * 0.45, 0.14);
        cx.save(); cx.translate(x, y - hov); cx.scale(beat, beat); img(im, 0, 0, w0, 0.5); cx.restore();
        e.lx = x; e.ly = y - hov; e.lr = df.light * k; lights.push(e); break; }
      case 'crow': { // Jack the Monkey, leaping at you (he already faces left)
        var hv = (44 + Math.sin(t * 3.4 + e.ph) * 12) * k;
        shadow(x, y, w0 * 0.4, 0.18);
        cx.save(); cx.translate(x, y - hv); cx.rotate(-0.12 + Math.sin(t * 6 + e.ph) * 0.08); img(im, 0, 0, w0, 0.5); cx.restore();
        break; }
    }
  }
  function drawCrowWarnings() {
    for (var i = 0; i < G.ents.length; i++) {
      var e = G.ents[i]; if (e.type !== 'crow') continue;
      var x = BX + (e.wx - G.cam) * U; if (x < W - 20) continue;
      var k = KS(e.d), y = DY(e.d), a = 0.5 + 0.4 * Math.sin(G.t * 12);
      cx.save(); cx.setLineDash([7 * k, 9 * k]); cx.strokeStyle = 'rgba(255,255,255,0.22)'; cx.lineWidth = 1.5 * k;
      cx.beginPath(); cx.moveTo(W - 56 * U, y); cx.lineTo(BX + 60 * U, y); cx.stroke(); cx.restore();
      cx.save(); cx.translate(W - 38 * U, y - 40 * k); img(IM.monkey, 0, 0, 46 * k, 0.5, a); cx.restore();
    }
  }
  function drawFx() {
    for (var i = 0; i < G.fx.length; i++) {
      var f = G.fx[i], x = BX + (f.wx - G.cam) * U, k = KS(f.d), y = DY(f.d), q = f.t / f.life;
      if (f.k === 'ring') {
        var rx = f.r * (0.4 + q) * k;
        cx.strokeStyle = 'rgba(' + f.color + ',' + ((1 - q) * f.a).toFixed(3) + ')'; cx.lineWidth = 1.6 * k;
        cx.beginPath(); cx.ellipse(x, y, rx, rx * 0.2, 0, 0, TAU); cx.stroke();
      } else {
        cx.globalAlpha = 1 - q * q; cx.font = '600 ' + (15 * U) + 'px ' + FONT; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        var ty = y - (62 + q * 34) * k;
        cx.lineWidth = 3.5 * U; cx.strokeStyle = 'rgba(10,22,34,0.75)'; cx.strokeText(f.text, x, ty);
        cx.fillStyle = '#E8EDF2'; cx.fillText(f.text, x, ty); cx.globalAlpha = 1;
      }
    }
  }
  function drawBoat() {
    var k = KS(G.d), y = DY(G.d), x = BX, t = G.t;
    var bob = Math.sin(t * 1.5) * 1.8 * k, vy = (G.d - G.dPrev) * 60;
    var tilt = clamp(vy * 0.25, -0.08, 0.08) + Math.sin(t * 1.2) * 0.02;
    var w = 200 * k, im = IM.pearl, h = w * im.naturalHeight / im.naturalWidth;
    ripple(x, y, w * 0.42, k, 0.38); ripple(x, y, w * 0.56, k, 0.18);
    var alpha = 1;
    if (G.hitIv > 0 && G.swift <= 0) alpha = (Math.floor(t * 12) % 2) ? 0.45 : 1;
    cx.save(); cx.translate(x, y + bob); cx.rotate(tilt); cx.globalAlpha = alpha;
    img(im, 0, h * 0.1, w);
    // stern windows glow with the lantern: they dim as the flame dies
    var fl = clamp(G.flame / 100, 0, 1) * (1 + 0.08 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29));
    if (fl > 0.02) {
      var bx0 = -w / 2, by0 = h * 0.1 - h;
      cx.fillStyle = 'rgba(255,196,96,' + clamp(fl * 0.95, 0, 1).toFixed(3) + ')';
      [0.034, 0.063, 0.093].forEach(function (fx, i) {
        var wx = bx0 + fx * w, wy = by0 + (0.750 + i * 0.0055) * h;
        cx.beginPath(); cx.ellipse(wx, wy + 0.004 * w, 0.0105 * w, 0.0165 * w, 0, 0, TAU); cx.fill();
      });
    }
    if (G.shield) {
      cx.globalAlpha = 0.85; cx.strokeStyle = '#F4B01E'; cx.lineWidth = 2.2 * k;
      cx.beginPath(); cx.ellipse(0, -h * 0.4, w * 0.58, h * 0.62, 0, 0, TAU); cx.stroke();
    }
    cx.restore(); cx.globalAlpha = 1;
  }
  function drawSwiftLines() {
    if (G.swift <= 0) return;
    cx.strokeStyle = 'rgba(255,255,255,0.28)'; cx.lineWidth = 1.6 * U; cx.lineCap = 'round';
    for (var i = 0; i < 12; i++) {
      var yy = HOR + BAND * (0.14 + 0.8 * mod(i * 0.381, 1)), xx = mod(i * 157 - G.t * 1100 * U, W + 240) - 120, len = (50 + (i % 4) * 26) * U;
      cx.beginPath(); cx.moveTo(xx, yy); cx.lineTo(xx + len, yy); cx.stroke();
    }
  }

  /* ---------- darkness: the flame is the light ---------- */
  function lightBlob(c, x, y, rx, ry, s) {
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    var gr = c.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
    gr.addColorStop(0, 'rgba(0,0,0,' + s + ')'); gr.addColorStop(0.55, 'rgba(0,0,0,' + (s * 0.6) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
  }
  function applyLight() {
    var sk = G.sk, dusk = sk[1], night = sk[2];
    var dark = night * 0.82 + dusk * 0.12;
    // warm evening wash
    if (dusk > 0.01) { cx.globalCompositeOperation = 'source-atop'; cx.fillStyle = 'rgba(255,128,48,' + (dusk * 0.12).toFixed(3) + ')'; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'source-over'; }
    if (dark < 0.01) return;
    var dyingBoost = G.mode === 'dying' || G.mode === 'over' ? 1 : 0;
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, maskC.width, maskC.height);
    mx.setTransform(DPR * 0.5, 0, 0, DPR * 0.5, 0, 0);
    mx.fillStyle = 'rgba(5,9,32,' + dark.toFixed(3) + ')'; mx.fillRect(0, 0, W, H);
    mx.globalCompositeOperation = 'destination-out';
    var f = clamp(G.lf, 0, 1), fl = 1 + 0.03 * Math.sin(G.t * 13) + 0.02 * Math.sin(G.t * 29);
    if (G.flame < 25 && G.mode === 'play') fl += 0.05 * Math.sin(G.t * 47);
    var rx = (100 + 250 * f) * U * (G.wish > 0 ? 1.45 : 1) * fl, ry = rx * 0.62;
    var by = DY(G.d) - 40 * KS(G.d);
    lightBlob(mx, BX + rx * 0.25, by, rx, ry, 1);
    for (var i = 0; i < lights.length; i++) {
      var e = lights[i]; lightBlob(mx, e.lx, e.ly, e.lr, e.lr * 0.8, 0.95);
    }
    mx.globalCompositeOperation = 'source-over';
    cx.globalCompositeOperation = 'source-atop';
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.drawImage(maskC, 0, 0, wC.width, wC.height);
    cx.globalCompositeOperation = 'source-over';
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ---------- frame ---------- */
  function render() {
    drawSky();
    cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.globalAlpha = 1; cx.clearRect(0, 0, W, H);
    layer(IM.mountains_far, 0.05, HOR * 0.62 / U, HOR + 2);
    layer(IM.hills_mid, 0.14, HOR * 0.45 / U, HOR + 2);
    layer(IM.trees_bank, 0.45, HOR * 0.33 / U, HOR + 3);
    drawWater();
    cx.save();
    if (G.shake > 0) cx.translate((Math.random() - 0.5) * 9 * U * (G.shake / 0.28), (Math.random() - 0.5) * 5 * U * (G.shake / 0.28));
    drawBestLine();
    lights.length = 0;
    var sorted = G.ents.slice().sort(function (a, b) { return a.d - b.d; }), boatDone = false;
    for (var i = 0; i < sorted.length; i++) {
      if (!boatDone && sorted[i].d > G.d) { drawBoat(); boatDone = true; }
      drawEnt(sorted[i]);
    }
    if (!boatDone) drawBoat();
    drawFx(); drawSwiftLines(); drawCrowWarnings();
    cx.restore();
    applyLight();
  }

  var last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, ((ts - last) / 1000) || 0.016); last = ts;
    BX = G.mode === 'attract' ? BXA : BXP;
    step(dt); render();
    if (hooks.frame) hooks.frame(G);
  }

  /* ---------- input ---------- */
  var ptr = null;
  function onDown(e) {
    if (G.mode !== 'play') return;
    ptr = { id: e.pointerId, y: e.clientY, dT: G.dT };
    try { wC.setPointerCapture(e.pointerId); } catch (x) { }
  }
  function onMove(e) {
    if (!ptr || e.pointerId !== ptr.id || G.mode !== 'play') return;
    G.dT = clamp(ptr.dT + (e.clientY - ptr.y) / (BAND * 0.74 * 0.82), 0.02, 0.98);
  }
  function onUp(e) { if (ptr && e.pointerId === ptr.id) ptr = null; }
  wC.addEventListener('pointerdown', onDown);
  wC.addEventListener('pointermove', onMove);
  wC.addEventListener('pointerup', onUp);
  wC.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { G.keys.up = true; if (G.mode === 'play') e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { G.keys.down = true; if (G.mode === 'play') e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') G.keys.up = false;
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') G.keys.down = false;
  });
  window.addEventListener('blur', function () { G.keys.up = G.keys.down = false; ptr = null; });

  /* ---------- public api ---------- */
  function resetRiver() {
    G.ents.length = 0; G.fx.length = 0; G.first = true;
    G.front = (W / U) * 0.85 + 160;
    G.nextLotus = 1800; G.nextKoi = 3300; G.nextLantern = 2500; G.sinceDiya = 0;
  }
  var Game = {
    init: function () {
      resize(); window.addEventListener('resize', resize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
      resetRiver(); Game.home();
      requestAnimationFrame(function (ts) { last = ts; frame(ts); });
    },
    home: function () {
      G.mode = 'attract'; G.run = null; G.cam = 0; G.t = 0; G.speed = 70; G.pOff = 0.41;
      G.d = G.dT = G.dPrev = 0.5; G.flame = 100; G.lf = 1; G.shield = false; G.swift = G.wish = G.hitIv = G.slow = 0; G.streak = 0;
      G.sk = skyTarget(cyc()).slice(); resetRiver();
      Sound.setMuffled(false); Sound.setNight(G.sk[2]);
    },
    start: function () {
      resize(); resetRiver();
      G.mode = 'play'; G.cam = 0; G.t = 0; G.speed = 150; G.pOff = 0; G.prevCyc = 0;
      G.d = G.dT = G.dPrev = 0.5; G.flame = 100; G.lf = 1; G.shield = false; G.swift = G.wish = G.hitIv = G.slow = 0;
      G.streak = 0; G.crowAt = 14; G.crowQ = 0; G.tick = 0; G.saveT = 0; G.lowT = 0; G.shake = 0; G.wakeT = 0;
      G.sk = [1, 0, 0];
      G.run = { dist: 0, diyas: 0, lotus: 0, koi: 0, lantern: 0, crows: 0, streak: 0, clean: 0, lastHit: 0, startBest: D.best, passedBest: false, granted: [] };
      D.runs++; Store.save();
      Sound.setMuffled(false); Sound.setNight(0);
      ensureWorld();
    },
    pause: function () { if (G.mode === 'play') { G.mode = 'pause'; Sound.setMuffled(true); G.keys.up = G.keys.down = false; ptr = null; return true; } return false; },
    resume: function () { if (G.mode === 'pause') { G.mode = 'play'; Sound.setMuffled(false); return true; } return false; },
    mode: function () { return G.mode; },
    on: function (name, fn) { hooks[name] = fn; },
    state: G,
    _mk: mk,
    resize: resize
  };
  g.Game = Game;
})(window);
