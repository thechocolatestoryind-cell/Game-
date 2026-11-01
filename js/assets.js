/* Black Pearl — image loader */
(function (g) {
  'use strict';
  var names = ['sky_day', 'sky_dusk', 'sky_night', 'water_tile', 'mountains_far', 'hills_mid', 'trees_bank',
    'sun', 'moon', 'cloud_a', 'cloud_b', 'stars', 'bird_flock', 'lily_pad',
    'pearl', 'coral', 'wreck_teal', 'wreck_rust', 'tentacle', 'monkey', 'coin', 'barrel', 'kraken', 'heart'];
  var img = {};
  function load(onProgress, onDone) {
    var n = 0;
    names.forEach(function (name) {
      var im = new Image();
      var fin = function () { n++; if (onProgress) onProgress(n / names.length); if (n === names.length && onDone) onDone(); };
      im.onload = fin; im.onerror = fin;
      im.src = 'images/' + name + '.webp';
      img[name] = im;
    });
  }
  g.Assets = { img: img, names: names, load: load };
})(window);
