//    WebSockets Audio API
//
//    Opus Quality Settings
//    =====================
//    App: 2048=voip, 2049=audio, 2051=low-delay
//    Sample Rate: 8000, 12000, 16000, 24000, or 48000
//    Frame Duration: 2.5, 5, 10, 20, 40, 60
//    Buffer Size = sample rate/6000 * 1024

(function (global) {
    var defaultConfig = {
        codec: {
            sampleRate: 16000,
            channels: 1,
            app: 2048,
            frameDuration: 40,
            bufferSize: 2048 //2048//4096
        }
    };

    var voiceid = new Uint8Array([1, 0, 1]);
    var audioContext = new(window.AudioContext || window.webkitAudioContext)();

    var WSAudioAPI = global.WSAudioAPI = {
        Player: function (config) {
            this.config = {};
            this.config.codec = config.codec || defaultConfig.codec;
            this.config.server = config.server || defaultConfig.server;
            this.sampler = new Resampler(this.config.codec.sampleRate, 48000, 1, this.config.codec.bufferSize);
            this.decoder = new OpusDecoder(this.config.codec.sampleRate, this.config.codec.channels);
            this.silence = new Float32Array(this.config.codec.bufferSize);
        },
        Streamer: function (config, packetCallback) {
            navigator.getUserMedia = (navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia);

            this.config = {};
            this.config.codec = config.codec || defaultConfig.codec;
            this.config.server = config.server || defaultConfig.server;
            this.packetCallback = packetCallback;

            var sampleRate = 48000;

            if (navigator.userAgent.toLowerCase().indexOf('mac') > -1) {
                sampleRate = 44100;
            }

            console.log(sampleRate);

            this.sampler = new Resampler(sampleRate, this.config.codec.sampleRate, 1, this.config.codec.bufferSize);
            this.encoder = new OpusEncoder(this.config.codec.sampleRate, this.config.codec.channels, this.config.codec.app, this.config.codec.frameDuration);
            var _this = this;
            this._makeStream = function (onError) {
                navigator.getUserMedia({
                    audio: true
                }, function (stream) {
                    console.log(stream);
                    _this.stream = stream;
                    _this.audioInput = audioContext.createMediaStreamSource(stream);
                    _this.gainNode = audioContext.createGain();
                    _this.recorder = audioContext.createScriptProcessor(_this.config.codec.bufferSize, 1, 1);
                    _this.recorder.onaudioprocess = function (e) {
                        var resampled = _this.sampler.resampler(e.inputBuffer.getChannelData(0));
                        var packets = _this.encoder.encode_float(resampled);

                        packets.forEach(packet => {
                            let packetArray = new Uint8Array(packet);
                            packetCallback(packetArray);
                        })
                    };
                    _this.audioInput.connect(_this.gainNode);
                    _this.gainNode.connect(_this.recorder);
                    _this.recorder.connect(audioContext.destination);
                }, onError || _this.onError);
            }
        }
    };

    WSAudioAPI.Streamer.prototype.start = function (onError) {
        var _this = this;
        this._makeStream(onError);
    };

    WSAudioAPI.Streamer.prototype.disconnect = function () {
        var _this = this;
        if (_this.audioInput) {
            _this.audioInput.disconnect();
            _this.audioInput = null;
        }
        if (_this.gainNode) {
            _this.gainNode.disconnect();
            _this.gainNode = null;
        }
        if (_this.recorder) {
            _this.recorder.disconnect();
            _this.recorder = null;
        }
        _this.stream.getTracks()[0].stop();
        console.log('Disconnected from server');
    };

    WSAudioAPI.Streamer.prototype.mute = function () {
        this.gainNode.gain.value = 0;
        console.log('Mic muted');
    };

    WSAudioAPI.Streamer.prototype.unMute = function () {
        this.gainNode.gain.value = 1;
        console.log('Mic unmuted');
    };

    WSAudioAPI.Streamer.prototype.onError = function (e) {
        var error = new Error(e.name);
        error.name = 'NavigatorUserMediaError';
        throw error;
    };

    WSAudioAPI.Streamer.prototype.stop = function () {
        if (this.audioInput) {
            this.audioInput.disconnect();
            this.audioInput = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.recorder) {
            this.recorder.disconnect();
            this.recorder = null;
        }
        this.stream.getTracks()[0].stop()
    };

    WSAudioAPI.Player.prototype.start = function () {
        var _this = this;

        this.audioQueue = {
            buffer: new Float32Array(0),

            write: function (newAudio) {
                var currentQLength = this.buffer.length;
                newAudio = _this.sampler.resampler(newAudio);
                var newBuffer = new Float32Array(currentQLength + newAudio.length);
                newBuffer.set(this.buffer, 0);
                newBuffer.set(newAudio, currentQLength);
                this.buffer = newBuffer;
            },

            read: function (nSamples) {
                var samplesToPlay = this.buffer.subarray(0, nSamples);
                this.buffer = this.buffer.subarray(nSamples, this.buffer.length);
                return samplesToPlay;
            },

            length: function () {
                return this.buffer.length;
            }
        };

        this.scriptNode = audioContext.createScriptProcessor(this.config.codec.bufferSize, 1, 1);
        this.scriptNode.onaudioprocess = function (e) {
            if (_this.audioQueue.length()) {
                e.outputBuffer.getChannelData(0).set(_this.audioQueue.read(_this.config.codec.bufferSize));
            } else {
                document.dispatchEvent(new Event('silence'));
                e.outputBuffer.getChannelData(0).set(_this.silence);
            }
        };
        this.gainNode = audioContext.createGain();
        this.scriptNode.connect(this.gainNode);
        this.gainNode.connect(audioContext.destination);

        this.started = true;
    };

    WSAudioAPI.Player.prototype.onPacket = function (packet) {
        if(this.started){
            // console.log(packet);
            this.audioQueue.write(this.decoder.decode_float(packet));
        }
    };

    WSAudioAPI.Player.prototype.getVolume = function () {
        return this.gainNode ? this.gainNode.gain.value : 'Stream not started yet';
    };

    WSAudioAPI.Player.prototype.setVolume = function (value) {
        if (this.gainNode) this.gainNode.gain.value = value;
    };

    WSAudioAPI.Player.prototype.stop = function () {
        this.started = false;
        this.audioQueue = null;
        this.scriptNode.disconnect();
        this.scriptNode = null;
        this.gainNode.disconnect();
        this.gainNode = null;
    };

})(window);