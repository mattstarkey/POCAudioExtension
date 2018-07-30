var config = {
    apiKey: "AIzaSyCApdPRm2-ihXXVKBV7Ig0KTL_FDfKVACQ",
    authDomain: "pttapp-5a5d5.firebaseapp.com",
    databaseURL: "https://pttapp-5a5d5.firebaseio.com",
    projectId: "pttapp-5a5d5",
    storageBucket: "pttapp-5a5d5.appspot.com",
    messagingSenderId: "77576022182"
};
firebase.initializeApp(config);

var database = firebase.database();
var uid;
var speaking = false;
var channelKey;
var channelName;
var usersObject = {}
var lastMessageDate = new Date();
var background;
var DEBUG = false;
var loggedIn = false;
var selectedForPrivateCall = [];
var userList = [];
var firebaseIdToken;
var me;
var currentPrivateChannelKey = "";
var inPrivate = false;
var inChannel = false;
var channelUsersSubscription;
var messagesObject = {};
var messagesRef;
var sendTo = [];
var messageText = "";
var myPacketId;
var unreadMessages = false;
var oldChannelKey;
var oldChannelName;

function showInfo(msg) {
    document.querySelector('.info').classList.remove('hide');
    document.querySelector('.info').innerHTML = msg;
}

function hideInfo() {
    document.querySelector('.info').classList.add('hide');
}

function showLogin() {
    document.querySelector('.loginForm').classList.remove('hide');
}

function hideLogin() {
    document.querySelector('.loginForm').classList.add('hide');
}

function showLoader() {
    document.querySelector('.blanket').classList.remove('hide');
}

function hideLoader() {
    document.querySelector('.blanket').classList.add('hide');
}

chrome.runtime.getBackgroundPage(function (page) {
    background = page;
    channelKey = background.currentChannel.key;
    channelName = background.currentChannel.name;

    if (background.currentChannel.connected) {
        document.querySelector('.loginForm').classList.add('hide');
        AuthAndInit(background.user, background.pass);
    } else {
        // AuthAndInit('mattstarkey@me.com', 'hamburgers');
        hideLoader();
    }

    if (background.currentChannel.loggedIn) {
        showLoader();
        AuthAndInit(background.user, background.pass);
    }

    if (background.currentChannel.showingMessages) {
        showInbox();
    }

});

function authorize() {
    showLoader();
    hideLogin();
    AuthAndInit(document.getElementById('user').value, document.getElementById('pass').value);
}

function AuthAndInit(username, password) {
    firebase.auth().signInWithEmailAndPassword(username, password).then(async function (res) {

        firebaseIdToken = await firebase.auth().currentUser.getIdToken();
        listenForPrivateChannel(res.uid);
        createMessageRef(res.uid);

        localStorage.setItem(username, password);

        var meRef = firebase.database().ref(`users/${res.uid}`);
        meRef.on('value', function (snapshot) {
            me = snapshot.val();
        });


        hideLogin();
        setInterval(_ => {
            hideLoader();
        }, 1500);

        background.user = username;
        background.pass = password;
        background.currentChannel.loggedIn = true;

        speaking = background.currentChannel.speaking;

        showInfo("Please select a channel.");
        if (background.currentChannel.connected) {
            hideInfo();
            if (background.currentChannel.minimized) {
                minimize();
                document.querySelector('.userSpeakingMini').innerHTML = `Connected to ${background.currentChannel.name}`;
                channelName = background.currentChannel.name;
            } else {
                showChannelInfo(background.currentChannel.key, res.uid, background.currentChannel.name);
            }
            updateSpeakingUi(background.currentChannel.speaking);
        } else {
            showInfo("Please select a channel.");
        }

        uid = res.uid;

        var channel = firebase.database().ref(`users/${res.uid}/channels`);
        channel.on('value', function (snapshot) {
            showChannels(snapshot.val());
        });

        listenForMessages(uid, 'inbox', false);

    }).catch(function (error) {
        // Handle Errors here.
        showInfo(error.message);
        showLogin();
        hideLoader();
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
    });
}

