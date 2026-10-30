var inFullscreen = false;
var mainCanvas = null;
var fullscreenCanvas = null;
var showAsMinimal = false;

// Key mappings for PC keyboard supporting both keyCode, event.key and event.code
var keyMap = {
  "up": { codes: [38, 87], keys: ["ArrowUp", "w", "W", "Up"], codeNames: ["ArrowUp", "KeyW"] },
  "down": { codes: [40, 83], keys: ["ArrowDown", "s", "S", "Down"], codeNames: ["ArrowDown", "KeyS"] },
  "left": { codes: [37, 65], keys: ["ArrowLeft", "a", "A", "Left"], codeNames: ["ArrowLeft", "KeyA"] },
  "right": { codes: [39, 68], keys: ["ArrowRight", "d", "D", "Right"], codeNames: ["ArrowRight", "KeyD"] },
  "a": { codes: [88, 75, 74], keys: ["x", "X", "k", "K", "j", "J"], codeNames: ["KeyX", "KeyK", "KeyJ"] },
  "b": { codes: [90, 81, 89], keys: ["z", "Z", "q", "Q", "y", "Y"], codeNames: ["KeyZ", "KeyQ", "KeyY"] },
  "select": { codes: [16, 32, 8], keys: ["Shift", " ", "Backspace", "Spacebar"], codeNames: ["ShiftLeft", "ShiftRight", "Space", "Backspace"] },
  "start": { codes: [13], keys: ["Enter"], codeNames: ["Enter", "NumpadEnter"] }
};

var cout = function (message, level) {
  if (typeof console !== "undefined" && console.log) {
    if (level === 2 && console.error) {
      console.error(message);
    } else if (level === 1 && console.warn) {
      console.warn(message);
    } else {
      console.log(message);
    }
  }
};

// Resume AudioContext on any user interaction (Autoplay policy)
function resumeAudioContext() {
  if (typeof XAudioJSWebAudioContextHandle !== "undefined" && XAudioJSWebAudioContextHandle) {
    if (XAudioJSWebAudioContextHandle.state === "suspended") {
      XAudioJSWebAudioContextHandle.resume().then(function () {
        updateAudioBadge(true);
      }).catch(function () {});
    } else if (XAudioJSWebAudioContextHandle.state === "running") {
      updateAudioBadge(true);
    }
  }
}

function updateAudioBadge(isPlaying) {
  var badge = document.getElementById("audio_status_badge");
  if (badge) {
    if (isPlaying) {
      badge.textContent = "🔊 声音：已启用";
      badge.className = "badge active";
      badge.title = "声音正在正常播放";
    } else {
      badge.textContent = "🔇 声音：点击或按键开启";
      badge.className = "badge";
      badge.title = "点击此处或按任意键以激活声音";
    }
  }
}

function toggleAudio() {
  if (typeof XAudioJSWebAudioContextHandle !== "undefined" && XAudioJSWebAudioContextHandle) {
    if (XAudioJSWebAudioContextHandle.state === "suspended") {
      XAudioJSWebAudioContextHandle.resume().then(function () {
        updateAudioBadge(true);
      });
    } else if (XAudioJSWebAudioContextHandle.state === "running") {
      if (typeof settings !== "undefined") {
        settings[0] = !settings[0];
        if (typeof gameboy === "object" && gameboy && typeof gameboy.changeVolume === "function") {
          gameboy.changeVolume();
        }
        updateAudioBadge(settings[0]);
      }
    }
  }
}

function startGame(blob) {
  var binaryHandle = new FileReader();
  binaryHandle.onload = function () {
    if (this.readyState === 2) {
      try {
        start(mainCanvas, this.result);
        resumeAudioContext();
        var overlay = document.getElementById("screen_overlay");
        if (overlay) {
          overlay.className = "hidden";
        }
      } catch (e) {
        alert("启动游戏失败: " + e.message);
      }
    }
  };
  binaryHandle.readAsBinaryString(blob);
}

