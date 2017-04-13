// The GUI module sets up menus and buttons unique to this page. 
// This module should only call functions in the main LTVis module, and NOT make
// calls directly to any other modules. E.g. don't call LTVis.Map.doSomething(), 
// instead call LTVis.doSomething(), and let LTVis call LTVis.Map.doSomething().
// While this is a bit redundant, it helps keep modules independant.
LTVis.GUI = (function() {

  var timelineChart;

  function initIconButtons() {
    $("#layerBtn").click(function() {
      console.log("layerBtn clicked");
      $(".menuWindow").css("display", "none");
      $("#datasetModal").css("display", "block");
    });

    $("#chartBtn").click(function() {
      $(".menuWindow").css("display", "none"); // TODO May be obsolete soon.
      $("#chartModal").css("display", "block");
    }); 

    $("#shapeBtn").click(function() {
      console.log("shapeBtn clicked");
      $("#addPolygonsMenu").css("display", "block");
    });

    $("#collapseChartBtn").click(function() {
      var chart = $("#timelineWidgetContainer");
      if(chart.hasClass("collapsed")) {
        uncollapseTimelineChart();
      } else {
        collapseTimelineChart();
      }
    });
  }

  function uncollapseTimelineChart() {
    // TODO somehow grab this height when the timeline is init'ed? 
    var uncollapsedHeight = 140; 
    var chart = $("#timelineWidgetContainer");
    chart.css("height", uncollapsedHeight);
    timelineChart.resize();
    timelineChart.showLines();
    $("#collapseChartBtn").html('<svg class="icon"><use xlink:href="iconDefs.svg#down" /></svg>')
    chart.removeClass("collapsed"); 
  }

  function collapseTimelineChart() {
    var collapsedHeight = 45;
    var chart = $("#timelineWidgetContainer");
    chart.css("height", collapsedHeight);
    timelineChart.hideLines();
    timelineChart.resize();
    $("#collapseChartBtn").html('<svg class="icon"><use xlink:href="iconDefs.svg#up" /></svg>')
    chart.addClass("collapsed");
  }

  function initModals() {
    $(window).click(function(e) {
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
      LTVis.timelineDateChanged(timelineChart.getSelectedDate());
    });


    window.addEventListener("resize", function() {
      timelineChart.resize();
    })

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
    },
    setTimelineSnappingDates: function(dates) {
      timelineChart.setDateRange(dates);
    },
    getTimelineMinMax: function() {
      return timelineChart.getDateStringMinMax();
    }
  };

})(); // END LTVis.GUI module.