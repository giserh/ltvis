// The Map module configures the map, manages map layers, and has functions 
// for adding, removing, and styling layers. 
LTVis.Map = (function() {

  var map;
  var areaSummaryLayers;
  var canvasLayer = null;
  var currentDatasetTileURL = null;
  

  // Prep needed stuff for drawing polygons
  var drawnItems = new L.FeatureGroup();
  var shapeOpts = { color:'#03f', weight:2 };
  var drawControl = new L.Control.Draw({
    position: "topright",
    draw: {
      // polyline: false,
      // marker: false,
      circle: false,
      polyline: {
        shapeOptions: { color:'#03f', weight:4, fill: false }
      },
      rectangle: {
        shapeOptions: shapeOpts
      },
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

  // Set up the color scale for the dataset tiles.
  // cs_def is just some default color ramp settings.
  var cs_def = {
    positions:[0, 0.25, 0.5, 0.75, 1], 
    colors:["#a6611a", "#dfc27d", "#f5f5f5", "#80cdc1", "#018571"]
  };
  // Make a new ColorInterpolator, which is used by the canvasLayer
  // to set pixel colors. 
  var tileColorScale = new ColorInterpolator(cs_def.positions, cs_def.colors);

  // Must call using the new keyword, as above. 
  // Creates an interpolator that can return a scaled rgba array based on 
  // an input value. Can include up to 256 colors.
  // positions: an array of numbers between 0 and 1 in ascending order. Determines
  // the locations in the color scale where each color starts/ends.
  // colors: an array of standard css color strings, can be hex, rgb, whatever.
  // Must be the same length as positions. 
  function ColorInterpolator(positions, colors) {
    if(positions.length !== colors.length) {
      throw new Error("positions and colors must be arrays of equal length");
    }
    // The number of colors in the color scale. 
    var scaleWidth = 256;
    // Delete the exising color scale, if there is one.
    d3.selectAll(".tileColorScale").remove();
    // Create a hidden canvas element to store the color scale. 
    var canvasColorScale = d3.select("body").append("canvas")
      .attr("width", scaleWidth)
      .attr("height", 1)
      .attr("class", "tileColorScale")
      .style("display", "none");
    // Grab the 2d context of the canvas, create a gradient, and configure it
    // using the positions and colors
    var contextColorScale = canvasColorScale.node().getContext("2d");
    var gradient = contextColorScale.createLinearGradient(0, 0, scaleWidth, 1);
    for (var i = 0; i < colors.length; ++i) {
      gradient.addColorStop(positions[i], colors[i]);
    }
    // Render the (hidden) color scale.
    contextColorScale.fillStyle = gradient;
    contextColorScale.fillRect(0, 0, scaleWidth, 1);
    // Access the image data of the color scale, which contains the rgb values
    // for each of the 256 colors in the scale. 
    var csImageData = contextColorScale.getImageData(0, 0, scaleWidth, 1).data;
    // Convert an integer
     t from 0 to 255 to a color based on the color scale.
    // It's fast because it's just accessing the position of t*4 in 
    // csImageData, which is 1-dimensional array of rgba values for each 
    // of the 256 colors in the scale. 
    // Returns [r,g,b,a]
    this.interpolateGrayscale = function(t) {
      var alpha = 255;
      if (t<0 || t > (scaleWidth-1)){
        alpha = 0;
      }
      var r = csImageData[t*4];
      var g = csImageData[t*4+1];
      var b = csImageData[t*4+2];
      var a = alpha;
      return [r, g, b, a];
    }
  }
  
  // Makes a L.GridLayer, where each tile is a canvas element. The 
  // pixels of the tile are recolored according to...stuff. Read on.
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
          // Draw this image onto the temp context. This step allows accessing
          // the data of the image in the next step.
          tempContext.drawImage(this, 0, 0);

          // Get the data of the image drawn on the temp context
          var tempImage = tempContext.getImageData(0,0,tile.width, tile.height);
          var tempData = tempImage.data;

          // Every 4 values are the RGBA values of a single pixel. 
          // Loop over the array 4 values at a time, and change the RGB
          // values according to...whatever color gradient is used here. 
          // The RGB values for each pixel should all be the same, since it's grayscale.
          // Therefor, only the R value is passed into the scaler doodad, and 
          // the resulting [r,g,b] data is used to recolor the pixel. 
          for (var i = 0; i < tempData.length; i +=4) {
            // change the color to something else!
            // FIXME, do not reference LTVis, put the needed code into the mapping module. 
            // 
            // var c = LTVis.getRGBAColorFromGrayscale(tempData[i]);
            var c = tileColorScale.interpolateGrayscale(tempData[i]);
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
      var newLyr = L.geoJSON(geoJSON, {
        style: function() {
          return {
            stroke: true,
            color: '#03f',
            weight: 1,
            opacity: 1,
            // fill: true,
            fillColor: "#03f",
            fillOpacity: 0
          }
        },
        onEachFeature: onEachFeature
      });

      var bounds = newLyr.getBounds();
      map.fitBounds(bounds);
      areaSummaryLayers.addLayer(newLyr);

      function onEachFeature(feature, layer) {
        console.log(feature);
        if(feature.geometry.type === "LineString") {
          layer.setStyle({weight: 3});
        } else if(feature.geometry.type === "Polygon") {
          layer.setStyle({fillOpacity: 0.2})
        }
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
        } else if(layer.feature.geometry.type === "LineString") {
          layer.setStyle({
            weight: 4
          })
        } else {
          // it's a Polygon probably.
          layer.setStyle({
            weight: 3
          });
        }
      }

      function mouseout(e) {
        var layer = e.target;
        if(layer.feature.geometry.type === "Point") {
          // Come kind of hover feedback for points?
        } else if(layer.feature.geometry.type === "LineString") {
          layer.setStyle({
            weight: 3
          })
        } else {
          layer.setStyle({
            weight: 1
          });
        }
        
      }

      function click(e) {
        // Style the clicked feature
        newLyr.setStyle({color: "#03f"});
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
        // FIXME Don't call a function inside LTVis. Instead, dispatch an event
        // that LTVis listens to, if possible. Look at the d3 dispatch example in 
        // the timeline chart module. 
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
      currentDatasetTileURL = url;
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
      LTVis.Map.addJSONAreaSummaryLayer(drawnItems.toGeoJSON());
    },

    setTileColorScale: function(positions, colors) {
      tileColorScale = new ColorInterpolator(positions, colors);
      // remove the old canvas element, redraw it using the new scale. 
      this.loadDatasetTiles(currentDatasetTileURL);
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