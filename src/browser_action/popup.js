







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
