const rp = require('request-promise');
const $ = require('cheerio');
const url = "https://www.mohfw.gov.in/"
// const sp = require("synchronized-promise")

var stateInfo = [];
res = (rp(url)
    .then(state1 = function (html) {
        let temp = [];
        $('td', html).each(function (i, e) {
            temp[i] = $(this).html();
        });
        let i = 0;
        let id = 1;

        while (true) {
            if (temp[(i * 5)][0] !== "<") {
                stateInfo[temp[(i * 5) + 1]] = {};
                stateInfo[temp[(i * 5) + 1]]["ConfirmedCases"] = parseInt(temp[(i * 5) + 2]);
                stateInfo[temp[(i * 5) + 1]]["Cured"] = parseInt(temp[(i * 5) + 3]);
                stateInfo[temp[(i * 5) + 1]]["Death"] = parseInt(temp[(i * 5) + 4]);
                id = id + 1;
                i = i + 1;
            } else {
                break;
            }
        }
        temp = [];
        $('strong', ".table", html).each(function (i, e) {
            temp[i] = ($(this).html());
        });
        stateInfo["TotalConfirmedCases"] = temp[6];
        stateInfo["TotalCured"] = temp[7];
        stateInfo["TotalDeath"] = temp[8];
        return stateInfo

    }))

