// if you checked "fancy-settings" in extensionizr.com, uncomment this lines

// var settings = new Store("settings", {
//     "sample_setting": "This is how you use Store.js to remember values"
// });

var recordedChunks = [];
var numrecordedChunks = 0;
var streamer;
var player;
var socket;

var config = {
  codec: {
    sampleRate: 16000,
    channels: 1,
    app: 2048,
    frameDuration: 20,
    bufferSize: 2048 //2048//4096
  }
};



//example of using a message handler from the inject scripts
chrome.extension.onMessage.addListener(
  function (request, sender, sendResponse) {
    chrome.pageAction.show(sender.tab.id);
    sendResponse();
  });


chrome.runtime.onInstalled.addListener((details) => {

  connectToChannel();

  if (details.reason.search(/install/g) === -1) {
    return
  }

  chrome.tabs.create({
    url: chrome.extension.getURL("/src/permission/permission.html"),
    active: true
  });
});

var streamId;

function gotMediaStream(stream) {

  console.log(stream);

  stream.getTracks().forEach(function (track) {
    console.log(track);
    track.addEventListener('ended', function () {
      console.log(stream.id, 'track ended', track.kind, track.id);
    });
  });



  console.log("Trying");
  recorder = new MediaRecorder(stream);
  console.log(recorder);

  console.log(recorder.state);

  recorder.ondataavailable = function (event) {
    console.log('On Data Available');
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
      numrecordedChunks += event.data.byteLength;
    }
  };

  recorder.onstop = function (data) {
    console.log('On Stop');
    stream.getTracks()[0].stop();
    setTimeout(function () {
      console.log(recordedChunks);

      var reader = new FileReader();

      reader.addEventListener("load", function () {

        console.log('DATA URI:::');
        console.log(reader.result);

        chrome.runtime.sendMessage({
          data: {
            dataUri: reader.result,
            type: recordedChunks[0].type
          }
        }, function (response) {
          console.log(response);
        });

      }, false);

      reader.readAsDataURL(recordedChunks[0]);


      // blobToDataURL(recordedChunks[0], function (base64String) {
      //   chrome.runtime.sendMessage({
      //     data: base64String
      //   }, function (response) {

      //   });
      // });




      // console.log("recorder stopped");


    }, 1000);
  };

  recorder.start();

  console.log(recorder.state);

  console.log("Recorder is started");
  console.assert(recorder);
}

function connectToChannel() {
  let id = this.speakerId;
  let idArray = intToByteArray(id, 2);
  let packetId = new Uint8Array([1, idArray[0], idArray[1]]);

  var uid = "TXCVCRIiUoWGcTS6EfOcNLncSfr1";
  var channelKey = "-L6LGrFG_vno0CKKDmJ4&EIO=3";

  socket = io.connect(`https://websock.italkdevice.com:3030`, {
    // query: `uid=${uid}&key=${channelKey}`
    query: `uid=${uid}&key=${channelKey}`
  });

  player = new WSAudioAPI.Player(config);

  streamer = new WSAudioAPI.Streamer(config, packet => {
    var outArray = new Uint8Array(packetId.length + packet.length);
    outArray.set(packetId, 0);
    outArray.set(packet, packetId.length);

    if (socket.connected) {
      socket.emit('packet', { packet: outArray.buffer });
    }
    // this.userSpeaking = this.me;
    // console.log(`Packet to send from ${id}, with ${outArray.length} bytes`);
  });
}

function getUserMediaError(error) {
  console.log("Error");
  console.log(error);
}

function end(stream) {
  console.log('ending');
  recorder.stop();
}

function captureAudio() {

  streamer.start();
  player.stop();


  // chrome.tabCapture.capture({ audio: true }, function (stream) {
  //   console.log('Capturing...');
  //   if (stream) {
  //     console.log('Stream');
  //     console.log(stream);
  //     // gotMediaStream(stream);
  //   } else {
  //     console.warn('Stream is null...');
  //   }
  // });

}

function stop() {
  streamer.stop();
  player.start();

  // chrome.tabCapture.stop();
}

function blobToDataURL(blob, cb) {
  var reader = new FileReader();
  reader.onload = function () {
    var dataUrl = reader.result;
    var base64 = dataUrl.split(',')[1];
    cb(base64);
  };
  reader.readAsDataURL(blob);
};

function intToByteArray(num, length) {
  let result = [];
  while (num > 0) {
    let byte = num & 0xff;
    result[--length] = byte;
    num = (num - byte) / 256;
  }

  while (length > 0) {
    result[--length] = 0;
  }

  return result;
}


// chrome.desktopCapture.chooseDesktopMedia(["screen", "audio"], function (approved) {
//   streamId = approved;
//   console.log(streamId);

//   navigator.webkitGetUserMedia({
//     audio: {
//       mandatory: {
//         chromeMediaSource: "system",
//         chromeMediaSourceId: streamId
//       }
//     }
//   }, gotMediaStream, getUserMediaError);



// });