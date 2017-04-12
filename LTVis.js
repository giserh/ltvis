var LTVis = (function(){

"use strict";
var version = "As Dan Left It";

var activeDataLayer,
    ramp;

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
  LTVis.Map.removeDrawToolbar();
}

function loadDataset(datasetID, dateString) {
  // TODO get the available dates for this dataset and pass them to the slider
  // TODO Invent some awesome system for determining the color ramp
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
    LTVis.GUI.setTimelineSnappingDates(datesArray);
  });


  ramp = "BrBG";
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
    var sliderDate = LTVis.GUI.getSelectedTimelineDate();

    band = formatDate(sliderDate);
  }
  // console.log(dateString);
  var url = [baseURL, datasetID, property, band].join("/");
  LTVis.Map.loadDatasetTiles(url);
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

  loadSummaryData: function(pathToGeoJSON, pathToData, config) {
    // load the polygons to the map
    $.get(pathToGeoJSON, null, function(geoJSON) {
      LTVis.Map.addJSONAreaSummaryLayer(parseJSON(geoJSON));
    });
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
    if (ramp === "BrBG") {
      c = d3.color(d3.interpolateBrBG((255-n)/255));

    }
    if (ramp ==="RdYlGn") {
      c = d3.color(d3.interpolateRdYlGn((255-n)/255));

    }
    if (ramp === "RdBu") {
      c = d3.color(d3.interpolateRdBu((255-n)/255));
    }
    return [c.r, c.g, c.b, c.opacity];
  },

  removeCanvasLayer: function() {
    LTVis.Map.removeCanvasLayer();
  },

  loadDataset: function(datasetID, dateString) {
    loadDataset(datasetID, dateString)
  },

  // requestFeatureTimeSeriesData: function(feature, request, callback) {
  //   $.ajax({
  //     url: '/mapping/requestData/',
  //     method: 'GET',
  //     data: request,
  //     error: function(R, msg, st) {
  //        // $("#message").html('An error occurred in the web application.<br>'+
  //        // R.responseText+'<br>'+msg+'<br>'+st +"<br>"+JSON.stringify(request));
  //       console.log('An error occurred in the web application.<br>'+
  //         R.responseText+'<br>'+msg+'<br>'+st +"<br>"+JSON.stringify(request));
  //       callback(false);
  //     },
  //     success: function(R) {
  //       // $("#message").html("<pre>"+R+"</pre>");
  //       callback(parseJSON(R));
  //     }
  //   });
  // },

  // This is called by the Map module whenever a polygon feature is clicked.
  // TODO It might be better if instead there was a listener on the map that 
  // fired when a polygon feature is clicked. This would allow the Map module
  // to remain more independant of LTVis. Look at the d3 dispatch example 
  // in the timeline chart module.
  displayFeatureSummaryData: function(feature) {
    // TODO This stuff needs to come from user-determined settings somewhere.
    var request = {
      'req-op': 'queryregion',
      'dataset': 'mr224_biomass',
      'property': 'tc_nbr_k1_bph_ge_3_crm',
      'reducer': 'mean,std,median,min,max',
      'region': JSON.stringify(feature.geometry),
      'date': JSON.stringify(LTVis.GUI.getTimelineMinMax()),
      'format':'json' // choice of 'json' or 'yaml'
    }

    console.log(JSON.stringify(feature.geometry));

    requestFeatureTimeSeriesData(feature, request, function(d) {
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
    loadDataset(activeDataLayer, formatDate(newDate));
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

  endDrawPolygonsMode: endDrawPolygonsMode,

  submitDrawnPolygons: function() {
    // Submitting drawn polygons!
    endDrawPolygonsMode();
    // Tell the map to do something with the drawn polygons
    LTVis.Map.submitDrawnPolygons();
  },

  init: function(callback) {
    LTVis.GUI.init();
    LTVis.Map.init(function(success) {
      callback(success);
    });   
  }
};


})(); // END the app. No more internal app code after this. 







