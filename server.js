var client = require('twilio')('INSERT','INSERT');
var Firebase = require("firebase");
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



// Reset Firebase
var myFirebaseRef = new Firebase("https://sweet-nothings-app.firebaseio.com/");
myFirebaseRef.remove();

var messageFrequency = 24;
var messageHit = 7;
var users = [];
var possibleMessages = [
"I love you so much [NAME]", "I miss you so much [NAME]", "[NAME], You are perfect in every way :)", "[NAME], you are brilliant, smart, and funny"
];

// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.

	var randMessageNum = Math.floor(Math.random() * possibleMessages.length);
	var messageToSend = possibleMessages[randMessageNum];

	function send_SMS(sendToNumber, sendToMessage){
		for (var i=0; i<users.length; i++){
			messageToSend = messageToSend.replace("[NAME]", users[i].toName);
			customBody = String(messageToSend + "\n\t - " + users[i].userName);
			client.sendMessage({
				to: users[i].toPhone,
				from: '+18627666785',
				body: customBody
			});
		}
	}

	function refresh(){
		var randomVariable = Math.floor(Math.random() * messageFrequency);
		if (randomVariable === messageHit){
			send_SMS();
		}

		setTimeout(function(){ refresh(); }, 60*60*1000);
	}
	refresh();


	socket.on('create_user', function(data){
		users.push(data.userInfo);
		console.log(users);

		// add to Firebase Users
		var myFirebaseRef = new Firebase("https://sweet-nothings-app.firebaseio.com/");
		myFirebaseRef.push({
			UserName: data.userInfo.userName,
			UserEmail: data.userInfo.userEmail,
			ToName: data.userInfo.toName,
			ToPhone: data.userInfo.toPhone
		});

	});
});