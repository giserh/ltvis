(function(){

"use strict";

var LTVis = {version: "testerville"};

// Expose the app in the global scope
window.LTVis = LTVis;

// The Map module configures the map, manages map layers, and has functions 
// for adding, removing, and styling layers. 
LTVis.Map = (function() {

  var map;
  var areaSummaryLayers;
  var canvasLayer = null;

  return {

    getAreaSummaryLayers: function() {
      return areaSummaryLayers;
    },

    addJSONAreaSummaryLayer: function(geoJSON) {
      areaSummaryLayers.clearLayers();

      var newLyr = L.geoJSON(geoJSON, {
        style: function() {
          return {
            stroke: true,
            color: "rgb(0,0,0)",
            weight: 1,
            opacity: 1,
            fill: true,
            fillColor: "rgb(200,200,200)",
            fillOpacity: 0
          }
        },
        onEachFeature: onEachFeature
      }).on("click", function(){
        this.setStyle({
          color: "rgb(0,0,0)"
        })
      });

      function onEachFeature(feature, layer) {
        layer.on({
          mouseover: mouseover,
          mouseout: mouseout,
          click: click
        })
      }

      function mouseover(e) {
        var layer = e.target;
        layer.setStyle({
          weight: 3
        })
        
      }

      function mouseout(e) {
        var layer = e.target;
        layer.setStyle({
          weight: 1
        })
      }

      function click(e) {
        // console.log(e.target);
        var layer = e.target;
        layer.setStyle({
          color: "red"
        })
        if (!L.Browser.ie && !L.Browser.opera) {
          layer.bringToFront();
        }
        console.log(e.target.feature.properties.id);
        console.log(LTVis.testData[e.target.feature.properties.id]);
        var data = LTVis.testData[e.target.feature.properties.id];
        LTVis.activeTimelineChart.loadData(data);
      }

      areaSummaryLayers.addLayer(newLyr);
    },

    addCanvasLayer: function(layer) {
      if(canvasLayer !== null) {
        map.removeLayer(canvasLayer);
      }
      canvasLayer = layer;
      layer.addTo(map);
    },

    removeCanvasLayer: function() {
      map.removeLayer(canvasLayer);
      canvasLayer = null;
    },

    addLayer: function(layer) {
      layer.addTo(map);
    },

    init: function() {
      // Load the config file for the map
      $.get('configFiles/mapConfig.yaml', null, function(data) {
        var mapConfig = jsyaml.load(data);
        L.mapbox.accessToken = mapConfig.map.accessToken;

        // Create the leaflet map, pass in the config options
        map = L.mapbox.map('map', null, mapConfig.map.options);

        // Set the initial map view
        map.setView(mapConfig.map.initialView.center, mapConfig.map.initialView.zoom);

        // Add a basemap layer
        L.mapbox.styleLayer(
          mapConfig.referenceLayer.styleLayer,
          mapConfig.referenceLayer.options)
          .addTo(map);

        // Create a featureLayer object to store summary area polygons
        areaSummaryLayers = L.mapbox.featureLayer().addTo(map);
        
        // L.control.attribution({position: "bottomleft"}).addTo(map);

        // Add a scale bar to the map
        L.control.scale().addTo(map);
      });
    }
  };
})();

LTVis.TimelineChart = function(divID, initialData){
  "use strict";

  console.log(divID);

  var chartEnabled = true;
  var data = initialData;
  var chartDiv = d3.select("#" + divID);
  var margins = {top: 10, right: 20, bottom: 25, left: 35};
  var width;
  var height;
  var selectedDataPoint = data[(Math.round((data.length - 1) / 2))]; // default selected point
  var xScale = d3.scaleLinear();
  var yScale = d3.scaleLinear();
  var xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d")); // tickFormat is removing commas
  var yAxis = d3.axisLeft(yScale);
  var line = d3.line()
               .defined(function(d) { return d; })
               .x(function(d) { return xScale(d.date); })
               .y(function(d) { return yScale(d.value); });
  
  // Layer up all the elements of the chart. This is done now to ensure everything
  // is in the proper order. 
  var svg = chartDiv.append("svg");
  var chart = svg.append("g")
               .attr("transform", "translate(" + margins.left + "," + margins.top + ")")
               .attr("class", "timelineChart");
  
  var xAxisSVG = chart.append("g").attr("class", "x axis");
  var yAxisSVG = chart.append("g").attr("class", "y axis");
  var lineSVG = chart.append("path")
      .data([data])
      .attr("class", "line")
      .attr("stroke", "green")
      .attr("stroke-width", 2)
      .attr("fill", "none");
  var focusPoint = chart.append("g")
      .style("display", "none")
      .attr("class", "focusPoint");
  var mouseCatcher = chart.append("rect").attr("class", "mouseCatcher")
      .style("fill", "none")
      .style("pointer-events", "all");
  var sliderHandle = chart.append("g").attr("class", "sliderHandle")
      .style("pointer-events", "all");

  // Define the div for the tooltip
  var tooltip = d3.select("#" + divID).append("div") 
      .attr("class", "timelineChartTooltip")       
      .style("display", "none")
      .style("white-space", "nowrap");

  var bisectYear = d3.bisector(function(d) {return d.date;}).left;

  function updateWidthHeight() {
    width = parseInt(chartDiv.style("width")) - margins.left - margins.right;
    height = parseInt(chartDiv.style("height")) - margins.top - margins.bottom;
  }

  function updateScales() {
    xScale.range([0, width]).nice(d3.timeYear);
    if (chartEnabled) {
      yScale.range([height, 0]).nice();
    } else {
      yScale.range([height, height]).nice();
    }
  }

  function resetScaleDomains() {
    xScale.domain(d3.extent(data, function(d) { return d.date; }));
    // if there is no value, make it 0?
    yScale.domain(d3.extent(data, function(d) {
      if(chartEnabled) {
        return d.value;
      }
      return false; 
    }));
  }

  function styleAxes() {
    var x = chart.select('.x.axis');
    var y = chart.select('.y.axis');

    var axisColor = "rgb(200,200,200)";
    var textColor = "rgb(100,100,100)";

    x.selectAll("line").attr("stroke", axisColor);
    x.selectAll("path").attr("stroke", axisColor);
    x.selectAll("text").attr("fill", textColor).attr("font-size", 12);

    y.selectAll("line").attr("stroke", axisColor);
    y.selectAll("path").attr("stroke", axisColor);
    y.selectAll("text").attr("fill", textColor).attr("font-size", 10);
  }

  function updateAxes() {
    xAxis.ticks(Math.max(width/100, 2));
    yAxis.ticks(Math.max(height/100, 2));
    chart.select('.x.axis')
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);
    chart.select('.y.axis')
      .call(yAxis);
    styleAxes();
  }

  function updateSVGDimensions() {
    svg.attr("width", width + margins.left + margins.right)
       .attr("height", height + margins.bottom + margins.top);
    chart.select(".mouseCatcher")
      .attr("width", width)
      .attr("height", height + margins.bottom);
  }

  function updateLine() {
    lineSVG.attr("d", line)
      .style("stroke", function() {
        if(chartEnabled) {
          return "green";
        } else {
          return "none";
        }
      });
  }

  function configSlider() {
    var circle = sliderHandle.append("circle")
      .style("stroke", "none")
      .style("fill", "rgb(102,189,180")
      .attr("r", 6);
    var handleLine = sliderHandle.append("line")
      .style("stroke", "rgb(102,189,180")
      .style("stroke-width", "3px");

    sliderHandle
      .on("mouseover", function() {
        focusPoint.style("display", null);
        tooltip.style("display", null); 
      })
      .on("mouseout", function() {
        focusPoint.style("display", "none");
        tooltip.style("display", "none"); 
      })
      .on("mousemove", function() {
        var d = getNearestDataPoint(d3.mouse(this)[0]);
        updateFocus(d);
      });

    // Set up drag events for the slider. Needs to be fired on drag events for
    // the slider AND the mousecatcher, which is a bit awkward, but required
    // if we want to sometime have multiple sliderHandles. 
    sliderHandle.call(d3.drag()
        .on("start.interrupt", function() {})
        .on("start drag", drag)
        .on("end", dragEnd))
    chart.select(".mouseCatcher")
      .call(d3.drag()
        .on("start.interrupt", function() {})
        .on("start drag", drag)
        .on("end", dragEnd));

    function drag() {
      var x = d3.mouse(this)[0];
      if(x < 0) {
        x = 0;
      } else if (x > width) {
        x = width;
      }
      var point = getNearestDataPoint(x);
      updateSlider({date: xScale.invert(x)});
      updateFocus(point);
      circle.attr("r", 7)
            .style("fill", "rgb(122,209,200"); //"rgb(102,189,180"
      handleLine.style("stroke-width", "4px")
          .style("stroke", "rgb(122,209,200");
    }
    function dragEnd() {
      var point = getNearestDataPoint(d3.mouse(this)[0]);
      updateSelectedDataPoint(point);
      circle.attr("r", 6)
            .style("fill", "rgb(102,189,180");
      handleLine.style("stroke-width", "3px")
          .style("stroke", "rgb(102,189,180");
    }
  }

  function getNearestDataPoint(mouseEventX) {
    var x0 = xScale.invert(mouseEventX);
    var i = bisectYear(data, x0, 1);
    var d0 = data[i-1];
    var d1 = data[i];
    if(typeof d1 === "undefined") { return d0 };
    var d = x0 - d0.date > d1.date - x0 ? d1 : d0;
    return d;
  }

  function updateSelectedDataPoint(d) {
    // only do something if d is different from selectedDataPoint
    if(d !== selectedDataPoint) {
      selectedDataPoint = d;
      dispatch.call("change");
    }
    updateSlider(d);
  }

  function updateSlider(d) {
    chart.select(".sliderHandle").select("circle")
         .attr("transform",
               "translate(" + xScale(d.date) + "," + 
                               height + ")");
    chart.select(".sliderHandle").select("line")
         .attr("transform", 
               "translate(" + xScale(d.date) + "," + 
                               height + ")")
         .attr("y2", -height)
         .attr("y2", function() {
          if(chartEnabled) {
            return -height;
          } else {
            return 0;
          }
         });
  }

  function formatData(dataToFormat) {
    dataToFormat.forEach(function(d) {
      d.date = Number(d.date);
      if(typeof d.value !== "undefined" || typeof d.value !== null) {
        d.value = +d.value;
      } else {
        d.value = null;
      }
    });
  }

  function config() {
    // updateWidthHeight();

    // Format the data a bit
    formatData(data);

    // Set up the scale domains. 
    resetScaleDomains();
    
    // append the x line
    focusPoint.append("line")
      .attr("class", "x")
      .style("stroke", "rgb(210,210,210)")
      .style("stroke-dasharray", "3,3")
      .style("opacity", 1)
      .attr("y1", 0)
      .attr("y2", height);

    // append the y line
    focusPoint.append("line")
      .attr("class", "y")
      .style("stroke", "rgb(210,210,210)")
      .style("stroke-dasharray", "3,3")
      .style("opacity", 1)
      .attr("x1", width)
      .attr("x2", width);

    focusPoint.append("circle")
      .attr("class", "y")
      .style("fill", "white")
      .style("stroke", "blue")
      .attr("r", 4);

    mouseCatcher
      .on("mouseover", function() { 
        focusPoint.style("display", null);
        tooltip.style("display", null); 
      })
      .on("mouseout", function() { 
        focusPoint.style("display", "none");
        tooltip.style("display", "none"); 
      })
      .on("mousemove", mousemove);

    function mousemove() {
      var d = getNearestDataPoint(d3.mouse(this)[0]);
      updateFocus(d);
    }
    configSlider();
  }

  function updateFocus(d) {
    var y = typeof d.value === "undefined" ? height : yScale(d.value);
    focusPoint.select("circle.y")
      .attr("transform",
            "translate(" + xScale(d.date) + "," +
                           y + ")");

    focusPoint.select(".x")
        .attr("transform",
              "translate(" + xScale(d.date) + "," +
                             yScale(d.value) + ")")
                   .attr("y2", height - yScale(d.value));

    focusPoint.select(".y")
        .attr("transform",
              "translate(" + width * -1 + "," +
                             yScale(d.value) + ")")
                   .attr("x2", width + width);

    tooltip
      // .html("Year: " + d.year + "<br/>"  + "Value: " + d.value)
      .html(function() {
        var txt = "";
        if(chartEnabled) {
          txt += "date: " + d.date + "<br/>"  + "Value: " + d.value;
        } else {
          txt += d.date;
        }
        return txt;
      })  
      .style("left", function() {
        return ((xScale(d.date) + margins.left + 5) + "px");
      })    
      .style("bottom", function() {
        // return ((yScale(d.value) + margins.top - 28 - 8) + "px");
        return ((height - yScale(d.value) + margins.bottom + 5) + "px");

      });
  }

  function resize() {
    updateWidthHeight();
    updateSVGDimensions();
    updateScales();
    updateAxes();
    updateLine();
    updateSlider(selectedDataPoint);
  }

  function loadData(d) {
    data = d;

    var oldSelectedDataPoint;
    if(selectedDataPoint) {
      oldSelectedDataPoint = selectedDataPoint;
    } else {
      oldSelectedDataPoint = data[(Math.round((data.length - 1) / 2))];
    }
    
    formatData(data);
    
    // remake the scales
    resetScaleDomains();
    updateScales();
    // remake the axes
    updateAxes();
    // assign the data to the value line
    lineSVG.data([data]);
    // remake the data line geometry
    updateLine();
    // reset the selectedDataPoint
    updateSelectedDataPoint(getNearestDataPoint(xScale(oldSelectedDataPoint.date)));
  }

  var dispatch = d3.dispatch("change");

  config();
  resize();

  window.addEventListener("resize", resize);

  return {
    resize: resize,
    getSelectedDataPoint: function() {
      return selectedDataPoint;
    },
    on: function(event, callback) {
      try {
        dispatch.on(event, callback);
      }
      catch(e) {
        var opts = "";
        var o;
        for (o in dispatch._) {
          if (dispatch._.hasOwnProperty(o)){
            opts += "'" + o + "' ";
          }
        }
        var msg = "Non-viable event for TimelineChart.on(event, function): '" + event + "'\n" +
          "Viable Events are: " + opts;
        throw new Error(msg);
      }
    },
    loadData: function(newData) {
      loadData(newData);
    },
    enableChart: function() {
      chartEnabled = true;
      updateScales();
      resetScaleDomains();
      updateAxes();
      updateLine();
      updateSlider(selectedDataPoint);
    },
    disableChart: function() {
      chartEnabled = false;
      updateScales();
      resetScaleDomains();
      updateAxes();
      updateLine();
      updateSlider(selectedDataPoint);
    },
    setChartOpacity: function(k) {
      yAxisSVG.attr("opacity", k);
      lineSVG.attr("opacity", k);
    }
  };

};

// Start main app functions instide the LTVis namespace. 
// These functions make calls to the modules defined
// above. The only place where calls to the modules above should happen are 
// in the LTVis namespace. 
$.extend(LTVis, {
  init: function() {
    LTVis.GUI.init();
    LTVis.Map.init();

    $.get("fakedata.json", null, function(data) {
      LTVis.testData = JSON.parse(data);
    })

  },
  importDemoPolygons: function() {
    $.get("assets/geojson/fourStates.json", null, function(data) {
      LTVis.Map.addJSONAreaSummaryLayer(JSON.parse(data));
    });
  },

  loadDemoShapefile: function() {
    var url = 'assets/shapefiles/counties.zip';
    loadshp({
      url: url,
      encoding: 'big5',
      EPSG: 3826
    }, function(data) {
      // add to the map...
      LTVis.Map.addJSONAreaSummaryLayer(data);
    });
  },

  getRGBAColorFromGrayscale: function(n) {
    var c;
    if (LTVis.ramp === "BrBG") {
      c = d3.color(d3.interpolateBrBG((255-n)/255));

    }
    if (LTVis.ramp ==="RdYlGn") {
      c = d3.color(d3.interpolateRdYlGn((255-n)/255));

    }
    if (LTVis.ramp === "RdBu") {
      c = d3.color(d3.interpolateRdBu((255-n)/255));
    }
    return [c.r, c.g, c.b, c.opacity];
  },

  CanvasLayer: L.GridLayer.extend({
    createTile: function(coords, done){
      var error;
      // create a <canvas> element for drawing
      var tile = L.DomUtil.create('canvas', 'leaflet-tile');
      // setup tile width and height according to the options
      var size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;

      var ctx = tile.getContext('2d');
      var imageObj = new Image();
      var zxy = coords.z + "/" + coords.x + "/" + coords.y;
      imageObj.src = 'http://ltweb.ceoas.oregonstate.edu/mapping/maps/' + LTVis.activeDataLayer + '/tiles/' + zxy + '.png';

      imageObj.onload = function() {

        // Create a temp canvas.
        var tempCanvas = document.createElement('canvas');
        // Get the 2d context of the temp canvas
        var tempContext = tempCanvas.getContext("2d");
        // set the height and width of the temp canvas
        tempCanvas.width = tile.width;
        tempCanvas.height = tile.height;
        // Draw this image onto the temp context
        tempContext.drawImage(this, 0, 0);

        // Get the data of the image drawn on the temp context
        var tempImage = tempContext.getImageData(0,0,tile.width, tile.height);
        var tempData = tempImage.data;

        //loop over every 4th value of the tempData
        for (var i = 0; i < tempData.length; i +=4) {
          // change the color to something else!
          var c = LTVis.getRGBAColorFromGrayscale(tempData[i]);
          tempData[i] = c[0];
          tempData[i + 1] = c[1];
          tempData[i + 2] = c[2];
          // tempData[i + 3] = c[3]; 
        }
        // draw the altered image to the tile 2d context!
        ctx.putImageData(tempImage, 0, 0);
        done(error, tile);
      }
      return tile;
    }
  }),

  addCanvasLayer: function(layerID) {
    LTVis.ramp = "BrBG";
    LTVis.activeDataLayer = layerID;
    var lyr = new LTVis.CanvasLayer();
    LTVis.Map.addCanvasLayer(lyr);
  },

  removeCanvasLayer: function() {
    LTVis.Map.removeCanvasLayer();
  }
}); // END $.extend(LTVis, {...})


// The GUI module sets up menus and buttons unique to this page. 
// TODO Should only call functions in the main LTVis app namespace, NOT make
// calls directly to any other modules. E.g., don't call LTVis.Map.doSomething(), 
// instead call LTVis.doSomething(), and let LTVis call LTVis.Map.doSomething().
// While this is a bit redundant, it helps keep the GUI indepentant of other 
// modules.
LTVis.GUI = (function() {

  function initIconButtons() {
    $("#layerBtn").click(function() {
      console.log("layerBtn clicked");
      $(".menuWindow").css("display", "none");
      $("#datasetModal").css("display", "block");
    });

    $("#chartBtn").click(function() {
      console.log("chartBtn clicked");
      $(".menuWindow").css("display", "none"); // TODO May be obsolete soon.
      $("#chartModal").css("display", "block");
    }); 

    $("#shapeBtn").click(function() {
      console.log("shapeBtn clicked");
      $("#addPolygonsMenu").css("display", "block");
    });
  }

  function initModals() {
    $(window).click(function(e) {
      // console.log(e);
      if($(e.target).hasClass("modal")) {
        $(e.target).css("display", "none");
        resetChartMenu();
      }
    });
    $(".modal-close").click(function() {
      $(".modal").css("display", "none");
      resetChartMenu();     
    });
  }

  function initMenus() {
    $(".menu-close").click(function() {
      console.log("menu-close clicked");
      $(".menuWindow").css("display", "none");     
    });
  }

  function initRasterDatasetSelections() {
    $(".rasterDatasetSelection").click(function() {
      var id = $(this).attr("id");
      console.log(id);
      // close the modal
      $(".modal").css("display", "none"); 
      // load the data associated with the id
      LTVis.addCanvasLayer(id);
    });
  }

  function initSummaryPolygonSelections() {
    $(".summaryPolygonsSelection").click(function() {
      console.log("summary polygon selection clicked");
    })
  }

  function hideAllChartMenuPanels() {
    $(".chartMenuPanel").hide();
  }

  function resetChartMenu() {
    // hide all the menus
    hideAllChartMenuPanels();
    // show the first one
    $("#clickOrSummaryMenu").show();
  }

  function cancelChartSetup() {
    $(".modal").css("display", "none"); 
    resetChartMenu();
  }

  return {
    init: function() {
      initIconButtons();
      initModals();
      initRasterDatasetSelections();
      initMenus();
      initSummaryPolygonSelections();

      $(".chartMenuCancelButton").click(function() {
        cancelChartSetup();
      });

      // Click Or Summary Menu
      $("#chartByClickBtn").click(function() {
        hideAllChartMenuPanels();
        $("#chartByClickOptionsMenu").show();
      });
      $("#addSummaryAreasBtn").click(function() {
        hideAllChartMenuPanels();
        $("#addSummaryPolygonOptions").show();
      });
     
      // Chart by click options menu
      $("#chartByClickOptionsSubmitBtn").click(function() {
        cancelChartSetup();
      });
      $("#chartByClickOptionsBackBtn").click(function() {
        hideAllChartMenuPanels();
        $("#clickOrSummaryMenu").show();
      });

      // Add summary polygon
      $("#createYourOwnSummaryBtn").click(function() {
        hideAllChartMenuPanels();
        $("#uploadPolygonsMenu").show();
      });
      $("#loadPremadeSummaryBtn").click(function() {
        hideAllChartMenuPanels();
        $("#selectPremadePolygonsMenu").show();
      });
      $("#addSummaryPolygonOptionsBackBtn").click(function() {
        hideAllChartMenuPanels();
        $("#clickOrSummaryMenu").show();
      });

      
      $("#uploadPolygonsSubmitBtn").click(function() {
        cancelChartSetup();
      });
      $("#uploadPolygonsMenuBackBtn").click(function() {
        hideAllChartMenuPanels();
        $("#addSummaryPolygonOptions").show();
      });
      $("#selectPremadePolygonsMenuBackBtn").click(function() {
        hideAllChartMenuPanels();
        $("#addSummaryPolygonOptions").show();
      });
    }
  };

})(); // END LTVis.GUI module.

})(); // END the app. No more internal app code after this. 

// Start the app!
$(document).ready(function() {
  LTVis.init();

  // demo data for the timeline
  var data = [
    {date: 1970, value: 10},
    {date: 1981, value: 20},
    {date: 1982, value: 30},
    {date: 1983, value: 10},
    {date: 1984, value: -90},
    {date: 1985, value: 80},
    {date: 1986, value: 120},
    {date: 1987, value: 2},
    {date: 1988, value: 40},
    {date: 1989, value: 50},
    {date: 1991, value: 111},
    {date: 1993, value: 22},
    {date: 1994, value: 20},
    {date: 1997, value: 33},
    {date: 2000, value: 60},
    {date: 2006, value: 99},
    {date: 2011, value: 50},
  ];
  
  // Demo-ing the timeline here.
  // TODO move this code into the GUI module when it's really time to add this.
  var timechart = new LTVis.TimelineChart("timeRangeContainer", data);
  timechart.on("change", function() {
    console.log(timechart.getSelectedDataPoint());
  });

  LTVis.activeTimelineChart = timechart;
  LTVis.importDemoPolygons();
});






