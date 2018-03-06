


console.log("Permissions.");


navigator.webkitGetUserMedia({ audio: true }, s => {
    console.log(s);
}, err => {
    console.log(err);
});