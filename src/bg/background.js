
var recordedChunks = [];
var numrecordedChunks = 0;
var streamer;
var player;
var socket;
var currentSpeakerId = -1;
var streamerCreated = false;
var oldPrivateChannelKey;
var uid;

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

  if (details.reason.search(/install/g) === -1) {
    return
  }

  chrome.tabs.create({
    url: chrome.extension.getURL("/src/permission/permission.html"),
    active: true
  });
});

var streamId;
var recording = false;
var started = false;
var currentChannel = {
  key: '',
  connected: false,
  speaking: false,
  minimized: false,
  name: '',
  loggedIn: false,
  myPacketId: 0,
  showingMessages: false
}

function disconnectFromChannel() {
  return new Promise((resolve, reject) => {

    if (socket.connected) {
      socket.disconnect();
    }

    if (player) {
      player.stop();
    }

    doNotConnect = false;

    player = null;
    streamer = null;
    currentChannel.speaking = false;
    currentChannel.connected = false;
    currentChannel.key = '';

    resolve();

  });
}

function reset() {
  chrome.runtime.restart();
}

function connectToChannel(channel, uid) {

  if (currentChannel.connected) {
    console.log('Stop');
    return;
  }

  if (socket != undefined) {
    if (socket.connected) {
      console.log('Already Connected...');
      return;
    }
  }

  console.log('Connecting');

  let id = currentChannel.myPacketId;
  let idArray = intToByteArray(id, 2);
  let packetId = new Uint8Array([1, idArray[0], idArray[1]]);

  let host = `https://${channel.host}`;
  let port = channel.port;

  if (port == undefined) {
    port = '3030'
  }

  socket = io.connect(`${host}:3030`, {
    query: `uid=${uid}&key=${channel.channelKey}`
  });

  currentChannel.connected = true;

  currentChannel.key = channel.channelKey;
  currentChannel.connected = true;

  player = new WSAudioAPI.Player(config);

  streamer = new WSAudioAPI.Streamer(config, packet => {
    var outArray = new Uint8Array(packetId.length + packet.length);
    outArray.set(packetId, 0);
    outArray.set(packet, packetId.length);

    if (socket.connected && recording) {
      socket.emit('packet', { packet: outArray.buffer });
      var msg = `Packet to send from ${id}, with ${outArray.length} bytes`;
      console.log(msg);
    }
    // this.userSpeaking = this.me;

  });

  player.start();

  socket.on('packet', function (msg) {
    if (!recording) {
      var message = new Uint8Array(msg.data.data);

      // Match this to id in /channels/{channelKey}/users/ list to know who is talking
      let id = message[1] * 256 + message[2];
      // console.log(`Packet from ${id}, with ${message.length} bytes`);

      showUserSpeaking(id);

      let packetType = message[0];

      if (player) {
        if (packetType == 1) {
          player.onPacket(message.slice(3, message.length));
        }

        if (packetType == 2) {
          // Number of opus packets in packet
          let count = message[3];

          // Starting point of data
          let from = 4 + count;

          for (let i = 0; i < count; i++) {
            // Length of data packet
            let length = message[4 + i];
            let to = from + length;
            let packet = message.slice(from, to);
            player.onPacket(packet);

            // Set the correct start of next packet
            from = from + length;
          }
        }

      }
    }
  });

  socket.on('disconnect', (reason) => {
    currentChannel.speaking = false;
    currentChannel.connected = false;
    currentChannel.key = '';

    try {
      streamer.disconnect();
    } catch (err) {
    }

    console.log('Disconnected...');
    chrome.runtime.sendMessage({
      data: {
        reason
      }
    }, function (response) {
    });
  });



}


function showUserSpeaking(id) {

  if (currentSpeakerId != id) {
    chrome.runtime.sendMessage({
      data: {
        showUserSpeaking: true,
        id: id
      }
    });
  }
  currentSpeakerId = id;

}

function getUserMediaError(error) {
  console.error(error);
}

function start() {
  recording = true;
  if (started) {
    streamer.unMute();
  } else {
    streamer.start();
  }
  started = true;
  currentChannel.speaking = true;
}

function stop() {
  streamer.mute();
  currentChannel.speaking = false;
  // player.start();
  recording = false;
}

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