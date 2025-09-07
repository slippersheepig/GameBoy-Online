//2010-2013 Grant Galitz - XAudioJS realtime audio output compatibility library:
var XAudioJSscriptsHandle = document.getElementsByTagName("script");
var XAudioJSsourceHandle = XAudioJSscriptsHandle[XAudioJSscriptsHandle.length-1].src;
function XAudioServer(channels, sampleRate, minBufferSize, maxBufferSize, underRunCallback, volume, failureCallback) {
	XAudioJSChannelsAllocated = Math.max(channels, 1);
	this.XAudioJSSampleRate = Math.abs(sampleRate);
	XAudioJSMinBufferSize = (minBufferSize >= (XAudioJSSamplesPerCallback * XAudioJSChannelsAllocated) && minBufferSize < maxBufferSize) ? (minBufferSize & (-XAudioJSChannelsAllocated)) : (XAudioJSSamplesPerCallback * XAudioJSChannelsAllocated);
	XAudioJSMaxBufferSize = (Math.floor(maxBufferSize) > XAudioJSMinBufferSize + XAudioJSChannelsAllocated) ? (maxBufferSize & (-XAudioJSChannelsAllocated)) : (XAudioJSMinBufferSize * XAudioJSChannelsAllocated);
	this.underRunCallback = (typeof underRunCallback == "function") ? underRunCallback : function () {};
	XAudioJSVolume = (volume >= 0 && volume <= 1) ? volume : 1;
	this.failureCallback = (typeof failureCallback == "function") ? failureCallback : function () { throw(new Error("XAudioJS has encountered a fatal error.")); };
	this.initializeAudio();
}
XAudioServer.prototype.MOZWriteAudioNoCallback = function (buffer) {
    //Resample before passing to the moz audio api:
    var bufferLength  = buffer.length;
    for (var bufferIndex = 0; bufferIndex < bufferLength;) {
        var sliceLength = Math.min(bufferLength - bufferIndex, XAudioJSMaxBufferSize);
        for (var sliceIndex = 0; sliceIndex < sliceLength; ++sliceIndex) {
            XAudioJSAudioContextSampleBuffer[sliceIndex] = buffer[bufferIndex++];
        }
        var resampleLength = XAudioJSResampleControl.resampler(XAudioJSGetArraySlice(XAudioJSAudioContextSampleBuffer, sliceIndex));
        if (resampleLength > 0) {
            var resampledResult = XAudioJSResampleControl.outputBuffer;
            var resampledBuffer = XAudioJSGetArraySlice(resampledResult, resampleLength);
            this.samplesAlreadyWritten += this.audioHandleMoz.mozWriteAudio(resampledBuffer);
        }
    }
}
XAudioServer.prototype.callbackBasedWriteAudioNoCallback = function (buffer) {
	//Callback-centered audio APIs:
	var length = buffer.length;
	for (var bufferCounter = 0; bufferCounter < length && XAudioJSAudioBufferSize < XAudioJSMaxBufferSize;) {
		XAudioJSAudioContextSampleBuffer[XAudioJSAudioBufferSize++] = buffer[bufferCounter++];
	}
}
/*Pass your samples into here!
Pack your samples as a one-dimenional array
With the channel samples packed uniformly.
examples:
    mono - [left, left, left, left]
    stereo - [left, right, left, right, left, right, left, right]
*/
XAudioServer.prototype.writeAudio = function (buffer) {
	switch (this.audioType) {
		case 0:
			this.MOZWriteAudioNoCallback(buffer);
			this.MOZExecuteCallback();
			break;
		case 2:
			this.checkFlashInit();
		case 1:
		case 3:
			this.callbackBasedWriteAudioNoCallback(buffer);
			this.callbackBasedExecuteCallback();
			break;
		default:
			this.failureCallback();
	}
}
/*Pass your samples into here if you don't want automatic callback calling:
Pack your samples as a one-dimenional array
With the channel samples packed uniformly.
examples:
    mono - [left, left, left, left]
    stereo - [left, right, left, right, left, right, left, right]
Useful in preventing infinite recursion issues with calling writeAudio inside your callback.
*/
XAudioServer.prototype.writeAudioNoCallback = function (buffer) {
	switch (this.audioType) {
		case 0:
			this.MOZWriteAudioNoCallback(buffer);
			break;
		case 2:
			this.checkFlashInit();
		case 1:
		case 3:
			this.callbackBasedWriteAudioNoCallback(buffer);
			break;
		default:
			this.failureCallback();
	}
}
//Developer can use this to see how many samples to write (example: minimum buffer allotment minus remaining samples left returned from this function to make sure maximum buffering is done...)
//If null is returned, then that means metric could not be done.
XAudioServer.prototype.remainingBuffer = function () {
	switch (this.audioType) {
		case 0:
			return Math.floor((this.samplesAlreadyWritten - this.audioHandleMoz.mozCurrentSampleOffset()) * XAudioJSResampleControl.ratioWeight / XAudioJSChannelsAllocated) * XAudioJSChannelsAllocated;
		case 2:
			this.checkFlashInit();
		case 1:
		case 3:
			return (Math.floor((XAudioJSResampledSamplesLeft() * XAudioJSResampleControl.ratioWeight) / XAudioJSChannelsAllocated) * XAudioJSChannelsAllocated) + XAudioJSAudioBufferSize;
		default:
			this.failureCallback();
			return null;
	}
}
XAudioServer.prototype.MOZExecuteCallback = function () {
	//mozAudio:
	var samplesRequested = XAudioJSMinBufferSize - this.remainingBuffer();
	if (samplesRequested > 0) {
		this.MOZWriteAudioNoCallback(this.underRunCallback(samplesRequested));
	}
}
XAudioServer.prototype.callbackBasedExecuteCallback = function () {
	//WebKit /Flash Audio:
	var samplesRequested = XAudioJSMinBufferSize - this.remainingBuffer();
	if (samplesRequested > 0) {
		this.callbackBasedWriteAudioNoCallback(this.underRunCallback(samplesRequested));
	}
}
//If you just want your callback called for any possible refill (Execution of callback is still conditional):
XAudioServer.prototype.executeCallback = function () {
	switch (this.audioType) {
		case 0:
			this.MOZExecuteCallback();
			break;
		case 2:
			this.checkFlashInit();
		case 1:
		case 3:
			this.callbackBasedExecuteCallback();
			break;
		default:
			this.failureCallback();
	}
}
//DO NOT CALL THIS, the lib calls this internally!
XAudioServer.prototype.initializeAudio = function () {
    try {
        this.initializeMozAudio();
    }
    catch (error) {
        try {
            this.initializeWebAudio();
        }
        catch (error) {
            try {
                this.initializeMediaStream();
            }
            catch (error) {
                try {
                    this.initializeFlashAudio();
                }
                catch (error) {
                    this.audioType = -1;
                    this.failureCallback();
                }
            }
        }
    }
}
XAudioServer.prototype.initializeMediaStream = function () {
	this.audioHandleMediaStream = new Audio();
	this.resetCallbackAPIAudioBuffer(XAudioJSMediaStreamSampleRate);
	if (XAudioJSMediaStreamWorker) {
		//WebWorker is not GC'd, so manually collect it:
		XAudioJSMediaStreamWorker.terminate();
	}
	XAudioJSMediaStreamWorker = new Worker(XAudioJSsourceHandle.substring(0, XAudioJSsourceHandle.length - 3) + "MediaStreamWorker.js");
	this.audioHandleMediaStreamProcessing = new ProcessedMediaStream(XAudioJSMediaStreamWorker, XAudioJSMediaStreamSampleRate, XAudioJSChannelsAllocated);
	this.audioHandleMediaStream.src = this.audioHandleMediaStreamProcessing;
	this.audioHandleMediaStream.volume = XAudioJSVolume;
	XAudioJSMediaStreamWorker.onmessage = XAudioJSMediaStreamPushAudio;
	XAudioJSMediaStreamWorker.postMessage([1, XAudioJSResampleBufferSize, XAudioJSChannelsAllocated]);
	this.audioHandleMediaStream.play();
	this.audioType = 3;
}
XAudioServer.prototype.initializeMozAudio = function () {
    this.audioHandleMoz = new Audio();
	this.audioHandleMoz.mozSetup(XAudioJSChannelsAllocated, XAudioJSMozAudioSampleRate);
	this.audioHandleMoz.volume = XAudioJSVolume;
	this.samplesAlreadyWritten = 0;
	this.audioType = 0;
	//if (navigator.platform != "MacIntel" && navigator.platform != "MacPPC") {
		//Add some additional buffering space to workaround a moz audio api issue:
		var bufferAmount = (this.XAudioJSSampleRate * XAudioJSChannelsAllocated / 10) | 0;
		bufferAmount -= bufferAmount % XAudioJSChannelsAllocated;
		this.samplesAlreadyWritten -= bufferAmount;
	//}
    this.initializeResampler(XAudioJSMozAudioSampleRate);
}
XAudioServer.prototype.initializeWebAudio = function () {
    // Create or reuse AudioContext:
    if (!XAudioJSWebAudioLaunchedContext) {
        try {
            XAudioJSWebAudioContextHandle = new AudioContext(); // modern
        }
        catch (error) {
            try {
                XAudioJSWebAudioContextHandle = new webkitAudioContext(); // older webkit
            } catch (e) {
                // If even webkitAudioContext not available, throw and let outer try/catch pick fallback
                throw error;
            }
        }
        XAudioJSWebAudioLaunchedContext = true;
    }

    // If an old node existed, disconnect it:
    if (XAudioJSWebAudioAudioNode) {
        try {
            XAudioJSWebAudioAudioNode.disconnect();
        } catch (e) {}
        try { XAudioJSWebAudioAudioNode.onaudioprocess = null; } catch (e) {}
        XAudioJSWebAudioAudioNode = null;
    }

    // Make sure we have the latest sample rate & buffers
    this.resetCallbackAPIAudioBuffer(XAudioJSWebAudioContextHandle.sampleRate);
    this.audioType = 1;

    // Small helper: resume audio context on first user interaction (fix mobile auto-suspend)
    (function resumeOnInteraction(ctx) {
        if (!ctx) return;
        if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
            var resume = function () {
                ctx.resume && ctx.resume().catch(function(){});
                document.removeEventListener('touchstart', resume, true);
                document.removeEventListener('mousedown', resume, true);
                document.removeEventListener('click', resume, true);
            };
            // use passive where safe
            document.addEventListener('touchstart', resume, true);
            document.addEventListener('mousedown', resume, true);
            document.addEventListener('click', resume, true);
        }
    })(XAudioJSWebAudioContextHandle);

    // If AudioWorklet is available, use it (preferred; removes ScriptProcessor deprecation warning).
    var parentObj = this;
    if (XAudioJSWebAudioContextHandle.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        try {
            // Build a small worklet script as a blob so we don't need an external file.
            var workletScript = [
                'class XAudioProcessor extends AudioWorkletProcessor {',
                '  constructor(options) {',
                '    super();',
                '    var procOpts = options.processorOptions || {};',
                '    this.channels = procOpts.channels || 1;',
                '    this._buffer = new Float32Array(0);',
                '    this._readIndex = 0;',
                '    this._tickCounter = 0;',
                '    var self = this;',
                '    this.port.onmessage = function(e) {',
                '      var d = e.data;',
                '      if (!d) return;',
                '      if (d.cmd === "pushBuffer" && d.buffer) {',
                '        // append received buffer (transferred ArrayBuffer)',
                '        var arr = new Float32Array(d.buffer);',
                '        var newBuf = new Float32Array(self._buffer.length - self._readIndex + arr.length);',
                '        if (self._buffer.length - self._readIndex > 0) {',
                '          newBuf.set(self._buffer.subarray(self._readIndex), 0);',
                '        }',
                '        newBuf.set(arr, self._buffer.length - self._readIndex);',
                '        self._buffer = newBuf;',
                '        self._readIndex = 0;',
                '      } else if (d.cmd === "clear") {',
                '        self._buffer = new Float32Array(0);',
                '        self._readIndex = 0;',
                '      }',
                '    };',
                '  }',
                '  process(inputs, outputs) {',
                '    var out = outputs[0];',
                '    var frames = (out[0] && out[0].length) ? out[0].length : 128;',
                '    var channels = this.channels;',
                '    var needed = frames * channels;',
                '    // If we have enough buffered samples, copy them out channel-wise',
                '    if (this._buffer.length - this._readIndex >= needed) {',
                '      var base = this._readIndex;',
                '      for (var ch = 0; ch < channels; ++ch) {',
                '        var chOut = out[ch];',
                '        var idx = base + ch;',
                '        for (var i = 0; i < frames; ++i) {',
                '          chOut[i] = this._buffer[idx];',
                '          idx += channels;',
                '        }',
                '      }',
                '      this._readIndex += needed;',
                '      // trim if we've consumed many samples',
                '      if (this._readIndex > 16384) {',
                '        this._buffer = this._buffer.subarray(this._readIndex);',
                '        this._readIndex = 0;',
                '      }',
                '    } else {',
                '      // underrun -> fill zeros',
                '      for (var ch2 = 0; ch2 < channels; ++ch2) {',
                '        var chOut2 = out[ch2];',
                '        for (var j = 0; j < frames; ++j) chOut2[j] = 0;',
                '      }',
                '      // Ask main thread for more samples (main thread will reply with pushBuffer)',
                '      this.port.postMessage({ cmd: "needSamples", frames: frames });',
                '    }',
                '    // send a tick occasionally so the main thread can detect the node is alive',
                '    this._tickCounter = (this._tickCounter + 1) | 0;',
                '    if ((this._tickCounter & 3) === 0) {',
                '      this.port.postMessage({ cmd: "tick" });',
                '    }',
                '    return true;',
                '  }',
                '}',
                'registerProcessor("xaudio-processor", XAudioProcessor);'
            ].join('\n');

            var blob = new Blob([workletScript], { type: 'application/javascript' });
            var blobURL = URL.createObjectURL(blob);

            // Add module and create node when ready
            XAudioJSWebAudioContextHandle.audioWorklet.addModule(blobURL).then(function () {
                // create the worklet node
                XAudioJSWebAudioAudioNode = new AudioWorkletNode(XAudioJSWebAudioContextHandle, 'xaudio-processor', {
                    numberOfOutputs: 1,
                    outputChannelCount: [XAudioJSChannelsAllocated],
                    processorOptions: { channels: XAudioJSChannelsAllocated }
                });

                // Handle messages from the processor:
                XAudioJSWebAudioAudioNode.port.onmessage = function (e) {
                    var data = e.data;
                    if (!data) return;
                    if (data.cmd === 'needSamples') {
                        // Processor asks for frames; respond by filling an interleaved Float32Array
                        var framesRequested = data.frames || XAudioJSSamplesPerCallback;
                        var totalReq = framesRequested * XAudioJSChannelsAllocated;
                        var sendBuf = new Float32Array(totalReq);
                        var fillIndex = 0;

                        // Ensure resampled buffer is refilled from main queued samples:
                        XAudioJSResampleRefill();

                        // Copy from XAudioJSResampledBuffer into sendBuf same as old onaudioprocess logic:
                        for (var idx = 0; idx < framesRequested && XAudioJSResampleBufferStart != XAudioJSResampleBufferEnd; ++idx) {
                            for (var ch = 0; ch < XAudioJSChannelsAllocated; ++ch) {
                                sendBuf[fillIndex++] = XAudioJSResampledBuffer[XAudioJSResampleBufferStart++] * XAudioJSVolume;
                                if (XAudioJSResampleBufferStart == XAudioJSResampleBufferSize) {
                                    XAudioJSResampleBufferStart = 0;
                                }
                            }
                        }
                        // pad with zeros if undersupplied
                        while (fillIndex < sendBuf.length) sendBuf[fillIndex++] = 0;

                        // Transfer the buffer to the worklet
                        try {
                            XAudioJSWebAudioAudioNode.port.postMessage({ cmd: 'pushBuffer', buffer: sendBuf.buffer }, [sendBuf.buffer]);
                        } catch (err) {
                            // fallback: post without transfer (slower)
                            XAudioJSWebAudioAudioNode.port.postMessage({ cmd: 'pushBuffer', buffer: sendBuf.buffer });
                        }
                    } else if (data.cmd === 'tick') {
                        // worklet signals it's alive -> update watchdog timestamp
                        XAudioJSWebAudioWatchDogLast = (new Date()).getTime();
                    }
                };

                // connect to destination
                XAudioJSWebAudioAudioNode.connect(XAudioJSWebAudioContextHandle.destination);

                // start watchdog timestamp for Gecko compatibility (original behavior)
                XAudioJSWebAudioWatchDogLast = (new Date()).getTime();

                // If Gecko, ensure the watchdog timer restarts the node on glitch (same as original)
                if (navigator.userAgent.indexOf('Gecko/') > -1) {
                    if (XAudioJSWebAudioWatchDogTimer) {
                        clearInterval(XAudioJSWebAudioWatchDogTimer);
                    }
                    var parentObj2 = parentObj;
                    XAudioJSWebAudioWatchDogTimer = setInterval(function () {
                        var timeDiff = (new Date()).getTime() - XAudioJSWebAudioWatchDogLast;
                        if (timeDiff > 500) {
                            try {
                                parentObj2.initializeWebAudio();
                            } catch (err) {}
                        }
                    }, 500);
                }
            }).catch(function (err) {
                // If worklet failed for any reason, fallback to old ScriptProcessor creation
                createDeprecatedProcessor();
            });

            // done (return from try)
            return;
        } catch (err) {
            // fall through to deprecated processor creation
        }
    }

    // If audioWorklet not available or failed, create the old ScriptProcessor (keeps original behavior)
    function createDeprecatedProcessor() {
        try {
            // preferred modern (but deprecated) API
            XAudioJSWebAudioAudioNode = XAudioJSWebAudioContextHandle.createScriptProcessor(XAudioJSSamplesPerCallback, 0, XAudioJSChannelsAllocated);
        } catch (error) {
            // older webkit name
            XAudioJSWebAudioAudioNode = XAudioJSWebAudioContextHandle.createJavaScriptNode(XAudioJSSamplesPerCallback, 0, XAudioJSChannelsAllocated);
        }
        // set the old onaudioprocess handler (unchanged)
        XAudioJSWebAudioAudioNode.onaudioprocess = XAudioJSWebAudioEvent;
        XAudioJSWebAudioAudioNode.connect(XAudioJSWebAudioContextHandle.destination);
        XAudioJSWebAudioWatchDogLast = (new Date()).getTime();

        if (navigator.userAgent.indexOf('Gecko/') > -1) {
            if (XAudioJSWebAudioWatchDogTimer) {
                clearInterval(XAudioJSWebAudioWatchDogTimer);
            }
            var parentObj3 = parentObj;
            XAudioJSWebAudioWatchDogTimer = setInterval(function () {
                var timeDiff = (new Date()).getTime() - XAudioJSWebAudioWatchDogLast;
                if (timeDiff > 500) {
                    parentObj3.initializeWebAudio();
                }
            }, 500);
        }
    }

    // create deprecated processor immediately if worklet path not used:
    createDeprecatedProcessor();
};
XAudioServer.prototype.initializeFlashAudio = function () {
	var existingFlashload = document.getElementById("XAudioJS");
	this.flashInitialized = false;
	this.resetCallbackAPIAudioBuffer(44100);
	switch (XAudioJSChannelsAllocated) {
		case 1:
			XAudioJSFlashTransportEncoder = XAudioJSGenerateFlashMonoString;
			break;
		case 2:
			XAudioJSFlashTransportEncoder = XAudioJSGenerateFlashStereoString;
			break;
		default:
			XAudioJSFlashTransportEncoder = XAudioJSGenerateFlashSurroundString;
	}
	if (existingFlashload == null) {
		this.audioHandleFlash = null;
		var thisObj = this;
		var mainContainerNode = document.createElement("div");
		mainContainerNode.setAttribute("style", "position: fixed; bottom: 0px; right: 0px; margin: 0px; padding: 0px; border: none; width: 8px; height: 8px; overflow: hidden; z-index: -1000; ");
		var containerNode = document.createElement("div");
		containerNode.setAttribute("style", "position: static; border: none; width: 0px; height: 0px; visibility: hidden; margin: 8px; padding: 0px;");
		containerNode.setAttribute("id", "XAudioJS");
		mainContainerNode.appendChild(containerNode);
		document.getElementsByTagName("body")[0].appendChild(mainContainerNode);
		swfobject.embedSWF(
			XAudioJSsourceHandle.substring(0, XAudioJSsourceHandle.length - 9) + "JS.swf",
			"XAudioJS",
			"8",
			"8",
			"9.0.0",
			"",
			{},
			{"allowscriptaccess":"always"},
			{"style":"position: static; visibility: hidden; margin: 8px; padding: 0px; border: none"},
			function (event) {
				if (event.success) {
					thisObj.audioHandleFlash = event.ref;
					thisObj.checkFlashInit();
				}
				else {
					thisObj.failureCallback();
					thisObj.audioType = -1;
				}
			}
		);
	}
	else {
		this.audioHandleFlash = existingFlashload;
		this.checkFlashInit();
	}
	this.audioType = 2;
}
XAudioServer.prototype.changeVolume = function (newVolume) {
	if (newVolume >= 0 && newVolume <= 1) {
		XAudioJSVolume = newVolume;
		switch (this.audioType) {
			case 0:
				this.audioHandleMoz.volume = XAudioJSVolume;
			case 1:
				break;
			case 2:
				if (this.flashInitialized) {
					this.audioHandleFlash.changeVolume(XAudioJSVolume);
				}
				else {
					this.checkFlashInit();
				}
				break;
			case 3:
				this.audioHandleMediaStream.volume = XAudioJSVolume;
				break;
			default:
				this.failureCallback();
		}
	}
}
//Checks to see if the NPAPI Adobe Flash bridge is ready yet:
XAudioServer.prototype.checkFlashInit = function () {
	if (!this.flashInitialized) {
		try {
			if (this.audioHandleFlash && this.audioHandleFlash.initialize) {
				this.flashInitialized = true;
				this.audioHandleFlash.initialize(XAudioJSChannelsAllocated, XAudioJSVolume);
			}
		}
		catch (error) {
			this.flashInitialized = false;
		}
	}
}
//Set up the resampling:
XAudioServer.prototype.resetCallbackAPIAudioBuffer = function (APISampleRate) {
	XAudioJSAudioBufferSize = XAudioJSResampleBufferEnd = XAudioJSResampleBufferStart = 0;
    this.initializeResampler(APISampleRate);
    XAudioJSResampledBuffer = this.getFloat32(XAudioJSResampleBufferSize);
}
XAudioServer.prototype.initializeResampler = function (sampleRate) {
    XAudioJSAudioContextSampleBuffer = this.getFloat32(XAudioJSMaxBufferSize);
    XAudioJSResampleBufferSize = Math.max(XAudioJSMaxBufferSize * Math.ceil(sampleRate / this.XAudioJSSampleRate) + XAudioJSChannelsAllocated, XAudioJSSamplesPerCallback * XAudioJSChannelsAllocated);
	XAudioJSResampleControl = new Resampler(this.XAudioJSSampleRate, sampleRate, XAudioJSChannelsAllocated, XAudioJSResampleBufferSize, true);
}
XAudioServer.prototype.getFloat32 = function (size) {
	try {
		return new Float32Array(size);
	}
	catch (error) {
		return [];
	}
}
function XAudioJSFlashAudioEvent() {		//The callback that flash calls...
	XAudioJSResampleRefill();
	return XAudioJSFlashTransportEncoder();
}
function XAudioJSGenerateFlashSurroundString() {	//Convert the arrays to one long string for speed.
	var XAudioJSTotalSamples = XAudioJSSamplesPerCallback << 1;
	if (XAudioJSBinaryString.length > XAudioJSTotalSamples) {
		XAudioJSBinaryString = [];
	}
	XAudioJSTotalSamples = 0;
	for (var index = 0; index < XAudioJSSamplesPerCallback && XAudioJSResampleBufferStart != XAudioJSResampleBufferEnd; ++index) {
		//Sanitize the buffer:
		XAudioJSBinaryString[XAudioJSTotalSamples++] = String.fromCharCode(((Math.min(Math.max(XAudioJSResampledBuffer[XAudioJSResampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		XAudioJSBinaryString[XAudioJSTotalSamples++] = String.fromCharCode(((Math.min(Math.max(XAudioJSResampledBuffer[XAudioJSResampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		XAudioJSResampleBufferStart += XAudioJSChannelsAllocated - 2;
		if (XAudioJSResampleBufferStart == XAudioJSResampleBufferSize) {
			XAudioJSResampleBufferStart = 0;
		}
	}
	return XAudioJSBinaryString.join("");
}
function XAudioJSGenerateFlashStereoString() {	//Convert the arrays to one long string for speed.
	var XAudioJSTotalSamples = XAudioJSSamplesPerCallback << 1;
	if (XAudioJSBinaryString.length > XAudioJSTotalSamples) {
		XAudioJSBinaryString = [];
	}
	for (var index = 0; index < XAudioJSTotalSamples && XAudioJSResampleBufferStart != XAudioJSResampleBufferEnd;) {
		//Sanitize the buffer:
		XAudioJSBinaryString[index++] = String.fromCharCode(((Math.min(Math.max(XAudioJSResampledBuffer[XAudioJSResampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		XAudioJSBinaryString[index++] = String.fromCharCode(((Math.min(Math.max(XAudioJSResampledBuffer[XAudioJSResampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		if (XAudioJSResampleBufferStart == XAudioJSResampleBufferSize) {
			XAudioJSResampleBufferStart = 0;
		}
	}
	return XAudioJSBinaryString.join("");
}
function XAudioJSGenerateFlashMonoString() {	//Convert the array to one long string for speed.
	if (XAudioJSBinaryString.length > XAudioJSSamplesPerCallback) {
		XAudioJSBinaryString = [];
	}
	for (var index = 0; index < XAudioJSSamplesPerCallback && XAudioJSResampleBufferStart != XAudioJSResampleBufferEnd;) {
		//Sanitize the buffer:
		XAudioJSBinaryString[index++] = String.fromCharCode(((Math.min(Math.max(XAudioJSResampledBuffer[XAudioJSResampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		if (XAudioJSResampleBufferStart == XAudioJSResampleBufferSize) {
			XAudioJSResampleBufferStart = 0;
		}
	}
	return XAudioJSBinaryString.join("");
}
//Some Required Globals:
var XAudioJSWebAudioContextHandle = null;
var XAudioJSWebAudioAudioNode = null;
var XAudioJSWebAudioWatchDogTimer = null;
var XAudioJSWebAudioWatchDogLast = false;
var XAudioJSWebAudioLaunchedContext = false;
var XAudioJSAudioContextSampleBuffer = [];
var XAudioJSResampledBuffer = [];
var XAudioJSMinBufferSize = 15000;
var XAudioJSMaxBufferSize = 25000;
var XAudioJSChannelsAllocated = 1;
var XAudioJSVolume = 1;
var XAudioJSResampleControl = null;
var XAudioJSAudioBufferSize = 0;
var XAudioJSResampleBufferStart = 0;
var XAudioJSResampleBufferEnd = 0;
var XAudioJSResampleBufferSize = 0;
var XAudioJSMediaStreamWorker = null;
var XAudioJSMediaStreamBuffer = [];
var XAudioJSMediaStreamSampleRate = 44100;
var XAudioJSMozAudioSampleRate = 44100;
var XAudioJSSamplesPerCallback = 2048;			//Has to be between 2048 and 4096 (If over, then samples are ignored, if under then silence is added).
var XAudioJSFlashTransportEncoder = null;
var XAudioJSMediaStreamLengthAliasCounter = 0;
var XAudioJSBinaryString = [];
function XAudioJSWebAudioEvent(event) {		//Web Audio API callback...
	if (XAudioJSWebAudioWatchDogTimer) {
		XAudioJSWebAudioWatchDogLast = (new Date()).getTime();
	}
	//Find all output channels:
	for (var bufferCount = 0, buffers = []; bufferCount < XAudioJSChannelsAllocated; ++bufferCount) {
		buffers[bufferCount] = event.outputBuffer.getChannelData(bufferCount);
	}
	//Make sure we have resampled samples ready:
	XAudioJSResampleRefill();
	//Copy samples from XAudioJS to the Web Audio API:
	for (var index = 0; index < XAudioJSSamplesPerCallback && XAudioJSResampleBufferStart != XAudioJSResampleBufferEnd; ++index) {
		for (bufferCount = 0; bufferCount < XAudioJSChannelsAllocated; ++bufferCount) {
			buffers[bufferCount][index] = XAudioJSResampledBuffer[XAudioJSResampleBufferStart++] * XAudioJSVolume;
		}
		if (XAudioJSResampleBufferStart == XAudioJSResampleBufferSize) {
			XAudioJSResampleBufferStart = 0;
		}
	}
	//Pad with silence if we're underrunning:
	while (index < XAudioJSSamplesPerCallback) {
		for (bufferCount = 0; bufferCount < XAudioJSChannelsAllocated; ++bufferCount) {
			buffers[bufferCount][index] = 0;
		}
		++index;
	}
}
//MediaStream API buffer push
function XAudioJSMediaStreamPushAudio(event) {
	var index = 0;
	var audioLengthRequested = event.data;
	var samplesPerCallbackAll = XAudioJSSamplesPerCallback * XAudioJSChannelsAllocated;
	var XAudioJSMediaStreamLengthAlias = audioLengthRequested % XAudioJSSamplesPerCallback;
	audioLengthRequested = audioLengthRequested - (XAudioJSMediaStreamLengthAliasCounter - (XAudioJSMediaStreamLengthAliasCounter % XAudioJSSamplesPerCallback)) - XAudioJSMediaStreamLengthAlias + XAudioJSSamplesPerCallback;
	XAudioJSMediaStreamLengthAliasCounter -= XAudioJSMediaStreamLengthAliasCounter - (XAudioJSMediaStreamLengthAliasCounter % XAudioJSSamplesPerCallback);
	XAudioJSMediaStreamLengthAliasCounter += XAudioJSSamplesPerCallback - XAudioJSMediaStreamLengthAlias;
	if (XAudioJSMediaStreamBuffer.length != samplesPerCallbackAll) {
		XAudioJSMediaStreamBuffer = new Float32Array(samplesPerCallbackAll);
	}
	XAudioJSResampleRefill();
	while (index < audioLengthRequested) {
		var index2 = 0;
		while (index2 < samplesPerCallbackAll && XAudioJSResampleBufferStart != XAudioJSResampleBufferEnd) {
			XAudioJSMediaStreamBuffer[index2++] = XAudioJSResampledBuffer[XAudioJSResampleBufferStart++];
			if (XAudioJSResampleBufferStart == XAudioJSResampleBufferSize) {
				XAudioJSResampleBufferStart = 0;
			}
		}
		XAudioJSMediaStreamWorker.postMessage([0, XAudioJSMediaStreamBuffer]);
		index += XAudioJSSamplesPerCallback;
	}
}
function XAudioJSResampleRefill() {
	if (XAudioJSAudioBufferSize > 0) {
		//Resample a chunk of audio:
		var resampleLength = XAudioJSResampleControl.resampler(XAudioJSGetBufferSamples());
		var resampledResult = XAudioJSResampleControl.outputBuffer;
		for (var index2 = 0; index2 < resampleLength;) {
			XAudioJSResampledBuffer[XAudioJSResampleBufferEnd++] = resampledResult[index2++];
			if (XAudioJSResampleBufferEnd == XAudioJSResampleBufferSize) {
				XAudioJSResampleBufferEnd = 0;
			}
			if (XAudioJSResampleBufferStart == XAudioJSResampleBufferEnd) {
				XAudioJSResampleBufferStart += XAudioJSChannelsAllocated;
				if (XAudioJSResampleBufferStart == XAudioJSResampleBufferSize) {
					XAudioJSResampleBufferStart = 0;
				}
			}
		}
		XAudioJSAudioBufferSize = 0;
	}
}
function XAudioJSResampledSamplesLeft() {
	return ((XAudioJSResampleBufferStart <= XAudioJSResampleBufferEnd) ? 0 : XAudioJSResampleBufferSize) + XAudioJSResampleBufferEnd - XAudioJSResampleBufferStart;
}
function XAudioJSGetBufferSamples() {
    return XAudioJSGetArraySlice(XAudioJSAudioContextSampleBuffer, XAudioJSAudioBufferSize);
}
function XAudioJSGetArraySlice(buffer, lengthOf) {
	//Typed array and normal array buffer section referencing:
	try {
		return buffer.subarray(0, lengthOf);
	}
	catch (error) {
		try {
			//Regular array pass:
			buffer.length = lengthOf;
			return buffer;
		}
		catch (error) {
			//Nightly Firefox 4 used to have the subarray function named as slice:
			return buffer.slice(0, lengthOf);
		}
	}
}