function displayChannel(channel, channelContainer) {
    let chan = document.createElement('div');
    chan.classList = 'item';
    chan.id = channel.channelKey;
    chan.textContent = channel.channelName;
    channelContainer.appendChild(chan);
    chan.addEventListener('click', function (evt) {
        channelName = evt.target.innerHTML;
        channelKey = evt.target.id;
        background.currentChannel.key = channelKey;
        background.currentChannel.name = channelName;
        openChannel(evt, false);
    });
}


function showChannels(channels) {
    var channelContainer = document.querySelector('.channels');
    channelContainer.innerHTML = "";

    if (Array.isArray(channels)) {
        for (let i = 0; i < channels.length; i++) {
            const channel = channels[i];
            if (channel != undefined) {
                displayChannel(channel, channelContainer);
            }
        }
    } else {
        for (const key in channels) {
            if (channels.hasOwnProperty(key)) {
                const chann = channels[key];
                if (chann != undefined) {
                    displayChannel(chann, channelContainer);
                }
            }
        }
    }


}

function updateSpeakingUi(speaking) {
    if (speaking) {
        document.querySelector('#wave').classList.remove('notRecording');
        document.querySelector('.soundWave').classList.remove('notRecording');
        document.querySelector('#startMini').classList.add('on');
        document.querySelector('#startIcon').classList.add('on');
    } else {
        document.querySelector('#wave').classList.add('notRecording');
        document.querySelector('.soundWave').classList.add('notRecording');
        document.querySelector('#startMini').classList.remove('on');
        document.querySelector('#startIcon').classList.remove('on');
    }
}

function showUsers(users) {
    return new Promise((resolve, reject) => {

        usersObject = users;
        background.currentChannel.myPacketId = usersObject[uid].id;
        console.log(usersObject[uid].id);
        var contactsContainer = document.querySelector('.contacts');
        document.querySelector('.conts').classList.remove('hide');
        document.querySelector('.talkButtons').classList.remove('hide');
        document.querySelector('.channel').classList.remove('hide');
        contactsContainer.innerHTML = "";
        let ind = 0;
        for (const user in users) {
            if (users.hasOwnProperty(user)) {
                const u = users[user];
                if (u != undefined) {
                    u.uid = user;
                    userList.push(u);
                    let userElement = document.createElement('div');
                    let onlineClass = u.online;
                    if (onlineClass == undefined) {
                        onlineClass = false;
                    }
                    userElement.classList = `item ${onlineClass}`;
                    userElement.id = u.id;
                    userElement.dataset.index = ind;
                    userElement.textContent = u.name;
                    contactsContainer.appendChild(userElement);
                    userElement.addEventListener('click', selectForPrivateCall);
                    ind++;
                }
            }
        }

        resolve();

    });
}

function selectForPrivateCall(evt) {
    let targetIndex = evt.target.dataset.index;
    let user = userList[targetIndex];
    let userIndex = indexOfInArray(user, 'id', selectedForPrivateCall);
    if (userIndex == -1) {
        // if (evt.target.classList.contains('true')) {
        selectedForPrivateCall.push(user);
        evt.target.classList.add('selected');
        // }
    } else {
        selectedForPrivateCall.splice(userIndex, 1);
        evt.target.classList.remove('selected');
    }

    if (selectedForPrivateCall.length > 0) {
        document.querySelector('#privateCall').classList.remove('hide');
        document.querySelector('#sendAMessage').classList.remove('hide');
    } else {
        document.querySelector('#privateCall').classList.add('hide');
        document.querySelector('#sendAMessage').classList.add('hide');
    }
}

function indexOfInArray(element, prop, arr) {
    for (let i = 0; i < arr.length; i++) {
        const u = arr[i];
        if (u[prop] == element[prop]) {
            return i;
        }
    }
    return -1;
}

