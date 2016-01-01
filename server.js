var client = require('twilio')('INSER','INSERT');
var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var Firebase = require("firebase");
// Require the packages we will use:
var http = require("http"),
socketio = require("socket.io"),
fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.

	fs.readFile("static/client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.

		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);

	});
});
app.listen(1337);


// mongoose.connect('mongodb://localhost/test');
// var db = mongoose.connection;
// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', function (callback) {
//	console.log("the database worked!");
//	var kittySchema = mongoose.Schema({
//		name: String
//	});
//	var Kitten = mongoose.model('Kitten', kittySchema);
//	var silence = new Kitten({ name: 'Silence' });
//	console.log(silence.name); // 'Silence'

// });

// Restart Firebase
var myFirebaseRef = new Firebase("https://sweet-nothings-app.firebaseio.com/");
myFirebaseRef.remove();


var userObjects = [];
var sellingQueue = [];
var countdown = 60;


// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.

	function send_SMS(sendToNumber, sendToMessage){
		console.log("send text on server " + sendToNumber + ", " + sendToMessage + " !!!!!!!!!!!!");
		client.sendMessage({
			to: sendToNumber,
			from: '+18627666785',
			body: sendToMessage
		}, function(err,data){
			if(err){
				console.log("error sending message " + JSON.stringify(err));
			}else{
				console.log("no error? " + data);
			}
		});
	}



socket.on('create_user', function(data){
	console.log(data);
	userObjects.push(data);
	console.log(data.userInfo.email + " aka " + data.userInfo.uniqueID + " joined the lobby with a password of " + data.userInfo.password);
	var washU = "@wustl.edu";
	var desiredEmail = String(data.userInfo.email);
	console.log(desiredEmail.indexOf(washU) + " !!! ");
	if (desiredEmail.indexOf(washU) > 0){

		for (var i=0; i<userObjects.length; i++){
			if (userObjects[i].userInfo.email === data.userInfo.email){
				console.log("you are the user! ");
				console.log(userObjects[i].userInfo.uniqueID);
				loadPage(userObjects[i].userInfo.uniqueID);
				io.to(userObjects[i].userInfo.uniqueID).emit('initialize', {uniqueID:userObjects[i].userInfo.uniqueID});
				// add to Firebase Users
				var myFirebaseRef = new Firebase("https://shining-fire-145.firebaseio.com/users");
				var salt = bcrypt.genSaltSync(10);
				var hash = bcrypt.hashSync(data.userInfo.password, salt);
				myFirebaseRef.push({
					userEmail: data.userInfo.email,
					userNumber: data.userInfo.phoneNumber,
					userPassword: hash,
					userUniqueId:userObjects[i].userInfo.uniqueID
				});

			}
		}

	}
});





io.on('connection', function (socket) {
	console.log("user is connected!");
	var uniqueID = socket.id;
	console.log(uniqueID + " is your unique ID" + "user length is " + userObjects.length);
	io.to(uniqueID).emit('give_user_socket_ID', {uniqueID:uniqueID});
});


});

