var Engine = (function() {
    var neighbourhoodsLayer, listingsLayer, map, progress, progressbar,
        info = L.control();

    function init() {
        // Create a "background" map with some configurations
        map = L.map('mapid', {
            minZoom: 12,
            maxZoom: 18,
            maxBounds: [[52.278139, 4.728856], [52.431157, 5.068390]]
        }).setView([52.370216, 4.895168], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        }).addTo(map);

        // Configure the controls
        configNeighbourhoodInfo(map);
        configRiskAreaLegenda(map);
        configAvailabilitySlider(map);

        // Set the style and the onEachFeature function
        neighbourhoodsLayer = new L.GeoJSON(null, {
            style: style,
            onEachFeature: onEachFeature
        });
        neighbourhoodsLayer.addTo(map);

        // Create a listings layer
        listingsLayer = new L.GeoJSON(null, {

        });
        listingsLayer.addTo(map);

        // Load in the neighbourhoods data
        $.ajax({
            type: "GET",
            dataType: "json",
            url: "data/neighbourhoods.geojson",
            error: function() {
                alert('Error retrieving some data! Please reload the page.')
            },
            success: function(data) {
                $(data.features).each(function (key, data) {
                    neighbourhoodsLayer.addData(data);
                });
            }
        });

        //todo filter the data with the sliders and show them on CANVAS!
        // Load in the listings data
        $.ajax({
            type: "GET",
            dataType: "json",
            url: "data/listings_filtered.json",
            error: function() {
                alert('Error retrieving some data! Please reload the page.')
            },
            success: function(data) {
                // Find the maximum value for the listings slider.
                var listingsSliderMax = Math.max.apply(Math, data.map(function(o) {return o.host_amsterdam_listings_count}));
                configListingsSlider(map, listingsSliderMax);

                // Load the markers in clusters on the screen.
                progress = document.getElementById('progress');
                progressBar = document.getElementById('progress-bar');

                var markers = L.markerClusterGroup({
                    chunkedLoading: true,
                    chunkProgress: updateProgressBar
                });

                // Loop through all json object and fill the markerList array.
                var markerList = [];
                for (var i = 0; i < data.length; i++) {
                    var a = data[i];
                    var title = '123';
                    var marker = L.marker(L.latLng(a.latitude, a.longitude), { title: title });
                    marker.bindPopup(title); // todo show some extra info!
                    markerList.push(marker);
                }
                markers.addLayers(markerList);
                map.addLayer(markers);
            }
        });
    }

    function configAvailabilitySlider(map) {
        var slider = L.control.slider(function(value) {
            //todo handler
        }, {
            id: 'slider',
            size: '300px',
            orientation: 'horizontal',
            position: 'topleft',
            min: 0,
            max: 60,
            value: 60,
            title: 'Max. available days out of 60',
            logo: 'Max. available days out of 60',
            syncSlider: true
        });

        slider.addTo(map);
    }

    function configListingsSlider(map, max) {
        var slider = L.control.slider(function(value) {
            //todo handler
        }, {
            id: 'slider',
            size: '300px',
            orientation: 'horizontal',
            position: 'topleft',
            min: 1,
            max: max,
            value: 1,
            title: 'Min. listings per host in Ams.',
            logo: 'Min. listings per host in Ams.',
            syncSlider: true
        });

        slider.addTo(map);
    }

    function configRiskAreaLegenda(map) {
        var legend = L.control({position: 'topright'});

        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend'),
                grades = [0, 10, 20, 50, 100, 200, 500, 1000];

            div.innerHTML = '<h4>N.o listings</h4>';

            // loop through our grades and generate a label with a colored square for each interval
            for (var i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + getColor(grades[i] + 1) + '"></i>' +
                    grades[i] + (grades[i + 1] ? ' &ndash; ' + grades[i + 1] + '<br>' : '+');
            }

            return div;
        };

        legend.addTo(map);
    }

    function configNeighbourhoodInfo(map) {
        info.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info');
            this.update();
            return this._div;
        };

        info.update = function (props) {
            this._div.innerHTML = '<h4>Neighbourhood</h4>'
                +  (props ? '<b>' + props.neighbourhood + '</b>' : 'Hover over a neighbourhood');
        };

        info.addTo(map);
    }

    function updateProgressBar(processed, total, elapsed) {
        if (elapsed > 1000) {
            // if it takes more than a second to load, display the progress bar:
            progress.style.display = 'block';
            progressBar.style.width = Math.round(processed/total*100) + '%';
        }

        if (processed === total) {
            // all markers processed - hide the progress bar:
            progress.style.display = 'none';
        }
    }

    function getColor(g) {
        return g > 1000 ? '#800026' :
            g > 500  ? '#BD0026' :
                g > 200  ? '#E31A1C' :
                    g > 100  ? '#FC4E2A' :
                        g > 50   ? '#FD8D3C' :
                            g > 20   ? '#FEB24C' :
                                g > 10   ? '#FED976' :
                                    '#FFEDA0';
    }

    function highlightFeature(e) {
        var layer = e.target;

        layer.setStyle({
            weight: 5,
            opacity: 1,
            dashArray: ''
        });

        // Bring it to the front so that the border doesn't clash with nearby states
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }

        info.update(layer.feature.properties);
    }

    function resetHighlight(e) {
        neighbourhoodsLayer.resetStyle(e.target);
        info.update();
    }

    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    function style(feature) {
        var grade = 0;

        return {
            color: '#700200',
            weight: 2,
            opacity: 0.7,
            dashArray: 10,
            fillColor: getColor(grade),
            fillOpacity: 0.3
        };
    }

    function onEachFeature(feature, layer) {
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: zoomToFeature
        });
    }

    return {
        init: function() {init()}
    }
})();
