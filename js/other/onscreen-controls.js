/* On-screen controls: map touch / mouse events to GameBoyKeyDown / GameBoyKeyUp */
(function () {
  "use strict";
  function pressKey(key) {
    if (typeof GameBoyKeyDown === "function") {
      try {
        GameBoyKeyDown(key);
      } catch (e) {
        console.error(e);
      }
    }
  }
  function releaseKey(key) {
    if (typeof GameBoyKeyUp === "function") {
      try {
        GameBoyKeyUp(key);
      } catch (e) {
        console.error(e);
      }
    }
  }
  function bindButton(el, key) {
    if (!el) return;
    var isPressed = false;
    var lastInteraction = 0;
    var start = function (e) {
      if (e.cancelable) {
        e.preventDefault();
      }
      lastInteraction = Date.now();
      if (!isPressed) {
        isPressed = true;
        el.classList.add("active");
        pressKey(key);
      }
    };
    var end = function (e) {
      if (!isPressed) return;
      if (e.cancelable && e.type !== "mouseleave") {
        e.preventDefault();
      }
      isPressed = false;
      lastInteraction = Date.now();
      el.classList.remove("active");
      releaseKey(key);
    };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", end);
    el.addEventListener("mouseleave", end);
    // Accessibility: space/enter key on the button will also trigger press/release via click
    el.addEventListener("click", function (e) {
      e.preventDefault();
      if (Date.now() - lastInteraction < 300) return;
      el.classList.add("active");
      pressKey(key);
      setTimeout(function () {
        el.classList.remove("active");
        releaseKey(key);
      }, 120);
    });
  }
  function initPositioning() {
    var game = document.getElementById("GameBoy");
    var controls = document.getElementById("gb-virtual-controls");
    if (!game || !controls) return;
    var lastRect = null;
    function applyPos(rect) {
      var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var targetWidth = Math.min(Math.max(Math.round(rect.width), 220), 520);
      var left = Math.round(rect.left + (rect.width - targetWidth) / 2 + scrollX);
      var top = Math.round(rect.bottom + scrollY + 8);
      controls.style.position = "absolute";
      controls.style.left = left + "px";
      controls.style.top = top + "px";
      controls.style.width = targetWidth + "px";
      controls.style.maxWidth = targetWidth + "px";
      controls.style.display = "block";
      controls.style.zIndex = "1";
    }
    function updateIfNeeded() {
      var r = game.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        controls.style.display = "none";
        lastRect = null;
        return;
      }
      var wasHidden = controls.style.display === "none";
      if (
        !lastRect ||
        r.left !== lastRect.left ||
        r.top !== lastRect.top ||
        r.width !== lastRect.width ||
        r.height !== lastRect.height ||
        r.bottom !== lastRect.bottom
      ) {
        applyPos(r);
        lastRect = {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          bottom: r.bottom
        };
        if (wasHidden && typeof windowStacks !== "undefined" && windowStacks[0]) {
          windowStacks[0].center();
        }
      }
    }
    if (window.ResizeObserver) {
      try {
        var ro = new ResizeObserver(updateIfNeeded);
        ro.observe(game);
      } catch (e) {}
    }
    if (window.MutationObserver) {
      try {
        var gameObserver = new MutationObserver(updateIfNeeded);
        gameObserver.observe(game, {
          attributes: true,
          attributeFilter: ["style", "class"]
        });
      } catch (e) {}
    }
    window.addEventListener("load", function () {
      setTimeout(updateIfNeeded, 20);
    });
    window.addEventListener("resize", updateIfNeeded);
    window.addEventListener("scroll", updateIfNeeded);
    updateIfNeeded();
    setTimeout(updateIfNeeded, 60);
    setTimeout(updateIfNeeded, 200);
  }
  function init() {
    var mapping = {
      "gb-btn-up": "up",
      "gb-btn-down": "down",
      "gb-btn-left": "left",
      "gb-btn-right": "right",
      "gb-btn-a": "a",
      "gb-btn-b": "b",
      "gb-btn-start": "start",
      "gb-btn-select": "select"
    };
    Object.keys(mapping).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) bindButton(el, mapping[id]);
    });
    initPositioning();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