function loadViaMozActivity() {
  var activity = new MozActivity({
    name: "pick",
    data: {}
  });
  activity.onsuccess = function () {
    startGame(this.result.blob);
  };
  activity.onerror = function () {
    alert(this.error.name);
  };
}

function loadViaXHR() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "1.gbc");
  xhr.responseType = "blob";
  xhr.onload = function () {
    if ((this.status === 200 || this.status === 0) && this.response) {
      startGame(new Blob([this.response], { type: "text/plain" }));
    } else {
      handleLoadError();
    }
  };
  xhr.onerror = function () {
    handleLoadError();
  };
  try {
    xhr.send();
  } catch (e) {
    handleLoadError();
  }
}

function handleLoadError() {
  cout("无法通过网络请求加载 1.gbc（可能直接以 file:// 协议打开）。支持手动选择 ROM 文件。", 1);
  var overlay = document.getElementById("screen_overlay");
  if (overlay) {
    overlay.className = "";
  }
}

// Visual button feedback
var keyZoneElements = {};
function getButtonElement(zone) {
  if (keyZoneElements[zone]) return keyZoneElements[zone];
  var el = document.querySelector('[data-key-zone="' + zone + '"]');
  if (el) {
    keyZoneElements[zone] = el;
  }
  return el;
}

function setButtonActiveState(zone, isActive) {
  var el = getButtonElement(zone);
  if (el) {
    if (isActive) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  }
}

var activePressedKeys = {};

function pressKey(zone) {
  if (!activePressedKeys[zone]) {
    activePressedKeys[zone] = true;
    if (typeof GameBoyKeyDown === "function") {
      try {
        GameBoyKeyDown(zone);
      } catch (e) {
        cout(e.message, 2);
      }
    }
    setButtonActiveState(zone, true);
    resumeAudioContext();
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(30);
    }
  }
}

function releaseKey(zone) {
  if (activePressedKeys[zone]) {
    activePressedKeys[zone] = false;
    if (typeof GameBoyKeyUp === "function") {
      try {
        GameBoyKeyUp(zone);
      } catch (e) {
        cout(e.message, 2);
      }
    }
    setButtonActiveState(zone, false);
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(0);
    }
  }
}

function releaseAllKeys() {
  for (var zone in activePressedKeys) {
    if (activePressedKeys[zone]) {
      releaseKey(zone);
    }
  }
}

function bindControl(el, zone) {
  if (!el) return;
  var lastTouch = 0;

  var onDown = function (e) {
    if (e.cancelable && e.type !== "mousedown") {
      e.preventDefault();
    }
    lastTouch = Date.now();
    pressKey(zone);
  };

  var onUp = function (e) {
    if (e.cancelable && e.type !== "mouseup") {
      e.preventDefault();
    }
    lastTouch = Date.now();
    releaseKey(zone);
  };

  el.addEventListener("touchstart", onDown, { passive: false });
  el.addEventListener("touchend", onUp, { passive: false });
  el.addEventListener("touchcancel", onUp, { passive: false });
  el.addEventListener("mousedown", onDown);
  el.addEventListener("mouseup", onUp);
  el.addEventListener("mouseleave", onUp);

  // Fallback click
  el.addEventListener("click", function (e) {
    if (Date.now() - lastTouch < 300) return;
    pressKey(zone);
    setTimeout(function () {
      releaseKey(zone);
    }, 120);
  });
}

function setupControlEvents() {
  var mappings = {
    "d_pad_up": "up",
    "d_pad_down": "down",
    "d_pad_left": "left",
    "d_pad_right": "right",
    "a_button_group": "a",
    "b_button_group": "b",
    "select_button_group": "select",
    "start_button_group": "start"
  };

  for (var id in mappings) {
    var el = document.getElementById(id);
    if (el) {
      bindControl(el, mappings[id]);
    }
  }

  // Global mouseup release
  window.addEventListener("mouseup", function () {
    releaseAllKeys();
  });

  window.addEventListener("touchend", function (e) {
    if (e && e.touches && e.touches.length === 0) {
      releaseAllKeys();
    }
  });

  // Global keyboard listeners
  window.addEventListener("keydown", keyDown, false);
  window.addEventListener("keyup", keyUp, false);
}