function showChannelInfo(key, uid, chanName) {

    document.querySelector('.conts').classList.remove('hide');
    document.querySelector('.talkButtons').classList.remove('hide');
    document.querySelector('.channel').classList.remove('hide');
    document.querySelector('.chans').classList.add('hide');

    document.querySelector('.channelHeading').innerHTML = `Connected to ${chanName}`;

    var users = firebase.database().ref(`channels/${key}/users`);

    users.on('value', function (snapshot) {
        showUsers(snapshot.val());
    });
}

function openChannel(evt, private) {
    showLoader();
    hideInfo();
    channelKey = evt.target.id;
    if (!private) {
        oldChannelKey = channelKey;
        oldChannelName = evt.target.innerHTML;
        document.querySelector('#closeItem').classList.remove('hide');
        document.querySelector('#close').classList.remove('hide');
    }
    document.querySelector('.chans').classList.add('hide');

    if (currentPrivateChannelKey.length > 2) {
        document.querySelector('#privateCall').classList.add('end');
        document.querySelector('#privateCall').classList.remove('hide');
        document.querySelector('#privateCall').textContent = "End Private Channel";
    } else {
        document.querySelector('#privateCall').classList.remove('end');
        document.querySelector('#privateCall').classList.add('hide');
        document.querySelector('#privateCall').textContent = "Create Private Call";
    }

    firebase.database().ref(`channels/${evt.target.id}/users/${uid}/online`).set(true);

    firebase.database().ref(`channels/${evt.target.id}`).once('value', function (snapshot) {
        chan = snapshot.val();
        chan.channelKey = evt.target.id;

        channelKey = evt.target.id;

        setTimeout(function () {
            document.querySelector('.chans').classList.add('hide');
        }, 200);

        document.querySelector('.channelHeading').innerHTML = `Connected to ${evt.target.innerHTML}`;
        channelName = evt.target.innerHTML;
        background.currentChannel.name = channelName;

        channelUsersSubscription = firebase.database().ref(`channels/${evt.target.id}/users`);
        channelUsersSubscription.on('value', function (snapshot) {
            let channellSubInfo = snapshot.val();
            console.log(uid);
            // background.currentChannel.myPacketId = usersObject[uid].id;
            showUsers(channellSubInfo).then(res => {

                if (private) {
                    background.disconnectFromChannel().then(_ => {
                        background.connectToChannel(chan, uid);
                    });
                } else {
                    background.connectToChannel(chan, uid);
                }

            });
            hideLoader();
        });

        inChannel = true;
    });


}

function closeChannel(privateChannelKey) {

    return new Promise(function (resolve, reject) {

        background.currentChannel.showingMessages = false;

        for (let y = 0; y < document.querySelectorAll('.messaging').length; y++) {
            const element = document.querySelectorAll('.messaging')[y];
            element.classList.add('hide');
        }

        document.querySelector('#sendAMessage').classList.add('hide');

        firebase.database().ref(`channels/${channelKey}/users/${uid}/online`).set(false);
        updateSpeakingUi(false);
        if (privateChannelKey != undefined) {
            currentPrivateChannelKey = privateChannelKey;
        } else {
            // currentPrivateChannelKey = "";
            // if (oldChannelName) {
            //     openChannel({
            //         target: {
            //             innerHTML: oldChannelName,
            //             id: oldChannelKey
            //         }
            //     }, false);
            // }
        }
        document.querySelector('.conts').classList.add('hide');
        document.querySelector('.talkButtons').classList.add('hide');
        document.querySelector('.channel').classList.add('hide');
        document.querySelector('.chans').classList.remove('hide');
        document.querySelector('#inbox').classList.add('hide');
        document.querySelector('#messagesList').classList.add('hide');
        document.querySelector('#messageBox').classList.add('hide');
        inChannel = false;
        channelUsersSubscription.off('value');
        try {
            background.started = false;
            background.disconnectFromChannel();
        } catch (err) {
        }
        resolve(true);
    });
}

