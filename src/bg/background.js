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
  console.log();

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
    console.log(data);
  };

  recorder.start();

  console.log(recorder.state);

  console.log("Recorder is started");
  console.assert(recorder);

  setTimeout(function () {
    recorder.stop();
    console.log(recordedChunks);
  }, 2000);

}

function getUserMediaError(error) {
  console.log("Error");
  console.log(error);
}

chrome.desktopCapture.chooseDesktopMedia(["tab", "audio"], function (approved) {
  streamId = approved;
  console.log(streamId);

  navigator.webkitGetUserMedia({
    audio: true
  }, gotMediaStream, getUserMediaError);

  // {
  //   mandatory: {
  //     chromeMediaSource: "tab",
  //     chromeMediaSourceId: streamId
  //   }
  // }

});