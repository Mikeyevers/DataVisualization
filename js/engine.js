var Engine = (function() {
    var neighbourhoodsLayer, map, progress, markersLayer, data, minListingsAms, maxAvailableDays, riskChart, listingsSliderMax, legend,
        markers = [],
        callbackCount = 0, // I know this is a little bit hacky..
        neighbourhoodRisks = {},
        info = L.control({position: 'topright'});

    function init() {
        // Create a "background" map with some configurations
        map = L.map('mapid', {
            attributionControl: false,
            minZoom: 12,
            maxBounds: [[52.278139, 4.728856], [52.431157, 5.068390]]
        }).setView([52.370216, 4.895168], 13);

        map.zoomControl.setPosition('bottomleft');

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
        }).addTo(map);


        // Create progressbar for loading in the markers/listings
        progress = document.getElementById('progress');
        progressBar = document.getElementById('progress-bar');

        markersLayer = L.markerClusterGroup({
            maxClusterRadius: 60,
            chunkedLoading: true,
            chunkProgress: updateProgressBar,
            polygonOptions: {weight: 0}
        });

        riskChart = Highcharts.chart('risk-chart', {
            chart: {
                type: 'scatter',
                zoomType: 'xy',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                borderRadius: 8,
                plotBackgroundColor: Highcharts.svg ? {
                    radialGradient: {
                        cx: 1.0,
                        cy: 0.0,
                        r: 1.5
                    },
                    stops: [
                        [0.0, 'rgba(255, 0, 0, 1.0)'],
                        [0.5, 'rgba(255, 193, 86, 1.0)'],
                        [1.0, 'rgba(44, 160, 44, 1.0)']
                    ]
                } : null
            },
            title: {
                text: 'Risk chart'
            },
            xAxis: {
                title: {
                    text: 'Listings in Ams.'
                },
                min: 0,
                max: listingsSliderMax
            },
            yAxis: {
                title: {
                    text: 'Available days out of 60'
                },
                min: 0,
                max: 60,
                reversed: true
            },
            series: [{
                name: 'Listings',
                marker: {
                    fillColor: 'rgba(0, 0, 0, .5)',
                    lineWidth: 0.5
                }
            }],
            tooltip: {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat: '{point.x} listings, {point.y} available days'
            },
            credits: {
                enabled: 0
            }
        });

        // Load in the listings data
        $.ajax({
            type: "GET",
            dataType: "json",
            url: "data/listings_filtered.json",
            error: function() {
                alert('Error retrieving some data! Please reload the page.')
            },
            success: function(objects) {
                data = objects;

                // Find the maximum value for the listings slider.
                listingsSliderMax = Math.max.apply(Math, data.map(function(o) {return o.host_amsterdam_listings_count}));

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
                            neighbourhoodRisks[data.properties.neighbourhood] = 0;
                        });

                        initMarkers();
                        filterRiskChart(markers);
                        configListingsSlider(listingsSliderMax);
                        configAvailabilitySlider();

                        neighbourhoodsLayer = new L.GeoJSON(null, {
                            style: style,
                            onEachFeature: onEachFeature
                        }).addTo(map);

                        neighbourhoodsLayer.addData(data);
                    }
                });

                configNeighbourhoodInfo();
                configRiskAreaLegenda();
             }
        });
    }

    function initMarkers() {
        for (var i = 0; i < data.length; i++) {
            var listing = data[i],
                marker = L.marker(L.latLng(listing.latitude, listing.longitude), {data: listing}),
                popup = '<h2>Listings</h2>' +
                '<i>' +
                '<i><b>Id: </b>'+listing.id+'</i><br>' +
                '<i><b>Name: </b>'+listing.name+'</i><br>' +
                '<i><b>Property type: </b>'+listing.property_type+'</i><br>' +
                '<i><b>Room type: </b>'+listing.room_type+'</i><br>' +

                '<h2>Host</h2>' +
                '<p>' +
                '<i><b>Id: </b>'+listing.host_id+'</i><br>' +
                '<i><b>Name: </b>'+listing.host_name+'</i><br>' +
                '<i><b>Total listings: </b>'+listing.host_total_listings_count+'</i><br>' +
                '<i><b>Listings in Amsterdam: </b>'+listing.host_amsterdam_listings_count+'</i><br>' +
                '</p>';

            neighbourhoodRisks[listing.neighbourhood_cleansed] += 1;
            marker.bindPopup(popup);
            markers.push(marker);
        }

        markersLayer.clearLayers();
        markersLayer.addLayers(markers);
        map.addLayer(markersLayer);
    }

    function filter() {
        var filteredMarkers = [];

        for (var key in neighbourhoodRisks) {
            neighbourhoodRisks[key] = 0;
        }

        for (var i = 0; i < markers.length; i++) {
            var listing = markers[i].options.data;

            if (!(listing.availability_60 <= maxAvailableDays)) { continue; }
            if (!(listing.host_amsterdam_listings_count >= minListingsAms)) { continue; }

            neighbourhoodRisks[listing.neighbourhood_cleansed] += 1;
            filteredMarkers.push(markers[i]);
        }

        neighbourhoodsLayer.eachLayer(function(layer){
            neighbourhoodsLayer.resetStyle(layer);
        });

        markersLayer.clearLayers();
        markersLayer.addLayers(filteredMarkers);
        filterRiskChart(filteredMarkers);
    }

    function configListingsSlider(max) {
        var slider = L.control.slider(function(value) {
            minListingsAms = parseInt(value);
            if (callbackCount >= 2) {
                setTimeout(filter, 0);
            } else {
                callbackCount++;
            }
        }, {
            id: 'slider',
            size: '300px',
            orientation: 'horizontal',
            position: 'bottomright',
            min: 1,
            max: max,
            value: 1,
            title: 'Min. listings per host in Ams.',
            logo: 'Min. listings per host in Ams.',
            syncSlider: true
        });

        slider.addTo(map);
    }

    function configAvailabilitySlider() {
        var slider = L.control.slider(function(value) {
            maxAvailableDays = parseInt(value);
            if (callbackCount >= 2) {
                setTimeout(filter, 0);
            } else {
                callbackCount++;
            }
        }, {
            id: 'slider',
            size: '300px',
            orientation: 'horizontal',
            position: 'bottomright',
            min: 0,
            max: 60,
            value: 60,
            title: 'Max. available days out of 60',
            logo: 'Max. available days out of 60',
            syncSlider: true
        });

        slider.addTo(map);
    }

    function configRiskAreaLegenda() {
        legend = L.control({position: 'topright'});

        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend'),
                grades = [0, 10, 20, 50, 100, 200, 500, 1000];

            div.innerHTML = '<h4>Listings</h4>';

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

    function configNeighbourhoodInfo() {
        info.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info');
            this.update();
            return this._div;
        };

        info.update = function (props) {
            var listings = props ? neighbourhoodRisks[props.neighbourhood] : null;

            this._div.innerHTML = '<h4>Info</h4>'
                +  (props ? '<p><b>Neighbourhood: </b>' + props.neighbourhood + '<p><b>Listings: </b>' + listings + '</p>' : 'Hover over a neighbourhood');
        };

        info.addTo(map);
    }

    function updateProgressBar(processed, total, elapsed) {
        if (elapsed > 50) {
            // if it takes more than x milliseconds to load, display the progress bar:
            progress.style.display = 'block';
            progressBar.style.width = Math.round(processed/total*100) + '%';
        }

        if (processed === total) {
            // all markers processed - hide the progress bar:
            progress.style.display = 'none';
        }
    }

    function getColor(listings) {
        return listings > 1000 ? '#800026' :
            listings > 500  ? '#BD0026' :
                listings > 200  ? '#E31A1C' :
                    listings > 100  ? '#FC4E2A' :
                        listings > 50   ? '#FD8D3C' :
                            listings > 20   ? '#FEB24C' :
                                listings > 10   ? '#FED976' :
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
        var neighbourhood = neighbourhoodRisks[feature.properties.neighbourhood];
        return {
            color: '#700200',
            weight: 2,
            opacity: 0.7,
            dashArray: 10,
            fillColor: neighbourhood ? getColor(neighbourhood) : 'transparent',
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

    function filterRiskChart(markers) {
        var convertedData = [];

        for (var i = 0; i < markers.length; i++) {
            convertedData.push([markers[i].options.data.host_amsterdam_listings_count, markers[i].options.data.availability_60]);
        }

        riskChart.series[0].setData(convertedData);
    }

    return {
        init: function() {init()}
    }
})();