function minimize() {
    if (document.querySelector('body').classList.contains('minimized')) {
        document.querySelector('.min').classList.add('hide');
        document.querySelector('.max').classList.remove('hide');
        document.querySelector('body').classList.remove('minimized');
        document.querySelector('html').classList.remove('minimized');
        document.querySelector('.userSpeakingMini').innerHTML = `Connected to ${background.currentChannel.name}`;

        background.currentChannel.minimized = false;

        openChannel({
            target: {
                innerHTML: channelName,
                id: channelKey
            }
        }, false);

    } else {
        document.querySelector('.min').classList.remove('hide');
        document.querySelector('.max').classList.add('hide');
        document.querySelector('body').classList.add('minimized');
        document.querySelector('html').classList.add('minimized');
        background.currentChannel.minimized = true;
    }
}

function startChat(evt) {
    chrome.runtime.getBackgroundPage(function (page) {
        if (!speaking) {
            page.start();
            speaking = true
            updateSpeakingUi(speaking);
        } else {
            speaking = false;
            endChat();
        }
    });
}

function endChat(evt) {
    chrome.runtime.getBackgroundPage(function (page) {
        updateSpeakingUi(speaking);
        page.stop();
    });
}

function listenForPrivateChannel(uid) {
    firebase.database().ref(`users/${uid}`).on('value', function (snapshot) {
        var response = snapshot.val();
        if (response.privateChannel) {
            if (currentPrivateChannelKey != response.privateChannel.channelKey) {
                currentPrivateChannelKey = response.privateChannel.channelKey;
                if (inChannel) {
                    closeChannel(response.privateChannel.channelKey).then(_ => {
                        openChannel({
                            target: {
                                innerHTML: 'private',
                                id: response.privateChannel.channelKey
                            }
                        }, true);
                    });
                } else {
                    openChannel({
                        target: {
                            innerHTML: 'private',
                            id: response.privateChannel.channelKey
                        }
                    }, true);
                }
                document.querySelector('#closeItem').classList.add('hide');
                document.querySelector('#close').classList.add('hide');

            }
        } else {
            if (inChannel) {
                closeChannel().then(_ => {
                    background.disconnectFromChannel().then(res => {
                        inPrivate = false;
                        document.querySelector('#closeItem').classList.remove('hide');
                        document.querySelector('#close').classList.remove('hide');
                        // currentPrivateChannelKey = "";
                        // if (oldChannelName) {
                        //     openChannel({
                        //         target: {
                        //             innerHTML: oldChannelName,
                        //             id: oldChannelKey
                        //         }
                        //     }, false);
                        // }
                    });
                });
            }
        }
    });
}

function endPrivateCall() {
    showLoader();
    let request = new XMLHttpRequest();
    request.open("DELETE", `https://us-central1-pttapp-5a5d5.cloudfunctions.net/route/privatechannel/${currentPrivateChannelKey}`);
    request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    request.setRequestHeader("id-token", firebaseIdToken);
    request.send();
    document.querySelector('#closeItem').classList.remove('hide');
    document.querySelector('#close').classList.remove('hide');
    background.disconnectFromChannel().then(res => {
        // currentPrivateChannelKey = "";
        // if (oldChannelName) {
        //     openChannel({
        //         target: {
        //             innerHTML: oldChannelName,
        //             id: oldChannelKey
        //         }
        //     }, false);
        // }
    });
}

function startPrivateCall(evt) {

    if (currentPrivateChannelKey.length > 2) {
        endPrivateCall();
        return;
    }

    let users = [];
    let devices = [];

    for (let i = 0; i < selectedForPrivateCall.length; i++) {
        const contact = selectedForPrivateCall[i];
        if (contact.type == 'device') {
            devices.push(contact.uid);
        }
        if (contact.type == 'user') {
            users.push(contact.uid);
        }
    }

    if (users.indexOf(uid) == -1) {
        users.push(uid);
    }

    let privateChannel = {
        name: "private",
        company: me.company,
        users: users,
        devices: devices
    };

    let request = new XMLHttpRequest();
    request.open("POST", "https://us-central1-pttapp-5a5d5.cloudfunctions.net/route/privatechannel");
    request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    request.setRequestHeader("id-token", firebaseIdToken);

    request.onreadystatechange = function () {
        if (request.readyState == 4 && request.status == 200) {
            var response = JSON.parse(request.responseText);
            if (response.channelKey) {
                currentPrivateChannelKey = response.channelKey;
            }
        }
    }

    selectedForPrivateCall = [];

    request.send(JSON.stringify(privateChannel));
}

