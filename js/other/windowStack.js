"use strict";
var windowStacks = [];
var topZIndex = 2;
function windowCreate(sId, bShow) {
  var oWindow = new windowStack(document.getElementById(sId));
  if (bShow) {
    oWindow.show();
  }
  return oWindow;
}
function windowStack(element) {
  if (element != null && typeof element == "object") {
    this.domObject = element;
    this.hadFocus = true;
    this.hookedMouse = false;
    var thisObj2 = this;
    this.events = [
      ["mousedown", function (event) { thisObj2.dragEnable(event); }],
      ["mousemove", function (event) { thisObj2.drag(event); }],
      ["mouseup", function () { thisObj2.dragDisable(); }]
    ];
  }
}
windowStack.prototype.bringToFront = function () {
  var currentZ = parseInt(this.domObject.style.zIndex, 10) || 0;
  if (currentZ < topZIndex || !this.hadFocus) {
    this.domObject.style.zIndex = ++topZIndex;
  }
  this.hadFocus = true;
};
windowStack.prototype.syncBannerPosition = function () {
  if (this.domObject.id === "GameBoy") {
    var banner = document.getElementById("mobile_mode_banner");
    if (banner) {
      var docWidth = document.documentElement.clientWidth || window.innerWidth || 0;
      var gbTop = parseInt(this.domObject.style.top, 10) || 0;
      var gbLeft = parseInt(this.domObject.style.left, 10) || 0;
      var bannerHeight = banner.offsetHeight || 52;
      var bannerWidth = banner.offsetWidth || 340;
      var centerX = gbLeft + Math.round(this.domObject.offsetWidth / 2);
      if (docWidth > bannerWidth + 16) {
        var halfBanner = Math.ceil(bannerWidth / 2);
        centerX = Math.min(Math.max(centerX, halfBanner + 8), docWidth - halfBanner - 8);
      }
      banner.style.top = Math.max(gbTop - bannerHeight - 12, 8) + "px";
      banner.style.left = centerX + "px";
    }
  }
};
windowStack.prototype.registerMouseEvents = function () {
  if (!this.hookedMouse) {
    this.hookedMouse = true;
    for (var eventIndex = 0; eventIndex < this.events.length; ++eventIndex) {
      addEvent(this.events[eventIndex][0], document, this.events[eventIndex][1]);
    }
    this.center();
  }
};
windowStack.prototype.unregisterMouseEvents = function () {
  if (this.hookedMouse) {
    this.hookedMouse = false;
    for (var eventIndex = 0; eventIndex < this.events.length; ++eventIndex) {
      removeEvent(this.events[eventIndex][0], document, this.events[eventIndex][1]);
    }
  }
};
windowStack.prototype.getStyleFloatOf = function (propertyNameOf, JSpropertyNameOf) {
  var dirtyValue = null;
  try {
    dirtyValue = window.getComputedStyle(this.domObject, null).getPropertyValue(propertyNameOf);
  }
  catch (error) {
    try {
      dirtyValue = this.domObject.currentStyle.getAttribute(JSpropertyNameOf);  /*JS object notation style keywords, not the CSS keywords!*/
    }
    catch (error) {
      cout(error.message, 2);
    }
  }
  var cleanValue = parseFloat((dirtyValue != null && dirtyValue.length) ? dirtyValue : "0");
  return (!isNaN(cleanValue) && cleanValue != -1) ? cleanValue : 0;  /*Note: Opera gives -1, not NaN for cleanValue when no number is found.*/
};
windowStack.prototype.dragEnable = function (event) {
  var elementAt = document.elementFromPoint(event.clientX, event.clientY);
  this.leftPos = this.getStyleFloatOf("left", "left");
  this.topPos = this.getStyleFloatOf("top", "top");
  var highX = this.leftPos + this.domObject.offsetWidth - document.documentElement.scrollLeft - document.getElementsByTagName("body")[0].scrollLeft;
  var highY = this.topPos + this.domObject.offsetHeight - document.documentElement.scrollTop - document.getElementsByTagName("body")[0].scrollTop;
  var mousedWindow = isSameNode(elementAt, this.domObject);
  this.mousedInsideWindow = (mousedWindow) ? false : isDescendantOf(this.domObject, elementAt);
  if (mousedWindow || this.mousedInsideWindow) {
    this.movable = true;
    this.leftLast = event.clientX;
    this.topLast = event.clientY;
    this.bringToFront();
    if (highX - this.leftLast < 25 && highY - this.topLast < 25) {  /*Invisible resize corner area for windows.*/
      this.resize = true;
    }
    else {
      this.resize = false;
    }
    this.coordDiffLeft = this.leftLast - this.leftPos;
    this.coordDiffTop = this.topLast - this.topPos;
    this.lastLeft = 0;
    this.lastTop = 0;
  }
  else {
    this.lostFocus();
  }
};
windowStack.prototype.drag = function (event) {
  if (this.movable) {
    this.lastLeft += event.clientX - this.coordDiffLeft;
    this.lastTop += event.clientY - this.coordDiffTop;
    if (this.resize) {
      var newWidth = this.domObject.clientWidth + event.clientX - this.leftLast - this.getStyleFloatOf("padding-left", "paddingLeft") - this.getStyleFloatOf("padding-right", "paddingRight");
      var newHeight = this.domObject.clientHeight + event.clientY - this.topLast - this.getStyleFloatOf("padding-top", "paddingTop") - this.getStyleFloatOf("padding-bottom", "paddingBottom");
      if (this.getStyleFloatOf("min-width", "minWidth") <= newWidth && this.getStyleFloatOf("min-height", "minHeight") <= newHeight && ((this.getStyleFloatOf("max-width", "maxWidth") >= newWidth || this.getStyleFloatOf("max-width", "maxWidth") == 0) && (this.getStyleFloatOf("max-height", "maxHeight") >= newHeight || this.getStyleFloatOf("max-height", "maxHeight") == 0))) {
        this.domObject.style.width = newWidth + "px";
        this.domObject.style.height = newHeight + "px";
        this.syncBannerPosition();
      }
    }
    else if (!this.mousedInsideWindow) {
      this.domObject.style.left = this.lastLeft + "px";
      this.domObject.style.top = this.lastTop + "px";
      this.syncBannerPosition();
    }
    this.coordDiffLeft = this.leftLast = event.clientX;
    this.coordDiffTop = this.topLast = event.clientY;
  }
};
windowStack.prototype.dragDisable = function () {
  this.movable = false;
  this.hadFocus = true;
};
windowStack.prototype.lostFocus = function () {
  if (this.hadFocus) {
    this.hadFocus = false;
  }
};
windowStack.prototype.center = function () {
  var docWidth = document.documentElement.clientWidth || window.innerWidth || 0;
  var docHeight = document.documentElement.clientHeight || window.innerHeight || 0;
  var docLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
  var docTop = window.pageYOffset || document.documentElement.scrollTop || 0;
  this.domObject.style.left = Math.max(Math.round(((docWidth - this.domObject.offsetWidth) / 2) + docLeft), 8) + "px";
  if (this.domObject.id === "GameBoy") {
    var controls = document.getElementById("gb-virtual-controls");
    var banner = document.getElementById("mobile_mode_banner");
    var extraBottom = controls ? ((controls.offsetHeight || 198) + 8) : 0;
    var extraTop = banner ? ((banner.offsetHeight || 52) + 12) : 0;
    this.domObject.style.top = Math.max(Math.round(((docHeight - this.domObject.offsetHeight - extraBottom + extraTop) / 2) + docTop), extraTop + 8) + "px";
    this.syncBannerPosition();
  }
  else {
    this.domObject.style.top = Math.max(Math.round(((docHeight - this.domObject.offsetHeight) / 2) + docTop), 24) + "px";
  }
};
windowStack.prototype.hide = function () {
  this.domObject.style.display = "none";
  this.unregisterMouseEvents();
};
windowStack.prototype.show = function () {
  this.domObject.style.display = "block";
  this.bringToFront();
  this.registerMouseEvents();
};
var activePopupMenus = [];
function closeAllPopupMenus(exceptMenu) {
  for (var index = 0; index < activePopupMenus.length; ++index) {
    if (activePopupMenus[index] !== exceptMenu) {
      activePopupMenus[index].closePopup();
    }
  }
}
function popupMenu(oClick, oMenu) {
  this.clickElement = oClick;
  this.menuElement = oMenu;
  this.open = false;
  var thisObj2 = this;
  activePopupMenus.push(this);
  addEvent("click", this.clickElement, function (event) {
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    if (thisObj2.open) {
      thisObj2.closePopup();
    }
    else {
      closeAllPopupMenus(thisObj2);
      thisObj2.startPopup(event);
    }
  });
  addEvent("click", this.menuElement, function (event) {
    var target = (event && event.target) ? event.target : event.srcElement;
    while (target && target !== thisObj2.menuElement) {
      if (target.tagName && target.tagName.toUpperCase() === "LI") {
        if (target.className && target.className.indexOf("has-submenu") !== -1) {
          if (target.classList) {
            target.classList.toggle("submenu-open");
          }
          if (event && event.stopPropagation) {
            event.stopPropagation();
          }
          return;
        }
        thisObj2.closePopup();
        return;
      }
      target = target.parentNode;
    }
  });
  this.outsideHandler = function (event) {
    if (!thisObj2.open) {
      return;
    }
    var target = (event && event.target) ? event.target : event.srcElement;
    if (
      target !== thisObj2.clickElement &&
      !isDescendantOf(thisObj2.clickElement, target) &&
      target !== thisObj2.menuElement &&
      !isDescendantOf(thisObj2.menuElement, target)
    ) {
      thisObj2.closePopup();
    }
  };
  this.keyHandler = function (event) {
    if (thisObj2.open && event && event.keyCode === 27) {
      thisObj2.closePopup();
    }
  };
  addEvent("mousedown", document, this.outsideHandler);
  addEvent("touchstart", document, this.outsideHandler);
  addEvent("keydown", document, this.keyHandler);
}
popupMenu.prototype.startPopup = function (event) {
  if (!this.open) {
    this.open = true;
    this.menuElement.style.display = "block";
    this.position(event);
  }
};
popupMenu.prototype.closePopup = function () {
  if (this.open) {
    this.open = false;
    this.menuElement.style.display = "none";
    var openSubmenus = this.menuElement.querySelectorAll
      ? this.menuElement.querySelectorAll(".submenu-open")
      : [];
    for (var i = 0; i < openSubmenus.length; ++i) {
      openSubmenus[i].classList.remove("submenu-open");
    }
  }
};
popupMenu.prototype.position = function (event) {
  if (this.open) {
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var docWidth = document.documentElement.clientWidth || window.innerWidth || 0;
    if (this.clickElement && this.clickElement.getBoundingClientRect) {
      var rect = this.clickElement.getBoundingClientRect();
      var menuWidth = this.menuElement.offsetWidth || 168;
      var targetLeft = Math.round(rect.left + scrollX);
      if (docWidth > menuWidth + 16) {
        targetLeft = Math.min(Math.max(targetLeft, 8), docWidth - menuWidth - 8);
      }
      this.menuElement.style.left = targetLeft + "px";
      this.menuElement.style.top = Math.round(rect.bottom + scrollY + 4) + "px";
    }
    else {
      this.menuElement.style.left = (pageXCoord(event) - 5) + "px";
      this.menuElement.style.top = (pageYCoord(event) + 12) + "px";
    }
  }
};
