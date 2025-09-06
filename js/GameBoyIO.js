"use strict";
var gameboy = null;						//GameBoyCore object.
var gbRunInterval = null;				//GameBoyCore Timer
var settings = [						//Some settings.
	true, 								//Turn on sound.
	true,								//Boot with boot ROM first?
	false,								//Give priority to GameBoy mode
	1,									//Volume level set.
	true,								//Colorize GB mode?
	false,								//Disallow typed arrays?
	8,									//Interval for the emulator loop.
	10,									//Audio buffer minimum span amount over x interpreter iterations.
	20,									//Audio buffer maximum span amount over x interpreter iterations.
	false,								//Override to allow for MBC1 instead of ROM only (compatibility for broken 3rd-party cartridges).
	false,								//Override MBC RAM disabling and always allow reading and writing to the banks.
	false,								//Use the GameBoy boot ROM instead of the GameBoy Color boot ROM.
	false,								//Scale the canvas in JS, or let the browser scale the canvas?
	true,								//Use image smoothing based scaling?
    [true, true, true, true]            //User controlled channel enables.
];
function start(canvas, ROM) {
	clearLastEmulation();
	autoSave();	//If we are about to load a new game, then save the last one...
	gameboy = new GameBoyCore(canvas, ROM);
	gameboy.openMBC = openSRAM;
	gameboy.openRTC = openRTC;
	gameboy.start();
	run();
}
function run() {
	if (GameBoyEmulatorInitialized()) {
		if (!GameBoyEmulatorPlaying()) {
			gameboy.stopEmulator &= 1;
			cout("Starting the iterator.", 0);
			var dateObj = new Date();
			gameboy.firstIteration = dateObj.getTime();
			gameboy.iterations = 0;
			gbRunInterval = setInterval(function () {
				if (!document.hidden && !document.msHidden && !document.mozHidden && !document.webkitHidden) {
					gameboy.run();
				}
			}, settings[6]);
		}
		else {
			cout("The GameBoy core is already running.", 1);
		}
	}
	else {
		cout("GameBoy core cannot run while it has not been initialized.", 1);
	}
}
function pause() {
	if (GameBoyEmulatorInitialized()) {
		if (GameBoyEmulatorPlaying()) {
			autoSave();
			clearLastEmulation();
		}
		else {
			cout("GameBoy core has already been paused.", 1);
		}
	}
	else {
		cout("GameBoy core cannot be paused while it has not been initialized.", 1);
	}
}
function clearLastEmulation() {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		clearInterval(gbRunInterval);
		gameboy.stopEmulator |= 2;
		cout("The previous emulation has been cleared.", 0);
	}
	else {
		cout("No previous emulation was found to be cleared.", 0);
	}
}
function save() {
	if (GameBoyEmulatorInitialized()) {
		var state_suffix = 0;
		while (findValue("FREEZE_" + gameboy.name + "_" + state_suffix) != null) {
			state_suffix++;
		}
		saveState("FREEZE_" + gameboy.name + "_" + state_suffix);
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}
function saveSRAM() {
	if (GameBoyEmulatorInitialized()) {
		if (gameboy.cBATT) {
			try {
				var sram = gameboy.saveSRAMState();
				if (sram.length > 0) {
					cout("Saving the SRAM...", 0);
					if (findValue("SRAM_" + gameboy.name) != null) {
						//Remove the outdated storage format save:
						cout("Deleting the old SRAM save due to outdated format.", 0);
						deleteValue("SRAM_" + gameboy.name);
					}
					setValue("B64_SRAM_" + gameboy.name, arrayToBase64(sram));
				}
				else {
					cout("SRAM could not be saved because it was empty.", 1);
				}
			}
			catch (error) {
				cout("Could not save the current emulation state(\"" + error.message + "\").", 2);
			}
		}
		else {
			cout("Cannot save a game that does not have battery backed SRAM specified.", 1);
		}
		saveRTC();
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}
function saveRTC() {	//Execute this when SRAM is being saved as well.
	if (GameBoyEmulatorInitialized()) {
		if (gameboy.cTIMER) {
			try {
				cout("Saving the RTC...", 0);
				setValue("RTC_" + gameboy.name, gameboy.saveRTCState());
			}
			catch (error) {
				cout("Could not save the RTC of the current emulation state(\"" + error.message + "\").", 2);
			}
		}
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}
function autoSave() {
	if (GameBoyEmulatorInitialized()) {
		cout("Automatically saving the SRAM.", 0);
		saveSRAM();
		saveRTC();
	}
}
function openSRAM(filename) {
	try {
		if (findValue("B64_SRAM_" + filename) != null) {
			cout("Found a previous SRAM state (Will attempt to load).", 0);
			return base64ToArray(findValue("B64_SRAM_" + filename));
		}
		else if (findValue("SRAM_" + filename) != null) {
			cout("Found a previous SRAM state (Will attempt to load).", 0);
			return findValue("SRAM_" + filename);
		}
		else {
			cout("Could not find any previous SRAM copy for the current ROM.", 0);
		}
	}
	catch (error) {
		cout("Could not open the  SRAM of the saved emulation state.", 2);
	}
	return [];
}
function openRTC(filename) {
	try {
		if (findValue("RTC_" + filename) != null) {
			cout("Found a previous RTC state (Will attempt to load).", 0);
			return findValue("RTC_" + filename);
		}
		else {
			cout("Could not find any previous RTC copy for the current ROM.", 0);
		}
	}
	catch (error) {
		cout("Could not open the RTC data of the saved emulation state.", 2);
	}
	return [];
}
function saveState(filename) {
	if (GameBoyEmulatorInitialized()) {
		try {
			setValue(filename, gameboy.saveState());
			cout("Saved the current state as: " + filename, 0);
		}
		catch (error) {
			cout("Could not save the current emulation state(\"" + error.message + "\").", 2);
		}
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}
function openState(filename, canvas) {
	try {
		if (findValue(filename) != null) {
			try {
				clearLastEmulation();
				cout("Attempting to run a saved emulation state.", 0);
				gameboy = new GameBoyCore(canvas, "");
				gameboy.savedStateFileName = filename;
				gameboy.returnFromState(findValue(filename));
				run();
			}
			catch (error) {
				alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
			}
		}
		else {
			cout("Could not find the save state " + filename + "\".", 2);
		}
	}
	catch (error) {
		cout("Could not open the saved emulation state.", 2);
	}
}

function import_save(blobData) {
	// 尝试按原有的 multi-blob 格式解析；若解析成功则按原逻辑导入并返回 true。
	try {
		var decoded = decodeBlob(blobData);
		if (decoded && decoded.blobs && decoded.blobs.length > 0) {
			for (var index = 0; index < decoded.blobs.length; ++index) {
				cout("Importing blob \"" + decoded.blobs[index].blobID + "\"", 0);
				if (decoded.blobs[index].blobContent) {
					// SRAM 内容在原代码里用 base64(...) 保存为 B64_SRAM_*，这里保持兼容。
					if (decoded.blobs[index].blobID.substring(0, 5) == "SRAM_") {
						setValue("B64_" + decoded.blobs[index].blobID, base64(decoded.blobs[index].blobContent));
					}
					else {
						// 其他项保存为解析后的 JSON（与原逻辑一致）
						try {
							setValue(decoded.blobs[index].blobID, JSON.parse(decoded.blobs[index].blobContent));
						} catch (e) {
							// 如果不能 parse，直接保存原始文本
							setValue(decoded.blobs[index].blobID, decoded.blobs[index].blobContent);
						}
					}
				}
				else if (decoded.blobs[index].blobID) {
					cout("Save file imported had blob \"" + decoded.blobs[index].blobID + "\" with no blob data interpretable.", 2);
				}
				else {
					cout("Blob chunk information missing completely.", 2);
				}
			}
			refreshStorageListing();
			return true;
		}
	} catch (e) {
		// decodeBlob 抛错则继续尝试 RAW 导入
		cout("decodeBlob failed (will attempt RAW import): " + (e && e.message ? e.message : ""), 1);
	}

	// 到这里：decodeBlob 未能成功解析成有效的 blobs => 作为 RAW SRAM (.sav) 处理。
	// blobData 可能是：
	//  - File / Blob 对象（浏览器 file input）
	//  - 已经是 binary 字符串（从旧接口传入）
	//  - base64 / 其它（不常见）
	// 我们尝试兼容 File/Blob 与 string。

	function arrayBufferToBase64(buffer) {
		var bytes = new Uint8Array(buffer);
		var binary = "";
		var len = bytes.byteLength;
		// 按 byte-by-byte 拼接二进制字符串（注意性能：sav 文件通常不太大，适用）
		for (var i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		// 浏览器提供的 btoa 可将 binary string 转为 base64
		return btoa(binary);
	}

	function storeImportedB64(b64) {
		try {
			var key = null;
			if (typeof GameBoyEmulatorInitialized === 'function' && GameBoyEmulatorInitialized()) {
				try {
					if (gameboy && gameboy.name && gameboy.name.length > 0) {
						key = "B64_SRAM_" + gameboy.name;
					}
				} catch (e) {
					// ignore and fallback to auto key
				}
			}
			if (!key) {
				key = "B64_SRAM_imported_" + (new Date()).getTime();
			}
			setValue(key, b64);
			cout("Imported RAW SRAM saved to storage key: " + key, 0);
			refreshStorageListing();
			return true;
		} catch (err) {
			cout("Could not store RAW save: " + (err && err.message ? err.message : err), 2);
			return false;
		}
	}

	// 如果传入的是 Blob / File，异步读取 ArrayBuffer 后再存
	if (typeof Blob !== "undefined" && blobData instanceof Blob) {
		try {
			var reader = new FileReader();
			reader.onload = function (e) {
				try {
					var b64 = arrayBufferToBase64(e.target.result);
					storeImportedB64(b64);
				} catch (err2) {
					cout("Failed converting imported RAW Blob to base64: " + (err2 && err2.message ? err2.message : err2), 2);
				}
			};
			reader.onerror = function (ev) {
				cout("FileReader error while importing RAW SRAM.", 2);
			};
			reader.readAsArrayBuffer(blobData);
			// 由于异步读取，返回 true 表示已接收并在处理
			return true;
		} catch (err) {
			cout("Failed to read blob for RAW import: " + (err && err.message ? err.message : err), 2);
			return false;
		}
	}
	// 如果是字符串（可能是二进制字符串），直接 base64 编码并存
	else if (typeof blobData === 'string' && blobData.length > 0) {
		try {
			// 尝试直接用 btoa（如果字符串中包含非 Latin1 字符，btoa 可能抛错）
			var b64str;
			try {
				b64str = btoa(blobData);
			} catch (e) {
				// 如果 btoa 失败，尝试先把每个字符按 charCode 截断为低 8 位再编码
				var binary = "";
				for (var i = 0; i < blobData.length; i++) {
					binary += String.fromCharCode(blobData.charCodeAt(i) & 0xFF);
				}
				b64str = btoa(binary);
			}
			return storeImportedB64(b64str);
		} catch (err) {
			cout("Failed to import RAW string data: " + (err && err.message ? err.message : err), 2);
			return false;
		}
	}
	// 其他情况：无法识别的输入
	cout("Could not decode the imported file.", 2);
	return false;
}

function generateBlob(keyName, encodedData) {
	//Append the file format prefix:
	var saveString = "EMULATOR_DATA";
	var consoleID = "GameBoy";
	//Figure out the length:
	var totalLength = (saveString.length + 4 + (1 + consoleID.length)) + ((1 + keyName.length) + (4 + encodedData.length));
	//Append the total length in bytes:
	saveString += to_little_endian_dword(totalLength);
	//Append the console ID text's length:
	saveString += to_byte(consoleID.length);
	//Append the console ID text:
	saveString += consoleID;
	//Append the blob ID:
	saveString += to_byte(keyName.length);
	saveString += keyName;
	//Now append the save data:
	saveString += to_little_endian_dword(encodedData.length);
	saveString += encodedData;
	return saveString;
}
function generateMultiBlob(blobPairs) {
	var consoleID = "GameBoy";
	//Figure out the initial length:
	var totalLength = 13 + 4 + 1 + consoleID.length;
	//Append the console ID text's length:
	var saveString = to_byte(consoleID.length);
	//Append the console ID text:
	saveString += consoleID;
	var keyName = "";
	var encodedData = "";
	//Now append all the blobs:
	for (var index = 0; index < blobPairs.length; ++index) {
		keyName = blobPairs[index][0];
		encodedData = blobPairs[index][1];
		//Append the blob ID:
		saveString += to_byte(keyName.length);
		saveString += keyName;
		//Now append the save data:
		saveString += to_little_endian_dword(encodedData.length);
		saveString += encodedData;
		//Update the total length:
		totalLength += 1 + keyName.length + 4 + encodedData.length;
	}
	//Now add the prefix:
	saveString = "EMULATOR_DATA" + to_little_endian_dword(totalLength) + saveString;
	return saveString;
}
function decodeBlob(blobData) {
	/*Format is as follows:
		- 13 byte string "EMULATOR_DATA"
		- 4 byte total size (including these 4 bytes).
		- 1 byte Console type ID length
		- Console type ID text of 8 bit size
		blobs {
			- 1 byte blob ID length
			- blob ID text (Used to say what the data is (SRAM/freeze state/etc...))
			- 4 byte blob length
			- blob length of 32 bit size
		}
	*/
	var length = blobData.length;
	var blobProperties = {};
	blobProperties.consoleID = null;
	var blobsCount = -1;
	blobProperties.blobs = [];
	if (length > 17) {
		if (blobData.substring(0, 13) == "EMULATOR_DATA") {
			var length = Math.min(((blobData.charCodeAt(16) & 0xFF) << 24) | ((blobData.charCodeAt(15) & 0xFF) << 16) | ((blobData.charCodeAt(14) & 0xFF) << 8) | (blobData.charCodeAt(13) & 0xFF), length);
			var consoleIDLength = blobData.charCodeAt(17) & 0xFF;
			if (length > 17 + consoleIDLength) {
				blobProperties.consoleID = blobData.substring(18, 18 + consoleIDLength);
				var blobIDLength = 0;
				var blobLength = 0;
				for (var index = 18 + consoleIDLength; index < length;) {
					blobIDLength = blobData.charCodeAt(index++) & 0xFF;
					if (index + blobIDLength < length) {
						blobProperties.blobs[++blobsCount] = {};
						blobProperties.blobs[blobsCount].blobID = blobData.substring(index, index + blobIDLength);
						index += blobIDLength;
						if (index + 4 < length) {
							blobLength = ((blobData.charCodeAt(index + 3) & 0xFF) << 24) | ((blobData.charCodeAt(index + 2) & 0xFF) << 16) | ((blobData.charCodeAt(index + 1) & 0xFF) << 8) | (blobData.charCodeAt(index) & 0xFF);
							index += 4;
							if (index + blobLength <= length) {
								blobProperties.blobs[blobsCount].blobContent =  blobData.substring(index, index + blobLength);
								index += blobLength;
							}
							else {
								cout("Blob length check failed, blob determined to be incomplete.", 2);
								break;
							}
						}
						else {
							cout("Blob was incomplete, bailing out.", 2);
							break;
						}
					}
					else {
						cout("Blob was incomplete, bailing out.", 2);
						break;
					}
				}
			}
		}
	}
	return blobProperties;
}
function matchKey(key) {	//Maps a keyboard key to a gameboy key.
	//Order: Right, Left, Up, Down, A, B, Select, Start
	var keymap = ["right", "left", "up", "down", "a", "b", "select", "start"];	//Keyboard button map.
	for (var index = 0; index < keymap.length; index++) {
		if (keymap[index] == key) {
			return index;
		}
	}
	return -1;
}
function GameBoyEmulatorInitialized() {
	return (typeof gameboy == "object" && gameboy != null);
}
function GameBoyEmulatorPlaying() {
	return ((gameboy.stopEmulator & 2) == 0);
}
function GameBoyKeyDown(key) {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		GameBoyJoyPadEvent(matchKey(key), true);
	}
}
function GameBoyJoyPadEvent(keycode, down) {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		if (keycode >= 0 && keycode < 8) {
			gameboy.JoyPadEvent(keycode, down);
		}
	}
}
function GameBoyKeyUp(key) {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		GameBoyJoyPadEvent(matchKey(key), false);
	}
}
function GameBoyGyroSignalHandler(e) {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		if (e.gamma || e.beta) {
			gameboy.GyroEvent(e.gamma * Math.PI / 180, e.beta * Math.PI / 180);
		}
		else {
			gameboy.GyroEvent(e.x, e.y);
		}
		try {
			e.preventDefault();
		}
		catch (error) { }
	}
}
//The emulator will call this to sort out the canvas properties for (re)initialization.
function initNewCanvas() {
	if (GameBoyEmulatorInitialized()) {
		gameboy.canvas.width = gameboy.canvas.clientWidth;
		gameboy.canvas.height = gameboy.canvas.clientHeight;
	}
}
//Call this when resizing the canvas:
function initNewCanvasSize() {
	if (GameBoyEmulatorInitialized()) {
		if (!settings[12]) {
			if (gameboy.onscreenWidth != 160 || gameboy.onscreenHeight != 144) {
				gameboy.initLCD();
			}
		}
		else {
			if (gameboy.onscreenWidth != gameboy.canvas.clientWidth || gameboy.onscreenHeight != gameboy.canvas.clientHeight) {
				gameboy.initLCD();
			}
		}
	}
}
