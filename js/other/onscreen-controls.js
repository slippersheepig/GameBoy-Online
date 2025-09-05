/* On-screen controls: map touch / mouse events to GameBoyKeyDown / GameBoyKeyUp */
(function () {
  "use strict";
  function safeCall(fn) { try { if (typeof fn === "function") fn(); } catch(e) { console && console.error && console.error(e); } }

  function pressKey(key) {
    if (typeof GameBoyKeyDown === "function") {
      try { GameBoyKeyDown(key); } catch(e) { console.error(e); }
    }
  }
  function releaseKey(key) {
    if (typeof GameBoyKeyUp === "function") {
      try { GameBoyKeyUp(key); } catch(e) { console.error(e); }
    }
  }

  function bindButton(el, key) {
    if (!el) return;
    var start = function (e) { e.preventDefault(); pressKey(key); };
    var end = function (e) { e.preventDefault(); releaseKey(key); };
    el.addEventListener("touchstart", start, {passive:false});
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", end);
    el.addEventListener("mouseleave", end);
    // Accessibility: space/enter key on the button will also trigger press/release via click
    el.addEventListener("click", function(e){ e.preventDefault(); /* toggle quick tap */ pressKey(key); setTimeout(function(){ releaseKey(key); }, 120); });
  }

  function init() {
    var mapping = {
      'gb-btn-up':'up',
      'gb-btn-down':'down',
      'gb-btn-left':'left',
      'gb-btn-right':'right',
      'gb-btn-a':'a',
      'gb-btn-b':'b',
      'gb-btn-start':'start',
      'gb-btn-select':'select'
    };
    Object.keys(mapping).forEach(function(id){
      var el = document.getElementById(id);
      if (el) bindButton(el, mapping[id]);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
