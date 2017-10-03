const express = require('express');
const app = express();

const WebSocketServer = require("ws").Server;
const Twit = require("twit");
const Rx = require("rx");

const T = new Twit({
  consumer_key: "consumer_key",
  consumer_secret: "consumer_secret",
  access_token: "access_token",
  access_token_secret: "access_token_secret"
});

const onConnect = (ws) => {

  console.log("Client connected on localhost:8080");
};

const Server = new WebSocketServer({
  port: 9000
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.render('index'));

app.listen(5050);
Rx.Observable.fromEvent(Server, "connection").subscribe(onConnect);