const http = require("http");
const express = require('express');
const WebSocketServer = require("ws").Server;
const Twit = require("twit");
const Rx = require("rx");

const app = express();
app.use(express.static(__dirname));
app.get('/', (req, res) => res.render('index'));
app.get('*', (req, res) => res.redirect('/'));

const T = new Twit({
        consumer_key: "qcq7PVJXaN2mLOrtA2tvjd3fS",
        consumer_secret: "ceVBoPGIAQ78Sz6EcQZevjxeYfxHRrBSOFaHo2yjNhFNJUG7Ba",
        access_token: "915463383637471232-etuMIAmtp5DJCdix8as4OEyRclgVqAY",
        access_token_secret: "MtKDjjY7gPNB1Luh0eIIh8z2okElABxSxj1Ac9g6lOCUc"
});

const createTweetEarthQuakeStatusesStream = locations => T.stream("statuses/filter", {
        track: "earthquake",
        locations
});

const onConnect = (ws) => {

        Rx.Observable
                .fromEvent(ws, "message")
                .map(message => JSON.parse(message))
                .map(message => message.quakes)
                .flatMap(quakes => Rx.Observable.from(quakes))
                .scan((boundsArray, quake) => {

                        const bounds = [quake.lng - 0.3, quake.lat - 0.15, quake.lng + 0.3, quake.lat + 0.15]
                                .map(coordinate => coordinate.toString().match(/\-?\d+(\.\-?\d{2})?/)[0]);

                        boundsArray.push(...bounds);
                        return boundsArray.slice(Math.max(boundsArray.length - 50, 0));
                }, [])
                .subscribe(boundsArray => {

                        const randomLocationsEarthquakeStream = Rx.Observable
                                .fromEvent(createTweetEarthQuakeStatusesStream([]), "tweet");

                        const mappedLocationsEarthquakeStream = Rx.Observable
                                .fromEvent(createTweetEarthQuakeStatusesStream(boundsArray.toString()), "tweet");

                        randomLocationsEarthquakeStream
                                .merge(mappedLocationsEarthquakeStream)
                                .debounce(5000)
                                .subscribe(tweet => ws.send(JSON.stringify(tweet)));
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