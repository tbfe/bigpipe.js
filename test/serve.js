var WEBSERVER_PORT = 8089;

var static = require('node-static');

//
// Create a node-static server instance to serve the './public' folder
//
var file = new static.Server('.');

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response);
    }).resume();
}).listen(WEBSERVER_PORT);

console.log("> node-static is listening on http://127.0.0.1:" + WEBSERVER_PORT);
