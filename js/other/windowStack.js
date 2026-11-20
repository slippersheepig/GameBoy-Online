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
      var gbTop = parseInt(this.domObject.style.top, 10) || 0;
      var gbLeft = parseInt(this.domObject.style.left, 10) || 0;
      var bannerHeight = banner.offsetHeight || 58;
      banner.style.top = Math.max(gbTop - bannerHeight - 14, 10) + "px";
      banner.style.left = (gbLeft + Math.round(this.domObject.offsetWidth / 2)) + "px";
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
  var docWidth = Math.max(document.documentElement.clientWidth, document.getElementsByTagName("body")[0].clientWidth);
  var docHeight = Math.max(document.documentElement.clientHeight, document.getElementsByTagName("body")[0].clientHeight);
  var docLeft = Math.max(document.documentElement.scrollLeft, document.getElementsByTagName("body")[0].scrollLeft);
  var docTop = Math.max(document.documentElement.scrollTop, document.getElementsByTagName("body")[0].scrollTop);
  this.domObject.style.left = Math.round(((docWidth - this.domObject.offsetWidth) / 2) + docLeft) + "px";
  if (this.domObject.id === "GameBoy") {
    var controls = document.getElementById("gb-virtual-controls");
    var banner = document.getElementById("mobile_mode_banner");
    var extraBottom = controls ? ((controls.offsetHeight || 190) + 8) : 0;
    var extraTop = banner ? ((banner.offsetHeight || 58) + 14) : 0;
    this.domObject.style.top = Math.max(Math.round(((docHeight - this.domObject.offsetHeight - extraBottom + extraTop) / 2) + docTop), extraTop + 10) + "px";
    this.syncBannerPosition();
  }
  else {
    this.domObject.style.top = Math.max(Math.round(((docHeight - this.domObject.offsetHeight) / 2) + docTop), 40) + "px";
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
function popupMenu(oClick, oMenu) {
  this.clickElement = oClick;
  this.menuElement = oMenu;
  var thisObj2 = this;
  this.eventHandle = [
    function (event) { thisObj2.startPopup(event); },
    function (event) { thisObj2.endPopup(event); }
  ];
  this.open = false;
  addEvent("click", this.clickElement, this.eventHandle[0]);
}
popupMenu.prototype.startPopup = function (event) {
  if (!this.open) {
    this.open = true;
    this.menuElement.style.display = "block";
    removeEvent("click", this.clickElement, this.eventHandle[0]);
    this.position(event);
    addEvent("mouseout", this.menuElement, this.eventHandle[1]);
  }
};
popupMenu.prototype.endPopup = function (event) {
  if (this.open) {
    if (mouseLeaveVerify(this.menuElement, event)) {
      this.open = false;
      this.menuElement.style.display = "none";
      removeEvent("mouseout", this.menuElement, this.eventHandle[1]);
      addEvent("click", this.clickElement, this.eventHandle[0]);
    }
  }
};
popupMenu.prototype.position = function (event) {
  if (this.open) {
    this.menuElement.style.left = (pageXCoord(event) - 5) + "px";
    this.menuElement.style.top = (pageYCoord(event) - 5) + "px";
  }
};
