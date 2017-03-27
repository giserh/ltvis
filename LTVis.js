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
  }
}

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

      var bounds = newLyr.getBounds();
      map.fitBounds(bounds);

      function onEachFeature(feature, layer) {
        layer.on({
          mouseover: mouseover,
          mouseout: mouseout,
          // click: click,
          mousedown: mousedown
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

      function mousedown(e) {
        // change the color of all the polygons back to black

        newLyr.setStyle({color: "black"});
        var layer = e.target;
        layer.setStyle({
          color: "red"
        })
        if (!L.Browser.ie && !L.Browser.opera) {
          layer.bringToFront();
        }
        console.log(e.target.feature.properties.id);
        console.log(LTVis.activeAreaSummaryData[e.target.feature.properties.id]);
        // FIXME make a function in LTVis that does the next two things
        var data = LTVis.activeAreaSummaryData[e.target.feature.properties.id];
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



// Start main app functions instide the LTVis namespace. 
// These functions make calls to the modules defined
// above. The only place where calls to the modules above should happen are 
// in the LTVis namespace. 
$.extend(LTVis, {
  init: function() {
    LTVis.GUI.init();
    LTVis.Map.init();

    // Demo-ing the timeline here.
    // TODO move this code to a better place later.
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

    var timechart = new LTVis.TimelineChart("timeRangeContainer", data);
    timechart.on("change", function() {
      console.log(timechart.getSelectedDataPoint());
    });

    LTVis.activeTimelineChart = timechart;
  },

  loadSummaryData: function(pathToGeoJSON, pathToData, config) {
    // load the polygons to the map
    $.get(pathToGeoJSON, null, function(geoJSON) {
      LTVis.Map.addJSONAreaSummaryLayer(LTVis.util.parseJSON(geoJSON));
    });

    // $.get(pathToData, null, function(data) {
    //   LTVis.activeAreaSummaryData = LTVis.util.parseJSON(data);
    //   console.log(LTVis.activeAreaSummaryData);
    // });
    d3.csv(pathToData, function(d) {
      LTVis.activeAreaSummaryData = LTVis.formatImportedCSVForChart(d);
    });
  },

  formatImportedCSVForChart: function(d) {

    var fd = {};
    console.log(d);
    var dates = [];

    for(var i = 0; i < d.columns.length; i += 1) {
      if(d.columns[i] !== "id") {
        dates.push(d.columns[i]);
      }
    }

    console.log(dates);

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

    console.log(fd);
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

  // FIXME: This needs to be reviewed and updated to offer more control.
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

  // TODO: This is all hardcoded stuff put here for demonstration purposes.
  // Needs to be incorporated into a system that allows more control. 
  addCanvasLayer: function(layerID) {
    LTVis.ramp = "BrBG";
    LTVis.activeDataLayer = layerID;
    var lyr = new LTVis.CanvasLayer();
    LTVis.Map.addCanvasLayer(lyr);
  },

  removeCanvasLayer: function() {
    LTVis.Map.removeCanvasLayer();
  },

  loadDataset: function(datasetID) {
    // Load the correct tiles, which are determined by the id and date of the 
    // slider as of before this was called. 

    // TODO: Right now this just loads an existing tileset sitting in a folder.
    // Later, this will need to make a request to Islay for specific tiles.
    // ALSO, tiles cannot be styled unless they come from the same server 
    // as this website. So we may need to have pre-styled tiles, in which case
    // we don't need to addCanvasLayer, but rather just request tiles from 
    // the server as normally done with leaflet. 
    LTVis.addCanvasLayer(datasetID);


    // Style the tiles according to the default styling specified by a metadata
    // file.

    // initialize the timeline slider with new dates according to the metadata
    // for this dataset.
    // TODO: For now there is no metadata for the dataset. Indeed, there are no 
    // proper datasets. So some metadata is invented here.
    var dates = [];
    for (var i = 1980; i <= 2020; i += 1) {
      dates.push(i);
    }

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
      LTVis.loadDataset(id);
    });
  }

  function initSummaryPolygonSelections() {
    $(".summaryPolygonsSelection").click(function() {
      console.log("summary polygon selection clicked");

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

      // initialize a timeline slider

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

      // Load the starting dataset. 
    }
  };

})(); // END LTVis.GUI module.

})(); // END the app. No more internal app code after this. 