function viewInbox() {
    document.getElementById('viewInbox').classList.add('selected');
    document.getElementById('messageBox').classList.add('hide');
    document.getElementById('viewSent').classList.remove('selected');
    listenForMessages(uid, 'inbox', true);
    document.getElementById('inboxHeading').textContent = 'Inbox';
}

function viewSent() {
    document.getElementById('viewInbox').classList.remove('selected');
    document.getElementById('messageBox').classList.add('hide');
    document.getElementById('viewSent').classList.add('selected');
    listenForMessages(uid, 'sent', true);
    document.getElementById('inboxHeading').textContent = 'Sent';
}

function showInbox() {
    background.currentChannel.showingMessages = true;
    for (let y = 0; y < document.querySelectorAll('.voice').length; y++) {
        const element = document.querySelectorAll('.voice')[y];
        element.classList.add('hide');
    }

    if (!document.querySelector('.channel').classList.contains('hide')) {
        document.querySelector('.channel').classList.add('hide');
    }

    if (!document.querySelector('.conts').classList.contains('hide')) {
        document.querySelector('.conts').classList.add('hide');
    }

    document.querySelector('#inbox').classList.remove('hide');
    document.querySelector('.chans').classList.add('hide');
}

function listenForMessages(uid, box, show) {
    if (show) {
        hideInfo();
        document.getElementById('inbox').classList.remove('messagesList');
        document.getElementById('messagesList').classList.remove('hide');
    }
    var messagesRef = firebase.database().ref(`messages/${uid}/${box}`);
    messagesRef.on('value', function (snapshot) {
        displayMessages(snapshot.val());
    });
}

function readMessage(evt) {
    document.querySelector('#sendAMessage').classList.remove('hide');
    let msg = messagesObject[evt.target.dataset.messageKey];
    let msgKey = evt.target.dataset.messageKey;

    if (evt.target.dataset.msgType == 'inbox') {
        firebase.database().ref(`messages/${uid}/inbox/${msgKey}/read`).set(Date.now());
        firebase.database().ref(`messages/${uid}/inbox/${msgKey}/ack`).set(Date.now());
        unreadMessages = false;
    }

    sendTo = [];

    let heading = "";
    if (msg.to) {
        for (const to in msg.to) {
            if (msg.to.hasOwnProperty(to)) {
                const messageTo = msg.to[to];
                msg.ack = messageTo.ack;
                msg.read = messageTo.read;
                heading = messageTo.name;
                sendTo.push({
                    uid: to,
                    name: heading
                });
                break;
            }
        }

    } else {
        heading = msg.fromName;
        sendTo.push({
            uid: msg.fromKey,
            name: msg.fromName
        });
    }

    document.getElementById('messageBox').classList.remove('hide');
    document.getElementById('messageHeading').textContent = heading;
    document.getElementById('messageBody').textContent = msg.message;
    document.getElementById('messageBody').classList.remove('ack');
    document.getElementById('messageBody').classList.remove('read');
    if (msg.ack != undefined) document.getElementById('messageBody').classList.add('ack');
    if (msg.read != undefined) document.getElementById('messageBody').classList.add('read');
    // document.getElementById('messageDate').textContent = new Date(msg.timestamp).toUTCString().split('G')[0];
    document.getElementById('messageDate').textContent = new Date(msg.timestamp).toString().split('G')[0];

    if (new Date(msg.read) != 'Invalid Date') {
        // document.querySelector('.msgReadOn').textContent = 'Read on ' + new Date(msg.read).toUTCString().split('G')[0];
        document.querySelector('.msgReadOn').textContent = 'Read on ' + new Date(msg.read).toString().split('G')[0];
    }
}

