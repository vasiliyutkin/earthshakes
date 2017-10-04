const http = require("http");
const express = require('express');
const WebSocketServer = require("ws").Server;
const Twit = require("twit");
const Rx = require("rx");

const app = express();
app.use(express.static(__dirname));
app.get('/', (req, res) => res.render('index'));

const T = new Twit({
    consumer_key: "qcq7PVJXaN2mLOrtA2tvjd3fS",
    consumer_secret: "ceVBoPGIAQ78Sz6EcQZevjxeYfxHRrBSOFaHo2yjNhFNJUG7Ba",
    access_token: "915463383637471232-etuMIAmtp5DJCdix8as4OEyRclgVqAY",
    access_token_secret: "MtKDjjY7gPNB1Luh0eIIh8z2okElABxSxj1Ac9g6lOCUc"
});

const onConnect = (ws) => {

    Rx.Observable
        .fromEvent(ws, "message")
        .flatMap(quakesObj => {

            quakesObj = JSON.parse(quakesObj);
            return Rx.Observable.from(quakesObj.quakes);
        })
        .scan((boundsArray, quake) => {

            const bounds = [
                quake.lng - 0.3,
                quake.lat - 0.15,
                quake.lng + 0.3,
                quake.lat + 0.15
            ].map(coordinate => {

                return coordinate.toString().match(/\-?\d+(\.\-?\d{2})?/)[0];
            });

            boundsArray.push(...bounds);

            return boundsArray.slice(Math.max(boundsArray.length - 50, 0));
        }, [])
        .subscribe(boundsArray => {

            const stream = T.stream("statuses/filter", {
                track: "earthquake",
                locations: boundsArray.toString()
            });

            Rx.Observable
                .fromEvent(stream, "tweet")
                .subscribe(tweetObj => {

                    const stringifiedTweetObj = JSON.stringify(tweetObj);
                    return ws.send(stringifiedTweetObj, err => err);
                });
        });
};

const server = http.createServer(app);
const wss = new WebSocketServer({
    server
});
server.listen(8080);

Rx.Observable
    .fromEvent(wss, "connection")
    .subscribe(onConnect);