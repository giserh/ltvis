var LTVis = (function(){

"use strict";
var version = "As Dan Left It";
var Map; // This is set to LTVis.Map when init() is called.
var GUI; // This is set to LTVis.GUI when init() is called.

var activeDataLayer;

// Some utility functions -----------------------------------------------------
function parseJSON(d) {
    // return typeof d === "object" ? d : JSON.parse(d);
    return typeof d === "string" ? JSON.parse(d) : d;
  }
function formatDate(d) {
  var year = d.getUTCFullYear();
  var day = d.getUTCDate();
  var month = d.getUTCMonth() + 1;
  if(String(month).length < 2) {
    month = "0" + month;
  }
  if(String(day).length < 2) {
    day = "0" + day;
  }
  return [year,month,day].join("-");
}
function sortDates(datesArray) {
  datesArray.sort(function(date1,date2) {
    if (date1 > date2) return 1;
    if (date1 < date2) return -1;
    return 0;
  });
}
// End utility functions ------------------------------------------------------

function endDrawPolygonsMode() {
  $("#mainButtonGroup").show();
  $("#drawingBtns").hide();
  Map.removeDrawToolbar();
}

// TODO Throw an error if datasetID doesn't match any existing dataset.
function loadDataset(datasetID) {
  $.get('../mapping/maps/' + datasetID + '/metadata.yaml', null, function(data) {
    var config = jsyaml.load(data);
    // console.log(config);
    // update the chart with dates!
    var dates = config["band-dates"];
    // I really want to convert this object to an array. 
    var datesArray = $.map(dates, function(value, index) {
      return [value];
    });
    sortDates(datesArray);
    // console.log(datesArray);
    // convert the dates to strings
    for (var i = 0; i < datesArray.length; i += 1) {
      datesArray[i] =  formatDate(datesArray[i]);
    }
    // send them dates to the timeline!
    // The timeline lives in the GUI. So you need to get in there!
    GUI.setTimelineSnappingDates(datesArray);
  });

  activeDataLayer = datasetID;
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
    var sliderDate = GUI.getSelectedTimelineDate();

    band = formatDate(sliderDate);
  }
  // console.log(dateString);
  var url = [baseURL, datasetID, property, band].join("/");
  Map.loadDatasetTiles(url);
}

function requestFeatureTimeSeriesData(feature, request, callback) {
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
      callback(parseJSON(R));
    }
  });
}

return {
  version: version,

  loadSummaryData: function(pathToGeoJSON) {
    // load the polygons to the map
    $.get(pathToGeoJSON, null, function(geoJSON) {
      Map.addJSONAreaSummaryLayer(parseJSON(geoJSON));
    });
  },

  loadDataset: function(datasetID) {
    loadDataset(datasetID)
  },

  // This is called by the Map module whenever a polygon feature is clicked.
  // TODO It might be better if instead there was a listener on the map that 
  // fired when a polygon feature is clicked. This would allow the Map module
  // to remain more independant of LTVis. Look at the d3 dispatch example 
  // in the timeline chart module.
  displayFeatureSummaryData: function(feature) {
    // TODO This stuff needs to come from user-determined settings somewhere.
    // For example, the 'dataset' should be whatever dataset is 
    // currently selected. The 'reducer' should be selectable somewhere in
    // the chart settings menu (when there is one).
    var request = {
      'req-op': 'queryregion',
      'dataset': 'mr224_biomass',
      'property': 'tc_nbr_k1_bph_ge_3_crm',
      'reducer': 'mean,std,median,min,max',
      'region': JSON.stringify(feature.geometry),
      'date': JSON.stringify(GUI.getTimelineMinMax()),
      'format':'json' // choice of 'json' or 'yaml'
    }

    console.log(JSON.stringify(feature.geometry));

    requestFeatureTimeSeriesData(feature, request, function(d) {
      // d is the time series data from the server!
      // Pass it into the graph here!
      GUI.removeLinesFromTimelineChart();
      if(d) {
        GUI.addLineToTimelineChart(d[request.property].mean);
      }      
    });
  },

  // This gets called by the GUI module when the timeline slider is moved.
  timelineDateChanged: function(newDate) {
    // Load a new dataset, but with the new date.
    loadDataset(activeDataLayer, formatDate(newDate));
  },

  startDrawPolygonsMode: function() {
    // Hide the buttons at the topright.
    $("#mainButtonGroup").hide();
    // show the Done and Cancel button
    $("#drawingBtns").show();

    // Clear the current polygons
    Map.clearAreaSummaryPolygons();

    // add a toolbar for drawing polygons!
    Map.addDrawToolbar();
  },

  endDrawPolygonsMode: endDrawPolygonsMode,

  submitDrawnPolygons: function() {
    // Submitting drawn polygons!
    endDrawPolygonsMode();
    // Tell the map to do something with the drawn polygons
    Map.submitDrawnPolygons();
  },

  // Set the color scale applied to dataset map tiles.
  // positions: an array of numbers from 0 to 1 in ascending order.
  // colors: an array of css-readable color strings. Must be the same length
  // as the positions array.
  setMapTileColorScale: function(positions, colors) {
    Map.setTileColorScale(positions, colors);
  },

  init: function(callback) {
    Map = LTVis.Map;
    GUI = LTVis.GUI;
    GUI.init();
    Map.init(function(success) {
      callback(success);
    });   
  }
};


})(); // END the app. No more internal app code after this. 







