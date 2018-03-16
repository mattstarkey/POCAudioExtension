// if you checked "fancy-settings" in extensionizr.com, uncomment this lines

// var settings = new Store("settings", {
//     "sample_setting": "This is how you use Store.js to remember values"
// });

var recordedChunks = [];
var numrecordedChunks = 0;


//example of using a message handler from the inject scripts
chrome.extension.onMessage.addListener(
  function (request, sender, sendResponse) {
    chrome.pageAction.show(sender.tab.id);
    sendResponse();
  });


chrome.runtime.onInstalled.addListener((details) => {
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

// function blobToUint8Array(b) {
//   var uri = URL.createObjectURL(b),
//     xhr = new XMLHttpRequest(),
//     i,
//     ui8;

//   xhr.open('GET', uri, false);
//   xhr.send();

//   URL.revokeObjectURL(uri);

//   ui8 = new Uint8Array(xhr.response.length);

//   for (i = 0; i < xhr.response.length; ++i) {
//     ui8[i] = xhr.response.charCodeAt(i);
//   }

//   return ui8;
// }

// var b = new Blob(['abc'], { type: 'application/octet-stream' });
// blobToUint8Array(b);

function getUserMediaError(error) {
  console.log("Error");
  console.log(error);
}

function end(stream) {
  console.log('ending');
  recorder.stop();
}

function captureAudio() {
  chrome.tabCapture.capture({ audio: true }, function (stream) {
    
    console.log('Capturing...');
    if (stream) {
      gotMediaStream(stream);
    } else {
      console.warn('Stream is null...');
    }

  });
}

function stop() {
  chrome.tabCapture.stop();
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