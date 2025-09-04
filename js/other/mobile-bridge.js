(function(){
  // mobile-bridge.js - lightweight script to provide mobile shell, reposition canvas and map touch controls.
  var MOBILE_MAX = 900;
  var mounted = false;
  var originalParent = null;
  var gfxId = 'gfx';
  var mobileWrapperId = 'mobile_shell_wrapper';

  var mobileShellHTML = '\
  <div id="mobile_shell_wrapper" class="mobile-only" style="display:none;">\
    <div id="gameboy_shell">\
      <span id="on_off">OFF ! ! ON</span>\
      <div id="screen_cover">\
        <div id="power">\
          <div class="two_column">\
            <div id="power_light"></div>\
            <div>)))</div>\
          </div>POWER\
        </div>\
        <div id="canvas_container">\
          <div id="mobile_canvas_mount"></div>\
        </div>\
        <div>GameBoy <span id="pocket">Pocket</span></div>\
      </div>\
      <div id="shadow"></div>\
      <div id="d_pad">\
        <div id="d_pad_up"><div id="arrow_up" data-key-zone="up"></div></div>\
        <div id="d_pad_left_right">\
          <div id="d_pad_left"><div id="arrow_left" data-key-zone="left"></div></div>\
          <div id="d_pad_right"><div id="arrow_right" data-key-zone="right"></div></div>\
          <div id="d_pad_center"></div>\
        </div>\
        <div id="d_pad_down"><div id="arrow_down" data-key-zone="down"></div></div>\
      </div>\
      <div id="a_button_group" class="button_group" data-key-zone="a"><div class="round_button"></div>A</div>\
      <div id="b_button_group" class="button_group" data-key-zone="b"><div class="round_button"></div>B</div>\
      <div id="select_button_group" class="button_group" data-key-zone="select"><div class="flat_button"></div>SELECT</div>\
      <div id="start_button_group" class="button_group" data-key-zone="start"><div class="flat_button"></div>START</div>\
      <img id="speaker" src="images/speaker.png" alt="speaker"/>\
    </div>\
  </div>';

  function isMobile() {
    try {
      return window.matchMedia && window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
    } catch(e){ return (window.innerWidth || document.documentElement.clientWidth) <= MOBILE_MAX; }
  }

  function addMobileShellIfNeeded(){
    if(document.getElementById(mobileWrapperId)) return;
    var container = document.createElement('div');
    container.innerHTML = mobileShellHTML;
    document.body.appendChild(container.firstElementChild);
  }

  function hideDesktopWindows(hide){
    var wins = document.querySelectorAll('.window');
    for(var i=0;i<wins.length;i++){
      var el = wins[i];
      // do not hide mobile shell if it's accidentally .window
      if(el.id === mobileWrapperId) continue;
      if(hide) {
        el.setAttribute('data-prev-display', el.style.display || '');
        el.style.display = 'none';
      } else {
        var prev = el.getAttribute('data-prev-display');
        el.style.display = prev || '';
        el.removeAttribute('data-prev-display');
      }
    }
  }

  function mountCanvas(){
    try {
      var gfx = document.getElementById(gfxId);
      var mount = document.getElementById('mobile_canvas_mount');
      if(!gfx || !mount) return;
      if(!originalParent) originalParent = gfx.parentNode;
      // move gfx into mount
      if(gfx.parentNode !== mount){
        mount.appendChild(gfx);
      }
      // adjust styles so it centers and fits
      gfx.style.position = 'relative';
      gfx.style.left = 'auto';
      gfx.style.top = 'auto';
      gfx.style.margin = '0 auto';
      gfx.style.width = '160px';
      gfx.style.height = 'auto';
      // ensure canvas has correct width/height attributes (native resolution)
      var canv = gfx.querySelector('canvas');
      if(canv){
        canv.style.width = '160px';
        canv.style.height = '144px';
        canv.style.imageRendering = 'pixelated';
        // ensure attributes match if not set
        if(!canv.getAttribute('width')) canv.setAttribute('width','160');
        if(!canv.getAttribute('height')) canv.setAttribute('height','144');
      }
      mounted = true;
    } catch(e){ console.warn('mountCanvas error', e); }
  }

  function unmountCanvas(){
    try {
      var gfx = document.getElementById(gfxId);
      if(!gfx || !originalParent) return;
      if(gfx.parentNode !== originalParent){
        originalParent.appendChild(gfx);
      }
      // restore style
      gfx.style.position = '';
      gfx.style.left = '';
      gfx.style.top = '';
      gfx.style.margin = '';
      gfx.style.width = '';
      gfx.style.height = '';
      mounted = false;
    } catch(e){ console.warn('unmountCanvas error', e); }
  }

  function attachTouchHandlers(){
    var buttons = document.querySelectorAll('[data-key-zone]');
    buttons.forEach(function(btn){
      var key = btn.getAttribute('data-key-zone');
      if(!key) return;
      var down = function(e){ e.preventDefault(); try{ window.GameBoyKeyDown && GameBoyKeyDown(key); } catch(e){} };
      var up = function(e){ e.preventDefault(); try{ window.GameBoyKeyUp && GameBoyKeyUp(key); } catch(e){} };
      btn.addEventListener('touchstart', down, {passive:false});
      btn.addEventListener('mousedown', down);
      btn.addEventListener('touchend', up, {passive:false});
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
      btn.addEventListener('touchcancel', up, {passive:false});
    });
  }

  function showMobileShell(show){
    var wrapper = document.getElementById(mobileWrapperId);
    if(!wrapper) return;
    wrapper.style.display = show ? '' : 'none';
  }

  function applyLayout(){
    if(isMobile()){
      addMobileShellIfNeeded();
      hideDesktopWindows(true);
      showMobileShell(true);
      mountCanvas();
      attachTouchHandlers();
      // position speaker inside shell (ensure absolute)
      var speaker = document.getElementById('speaker');
      if(speaker){
        speaker.style.position = 'absolute';
        speaker.style.right = '6%';
        speaker.style.bottom = '6%';
        speaker.style.zIndex = 2000;
        speaker.style.width = speaker.style.width || '32px';
      }
    } else {
      showMobileShell(false);
      hideDesktopWindows(false);
      unmountCanvas();
    }
  }

  window.addEventListener('load', function(){ setTimeout(applyLayout, 50); });
  window.addEventListener('resize', function(){ setTimeout(applyLayout, 50); });
  window.addEventListener('orientationchange', function(){ setTimeout(applyLayout, 300); });
})();
