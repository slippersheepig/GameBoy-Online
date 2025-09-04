(function () {
  'use strict';
  // Patched mobile-bridge.js: non-destructive mobile shell enhancer.
  // Behavior: if viewport <= MOBILE_MAX or touch detected, ensure mobile shell exists,
  // make the canvas scale nicely and attach improved touch-to-key mappings.
  var MOBILE_MAX = 900;
  var mobileWrapperId = 'mobile_shell_wrapper';
  var isTouch = function () { return ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0); };
  var isSmall = function () {
    try { return window.matchMedia && window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches; } catch (e) { return (window.innerWidth || document.documentElement.clientWidth) <= MOBILE_MAX; }
  };

  // Key mapping: try to match project's keyboard mapping (arrow keys + z/x for A/B)
  var KEY_MAP = {
    left:  { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    up:    { key: 'ArrowUp',   code: 'ArrowUp',   keyCode: 38 },
    right: { key: 'ArrowRight',code: 'ArrowRight',keyCode: 39 },
    down:  { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    a:     { key: 'x',         code: 'KeyX',      keyCode: 88 },
    b:     { key: 'z',         code: 'KeyZ',      keyCode: 90 },
    start: { key: 'Enter',     code: 'Enter',     keyCode: 13 },
    select:{ key: 'Shift',     code: 'ShiftLeft', keyCode: 16 }
  };

  function dispatchKeyboardEvent(type, info) {
    try {
      var ev = new KeyboardEvent(type, { key: info.key, code: info.code, bubbles: true, cancelable: true });
      try { Object.defineProperty(ev, 'keyCode', { get: function() { return info.keyCode; } }); } catch (e) {}
      document.dispatchEvent(ev);
    } catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent(type, true, true);
      ev.key = info.key; ev.code = info.code; ev.keyCode = info.keyCode;
      document.dispatchEvent(ev);
    }
    // Custom event for compatibility with bridges
    try { document.dispatchEvent(new CustomEvent('gameboy-input', { detail: { type: type, button: info } })); } catch (e) {}
  }

  function callEmulatorAPIs(type, name) {
    try {
      if (window.emulator && typeof window.emulator.key === 'function') {
        window.emulator.key(type === 'keydown' ? 'down' : 'up', name);
        return true;
      }
      if (window.keyHandler && typeof window.keyHandler === 'function') {
        window.keyHandler(type, name);
        return true;
      }
      if (window.handleKey && typeof window.handleKey === 'function') {
        window.handleKey(type, name);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function sendKey(name, action) {
    var info = KEY_MAP[name];
    if (!info) return;
    var type = (action === 'down') ? 'keydown' : 'keyup';
    dispatchKeyboardEvent(type, info);
    callEmulatorAPIs(type, name);
  }

  // Bind pointer/touch events to a control element (element may be existing DOM with data-key attributes)
  function bindControl(el, keyName) {
    if (!el) return;
    var down = function(e) { e.preventDefault(); el.classList && el.classList.add('pressed'); sendKey(keyName, 'down'); };
    var up   = function(e) { e.preventDefault(); el.classList && el.classList.remove('pressed'); sendKey(keyName, 'up'); };
    el.addEventListener('pointerdown', down);
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){ el.addEventListener(ev, up); });
    // fallback touch events for older browsers
    el.addEventListener('touchstart', down, { passive:false });
    el.addEventListener('touchend', up, { passive:false });
  }

  // Attempt to find the canvas (gfx) used by the emulator
  function findCanvas() {
    var selectors = ['#gfx canvas', '#gfx', '#display canvas', 'canvas'];
    for (var i=0;i<selectors.length;i++) {
      var sel = selectors[i];
      var el = document.querySelector(sel);
      if (el) return el.tagName.toLowerCase() === 'canvas' ? el : (el.querySelector && el.querySelector('canvas')) || el;
    }
    return document.querySelector('canvas');
  }

  // Create a small, non-destructive mobile controls overlay only if a control isn't already present
  function createOverlayIfNeeded() {
    if (document.getElementById('mobile-controls-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'mobile-controls-overlay';
    overlay.className = 'mobile-controls-overlay';

    var left = document.createElement('div');
    left.className = 'controls-side left';
    // create a dpad container that maps to existing #d_pad if present
    var dpad = document.getElementById('d_pad');
    if (!dpad) {
      dpad = document.createElement('div');
      dpad.id = 'd_pad';
      // arrows
      var up = document.createElement('div'); up.id = 'd_pad_up'; up.innerHTML = '<div id=\"arrow_up\"></div>'; dpad.appendChild(up);
      var mid = document.createElement('div'); mid.id = 'd_pad_left_right';
      var leftb = document.createElement('div'); leftb.id = 'd_pad_left'; leftb.innerHTML = '<div id=\"arrow_left\"></div>';
      var center = document.createElement('div'); center.id = 'd_pad_center'; center.style.display='none';
      var rightb = document.createElement('div'); rightb.id = 'd_pad_right'; rightb.innerHTML = '<div id=\"arrow_right\"></div>';
      mid.appendChild(leftb); mid.appendChild(center); mid.appendChild(rightb);
      dpad.appendChild(mid);
      var down = document.createElement('div'); down.id = 'd_pad_down'; down.innerHTML = '<div id=\"arrow_down\"></div>'; dpad.appendChild(down);
    }
    // mark directional buttons with data-key so CSS/JS can bind them
    [['d_pad_up','up'],['d_pad_left','left'],['d_pad_right','right'],['d_pad_down','down']].forEach(function(pair){
      var el = document.getElementById(pair[0]) || (dpad.querySelector('#'+pair[0]) || null);
      if (el) { el.setAttribute('data-key', pair[1]); el.classList.add('mobile-control'); }
    });

    left.appendChild(dpad);

    var right = document.createElement('div');
    right.className = 'controls-side right';
    // A/B buttons
    var aGroup = document.getElementById('a_button_group');
    var bGroup = document.getElementById('b_button_group');
    // if they don't exist, create simpler buttons to the overlay
    if (!bGroup) {
      bGroup = document.createElement('div');
      bGroup.className = 'button_group';
      var bbtn = document.createElement('div'); bbtn.className='round_action'; bbtn.textContent='B'; bbtn.setAttribute('data-key','b'); bGroup.appendChild(bbtn);
    }
    if (!aGroup) {
      aGroup = document.createElement('div');
      aGroup.className = 'button_group';
      var abtn = document.createElement('div'); abtn.className='round_action'; abtn.textContent='A'; abtn.setAttribute('data-key','a'); aGroup.appendChild(abtn);
    }
    // ensure these elements have data-key attribute on interactive node
    var ensure = function(container, keyName) {
      var btn = container.querySelector('[data-key]') || container.querySelector('.round_action') || container.firstElementChild;
      if (btn && !btn.getAttribute('data-key')) btn.setAttribute('data-key', keyName);
      if (btn) btn.classList.add('mobile-control');
    };
    ensure(bGroup,'b'); ensure(aGroup,'a');

    right.appendChild(bGroup);
    right.appendChild(aGroup);

    // create center area for Start/Select if not present
    var centerArea = document.createElement('div');
    centerArea.style.width = '100%';
    centerArea.style.display = 'flex';
    centerArea.style.justifyContent = 'center';
    centerArea.style.pointerEvents = 'none';
    var selectGroup = document.getElementById('select_button_group');
    var startGroup = document.getElementById('start_button_group');
    if (!selectGroup) {
      selectGroup = document.createElement('div'); selectGroup.id='select_button_group'; selectGroup.className='button_group';
      var sbtn = document.createElement('div'); sbtn.className='flat_button'; sbtn.textContent='Select'; sbtn.setAttribute('data-key','select'); selectGroup.appendChild(sbtn);
    }
    if (!startGroup) {
      startGroup = document.createElement('div'); startGroup.id='start_button_group'; startGroup.className='button_group';
      var stbtn = document.createElement('div'); stbtn.className='flat_button'; stbtn.textContent='Start'; stbtn.setAttribute('data-key','start'); startGroup.appendChild(stbtn);
    }
    // center area receives pointer events for the buttons
    selectGroup.style.pointerEvents = 'auto'; startGroup.style.pointerEvents = 'auto';
    // ensure children have data-key attributes
    [['select_button_group','select'], ['start_button_group','start']].forEach(function(pair){
      var el = document.getElementById(pair[0]);
      if (el) {
        var btn = el.querySelector('[data-key]') || el.firstElementChild;
        if (btn && !btn.getAttribute('data-key')) btn.setAttribute('data-key', pair[1]);
        if (btn) btn.classList.add('mobile-control');
      }
    });

    centerArea.appendChild(selectGroup);
    centerArea.appendChild(startGroup);

    overlay.appendChild(left);
    // append the center area as a positioned element so it appears above other controls
    var centerWrap = document.createElement('div');
    centerWrap.style.position='absolute';
    centerWrap.style.left='0'; centerWrap.style.right='0'; centerWrap.style.bottom='6%'; centerWrap.style.pointerEvents='none'; centerWrap.style.display='flex'; centerWrap.style.justifyContent='center'; centerWrap.style.zIndex='10002';
    selectGroup.style.pointerEvents='auto'; startGroup.style.pointerEvents='auto';
    centerWrap.appendChild(selectGroup);
    centerWrap.appendChild(startGroup);

    overlay.appendChild(right);
    document.body.appendChild(overlay);
    document.body.appendChild(centerWrap);

    // Bind events for any element we created that has data-key
    var nodes = document.querySelectorAll('[data-key]');
    nodes.forEach(function(n){
      var k = n.getAttribute('data-key');
      bindControl(n, k);
    });
  }

  function activateMobileMode() {
    // add class for CSS to pick up
    document.body.classList.add('mobile-fullscreen');
    // ensure mobile shell exists (non-destructive: don't remove existing)
    var wrapper = document.getElementById(mobileWrapperId);
    if (!wrapper) {
      // try to find #gameboy_shell and wrap it
      var gb = document.getElementById('gameboy_shell') || document.body;
      wrapper = document.createElement('div');
      wrapper.id = mobileWrapperId;
      // insert wrapper before gb element and move gb inside wrapper
      gb.parentNode.insertBefore(wrapper, gb);
      wrapper.appendChild(gb);
    }
    // ensure canvas is centered and scaled by adding mount wrapper if missing
    var gfx = document.getElementById('gfx');
    if (gfx) {
      var mount = document.getElementById('mobile_canvas_mount');
      if (!mount) {
        mount = document.createElement('div');
        mount.id = 'mobile_canvas_mount';
        // place mount at the top of gameboy_shell
        var shell = document.getElementById('gameboy_shell');
        if (shell) shell.insertBefore(mount, shell.firstChild);
        // move gfx into mount (if not already)
        mount.appendChild(gfx);
      }
      // style adjustments: ensure canvas scales
      var c = gfx.querySelector('canvas') || gfx;
      if (c) {
        c.style.maxWidth = 'calc(100vw - 32px)';
        c.style.maxHeight = '60vh';
        c.style.imageRendering = 'pixelated';
        c.style.display = 'block';
        c.style.margin = '0 auto';
      }
    }

    // create overlay controls only on touch/small devices
    createOverlayIfNeeded();

    // bind any existing on-screen controls (legacy HTML may contain elements)
    var touchables = document.querySelectorAll('.mobile-control, [data-key]');
    touchables.forEach(function(el){
      var key = el.getAttribute('data-key');
      if (key) bindControl(el, key);
    });

    // hide desktop windows for clarity
    var wins = document.querySelectorAll('.window');
    wins.forEach(function(w){ w.style.display = 'none'; });
  }

  // init on DOM ready if mobile/touch small
  function init() {
    if (!isTouch() && !isSmall()) return; // only activate for touch or narrow screens
    if (document.readyState === 'complete' || document.readyState === 'interactive') activateMobileMode();
    else document.addEventListener('DOMContentLoaded', activateMobileMode);
    // react to orientation/resize
    window.addEventListener('orientationchange', function(){ setTimeout(function(){}, 250); });
    window.addEventListener('resize', function(){ /* no-op for now; layout is responsive CSS */ });
  }

  init();

  // export for debugging
  window.mobileBridgePatched = {
    activateMobileMode: activateMobileMode,
    createOverlayIfNeeded: createOverlayIfNeeded,
    sendKey: sendKey
  };
})();
