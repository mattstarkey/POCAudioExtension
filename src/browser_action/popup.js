







document.addEventListener('DOMContentLoaded', function () {

    document.getElementById('start').addEventListener('click', function (evt) {
        chrome.runtime.getBackgroundPage(function (page) {
            page.captureAudio();
        });
    });

    document.getElementById('stop').addEventListener('click', function (evt) {
        chrome.runtime.getBackgroundPage(function (page) {
            page.end();
        });
    });
});



chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log(message.data);

    var outputDiv = document.getElementById('output');
    outputDiv.textContent = message.data.msg;


    // console.log(sender);

    // console.log('Trying...');
    // dataURLtoBlob(message.data.dataUri, function (blob) {
    //     console.log('This should be a blob now...');
    //     console.log(blob);

    //     var audio = document.createElement('audio');
    //     audio.controls = true;
    //     var audioURL = window.URL.createObjectURL(blob);
    //     audio.src = audioURL;

    //     document.getElementsByTagName('body')[0].appendChild(audio);
    // });


    // var blob = new Blob([message.data.dataUri], { type: message.data.type });

    // console.log('TODO: Do something with ' + message.type + ':', blob);

    // Do something, e.g. reply to message
    // sendResponse('Processed file');


    // var blob = dataURLtoBlob(message.data);
    // saveBlobToFile(blob, "screenshot.ogg");

    // var audio = document.createElement('audio');
    // audio.controls = true;
    // var blob = new Blob([message.data.blob], { 'type': 'audio/ogg; codecs=opus' });
    // var audioURL = window.URL.createObjectURL(blob);
    // console.log(audioURL);
    // console.log(blob);
    // audio.src = audioURL;

    // document.getElementsByTagName('body')[0].appendChild(audio);
    // audio.play();

    // sendResponse({
    //     data: "I am fine, thank you. How is life in the background?"
    // }); 
});

function dataURLtoBlob(dataUrl, callback) {
    var req = new XMLHttpRequest();

    req.open('GET', dataUrl);
    req.responseType = 'arraybuffer'; // Can't use blob directly because of https://crbug.com/412752

    req.onload = function fileLoaded(e) {
        // If you require the blob to have correct mime type
        var mime = this.getResponseHeader('content-type');

        callback(new Blob([this.response], { type: mime }));
    };

    req.send();
}

function dataURItoBlob(dataURI, dataTYPE) {
    var binary = atob(dataURI.split(',')[1]), array = [];
    for (var i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
    return new Blob([new Uint8Array(array)], { type: dataTYPE });
}


// function dataURLtoBlob(dataURL) {
//     var byteString = atob(dataURL.split(',')[1]),
//         mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];

//     var ab = new ArrayBuffer(byteString.length);
//     var ia = new Uint8Array(ab);
//     for (var i = 0; i < byteString.length; i++) {
//         ia[i] = byteString.charCodeAt(i);
//     }

//     var blob = new Blob([ia], { type: mimeString });
//     return blob;
// }