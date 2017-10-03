import "./styles/earthshake.app.styles.css";
import * as L from "leaflet";
import "rx-dom";

const map = L.map("map")
    .setView([33.858631, -118.279602], 7);

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

const initialize = () => {

    const Socket = Rx["DOM"].fromWebSocket("ws://127.0.0.1:9000");
    console.log(Socket);

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
};

Rx["DOM"].ready().subscribe(initialize);