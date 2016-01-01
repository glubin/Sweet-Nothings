var client = require('twilio')('INSERT','INSERT');
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
var myFirebaseRef = new Firebase("https://shining-fire-145.firebaseio.com/");
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



	function refresh(){
		io.emit('update_countdown', {timeLeft:countdown});
		if (countdown === 0){
			// console.log("need to refresh!");
			countdown = 60;
		// remove first element
		if (sellingQueue.length > 0){
			sellingQueue.shift();
		}
		loadPage();
	} else {
		// console.log("decrease by one because " + countdown);
		countdown = countdown - 1;
	}

	setTimeout(function(){ refresh(); }, 1000);
}
refresh();


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

socket.on('validate_user', function(data){
	console.log(data.emailGuess + ", " + data.passwordGuess);
	for (var i=0; i<userObjects.length; i++){
		if (userObjects[i].userInfo.email === data.emailGuess && userObjects[i].userInfo.password === data.passwordGuess){
			userObjects[i].userInfo.uniqueID = data.uniqueID;
			console.log("you have successfully logged in! " + userObjects[i].userInfo.uniqueID);
					// update selling queue uniqueId
					for (var j=0; j<sellingQueue.length; j++){
						if (sellingQueue[j].sellInfo.email === data.emailGuess){
							console.log("need to change this products uniqueID");
							sellingQueue[j].sellInfo.uniqueID = data.uniqueID;
						}
					}
					// send over buyer and seller log
					io.to(userObjects[i].userInfo.uniqueID).emit('update_sell_log', {sellLogItems:userObjects[i].userInfo.soldItems});
					io.to(userObjects[i].userInfo.uniqueID).emit('update_buy_log', {buyLogItems:userObjects[i].userInfo.purchasedItems});


					loadPage(userObjects[i].userInfo.uniqueID);
					io.to(userObjects[i].userInfo.uniqueID).emit('initialize', {uniqueID:userObjects[i].userInfo.uniqueID});
				}
			}
		});


socket.on('add_item_to_queue', function(data){
	console.log(data.sellInfo.suggestedPrice + " > " + data.sellInfo.minPrice);
	if (data.sellInfo.suggestedPrice > data.sellInfo.minPrice){
		var myFirebaseRef = new Firebase("https://shining-fire-145.firebaseio.com/queue");
		myFirebaseRef.push({
					queueItem: data.sellInfo.email,
					queueSuggestedPrice: data.sellInfo.suggestedPrice,
					queueMinPrice: data.sellInfo.minPrice,
					queueImageLink: data.sellInfo.imageLink,
					queueEmail: data.sellInfo.email,
					queueSellersPhone: data.sellInfo.phoneNumber,
					queueSellersUniqueID: data.sellInfo.uniqueID
				});

		// add item to queue
		sellingQueue.push(data);
		// console.log(sellingQueue.length);
		if (sellingQueue.length > 1){
			loadPage(data['uniqueID']);
		} else {
			loadPage();
		}
		// if first item added, then restart clock
		if (sellingQueue.length === 1){
			countdown = 60;
		}
	}
});

socket.on('delete_product', function(data){
	console.log(data);
		// remove from array
		for (var i=0; i <sellingQueue.length; i++){
			if (sellingQueue[i].sellInfo.uniqueID === data.uniqueID && sellingQueue[i].sellInfo.itemName === data.itemName){
				console.log("you want to delete the " + i + " element");
				sellingQueue.splice(i, 1);
				loadPage();
			}
		}
		// refresh page
	});


