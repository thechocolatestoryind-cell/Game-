/* Black Pearl — save data (localStorage only, no backend) + wishes (achievements) */
(function (g) {
  'use strict';
  var KEY = 'blackpearl.save.v1';
  var DEF = {
    best: 0, runs: 0, totalDist: 0,
    diyas: 0, lotus: 0, koi: 0, lantern: 0, crows: 0, nights: 0,
    cleanBest: 0, streakBest: 0, pairBest: 0,
    wishes: {}, settings: { sound: true, haptics: true }
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var data = clone(DEF), persistent = true, timer = 0;
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      data = Object.assign(clone(DEF), o);
      data.settings = Object.assign(clone(DEF.settings), o.settings || {});
      data.wishes = o.wishes || {};
    }
  } catch (e) { persistent = false; }

  function save() {
    if (timer) { clearTimeout(timer); timer = 0; }
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { persistent = false; }
  }
  function saveSoon() { if (!timer) timer = setTimeout(save, 1500); }
  function reset() {
    Object.keys(data).forEach(function (k) { delete data[k]; });
    Object.assign(data, clone(DEF));
    save();
  }

  var WISHES = [
    { id: 'first',   name: 'First doubloon',      desc: 'Take your first piece of Aztec gold.',                    goal: 1,    val: function (d) { return d.diyas; } },
    { id: 'lamps',   name: 'Hundred doubloons',  desc: 'Take 100 pieces of gold in total.',                 goal: 100,  val: function (d) { return d.diyas; } },
    { id: 'long',    name: 'Long sea',       desc: 'Sail 1,000 m in a single run.',            goal: 1000, val: function (d, r) { return Math.max(d.best, r ? r.dist : 0); } },
    { id: 'night',   name: 'Through the night', desc: 'Keep your lantern lit until the night ends.', goal: 1,  val: function (d) { return d.nights; } },
    { id: 'clean',   name: 'Untouchable',        desc: 'Sail 600 m without hitting anything.',    goal: 600,  val: function (d, r) { return Math.max(d.cleanBest, r ? r.clean : 0); } },
    { id: 'garland', name: 'Plunder streak',          desc: 'Take 12 pieces of gold in a row without a miss.',   goal: 12,   val: function (d, r) { return Math.max(d.streakBest, r ? r.streak : 0); } },
    { id: 'pair',    name: 'Kraken and rum',  desc: 'Wake the Kraken and grab a rum barrel in one run.',       goal: 2,    val: function (d, r) { return Math.max(d.pairBest, r ? ((r.koi > 0 ? 1 : 0) + (r.lotus > 0 ? 1 : 0)) : 0); } },
    { id: 'crows',   name: "Monkey business",      desc: 'Dodge Jack the Monkey 25 times.',                           goal: 25,   val: function (d) { return d.crows; } }
  ];

  function evaluate(run) {
    var out = [];
    WISHES.forEach(function (w) {
      if (data.wishes[w.id]) return;
      if (w.val(data, run) >= w.goal) { data.wishes[w.id] = Date.now(); out.push(w); }
    });
    if (out.length) save();
    return out;
  }

  g.Store = { data: data, save: save, saveSoon: saveSoon, reset: reset, evaluate: evaluate, WISHES: WISHES, persistent: function () { return persistent; } };
})(window);