function reverseObject(Obj) {
    var TempArr = [];
    var NewObj = [];
    for (var Key in Obj) {
        TempArr.push(Key);
    }
    for (var i = TempArr.length - 1; i >= 0; i--) {
        NewObj[TempArr[i]] = [];
    }
    return NewObj;
}

function displayMessages(messages) {
    messagesObject = messages;
    var container = document.getElementById('msgs');
    container.innerHTML = "";
    for (const key in reverseObject(messages)) {
        if (messages.hasOwnProperty(key)) {

            const msg = messages[key];

            if (msg.fromKey) {
                //Inbox
                var messageElement = document.createElement('div');
                messageElement.classList.add('item');
                messageElement.classList.add('message');
                messageElement.dataset.messageKey = key;
                messageElement.textContent = `${msg.fromName} - ${new Date(msg.timestamp).toDateString()} - ${msg.message}`;
                messageElement.dataset.msgType = 'inbox';
                messageElement.addEventListener('click', readMessage);
                container.appendChild(messageElement);
                if (msg.read == undefined) {
                    unreadMessages = true;
                }
            } else {
                //Sent
                var messageElement = document.createElement('div');
                messageElement.dataset.msgType = 'sent';
                messageElement.classList.add('item');
                messageElement.classList.add('message');
                messageElement.dataset.messageKey = key;

                let toName = "";
                for (const to in msg.to) {
                    if (msg.to.hasOwnProperty(to)) {
                        const messageTo = msg.to[to];
                        toName = messageTo.name;
                        break;
                    }
                }

                messageElement.textContent = `${toName} - ${new Date(msg.timestamp).toDateString()} - ${msg.message}`;
                messageElement.addEventListener('click', readMessage);
                container.appendChild(messageElement);
            }



        }
    }
}

document.addEventListener('DOMContentLoaded', function () {

    if (DEBUG) {
        var outDiv = document.getElementById('output');
        outDiv.textContent = 'test';
    }

    document.getElementById('user').addEventListener('change', function (evt) {
        var ps = localStorage.getItem(evt.target.value);

        // document.getElementById('user').dispatchEvent(new Event('change', { 'bubbles': true }));

        if (ps != undefined && document.getElementById('pass') != null) {
            document.getElementById('pass').value = ps;
        }
    });

    document.querySelector('#signIn').addEventListener('click', function (evt) {
        authorize();
    });

    document.addEventListener('keydown', function (evt) {
        if (evt.keyCode == 32 && inChannel && !speaking) {
            startChat(evt);
        }
    });

    document.addEventListener('keyup', function (evt) {
        if (evt.keyCode == 32 && inChannel && speaking) {
            speaking = false;
            endChat(evt);
        }
    });

    document.getElementById('start').addEventListener('click', startChat);
    document.getElementById('wave').addEventListener('click', startChat);
    document.getElementById('startMini').addEventListener('click', startChat);
    document.getElementById('privateCall').addEventListener('click', startPrivateCall);
    document.querySelector('#close').addEventListener('click', closeChannel);
    document.querySelector('#closeItem').addEventListener('click', closeChannel);
    document.querySelector('#minimize').addEventListener('click', minimize);
    document.querySelector('.maxMin').addEventListener('click', minimize);
    document.getElementById('messageItem').addEventListener('click', showInbox);
    document.getElementById('viewInbox').addEventListener('click', viewInbox);
    document.getElementById('viewSent').addEventListener('click', viewSent);
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('sendAMessage').addEventListener('click', openMessageModal);
    document.querySelector('.sendAMessage').addEventListener('click', openMessageModal);
    document.getElementById('closeMessageModal').addEventListener('click', closeMessageModal);
    document.querySelector('.logout').addEventListener('click', logOut);

    for (let i = 0; i < document.querySelectorAll('.loginForm input').length; i++) {
        const input = document.querySelectorAll('.loginForm input')[i];
        input.addEventListener('keydown', function (evt) {
            if (document.querySelector('#user').value.length > 2 && document.querySelector('#pass').value.length > 1) {
                document.getElementById('signIn').disabled = false;
            } else {
                document.getElementById('signIn').disabled = true;
            }
        });
    }
});