socket.on('check_if_bid_is_high_enough', function(data){
	console.log(data.yourBid + " is the bid for " + data.uniqueID);
	console.log("you need to check against " + sellingQueue[0].sellInfo.minPrice);
	console.log(data.yourBid + " > " + sellingQueue[0].sellInfo.minPrice + " is the comparison");
	if (parseInt(data.yourBid) >= parseInt(sellingQueue[0].sellInfo.minPrice)){

		console.log("your bid was high enough!");

		// send_SMS("it worked!");

		countdown = 60;
			// connect users
			console.log("connect: " + data.yourEmail + " and " + sellingQueue[0].sellInfo.email);
			io.to(data.uniqueID).emit('sendEmail', {buyerEmail:data.yourEmail,sellerEmail:sellingQueue[0].sellInfo.email, price:data.yourBid, itemName:sellingQueue[0].sellInfo.itemName});
			io.to(sellingQueue[0].sellInfo.uniqueID).emit('sendEmail', {buyerEmail:data.yourEmail,sellerEmail:sellingQueue[0].sellInfo.email, price:data.yourBid,itemName:sellingQueue[0].sellInfo.itemName});

			//update logs
			console.log("update selling log");
			for (var i=0; i<userObjects.length;i++){
				//update seller log
				if (userObjects[i].userInfo.uniqueID === sellingQueue[0].sellInfo.uniqueID)	{
					var toSend = "You sold " + sellingQueue[0].sellInfo.itemName + " to " + data.yourEmail + " for $" + data.yourBid + ".";
					console.log(toSend);
					userObjects[i].userInfo.soldItems.push(toSend);
					io.to(sellingQueue[0].sellInfo.uniqueID).emit('update_sell_log', {sellLogItems:userObjects[i].userInfo.soldItems});
					// console.log("update seller log with " + sellingQueue[0].sellInfo.phoneNumber);
					var smsBody = data.yourEmail + " has agreed to buy " + sellingQueue[0].sellInfo.itemName + " for $" + data.yourBid + ".";
					console.log(smsBody);
					send_SMS(sellingQueue[0].sellInfo.phoneNumber,smsBody);
				}
				//update buyer log
				if (userObjects[i].userInfo.uniqueID === data.uniqueID){
					var toBuy = "You bought " + sellingQueue[0].sellInfo.itemName + " from " + sellingQueue[0].sellInfo.email + " for " + data.yourBid + ".";
					console.log(toBuy);
					userObjects[i].userInfo.purchasedItems.push(toBuy);
					io.to(data.uniqueID).emit('update_buy_log', {buyLogItems:userObjects[i].userInfo.purchasedItems});
					var buyerSmsBody = "You have agreed to buy " + sellingQueue[0].sellInfo.itemName + " from " + sellingQueue[0].sellInfo.email + " for $" + data.yourBid + ".";
					send_SMS(data.yourNumber,buyerSmsBody);
				}
			}


		//// remove first from queue and then reload page for all users
		sellingQueue.shift();
		loadPage();
	} else {
		console.log("low bid");
		io.to(data.uniqueID).emit('hide_from_all', {reason:"you bid too low"});
	}

});

io.on('connection', function (socket) {
	console.log("user is connected!");
	var uniqueID = socket.id;
	console.log(uniqueID + " is your unique ID" + "user length is " + userObjects.length);
	io.to(uniqueID).emit('give_user_socket_ID', {uniqueID:uniqueID});
});


function loadPage(uniqueID){
	console.log("load page");
		if (uniqueID !== undefined){ //when logging in
			if (sellingQueue.length > 0){
				currentItem = sellingQueue[0];
				console.log("you need to load " + JSON.stringify(currentItem) + ", " + uniqueID);
				io.to(uniqueID).emit('loadPage', {currentItem:currentItem});
				io.emit('send_queue_to_update_order', {queue:sellingQueue});
			}
		} else{
			console.log("refresh because previous item was sold");
			if (sellingQueue.length > 0){ //after item was sold
				currentItem = sellingQueue[0];
				console.log("FOR EVERYONE: LOAD " + JSON.stringify(currentItem) + ", " + "no unique ID");
				io.emit('loadPage', {currentItem:currentItem});
			} else {
				io.emit('hide_from_all', {reason:"prev item was sold"});
			}
		}
		// update list for of products / rank for users
		if (sellingQueue.length >= 0){ // or == to
			console.log("send queue info to users");
			io.emit('send_queue_to_update_order', {queue:sellingQueue});
		}
	}




	// socket.on('send_SMS', function(data){
	// 	console.log("send text on server");
	// 	client.sendMessage({
	// 		to: '+19737522424',
	// 		from: '+18627666785',
	// 		body: 'Hello World'
	// 	});
	// });



});