res.then(function (stateInfo) {
    L.mapbox.accessToken = 'pk.eyJ1IjoiaW5pdGRvdCIsImEiOiJ3VkkxTldvIn0.7UPZ8q9fgBE70dMV7e0sLw';

    var map = L.mapbox.map('map', 'initdot.ljplbdcp').setView([21.836006, 87.824707], 5),
        // color reference from color brewer
        mapBrew = ['rgb(255,255,204)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(65,171,93)', 'rgb(35,132,67)', 'rgb(0,90,50)'],
        // population density range used for choropleth and legend
        mapRange = [5000, 1000, 800, 500, 300, 100, 0];

    // map legend for population density
    var legend = L.mapbox.legendControl({
            position: "bottomleft"
        }).addLegend(getLegendHTML()).addTo(map),
        // popup for displaying state census details
        popup = new L.Popup({
            autoPan: false,
            className: 'statsPopup'
        }),
        // layer for each state feature from geojson
        statesLayer,
        closeTooltip;

    // fetch the state geojson data
    d3.json("india-states.json", function (statesData) {
        statesLayer = L.geoJson(statesData, {
            style: getStyle,
            onEachFeature: onEachFeature
        }).addTo(map);
        L.path.touchHelper(L.geoJson(statesData).addTo(map));
    });

    function getStyle(feature) {
        return {
            weight: 2,
            opacity: 0.1,
            color: 'black',
            fillOpacity: 0.85,
            fillColor: getDensityColor(indiaCensus.states[feature.properties.code].density)
        };
    }

    // get color depending on population density value
    function getDensityColor(d) {
        var colors = Array.prototype.slice.call(mapBrew).reverse(), // creates a copy of the mapBrew array and reverses it
            range = mapRange;

        return d > range[0] ? colors[0] :
            d > range[1] ? colors[1] :
            d > range[2] ? colors[2] :
            d > range[3] ? colors[3] :
            d > range[4] ? colors[4] :
            d > range[5] ? colors[5] :
            colors[6];
    }

    function onEachFeature(feature, layer) {
        layer.on({
            mousemove: mousemove,
            mouseout: mouseout,
            // click: zoomToFeature,
            touchstart: mousemove, 
            touchend: mouseout
        });
    }

    // function touch() {
    //     mousemove(e).trigger("touchstart");
    // }
    // windows.onload

    // function touchstart(e) {
    //     statesLayer.resetStyle(e.target);
    //     closeTooltip = window.setTimeout(function () {
    //         // ref: https://www.mapbox.com/mapbox.js/api/v2.1.6/l-map-class/
    //         map.closePopup(popup); // close only the state details popup
    //     }, 100);
    // }

    function mousemove(e) {
        var layer = e.target;

        var popupData = {
            state: indiaCensus.states[layer.feature.properties.code].name,
            density: indiaCensus.states[layer.feature.properties.code].density,
            area: indiaCensus.states[layer.feature.properties.code].area,
            growth: indiaCensus.states[layer.feature.properties.code].growth,
            population: indiaCensus.states[layer.feature.properties.code].population,
            capital: indiaCensus.states[layer.feature.properties.code].capital.name,
            ConfirmedCases: stateInfo[indiaCensus.states[layer.feature.properties.code].name].ConfirmedCases
        };
        console.log(popupData);

        popup.setLatLng(e.latlng);

        var popContent = L.mapbox.template(d3.select("#popup-template").text(), popupData);
        popup.setContent(popContent);

        if (!popup._map) popup.openOn(map);
        window.clearTimeout(closeTooltip);

        // highlight feature
        layer.setStyle({
            weight: 2,
            opacity: 0.3,
            fillOpacity: 0.9
        });

        if (!L.Browser.ie && !L.Browser.opera) {
            layer.bringToFront();
        }
        // update the graph with Death and sex ratio data
        updateGraph(indiaCensus.states[layer.feature.properties.code]);
    }

    function mouseout(e) {
        statesLayer.resetStyle(e.target);
        closeTooltip = window.setTimeout(function () {
            map.closePopup(popup); // close only the state details popup
        }, 100);
    }

    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    function getLegendHTML() {
        var grades = Array.prototype.slice.call(mapRange).reverse(), // creates a copy of ranges and reverses it
            labels = [],
            from, to;
        // color reference from color brewer
        var brew = mapBrew;

        for (var i = 0; i < grades.length; i++) {
            from = grades[i];
            to = grades[i + 1];

            labels.push(
                '<i style="background:' + brew[i] + '"></i> ' +
                from + (to ? '&ndash;' + to : '+'));
        }

        return '<span>People per square km</span><br>' + labels.join('<br>');
    }
    var PieGraphControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function (map) {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'pie-graph');
            // ... initialize other DOM elements, add listeners, etc.
            return container;
        }
    });


    var BarGraphControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'bar-graph');
            return container;
        }
    });

    // add the piegraph and bar graph container
    map.addControl(new PieGraphControl())
        .addControl(new BarGraphControl());

    // START: Pie Graph
    var width = 250,
        height = 150,
        pieColors = {
            affected: "pink",
            cured: "green",
            died: "red"
        };

    var pieName = d3.select(".pie-graph")
        .append("div")
        .text("Death Ratio")
        .style("color", "white")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("margin", "6px 0");

    // append the svg elements to the graph containers 
    var pieSvg = d3.select(".pie-graph")
        .append("svg")
        .attr("id", "pie-graph")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var pieLegend = d3.select(".pie-graph")
        .append("div")
        .attr("id", "pie-legend");

    pieLegend.append("i")
        .style("background", pieColors.affected)
        .style("padding", "5px")
        .style("color", "black")
        .text("affected : " +parseInt(stateInfo.TotalConfirmedCases));

    pieLegend.append("i")
        .style("background", pieColors.cured)
        .style("padding", "5px")
        .style("color", "black")
        .text("cured : "+ parseInt(stateInfo.TotalCured));
    pieLegend.append("i")
        .style("background", pieColors.died)
        .style("padding", "5px")
        .style("color", "black")
        .text("died : "+parseInt(stateInfo.TotalDeath));

    var pieRadius = 60;

    var arc = d3.svg.arc()
        .outerRadius(pieRadius - 5)
        .innerRadius(0);

    var pieData = [];

    // initial data for Delhi
    pieData.push({
        type: "affected",
        ratio: 250,
        color: pieColors.affected
    });
    pieData.push({
        type: "cured",
        ratio: 250,
        color: pieColors.cured
    });
    pieData.push({
        type: "died",
        ratio: 250,
        color: pieColors.died
    });

    var pie = d3.layout.pie()
        .sort(null)
        .value(function (d) {
            return d.ratio;
        })
        // realigns the sector in the circle 
        .startAngle(3 * Math.PI)
        .endAngle(1 * Math.PI)
    ;

    var piePieces = pieSvg.selectAll(".pie-piece")
        .data(pie(pieData))
        .enter().append("g")
        .attr("class", "pie-piece");

    piePieces.append("path")
        .attr("d", arc)
        .style("fill", function (d) {
            return d.data.color;
        })
        .each(function (d) {
            this._oldAngle = d;
        });
    // END: Pie Graph

    // START: Bar Graph (Death)
    var barWidth = 250,
        barHeight = 180,
        barSize = 50,
        // attach the Death data for 'Delhi' initially
        DeathData = [86.21];

    var barName = d3.select(".bar-graph")
        .append("div")
        .text("Delhi")
        .style("color", "white")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("margin", "6px 0");

    var barHolder = d3.select(".bar-graph")
        .append("svg")
        .attr("id", "Death-bar")
        .attr("width", barWidth)
        .attr("height", barHeight)
        .append("rect")
        .attr("width", barSize)
        .attr("height", barHeight)
        .attr("x", (barWidth - barSize) / 2)
        .style("color", getDeathColor(DeathData[0]));

    var barLegend = d3.select(".bar-graph")
        .append("div")
        .style("color", "white")
        .style("font-weight", "bold")
        .style("font-size", "15px")
        .text("Death: ")
        .append("span")
        .attr("id", "Death-percent")
        .text(DeathData[0].toFixed(2) + "%")
        .style("color", getDeathColor(DeathData[0]));

    var DeathBar = d3.select("#Death-bar").selectAll("rect")
        .data(DeathData)
        .attr("height", function (d) {
            var h = barHeight * (d / 100);
            return h;
        })
        .attr("y", function (d) {
            var h = barHeight * (d / 100),
                nh = barHeight - h;
            return nh;
        })
        .style("fill", function (d) {
            return getDeathColor(d);
        });
    // END: Bar Graph (Death)

    // START: Updates both Pie Graph and Bar Graph
    function updateGraph(graphData) {
        pieData = [];

        pieData.push({
            type: "affected",
            ratio: parseInt(stateInfo.TotalConfirmedCases),
            color: pieColors.affected
        });
        pieData.push({
            type: "cured",
            ratio: parseInt(stateInfo.TotalCured),
            color: pieColors.cured
        });
        pieData.push({
            type: "died",
            ratio: parseInt(stateInfo.TotalDeath),
            color: pieColors.died
        });

        // update pie
        var pieUpdate = pieSvg.selectAll(".pie-piece")
            // bind the new updated data
            .data(pie(pieData));
        // update pie arc
        pieUpdate.select("path")
            .transition().delay(300).attrTween("d", function (d) {
                // we have stored the angle data in path element in _oldAngle
                var i = d3.interpolate(this._oldAngle, d);
                // update the old angle data with current angle data
                this._oldAngle = i(0);
                //return a functor
                return function (t) {
                    return arc(i(t));
                }
            });
        // update pie text
        // pieUpdate.select("text")
        //     .attr("transform", function (d) {
        //         return "translate(" + arc.centroid(d) + ")";
        //     })
        //     .attr("dy", ".35em")
        //     .style("text-anchor", "middle")
        //     .text(function (d) {
        //         return d.data.ratio;
        //     });
        // update state name in pie graph
        pieName.text("Total Cases");


        barName.text(graphData.name);

        DeathData = [];
        DeathData.push((parseInt(stateInfo[graphData.name].Death) / parseInt(stateInfo.TotalDeath)) * 100); //controls the bar

        d3.select("#Death-bar").selectAll("rect")
            .data(DeathData)
            .transition().duration(500)
            .attr("height", function (d) {
                var h = barHeight * (d / 100);
                return h;
            })
            .attr("y", function (d) {
                var h = barHeight * (d / 100),
                    nh = barHeight - h;
                return nh;
            })
            .style("fill", function (d) {
                return getDeathColor(d);
            });

        barLegend.text(stateInfo[graphData.name].Death) //controls the values
            .transition().duration(500)
            .style("color", getDeathColor(+graphData.Death)); //controls the color
    } // END: updateChart()

    function getDeathColor(Death) {
        // color from colorbrew
        var DeathBrew = ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(166,217,106)', 'rgb(26,150,65)'].reverse(),
            DeathRange = [1, 5, 10, 20];

        Death = +Death;

        return Death > DeathRange[0] ? DeathBrew[0] :
            Death > DeathRange[1] ? DeathBrew[1] :
            Death > DeathRange[2] ? DeathBrew[2] :
            DeathBrew[3];
    }

    // draw the layer with capital markers
    var capitalLayer;

    drawCapitalMarkers();

    function drawCapitalMarkers() {
        var capitalGeoJson = [];

        for (var state in indiaCensus.states) {
            var capitalData = indiaCensus.states[state].capital;
            // capital marker geojson data
            capitalData.details.forEach(function (capital, index) {
                // location is normally in (latitude, longitude) format
                // but for geojson the format is  (longitude, latitude)
                capitalGeoJson.push({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        // make an array copy and reverse the co-ordinates to (long,lat) for geojson
                        "coordinates": Array.prototype.slice.call(capital.coordinates).reverse()
                    },
                    "properties": {
                        "title": capital.name,
                        "description": capital.population ? "<strong>Population: </strong>" + capital.population : "(census data not available)",
                        "data": capital,
                        "marker-color": "#ffb90f",
                        "marker-size": "small",
                        "marker-symbol": "star"
                    }
                });
            }); // end of 'forEach'
        } // end of 'for in'

        // add the marker layer
        capitalLayer = L.mapbox.featureLayer(capitalGeoJson).addTo(map);
        // open the popup on hover
        capitalLayer.on('mouseover', function (e) {
            e.layer.openPopup();
            // update the graph if census details is present
            if (e.layer.feature.properties.data.sexratio) {
                updateGraph(e.layer.feature.properties.data);
            }
        });

        capitalLayer.on('mouseout', function (e) {
            e.layer.closePopup();
        });
    
    
    }
});

// console.log(temp);