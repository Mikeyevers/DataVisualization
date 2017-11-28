var Engine = (function() {
    var neighbourhoodsLayer, map;
    var i = -1;

    function highlightFeature(e) {
        var layer = e.target;

        layer.setStyle({
            weight: 5,
            opacity: 1,
            dashArray: ''
        });

        // Bring it to the front so that the border doesn't clash with nearby states.
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
    }

    function resetHighlight(e) {
        neighbourhoodsLayer.resetStyle(e.target);
    }

    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    function style(feature) {
        var neighbourhood = feature.properties.neighbourhood;

        i++;
        return {
            color: '#700200',
            weight: 2,
            opacity: 0.7,
            dashArray: 10,
            fillColor: feature.properties && neighbourhood && colors[neighbourhood] ? colors[neighbourhood] : null ,
            fillOpacity: 0.3
        };
    }

    function onEachFeature(feature, layer) {
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: zoomToFeature
        });

        // todo Replace this with a kind of legenda..
        if (feature.properties && feature.properties.neighbourhood) {
            layer.bindTooltip(feature.properties.neighbourhood, {direction: 'center'});
        }
    }

    function createMap() {
        // Create a "background" map with some configurations.
        map = L.map('mapid', {
            minZoom: 12,
            maxZoom: 18,
            maxBounds: [[52.278139, 4.728856], [52.431157, 5.068390]]
        }).setView([52.370216, 4.895168], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        }).addTo(map);


        neighbourhoodsLayer = new L.GeoJSON(null, {
            style: style,
            onEachFeature: onEachFeature
        });
        neighbourhoodsLayer.addTo(map);

        // After all the configurations are set, load in the neighbourhoods data
        $.ajax({
            dataType: "json",
            url: "data/neighbourhoods.geojson",
            success: function (data) {
                $(data.features).each(function (key, data) {
                    neighbourhoodsLayer.addData(data);
                });
            }
        })
    }

    return {
        createMap: function() {createMap()}
    }
})();
