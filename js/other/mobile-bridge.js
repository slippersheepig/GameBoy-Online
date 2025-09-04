/*
 * mobile-bridge.js
 * Lightweight mobile control overlay that reuses index.xhtml's existing canvas (#mainCanvas)
 * and GameBoyIO's GameBoyKeyDown/Up logic. Avoids conflicting with mobile.js/gui.js.
 */
(function(){
    var MOBILE_MAX_WIDTH = 900;
    var mounted = false;
    function isMobile() {
        return window.matchMedia && window.matchMedia("(max-width: " + MOBILE_MAX_WIDTH + "px)").matches;
    }
    function $(id){ return document.getElementById(id); }
    function mountCanvasIntoShell() {
        var mount = $("mobile_canvas_mount");
        var gfx = $("gfx");
        var wrapper = $("mobile_shell_wrapper");
        if (!mount || !gfx || !wrapper) return;
        wrapper.style.display = "";
        if (gfx.parentNode !== mount) {
            mount.innerHTML = "";
            mount.appendChild(gfx);
        }
        mounted = true;
    }
    function unmountCanvasFromShell() {
        var mount = $("mobile_canvas_mount");
        var gfx = $("gfx");
        var gameboyWindow = $("GameBoy");
        var wrapper = $("mobile_shell_wrapper");
        if (!mount || !gfx || !gameboyWindow || !wrapper) return;
        if (gfx.parentNode === mount) {
            gameboyWindow.appendChild(gfx);
        }
        wrapper.style.display = "none";
        mounted = false;
    }
    function onKeyDown(key) {
        try { window.GameBoyKeyDown && GameBoyKeyDown(key); } catch(e){}
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch(_){} }
    }
    function onKeyUp(key) {
        try { window.GameBoyKeyUp && GameBoyKeyUp(key); } catch(e){}
    }
    function attachTouchShims() {
        var ids = [
            "a_button_group",
            "b_button_group",
            "arrow_up",
            "arrow_down",
            "arrow_right",
            "arrow_left",
            "select_button_group",
            "start_button_group"
        ];
        ids.forEach(function(id){
            var el = $(id);
            if (!el) return;
            var key = el.getAttribute("data-key-zone");
            if (!key) {
                if (id.indexOf("arrow_") === 0) {
                    key = id.split("_")[1];
                }
            }
            if (!key) return;
            var handlerDown = function(e){ e.preventDefault(); onKeyDown(key); };
            var handlerUp = function(e){ e.preventDefault(); onKeyUp(key); };
            ["touchstart","mousedown"].forEach(function(type){ el.addEventListener(type, handlerDown, {passive:false}); });
            ["touchend","touchcancel","mouseup","mouseleave"].forEach(function(type){ el.addEventListener(type, handlerUp, {passive:false}); });
        });
    }
    function toggleLayout() {
        if (isMobile()) {
            mountCanvasIntoShell();
            attachTouchShims();
        } else {
            unmountCanvasFromShell();
        }
    }
    window.addEventListener("load", function(){
        setTimeout(toggleLayout, 0);
    });
    window.addEventListener("resize", toggleLayout);
})();