function matchKeyZone(e) {
  var k = e.key;
  var code = e.code;
  var kc = e.keyCode || e.which;

  for (var zone in keyMap) {
    var m = keyMap[zone];
    if (kc && m.codes.indexOf(kc) !== -1) return zone;
    if (k && m.keys.indexOf(k) !== -1) return zone;
    if (code && m.codeNames.indexOf(code) !== -1) return zone;
  }
  return null;
}

function keyDown(event) {
  var zone = matchKeyZone(event);
  if (zone) {
    pressKey(zone);
    try {
      event.preventDefault();
    } catch (e) {}
  }
}

function keyUp(event) {
  var zone = matchKeyZone(event);
  if (zone) {
    releaseKey(zone);
    try {
      event.preventDefault();
    } catch (e) {}
  }
}

var gameBoyColors = [
  { shell: "#33B678", border: "#227b51" }, // Emerald Green
  { shell: "#FFDC2B", border: "#c2a30b" }, // Canary Yellow
  { shell: "#F61300", border: "#aa0c00" }, // Ruby Red
  { shell: "#0356F2", border: "#023ca8" }, // Cobalt Blue
  { shell: "#68707a", border: "#464d55" }  // Classic Silver/Grey
];

function pickRandomColor() {
  var nintendo = document.getElementById("nintendo");
  var shell = document.getElementById("gameboy_shell");
  var colorObj = gameBoyColors[(gameBoyColors.length * Math.random()) | 0];
  if (shell) {
    shell.style.backgroundColor = colorObj.shell;
  }
  if (nintendo) {
    nintendo.style.borderColor = colorObj.border;
    nintendo.style.color = colorObj.border;
  }
}

function setupAudioListeners() {
  var unlockEvents = ["click", "touchstart", "touchend", "mousedown", "keydown"];
  var unlock = function () {
    resumeAudioContext();
  };
  unlockEvents.forEach(function (evt) {
    window.addEventListener(evt, unlock, { passive: true });
  });

  var speaker = document.getElementById("speaker");
  if (speaker) {
    speaker.addEventListener("click", function () {
      toggleAudio();
    });
  }

  var badge = document.getElementById("audio_status_badge");
  if (badge) {
    badge.addEventListener("click", function () {
      resumeAudioContext();
    });
  }
}

function setupRomLoader() {
  var romInput = document.getElementById("local_rom_input");
  var loadBtn = document.getElementById("load_rom_btn");
  var overlay = document.getElementById("screen_overlay");

  if (loadBtn && romInput) {
    loadBtn.addEventListener("click", function (e) {
      // If triggered by label, native click handles it; otherwise invoke:
      if (e.target.tagName !== "LABEL") {
        romInput.click();
      }
    });
  }
  if (overlay && romInput) {
    overlay.addEventListener("click", function () {
      romInput.click();
    });
  }
  if (romInput) {
    romInput.addEventListener("change", function () {
      if (this.files && this.files.length > 0) {
        startGame(this.files[0]);
      }
    });
  }
}

function windowingInitialize() {
  cout("windowingInitialize() called.", 0);
  pickRandomColor();
  mainCanvas = document.getElementById("mainCanvas");
  setupControlEvents();
  setupAudioListeners();
  setupRomLoader();
  window.onunload = autoSave;

  ("MozActivity" in window ? loadViaMozActivity : loadViaXHR)();
}

window.addEventListener("DOMContentLoaded", windowingInitialize);

// LocalStorage helpers for SRAM and Savestates
function findValue(key) {
  try {
    if (window.localStorage && window.localStorage.getItem(key) != null) {
      return JSON.parse(window.localStorage.getItem(key));
    }
  } catch (error) {}
  return null;
}

function setValue(key, value) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {}
}

function deleteValue(key) {
  try {
    if (window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {}
}
