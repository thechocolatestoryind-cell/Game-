/* Black Pearl — menus, HUD, settings, PWA wiring */
(function (g) {
  'use strict';
  var D = Store.data;
  var $ = function (id) { return document.getElementById(id); };
  var screens = ['title', 'how', 'wishes', 'settings', 'pause', 'over'];
  var current = null, returnTo = 'title';

  function show(name) {
    screens.forEach(function (s) { $('screen-' + s).hidden = (s !== name); });
    current = name;
    var playing = name === null;
    $('hud').hidden = !(playing || name === 'pause');
    if (name === 'title') renderTitle();
    if (name === 'wishes') renderWishes();
    if (name === 'settings') renderSettings();
  }
  function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }

  /* ---- fade between title and run ---- */
  function fadeThen(fn) {
    var f = $('fade'); f.classList.add('on');
    setTimeout(function () { fn(); requestAnimationFrame(function () { f.classList.remove('on'); }); }, 220);
  }

  /* ---- title ---- */
  function renderTitle() {
    var m = $('title-meta');
    if (!D.runs) { m.innerHTML = ''; return; }
    m.innerHTML = '<span>Best <b>' + fmt(D.best) + ' m</b></span><span>Gold taken <b>' + fmt(D.diyas) + '</b></span>';
  }

  /* ---- wishes ---- */
  function renderWishes() {
    var list = $('wishes-list'), done = 0, html = '';
    Store.WISHES.forEach(function (w) {
      var granted = !!D.wishes[w.id], v = Math.min(w.goal, Math.floor(w.val(D, null)));
      if (granted) { done++; v = w.goal; }
      var pct = Math.round(100 * v / w.goal);
      html += '<li class="' + (granted ? 'lit' : '') + '"><img src="images/coin.webp" alt="">' +
        '<div><h3>' + w.name + '</h3><p>' + w.desc + '</p>' +
        '<div class="pbar"><i style="width:' + pct + '%"></i></div></div>' +
        '<span class="count">' + (granted ? 'Granted' : fmt(v) + ' / ' + fmt(w.goal)) + '</span></li>';
    });
    list.innerHTML = html;
    $('wishes-sub').textContent = done + ' of ' + Store.WISHES.length + ' granted';
  }

  /* ---- settings ---- */
  function setToggle(btn, on) { btn.setAttribute('aria-checked', on ? 'true' : 'false'); }
  function renderSettings() {
    setToggle($('t-sound'), D.settings.sound);
    setToggle($('t-haptics'), D.settings.haptics);
    $('row-haptics').hidden = !navigator.vibrate;
    $('row-full').hidden = !(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    $('save-note').textContent = Store.persistent() ? 'Stored on this device only' : 'Storage is blocked here; progress will not persist';
    var b = $('btn-erase'); b.textContent = 'Erase'; b.dataset.armed = '';
  }
  function updateMuteLabel() { $('btn-mute').textContent = 'Sound: ' + (D.settings.sound ? 'on' : 'off'); }
  $('t-sound').addEventListener('click', function () {
    D.settings.sound = !D.settings.sound; Sound.unlock(); Sound.setEnabled(D.settings.sound); Store.save(); renderSettings(); updateMuteLabel(); Sound.play('ui');
  });
  $('t-haptics').addEventListener('click', function () { D.settings.haptics = !D.settings.haptics; Store.save(); renderSettings(); if (D.settings.haptics && navigator.vibrate) navigator.vibrate(20); });
  $('btn-full').addEventListener('click', function () {
    var el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    else {
      var p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      if (p && p.then) p.then(function () { try { screen.orientation.lock('landscape').catch(function () { }); } catch (e) { } }).catch(function () { });
    }
  });
  $('btn-erase').addEventListener('click', function () {
    var b = this;
    if (b.dataset.armed === '1') { Store.reset(); Game.home(); renderSettings(); b.textContent = 'Erased'; return; }
    b.dataset.armed = '1'; b.textContent = 'Tap again to erase';
    setTimeout(function () { if (b.dataset.armed === '1') { b.dataset.armed = ''; b.textContent = 'Erase'; } }, 3500);
  });

  /* ---- install (PWA) ---- */
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; $('row-install').hidden = false; });
  $('btn-install').addEventListener('click', function () {
    if (!deferredInstall) return;
    deferredInstall.prompt(); deferredInstall.userChoice.finally(function () { deferredInstall = null; $('row-install').hidden = true; });
  });
  window.addEventListener('appinstalled', function () { $('row-install').hidden = true; });

  /* ---- toasts ---- */
  var toastTimer = 0, toastQ = [];
  function toast(msg, kind) {
    toastQ.push({ msg: msg, kind: kind }); if (!toastTimer) nextToast();
  }
  function nextToast() {
    var t = toastQ.shift(), el = $('toast');
    if (!t) { el.className = ''; toastTimer = 0; return; }
    el.textContent = t.msg; el.className = 'on' + (t.kind ? ' ' + t.kind : '');
    toastTimer = setTimeout(function () { el.className = ''; toastTimer = setTimeout(nextToast, 250); }, 2600);
  }

  /* ---- run flow ---- */
  function startRun() {
    Sound.unlock();
    fadeThen(function () {
      show(null); Game.start(); updateHud(Game.state, true);
      if (D.runs <= 2) toast('Drag up or down to steer. Take gold to keep the lantern lit.');
    });
  }
  function toTitle() { fadeThen(function () { Game.home(); show('title'); }); }
  function doPause() { if (Game.pause()) { show('pause'); updateMuteLabel(); } }
  function doResume() { if (Game.resume()) show(null); }

  $('btn-play').addEventListener('click', startRun);
  $('btn-again').addEventListener('click', startRun);
  $('btn-restart').addEventListener('click', startRun);
  $('btn-over-home').addEventListener('click', toTitle);
  $('btn-home').addEventListener('click', toTitle);
  $('btn-resume').addEventListener('click', doResume);
  $('btn-pause').addEventListener('click', doPause);
  $('btn-mute').addEventListener('click', function () {
    D.settings.sound = !D.settings.sound; Sound.setEnabled(D.settings.sound); Store.save(); updateMuteLabel();
  });
  $('btn-wishes').addEventListener('click', function () { returnTo = 'title'; show('wishes'); });
  $('btn-how').addEventListener('click', function () { returnTo = 'title'; show('how'); });
  $('btn-settings').addEventListener('click', function () { returnTo = 'title'; show('settings'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (b) { b.addEventListener('click', function () { show(returnTo); }); });

  document.addEventListener('pointerdown', function () { Sound.unlock(); }, { passive: true });
  document.addEventListener('keydown', function (e) {
    Sound.unlock();
    var m = Game.mode();
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (m === 'play') doPause(); else if (m === 'pause') doResume();
      else if (current && current !== 'title' && current !== 'over' && current !== 'pause') show(returnTo);
    } else if ((e.key === ' ' || e.key === 'Enter') && current === 'title' && document.activeElement === document.body) {
      e.preventDefault(); startRun();
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { doPause(); Store.save(); }
  });
  window.addEventListener('pagehide', function () { Store.save(); });

  /* ---- game callbacks ---- */
  Game.on('over', function (r) {
    $('o-dist').textContent = fmt(r.dist);
    $('o-diyas').textContent = fmt(r.diyas);
    $('o-best').textContent = fmt(r.best) + ' m';
    $('o-new').hidden = !r.newBest;
    var gr = $('o-granted');
    if (r.granted.length) { gr.hidden = false; gr.textContent = 'Wish granted: ' + r.granted.join(', '); } else gr.hidden = true;
    show('over');
  });
  Game.on('wish', function (w) { toast('Wish granted: ' + w.name, 'wish'); });
  Game.on('toast', function (m) { toast(m); });

  /* ---- HUD ---- */
  var hc = { dist: -1, flame: -1, shield: null, swift: -1, wish: -1, streak: -1 };
  var elDist = $('h-dist'), elFlame = $('h-flame'), elStreak = $('h-streak'), track = document.querySelector('.hud-flame .track');
  var stShield = $('st-shield'), stSwift = $('st-swift'), stWish = $('st-wish');
  function updateHud(G, force) {
    if (Game.mode() === 'attract' || Game.mode() === 'over') return;
    var dist = G.run ? G.run.dist : 0;
    if (force || dist !== hc.dist) { hc.dist = dist; elDist.textContent = fmt(dist); }
    var fl = Math.round(G.flame);
    if (force || fl !== hc.flame) {
      hc.flame = fl; elFlame.style.transform = 'scaleX(' + (fl / 100) + ')';
      elFlame.className = fl < 25 ? 'low' : ''; track.setAttribute('aria-valuenow', fl);
    }
    if (force || G.shield !== hc.shield) { hc.shield = G.shield; stShield.hidden = !G.shield; }
    var sw = G.swift > 0 ? Math.ceil(G.swift * 4) : 0;
    if (force || sw !== hc.swift) { hc.swift = sw; stSwift.hidden = !sw; stSwift.querySelector('i').style.transform = 'scaleX(' + (G.swift / 4.5) + ')'; }
    var wi = G.wish > 0 ? Math.ceil(G.wish * 4) : 0;
    if (force || wi !== hc.wish) { hc.wish = wi; stWish.hidden = !wi; stWish.querySelector('i').style.transform = 'scaleX(' + (G.wish / 9) + ')'; }
    var sk = G.streak >= 3 ? G.streak : 0;
    if (force || sk !== hc.streak) { hc.streak = sk; elStreak.hidden = !sk; elStreak.textContent = sk + ' in a row'; }
  }
  Game.on('frame', updateHud);

  /* ---- boot ---- */
  Sound.setEnabled(D.settings.sound);
  Assets.load(function (p) { $('lbar').style.transform = 'scaleX(' + p + ')'; }, function () {
    Game.init(); show('title');
    var l = $('loader'); l.classList.add('done'); setTimeout(function () { l.hidden = true; }, 500);
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
  g.__pearl = { show: show };
})(window);
