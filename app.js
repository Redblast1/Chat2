var express = require('express');
var app = express();
var server = require('http').createServer(app);
var formidable = require('formidable');
var util = require('util');
var fs   = require('fs-extra');
var path = require('path');
var qt   = require('quickthumb');
var mongo = require('mongodb').MongoClient;

var client = require('socket.io')(server);
var port = process.env.PORT || 8080;
var messageNumber = 0;

mongo.connect('mongodb://localhost/chat', function(err, db) {
    if(err) throw err;
    console.log('Successfully connected to mongo');

    var lastMessage;

    server.listen(port, function() {
        console.log('Server listening at port %d', port);
    });

    app.use(express.static(__dirname + '/public'));
    /* Use quickthumb */
    app.use(qt.static(__dirname + "/"));

    client.on('connection', function(socket) {
        console.log('Someone has connected.');

        // Switch to messages mongo collection
        var msgCollection = db.collection('messages');

        function sendStatus(s) {
            socket.emit('status', s);
        };



        app.post('/upload', function(req, res){
            var form = new formidable.IncomingForm();
            form.parse(req, function(err, fields, files) {
                res.redirect('/');
            });

            form.on('end', function(fields, files) {
                /* Temporary location of our uploaded file */
                var temp_path = this.openedFiles[0].path;
                /* The file name of the uplaoded file */
                var filename = this.openedFiles[0].name;
                /* Location where we want to copy the uploaded file */
                var new_location = 'uploads/';

                fs.copy(temp_path, new_location + filename, function(err) {
                    if(err) {
                        console.error(err);
                    }
                    else {
                        console.log("Successfully stored image");

                        // msgCollection.find({image: filename}, function (err, entry) {
                          client.emit('output', [lastMessage]);

                          sendStatus({
                            message: "Message sent",
                            clear: true
                          });
                        // });
                    }
                });
            });
        });

        // Emit all messages on initial log in
        msgCollection.find().sort({_id: 1}).toArray(function(err, res) {
            if(err) throw err;
            socket.emit('output', res.slice(res.length - 100, res.length));
        });

        // Wait for input
        socket.on('input', function(data) {


            console.log(data);
            var name = data.name;
            var nameColor = data.nameColor;     //DP+
            var message = data.message;
            var messageTime = data.time;
            var messageImage = data.image;
            var whitespacePattern = /^\s*$/;

            if(whitespacePattern.test(name)) {
                sendStatus('Name is required.');
            }
            else if(whitespacePattern.test(message) && whitespacePattern.test(messageImage)){
                sendStatus('Either a message or a message is required');
            }
            else {
                messageNumber = messageNumber + 1;
                lastMessage = {name: name, message: message, time: messageTime, number: messageNumber, image: messageImage, nameColor: nameColor};
                msgCollection.insert(lastMessage, function() {

                  if(messageImage === ""){
                    client.emit('output', [lastMessage]);

                    sendStatus({
                      message: "Message sent",
                      clear: true
                    });
                  }
                });
            }
        });
    });
});
