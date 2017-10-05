import "./styles/earthshake.app.styles.css";
import "rx-dom";
import * as L from "leaflet";
import * as angular from "angular";
import * as E from 'linq';

angular.module("com.app.earthquake", [])
    .controller("com.app.earthquake.mainController", function MainController($scope) {

        const socket = Rx["DOM"].fromWebSocket("ws://127.0.0.1:8080");

        this.tweetList = [];
        this.earthquakesList = [];

        const quakesTable = document.getElementById("quakes_info");
        const map = L.map("map").setView([33.858631, -118.279602], 7);
        const quakeLayer = L.layerGroup([]).addTo(map);
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);
        const codeLayers = {};

        const getRowFromEvent = event => {

            return Rx.Observable
                .fromEvent(quakesTable, event)
                .filter(event => {

                    const el = event["target"];
                    return el.tagName === "TD" && el.parentNode.id.length;
                })
                .pluck("target")
                .pluck("parentNode")
                .distinctUntilChanged();
        };

        const quakes = Rx.Observable.interval(5000)
            .flatMap(() => {

                return Rx["DOM"].jsonpRequest({
                    url: "http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp",
                    jsonpCallback: "eqfeed_callback"
                });
            })
            .flatMap(result => Rx.Observable.from(result["response"].features))
            .distinct(quake => quake["properties"].code)
            .share();

        quakes.subscribe(quake => {

            const coords = quake["geometry"].coordinates;
            const size = quake["properties"].mag * 10000;

            const circle = L.circle([coords[1], coords[0]], size)
                .addTo(map);

            quakeLayer.addLayer(circle);
            codeLayers[quake["id"]] = quakeLayer.getLayerId(circle);
        });

        quakes.pluck("properties")
            .subscribe(quake => $scope.$apply(() => this.earthquakesList.push(quake)));

        getRowFromEvent("mouseover")
            .pairwise()
            .subscribe(rows => {

                const prevCircle = quakeLayer.getLayer(codeLayers[rows[0]["id"]]);
                const currCircle = quakeLayer.getLayer(codeLayers[rows[1]["id"]]);
                prevCircle.setStyle({ color: "#59a27a" });
                currCircle.setStyle({ color: "#b01055" });
            });

        getRowFromEvent("click")
            .subscribe(row => {

                const circle = quakeLayer.getLayer(codeLayers[row["id"]]);
                map.panTo(circle.getLatLng());
            });

        quakes
            .bufferWithCount(100)
            .map(quakeList => {

                return quakeList.map(quake => {

                    return {
                        id: quake["properties"].net + quake["properties"].code,
                        lat: quake["geometry"].coordinates[1],
                        lng: quake["geometry"].coordinates[0],
                        mag: quake["properties"].mag
                    };
                });
            })
            .subscribe(quakes => socket.onNext(JSON.stringify({ quakes })));

        socket.map(message => JSON.parse(message.data))
            .subscribe(tweet => {

                $scope.$apply(() => {

                    this.tweetList.push(tweet);
                    this.tweetList = E.from(this.tweetList)
                        .distinct(i => i["created_at"]).toArray();
                });
            });
    });