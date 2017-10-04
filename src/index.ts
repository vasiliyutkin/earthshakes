import "./styles/earthshake.app.styles.css";
import * as L from "leaflet";
import "rx-dom";

const socket = Rx["DOM"]
    .fromWebSocket("ws://127.0.0.1:8080");

const map = L.map("map").setView([33.858631, -118.279602], 7);
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);

const makeRow = (props) => {

    const row = document.createElement("tr");
    row.id = props.net + props.code;
    const date = new Date(props.time);
    const time = date.toString();

    [props.place, props.mag, time].forEach(text => {

        const cell = document.createElement("td");
        cell.textContent = text;
        row.appendChild(cell);
    })

    return row;
};

const getRowFromEvent = (table, event) => {

    return Rx.Observable.fromEvent(table, event)
        .filter(event => {

            const el = event["target"];
            return el.tagName === "TD" && el.parentNode.id.length;
        })
        .pluck("target")
        .pluck("parentNode")
        .distinctUntilChanged();
};

const makeTweetElement = tweetObj => {

    const tweetEl = document.createElement("div");
    const time = new Date(tweetObj.created_at);
    const timeText = `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;
    const content = `
        <img src="${tweetObj.user.profile_image_url}" class="avatar" />
        <div class="content">${tweetObj.text}</div>
        <div class="time">${timeText}</div>
    `;

    tweetEl.classList.add("tweet");
    tweetEl.innerHTML = content;

    return tweetEl;
};

const initialize = () => {

    const quakesTable = document.getElementById("quakes_info");
    const codeLayers = {};
    const quakeLayer = L.layerGroup([]).addTo(map);

    const quakes = Rx.Observable.interval(5000)
        .flatMap(() => {

            return Rx["DOM"].jsonpRequest({
                url: "http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp",
                jsonpCallback: "eqfeed_callback"
            }).retry(3);
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
        .map(makeRow)
        .subscribe(row => quakesTable.appendChild(row));

    getRowFromEvent(quakesTable, "mouseover")
        .pairwise()
        .subscribe(rows => {

            const prevCircle = quakeLayer.getLayer(codeLayers[rows[0]["id"]]);
            const currCircle = quakeLayer.getLayer(codeLayers[rows[1]["id"]]);
            prevCircle.setStyle({ color: "#0000ff" });
            currCircle.setStyle({ color: "#ff0000" });
        });

    getRowFromEvent(quakesTable, "click")
        .subscribe(row => {

            const circle = quakeLayer.getLayer(codeLayers[row["id"]]);
            map.panTo(circle.getLatLng());
        });

    quakes.bufferWithCount(100)
        .map(quakes => {

            return quakes.map(quake => {

                return {
                    id: quake["properties"].net + quake["properties"].code,
                    lat: quake["geometry"].coordinates[1],
                    lng: quake["geometry"].coordinates[0],
                    mag: quake["properties"].mag
                };
            });
        })
        .subscribe(quakes => socket.onNext(JSON.stringify({ quakes })));

    socket
        .map(message => JSON.parse(message.data))
        .subscribe(tweetObj => {

            const container = document.getElementById("tweet_container");
            container.insertBefore(makeTweetElement(tweetObj), container.firstChild);
        });

};

Rx["DOM"]
    .ready()
    .subscribe(initialize);