setInterval(function () {
    if (new Date() - lastMessageDate > 2000) {
        document.querySelector('.userSpeaking').classList.add('hide');
        document.querySelector('.userSpeakingMini').innerHTML = `Connected to ${channelName}`;
        background.currentSpeakerId = -1;
        if (!speaking) {
            document.querySelector('#wave').classList.add('notRecording');
        }
    }

    if (background.currentChannel.showingMessages) {
        showInbox();
    }

    if (unreadMessages) {
        document.getElementById('unread').classList.remove('hide');
    } else {
        document.getElementById('unread').classList.add('hide');
    }
}, 1000);

function logOut() {
    firebase.auth().signOut().then(_ => {
        background.reset();
        showLogin();
    });
}

function showSpeakingUser(id) {
    for (const user in usersObject) {
        if (usersObject.hasOwnProperty(user)) {
            const u = usersObject[user];
            if (u.id == id) {
                var msg = `${u.name} is speaking`;
                document.querySelector('.userSpeaking').innerHTML = msg;
                document.querySelector('.userSpeaking').classList.remove('hide');
                document.querySelector('.userSpeakingMini').innerHTML = msg;
                lastMessageDate = new Date();
            }
        }
    }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.data.showUserSpeaking) {
        showSpeakingUser(message.data.id);
        document.querySelector('#wave').classList.remove('notRecording');
    } else {
        if (DEBUG) {
            var outputDiv = document.getElementById('output');
            outputDiv.textContent = message.data.msg;
        }
    }
});


window.onerror = function (err) {
    showInfo(err);
}

function createMessageRef(uid) {
    messagesRef = firebase.database().ref(`messages/${uid}/send`);
}

function sendMessage() {
    messageText = document.getElementById('messageText').value;

    var sendList = [];
    for (let i = 0; i < sendTo.length; i++) {
        const user = sendTo[i];
        sendList.push({
            id: user.uid,
            name: user.name
        });
    }
    messagesRef.set({
        to: sendList,
        message: messageText
    });
    document.getElementById('messageText').textContent = "";
    setTimeout(_ => {
        closeMessageModal();
        showInfo('Message sent');
        document.getElementById('messageText').value = "";
        setTimeout(_ => {
            hideInfo();
        }, 3000);
    }, 1000);
}

function removeRecipient(evt) {
    sendTo.splice(evt.target.dataset.index, 1);
    updateRecipients();
}

function updateRecipients() {
    var messagetoContainer = document.getElementById('toList');
    messagetoContainer.innerHTML = "";
    for (let i = 0; i < sendTo.length; i++) {
        const element = sendTo[i];
        var pEl = document.createElement('span');
        pEl.classList.add('recipient');
        pEl.textContent = element.name;
        pEl.dataset.uid = element.uid;
        messagetoContainer.appendChild(pEl);

        var closeElement = document.createElement('span');
        closeElement.classList.add('closeClick');
        closeElement.dataset.index = i;
        closeElement.addEventListener('click', removeRecipient);
        closeElement.textContent = "x";
        pEl.appendChild(closeElement);
    }

    if (sendTo.length == 0) {
        closeMessageModal();
    }
}

function closeMessageModal() {
    document.getElementById('messageBlanket').classList.add('hide');
}

function openMessageModal() {
    if (selectedForPrivateCall.length > 0) {
        sendTo = selectedForPrivateCall;
    }
    updateRecipients();
    document.getElementById('messageBlanket').classList.remove('hide');
}