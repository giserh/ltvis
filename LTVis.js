(function(){

"use strict";

var LTVis = {version: "testerville"};

// Expose the app in the global scope
window.LTVis = LTVis;

LTVis.util = {
  // Checks if d is a string before calling JSON.parse()
  // If it isn't, it is assumed to be already parsed JSON.
  // Useful when switching between working on the server vs locally.
  parseJSON: function(d) {
    // return typeof d === "object" ? d : JSON.parse(d);
    return typeof d === "string" ? JSON.parse(d) : d;
  },
  formatDate: function(d) {
    var year = d.getFullYear();
    var day = d.getDate();
    var month = d.getMonth() + 1;
    if(String(month).length < 2) {
      month = "0" + month;
    }
    if(String(day).length < 2) {
      day = "0" + day;
    }
    return [year,month,day].join("-");
  },
}

// The Map module configures the map, manages map layers, and has functions 
// for adding, removing, and styling layers. 
LTVis.Map = (function() {

  var map;
  var areaSummaryLayers;
  var canvasLayer = null;

  // Prep needed stuff for drawing polygons
  var drawnItems = new L.FeatureGroup();
  var shapeOpts = { color:'#03f', weight:2 };
  var drawControl = new L.Control.Draw({
    position: "topright",
    draw: {
      polyline: false,
      // marker: false,
      circle: false,
      rectangle: {shapeOptions: shapeOpts},
      polygon: {
        shapeOptions: shapeOpts,
        allowIntersection: false
      }
    },
    edit: {
      featureGroup: drawnItems
    }
  });

  // Set up some markers
  var blueMarker = new L.Icon({
    iconUrl:   'lib/leaflet-color-markers/img/marker-icon-blue.png',
    shadowUrl: 'lib/LeafletDraw/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  var redMarker = new L.Icon({
    iconUrl:   'lib/leaflet-color-markers/img/marker-icon-red.png',
    shadowUrl: 'lib/LeafletDraw/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  function createCanvasLayer(url) {
    var CanvasLayer = L.GridLayer.extend({
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

        // imageObj.src = [url, zxy + ".png"].join("/");
        imageObj.src = url + "/" + zxy + ".png";
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
    });
    return new CanvasLayer();
  }

  return {

    getAreaSummaryLayers: function() {
      return areaSummaryLayers;
    },

    clearAreaSummaryPolygons: function() {
      areaSummaryLayers.clearLayers();
    },

    addJSONAreaSummaryLayer: function(geoJSON) {
      areaSummaryLayers.clearLayers();
      console.log(geoJSON);

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
      });

      var bounds = newLyr.getBounds();
      map.fitBounds(bounds);
      areaSummaryLayers.addLayer(newLyr);

      function onEachFeature(feature, layer) {
        layer.on({
          mouseover: mouseover,
          mouseout: mouseout,
          click: click
        })
      }

      function mouseover(e) {
        var layer = e.target;
        if(layer.feature.geometry.type === "Point") {
          // Come kind of hover feedback for points?
        } else {
          console.log("it's some other thing");
          layer.setStyle({
            weight: 3
          });
        }

        
      }

      function mouseout(e) {
        var layer = e.target;
        if(layer.feature.geometry.type === "Point") {
          // Come kind of hover feedback for points?
        } else {
          layer.setStyle({
            weight: 1
          });
        }
        
      }

      function click(e) {
        // Style the clicked feature
        newLyr.setStyle({color: "black"});
        newLyr.eachLayer(function(lyr) {
          if(lyr.feature.geometry.type === "Point") {
            lyr.setIcon(blueMarker);
          }
        })
        var layer = e.target;
        if(layer.feature.geometry.type === "Point") {
          e.target.setIcon(redMarker);
        } else {
          layer.setStyle({
            color: "red"
          })
          if (!L.Browser.ie && !L.Browser.opera) {
            layer.bringToFront();
          }
        }
        LTVis.displayFeatureSummaryData(e.target.feature);
      }
    },

    addCanvasLayer: function(layer) {
      if(canvasLayer !== null) {
        map.removeLayer(canvasLayer);
      }
      canvasLayer = layer;
      layer.addTo(map);
    },

    loadDatasetTiles: function(url) {
      // Make a canvas layer
      var lyr = createCanvasLayer(url);
      this.addCanvasLayer(lyr);
    },

    removeCanvasLayer: function() {
      map.removeLayer(canvasLayer);
      canvasLayer = null;
    },

    addLayer: function(layer) {
      layer.addTo(map);
    },

    addDrawToolbar: function() {

      // Decrease opacity of other layers
      canvasLayer.setOpacity(0.5);

      // Create the draw toolbar, configure some options, add it to the map!
      map.addLayer(drawnItems);
      map.addControl(drawControl);
    },

    removeDrawToolbar: function() {
      // FIXME Set opacity back to whatever the UI setting is.
      // Ehen there is one.
      canvasLayer.setOpacity(1);
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    },

    submitDrawnPolygons: function() {
      // get the geojson out of the drawn polygon layer, yeah?
      console.log(drawnItems.toGeoJSON());
      LTVis.Map.addJSONAreaSummaryLayer(drawnItems.toGeoJSON());
    },

    init: function(callback) {
      // Load the config file for the map
      $.get('configFiles/mapConfig.yaml', null, function(data) {
        var mapConfig = jsyaml.load(data);
        L.mapbox.accessToken = mapConfig.map.accessToken;

        // Create the leaflet map, pass in the config options
        map = L.mapbox.map('map', null, mapConfig.map.options);

        // Set the initial map view
        map.setView(
          mapConfig.map.initialView.center, 
          mapConfig.map.initialView.zoom
        );

        // Add a basemap layer
        L.mapbox.styleLayer(
          mapConfig.referenceLayer.styleLayer,
          mapConfig.referenceLayer.options)
          .addTo(map);

        // Create a featureLayer object to store summary area polygons
        areaSummaryLayers = L.mapbox.featureLayer().addTo(map);
        
        // L.control.attribution({position: "bottomleft"}).addTo(map);

        // Add a scale bar scalebar to the map
        // TODO Temporarily disabled until we pick a good place for it.
        // L.control.scale().addTo(map);

        // Configure events for drawing polygons
        map.on('draw:created', function(e) {
          drawnItems.addLayer(e.layer);
        });
        map.on('draw:deleted', function(e) {
          // Maybe do something. Probably not.
        });

        // Done making the map! Let LTVis know.
        callback(true);
      });
    }
  };
})();



// Start main app functions instide the LTVis namespace. 
// These functions make calls to the modules defined
// above. The only place where calls to the modules above should happen are 
// in the LTVis namespace. 
$.extend(LTVis, {
  

  loadSummaryData: function(pathToGeoJSON, pathToData, config) {
    // load the polygons to the map
    $.get(pathToGeoJSON, null, function(geoJSON) {
      LTVis.Map.addJSONAreaSummaryLayer(LTVis.util.parseJSON(geoJSON));
    });

    // $.get(pathToData, null, function(data) {
    //   LTVis.activeAreaSummaryData = LTVis.util.parseJSON(data);
    //   console.log(LTVis.activeAreaSummaryData);
    // });
    // d3.csv(pathToData, function(d) {
    //   LTVis.activeAreaSummaryData = LTVis.formatImportedCSVForChart(d);
    // });
  },

  // This may become obsolete if all summary data is requested dynamically from 
  // the server.
  // It will be useful if summary data is cached as csv files.
  formatImportedCSVForChart: function(d) {

    var fd = {};
    // console.log(d);
    var dates = [];

    for(var i = 0; i < d.columns.length; i += 1) {
      if(d.columns[i] !== "id") {
        dates.push(d.columns[i]);
      }
    }

    for (var i=0; i < d.length; i += 1) {
      var id = d[i].id;
      fd[id] = [];
      for(var k = 0; k < dates.length; k += 1) {
        var o = {};
        o.date = dates[k];
        o.value = d[i][dates[k]];
        fd[id].push(o);
      }
    }
    return fd;
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

  // FIXME: This is all hardcoded stuff for demonstration purposes. Needs to be
  // extended and refined. 
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

  removeCanvasLayer: function() {
    LTVis.Map.removeCanvasLayer();
  },



  loadDataset: function(datasetID, dateString) {
    // TODO get the available dates for this dataset and pass them to the slider
    // TODO Invent some awesome system for determining the color ramp
    LTVis.ramp = "BrBG";
    LTVis.activeDataLayer = datasetID;
    var baseURL = "http://ltweb.ceoas.oregonstate.edu/mapping/tiles";
    // TODO get the available properties from somewhere
    var property = "tc_band5_k5_bph_ge_3_crm"; // Should come from ui settings.
    var band;
    // Set the band to the passed in dateString if there is one. 
    // Though really it should come from the slider.
    // ...Except the slider might be set to an invalid date.
    // TODO Think about this.
    if(typeof dateString !== "undefined") {
      band = dateString;
    } else {
      band = "2005-07-01";
    }
    console.log(dateString);
    var url = [baseURL, datasetID, property, band].join("/");
    LTVis.Map.loadDatasetTiles(url);
  },

  requestFeatureTimeSeriesData: function(feature, request, callback) {
    $.ajax({
      url: '/mapping/requestData/',
      method: 'GET',
      data: request,
      error: function(R, msg, st) {
         // $("#message").html('An error occurred in the web application.<br>'+
         // R.responseText+'<br>'+msg+'<br>'+st +"<br>"+JSON.stringify(request));
        console.log('An error occurred in the web application.<br>'+
          R.responseText+'<br>'+msg+'<br>'+st +"<br>"+JSON.stringify(request));
        callback(false);
      },
      success: function(R) {
        // $("#message").html("<pre>"+R+"</pre>");
        // console.log(LTVis.util.parseJSON(R));
        callback(LTVis.util.parseJSON(R));
      }
    });
  },

  displayFeatureSummaryData: function(feature) {
    // TODO This stuff needs to come from user-determined settings somewhere.
    var request = {
      'req-op': 'queryregion',
      'dataset': 'mr224_biomass',
      'property': 'tc_nbr_k1_bph_ge_3_crm',
      'reducer': 'mean,std,median,min,max',
      'region': JSON.stringify(feature.geometry),
      'date': JSON.stringify(['2000-01-01', '2010-12-31']),
      'format':'json' // choice of 'json' or 'yaml'
    }

    console.log(JSON.stringify(feature.geometry));

    LTVis.requestFeatureTimeSeriesData(feature, request, function(d) {
      // d is the time series data from the server!
      // Pass it into the graph here!
      LTVis.GUI.removeLinesFromTimelineChart();
      if(d) {
        LTVis.GUI.addLineToTimelineChart(d[request.property].mean);
      }      
    });
  },

  // This gets called by the GUI module when the timeline slider is moved.
  timelineDateChanged: function(newDate) {
    // Load a new dataset, but with the new date.
    LTVis.loadDataset(LTVis.activeDataLayer, LTVis.util.formatDate(newDate));
  },

  startDrawPolygonsMode: function() {
    // Hide the buttons at the topright.
    $("#mainButtonGroup").hide();
    // show the Done and Cancel button
    $("#drawingBtns").show();

    // Clear the current polygons
    LTVis.Map.clearAreaSummaryPolygons();

    // add a toolbar for drawing polygons!
    LTVis.Map.addDrawToolbar();
  },
  endDrawPolygonsMode: function() {
    // Remove the toolbar from the map

    $("#mainButtonGroup").show();
    $("#drawingBtns").hide();
    LTVis.Map.removeDrawToolbar();
  },
  submitDrawnPolygons: function() {
    // Submitting drawn polygons!
    LTVis.endDrawPolygonsMode();
    // Tell the map to do something with the drawn polygons
    LTVis.Map.submitDrawnPolygons();
  },

  init: function() {
    LTVis.GUI.init();
    LTVis.Map.init(function(success) {
       // load the starting dataset
      var sliderDate = LTVis.GUI.getSelectedTimelineDate();
      LTVis.loadDataset("mr224_biomass", LTVis.util.formatDate(sliderDate));
    });   
  }


}); // END $.extend(LTVis, {...})


// The GUI module sets up menus and buttons unique to this page. 
// TODO Should only call functions in the main LTVis app namespace, NOT make
// calls directly to any other modules. E.g. don't call LTVis.Map.doSomething(), 
// instead call LTVis.doSomething(), and let LTVis call LTVis.Map.doSomething().
// While this is a bit redundant, it helps keep the GUI indepentant of other 
// modules.
LTVis.GUI = (function() {

  var timelineChart;

  function initIconButtons() {
    $("#layerBtn").click(function() {
      console.log("layerBtn clicked");
      $(".menuWindow").css("display", "none");
      $("#datasetModal").css("display", "block");
    });

    $("#chartBtn").click(function() {
      // console.log("chartBtn clicked");
      $(".menuWindow").css("display", "none"); // TODO May be obsolete soon.
      $("#chartModal").css("display", "block");
    }); 

    $("#shapeBtn").click(function() {
      console.log("shapeBtn clicked");
      $("#addPolygonsMenu").css("display", "block");
    });

    $("#collapseChartBtn").click(function() {
      var uncollapsedHeight = 140;
      var collapsedHeight = 45;
      // What, just make it x-pixels tall? 
      // Make it 45 pixels tall. Yeah.
      // But hide the lines. And the y axis.
      // If the chart isn't collapsed, that is.
      // Otherwise, uncollapse it!
      // Oh, and change the icon in the button. 
      var chart = $("#timelineWidgetContainer");
      if(chart.hasClass("collapsed")) {
        chart.css("height", uncollapsedHeight);
        timelineChart.resize();
        timelineChart.showLines();

        $("#collapseChartBtn").html('<svg class="icon"><use xlink:href="iconDefs.svg#down" /></svg>')


        chart.removeClass("collapsed");
      } else {
        timelineChart.hideLines();
        chart.css("height", collapsedHeight);
        timelineChart.resize();

        $("#collapseChartBtn").html('<svg class="icon"><use xlink:href="iconDefs.svg#up" /></svg>')
        chart.addClass("collapsed");
      }


      // timelineChart.hideLines();
      // $("#timelineWidgetContainer");
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
      LTVis.loadDataset(id);
    });
  }

  function initSummaryPolygonSelections() {
    $(".summaryPolygonsSelection").click(function() {
      // Load them summary polygons
      var root = "data/premadeAreaSummaries/";
      var id = $(this).attr("id");
      var config;
      var pathToGeoJSON = root + id + "_geom.json";
      // var pathToData =    root + id + "_data.json";
      var pathToData =    root + id + "_data.csv";
      LTVis.loadSummaryData(pathToGeoJSON,pathToData);
      $(".modal").css("display", "none"); 
      resetChartMenu();
    })
  }

  function hideAllChartMenuPanels() {
    $(".chartMenuPanel").hide();
  }

  function resetChartMenu() {
    // hide all the menus
    hideAllChartMenuPanels();
    // show the first one
    $("#addSummaryPolygonOptions").show();
  }

  function cancelChartSetup() {
    $(".modal").css("display", "none"); 
    resetChartMenu();
  }

  function initTimelineChart() {
    // Because it must have dates. Maybe there is another way.
    var fakeDates = [
      "2000-06-01",
      "2001-06-01",
      "2002-06-01",
      "2003-06-01",
      "2004-06-01",
      "2005-06-01",
      "2006-06-01",
      "2007-06-01",
      "2008-06-01",
      "2009-06-01",
      "2010-06-01"
    ];
    timelineChart = new LTVis.TimelineChart("timelineWidget", fakeDates);
    timelineChart.on("change", function() {
      // console.log(timelineChart.getSelectedDate());
      LTVis.timelineDateChanged(timelineChart.getSelectedDate());
    });


    // Add a fake line to the widget. C'mon. 
    var line1 = {
      "2000-06-01": 70314.94714178116,
      "2001-06-01": 70300.14104355505,
      "2002-06-01": 69922.46855829416,
      "2003-06-01": 70106.94013193776,
      "2004-06-01": 69984.5749006571,
      "2005-06-01": 69789.50853959432,
      "2006-06-01": 69670.16361582214,
      "2007-06-01": 69660.00609303171,
      "2008-06-01": 69310.96638184038,
      "2009-06-01": 69160.56927252423,
      "2010-06-01": 69193.47928732826
    };
    timelineChart.addLine(line1);

    window.addEventListener("resize", function() {
      timelineChart.resize();
    })

    // Ok, now hide it. because it can't be visible until later. 
    // $("#timeRangeContainer").hide();
  }

  return {
    init: function() {
      initIconButtons();
      initModals();
      initRasterDatasetSelections();
      initMenus();
      initSummaryPolygonSelections();
      initTimelineChart();

      $(".chartMenuCancelButton").click(function() {
        cancelChartSetup();
      });

      $("#addSummaryAreasBtn").click(function() {
        hideAllChartMenuPanels();
        $("#addSummaryPolygonOptions").show();
      });

      // Add summary polygon
      $("#createYourOwnSummaryBtn").click(function() {
        hideAllChartMenuPanels();
        $("#uploadPolygonsMenu").show();
      });
      $("#drawPolygonsBtn").click(function() {
        // Hide the modal
        cancelChartSetup(); // Not really cancelling. But it is closing the 
        // modal.
        // Go into some kind of "drawing Polygons" mode or something.
        // This will add the polygon drawing tools, as well as 
        // a Done and Cancel button.
        LTVis.startDrawPolygonsMode();
      });
      $("#doneDrawingBtn").click(function() {
        LTVis.submitDrawnPolygons();
      });
      $("#cancelDrawingBtn").click(function() {
        LTVis.endDrawPolygonsMode();
      });
      $("#loadPremadeSummaryBtn").click(function() {
        hideAllChartMenuPanels();
        $("#selectPremadePolygonsMenu").show();
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
    },
    addLineToTimelineChart: function(lineData) {
      timelineChart.addLine(lineData);
    },
    removeLinesFromTimelineChart: function() {
      timelineChart.removeLines();
    },
    getSelectedTimelineDate: function() {
      return timelineChart.getSelectedDate();
    }
  };

})(); // END LTVis.GUI module.

})(); // END the app. No more internal app code after this. 








