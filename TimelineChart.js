LTVis.TimelineChart = function(divID, inputSnappingDates){
  "use strict";

  var settings = {
    showLines: true
  }

  var chartDiv = d3.select("#" + divID);
  var margins = {top: 10, right: 20, bottom: 25, left: 30};
  var width;
  var height;

  var snappingDateStrings = inputSnappingDates; // might not ever need the strings
  var snappingDates = [];
  

  var parseTime = d3.timeParse("%Y-%m-%d");
  snappingDateStrings.forEach(function(d) {
    snappingDates.push(parseTime(d));
  });

  // Select a default snapping date. Maybe the middle one for now.
  var selectedSnappingDate = snappingDates[(Math.round((snappingDates.length - 1) / 2))];

  // lineData is an array of objects formatted as {date: date, value: value}, 
  // and is used to draw the data lines on the chart.
  // rawLineData are non-formatted {date: value} pairs as they were passed in, 
  // useful for drawing focus points on the chart quickly. Both are updated
  // any time a line is added to the chart.
  var lineData = [];
  var rawLineData = []; 

  // d3.line is a tool for creating path SVG strings, and this defines how the 
  // lineData is processed when it's passed in later. 
  var line = d3.line()
               .defined(function(d) { return d; })
               .x(function(d) { return xScale(d.date); })
               .y(function(d) { return yScale(d.value); });

  // Define scales and axes.
  var xScale = d3.scaleTime();
  var yScale = d3.scaleLinear();
  var xAxis = d3.axisBottom(xScale);
  var yAxis = d3.axisLeft(yScale);
  var xAxisName = "Date";
  var yAxisName = "y";

  // Here all the different SVG groups are defined and layered in the order they 
  // need to appear on the chart. 
  // 'svg' is the main SVG object where everything is drawn, and spans the entire
  // div.
  // 'chart' is another SVG group division where pretty much everything is drawn.
  // 'mouseCatcher' is for capturing hover events on the chart.
  var svg = chartDiv.append("svg");
  var chart = svg.append("g")
        .attr("transform", "translate(" + margins.left + "," + margins.top + ")")
        .attr("class", "timelineChart");
  var xAxisSVG = chart.append("g").attr("class", "x axis");
  var snappingTicks = chart.append("g").attr("class", "snappingTicks");
  var yAxisSVG = chart.append("g").attr("class", "y axis");
  var linesSVG = chart.append("g").attr("class", "linesSVG");
  var mouseCatcher = chart.append("rect").attr("class", "mouseCatcher")
        .style("fill", "none")
        .style("pointer-events", "all");
  var focusPoints = chart.append("g")
      .style("display", "none")
      .attr("class", "focusPoints");
  var ghostHandle = chart.append("g")
        .attr("class", "ghostHandle")
        .style("pointer-events", "none");
  var sliderHandle = chart.append("g")
        .attr("class", "sliderHandle")
        .style("pointer-events", "all");

  // The dateTooltip only appears when the sliderHandle is being dragged or
  // hovered.
  // The focusTooltip is shown only when focus points are hovered over. 
  // TODO Maybe just one tooltip can be used for both? Would that be easier?
  var dateTooltip = d3.select("#" + divID).append("div")
        .attr("class", "dateTooltip")       
        .style("display", "none");
  var focusTooltip = d3.select("#" + divID).append("div")
        .attr("class", "focusTooltip")
        .style("display", "none");


  // var formatMonth = d3.timeFormat("%b");
  // With the above, calling formatMonth(date) makes June into Jun, which is 
  // weird. So here's one where June is June. Less weird.
  function formatMonth(date) {
    var months = ["Jan","Feb","Mar","Apr","May","June","July","Aug","Sep","Oct",
                  "Nov","Dec"];
    return months[date.getMonth()];
  }

  // Convert a date object into a "yyyy-mm-dd" string, which is the format
  // used for keys in the rawLineData objects.
  function dateToLineDataString(d) {
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
  }

  // Update the text in the dateTooltip with the provided date,
  // and move it above the snapping point for that date on the slider
  function updateDateTooltip(date) {
    dateTooltip.html(function() {
      var month = formatMonth(date);
      return (month + " " + date.getDate() + "<br/>" + date.getFullYear());
    });
    dateTooltip.style("left", function() {
      var divWidth = dateTooltip.node().getBoundingClientRect().width;
      return ((xScale(date) + margins.left - Number(divWidth)/2) + "px"); 
    })
    .style("bottom", function() {
      return (margins.bottom + 10) + "px";
    })
  } 

  // d is rawLineData for one line. 
  function updateFocusTooltip(d, date) {
    var value = d[dateToLineDataString(date)];
    focusTooltip.html(function() {
      var m = formatMonth(date);
      var day = date.getDate();
      var y = date.getFullYear();
      var dateString = xAxisName + ": " + m + " " + day + ", " + y;
      return dateString + "<br/>" + yAxisName + ": " + value;
    })
    .style("left", function() {
      return (xScale(date) + margins.left + 5) + "px";
    })
    .style("bottom", function() {
      return  (height-yScale(value)+margins.bottom + 5) + "px";
    })
  }

  function configFocusPoints() {
    var points = focusPoints.selectAll("circle")
        .data(rawLineData)
        .enter().append("circle")
        .attr("r", 4)
        .attr("fill", "#fff")
        .attr("stroke", "rgb(120,120,120")
        .on("mouseover", function(d) { 
          if(settings.showLines) {
            focusPoints.style("display", null);
            d3.select(this)
              .attr("r", 6);
            // Show and place the focusTooltip.
            focusTooltip.style("display", null);
            var nearestSnappingDate = getNearestSnappingDate(d3.mouse(mouseCatcher.node())[0]);
            updateFocusTooltip(d, nearestSnappingDate);
          }
        })
        .on("mouseout", function() { 
          if(settings.showLines) {
            focusPoints.style("display", "none");
            d3.select(this)
              .attr("r", 4);
            // hide the focusTooltip
            focusTooltip.style("display", "none");
          }
        })
        .on("mousemove", function() {
          if(settings.showLines) {
            mousemove();
          }
        });


    mouseCatcher.on("mouseover", function() {
        if(settings.showLines) {
          focusPoints.style("display", null);
        } 
        
      })
      .on("mouseout", function() { 
        if(settings.showLines) {
          focusPoints.style("display", "none");
        }
      })
      .on("mousemove", function() {
        if(settings.showLines) {
          mousemove();
        }
      });

    function mousemove() {
      var nearestSnappingDate = getNearestSnappingDate(d3.mouse(mouseCatcher.node())[0]);
      focusPoints.selectAll("circle").each(function(d) {
        // set the xy to the date/value
        d3.select(this)
          .attr("transform",
                "translate(" + xScale(nearestSnappingDate) + "," +
                           yScale(d[dateToLineDataString(nearestSnappingDate)]) + ")");
      })
    }
  }

  function configSlider() {
    
    var handleLine = sliderHandle.append("line")
          .style("stroke", "rgb(150,150,150")
          .style("stroke-width", "1px")
          .attr("stroke-dasharray","5, 5")
          .style("pointer-events", "none");

    var circle = sliderHandle.append("circle")
          .style("stroke", "none")
          .style("fill", "rgb(102,189,180)")
          .attr("r", 7);

    var ghostCircle = ghostHandle.append("circle")
          .style("stroke", "none")
          .style("fill", "rgb(150,150,150)")
          .attr("r", 4)
          .style("display", "none");

    sliderHandle
      .on("mouseover", function() {
        console.log("slider handle mouseover");
        // show the tooltip!
        var x = d3.mouse(this)[0];
        var nearestSnappingDate = getNearestSnappingDate(x);
        dateTooltip.style("display", null);
        updateDateTooltip(nearestSnappingDate);
      })
      .on("mouseout", function() {
        dateTooltip.style("display", "none");
      });

    sliderHandle.call(d3.drag()
        .on("start.interrupt", function() { console.log("Interrupted? Or started?"); })
        .on("start drag", drag)
        .on("end", dragEnd));

    function drag() {
      mouseCatcher.style("pointer-events", "none");
      // Get the location of the mouse
      var x = d3.mouse(this)[0];

      // Constrain the slider location to inside the visible part of the chart
      if(x < 0) {
        x = 0;
      } else if (x > width) {
        x = width;
      }

      // Move the slider to the mouse location
      updateSlider(xScale.invert(x));

      // Change the style to dragging style
      circle.style("fill", "rgb(80,160,155"); //"rgb(102,189,180"


      // show the ghostCircle!
      ghostCircle.style("display", null);
      // put the ghostCircle somewhere! The nearest snapping date!
      var nearestSnappingDate = getNearestSnappingDate(x);

      ghostCircle.attr("transform",
                       "translate(" + xScale(nearestSnappingDate) + "," + height + ")");

      // show the tooltip!
      dateTooltip.style("display", null);

      // update the tooltip.
      updateDateTooltip(nearestSnappingDate);
      
      
    }
    function dragEnd() {
      mouseCatcher.style("pointer-events", "all");
      // find the snapping date closest to the mouse location
      var nearestSnappingDate = getNearestSnappingDate(d3.mouse(this)[0]);

      setSelectedSnappingDate(nearestSnappingDate);

      // Change the style back to not-dragging style
      circle.style("fill", "rgb(102,189,180");
      ghostCircle.style("display", "none");
      dateTooltip.style("display", "none");
    }
  }

  var bisectDate = d3.bisector(function(d) {return d;}).left;

  function getNearestSnappingDate(mouseEventX) {
    var x0 = xScale.invert(mouseEventX);
    var i = bisectDate(snappingDates, x0, 1);
    var d0 = snappingDates[i-1];
    var d1 = snappingDates[i];
    if(typeof d1 === "undefined") { return d0 };
    var d = x0 - d0 > d1 - x0 ? d1 : d0;
    return d;
  }

  function setSelectedSnappingDate(d) {
    // only do something if d isn't already the selected snapping date
    if (d !== selectedSnappingDate) {
      selectedSnappingDate = d;
      dispatch.call("change");
    }
    updateSlider(d);
  }

  // d is a date object. Moves the slider handle to that date on the x axis,
  // and adjusts the height of the line sticking out of the dot there.
  function updateSlider(d) {
    // TODO if outside range, move to nearest available
    sliderHandle.select("circle")
      .attr("transform", 
            "translate(" + xScale(d) + "," + height + ")");
    sliderHandle.select("line")
      .attr("transform", 
            "translate(" + xScale(d) + "," + height + ")")
      .attr("y2", -height)
      .attr("y2", function() {
        if(lineData.length>0 && settings.showLines) {
          return -height;
        } else {
          return 0;
        }
      });
  }

  function updateWidthHeight() {
    width = parseInt(chartDiv.style("width")) - margins.left - margins.right;
    height = parseInt(chartDiv.style("height")) - margins.top - margins.bottom;
  }

  function updateSVGDimensions() {
    svg.attr("width", width + margins.left + margins.right)
       .attr("height", height + margins.bottom + margins.top);
    chart.select(".mouseCatcher")
      .attr("width", width)
      .attr("height", height + margins.bottom);
  }

  function updateScaleRanges() {
    xScale.range([0, width]).nice();
    if (lineData.length > 0 && settings.showLines) {
      yScale.range([height, 0]).nice();
    } else {
      yScale.range([height, height]).nice();
    }
  }

  // TODO Could split this into two functions, one for xScale and yScale.
  function updateScaleDomains() {
    // xScale is easy
    // xScale.domain(d3.extent(dates));

    var datesExtent = d3.extent(snappingDates);


    for (var i = 0; i < lineData.length; i += 1) {
      var extent = d3.extent(lineData[i], function(d) {
        return d.date;
      });
      datesExtent[0] = extent[0] < datesExtent[0] ? extent[0] : datesExtent[0];
      datesExtent[1] = extent[1] > datesExtent[1] ? extent[1] : datesExtent[1];
    }
    xScale.domain(datesExtent);

    // yScale depends on the existing lineData
    if(lineData.length > 0 && settings.showLines) {
      var minY = Infinity;
      var maxY = Number.NEGATIVE_INFINITY;
      // Loop through each lineData element...
      for (var i = 0; i < lineData.length; i += 1) {
        var extent = d3.extent(lineData[i], function(d) {
          return d.value;
        });
        minY = extent[0] < minY ? extent[0] : minY;
        maxY = extent[1] > maxY ? extent[1] : maxY;
      }

      if (minY === maxY) {
        var k = minY;
        minY -= k;
        maxY = k === 0 ? 1 : k; // If the values are all zero, make the max 1
      }
      yScale.domain([minY, maxY]);
    } else {
      yScale.domain(false);
    }
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

  function updateSnappingTicks() {
    snappingTicks.selectAll("line").remove();
    // Loop through the snappingDates
    for(var i = 0; i < snappingDates.length; i += 1) {
      snappingTicks.append("line")
        .attr("transform",
              "translate(" + xScale(snappingDates[i]) + "," + height + ")")
        .attr("y2", -7)
        .style("stroke", "rgb(170,170,170)")
        .style("stroke-width", "1px");
    }
  }

  function updateAxes() {
    xAxis.ticks(Math.max(width/100, 2));
    yAxis.ticks(Math.max(height/30, 2));
    chart.select('.x.axis')
      .call(xAxis)
      .attr("transform", "translate(0," + height + ")");
    chart.select('.y.axis')
      .call(yAxis);
    updateSnappingTicks();
    styleAxes();
  }

  function fitToDiv() {
    updateWidthHeight();
    updateScaleDomains();
    updateScaleRanges();
    updateSVGDimensions();
    updateAxes();
    updateLines();
    updateSlider(selectedSnappingDate);
  }

  

  // lineData is an object with data:value pairs.
  // Make it into an array of {date:date, value:value} objects,
  // in ascending order by date.
  function formatLineData(lineData) {
    // collect the dates in an array
    var lineDates  = [];
    for(var i in lineData) {
      if (lineData.hasOwnProperty(i)) {
        lineDates.push(i);
      }
    }
    // Sort the lineDates. They are strings tho. 
    // So compare parsed versions of the strings.
    // Here is the compare function
    function parseAndCompareDates(a,b) {
      var aParsed = parseTime(a);
      var bParsed = parseTime(b);
      if (aParsed < bParsed) {
        return -1;
      }
      if (aParsed > bParsed) {
        return 1;
      }
      return 0;
    }
    // Here is the sorting, which uses the compare function
    lineDates.sort(parseAndCompareDates);

    // Create the formattedLineData array, making sure they are in order by date.
    var formattedLineData = [];
    for (var i = 0; i < lineDates.length; i += 1) {
      var ob = {};
      ob.date = parseTime(lineDates[i]); //  dates[i];
      ob.value = lineData[lineDates[i]];
      formattedLineData.push(ob);
    }
    return formattedLineData;
  }

  

  function drawLine(l) {
    // console.log(l);
    var newLineSVG = linesSVG.append("path")
      .data([l])
      .attr("class", "line")
      .attr("stroke", "green")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("d", line)
      .on("mouseover", function(d) {
        d3.select(this).attr("stroke", "yellow");
        console.log(d);
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke", "green");
      });
  }

  function updateLines() {
    linesSVG.selectAll("path")
      .attr("d", line);
  }

  function drawLines() {
    // Clear all the currently drawn lines, if there are any.
    linesSVG.selectAll("path").remove();

    // Need to update the yAxis range, domain, and rendering to fit the 
    // y-range of the line data.
    updateScaleDomains(); 
    updateScaleRanges();
    updateAxes();

    // The yAxis tick labels can be any width, so right now they might either
    // be off the visible area, or too small for the amount of white space in 
    // the left margin. So the left margin needs to be adjusted to fix the
    // tick lables, and the chart then nudged left or right using the new
    // margin.
    updateMargins();
    chart.attr("transform", "translate(" + (margins.left + 2) + "," + margins.top + ")");
    
    // Since the chart was nudged left or right, now the xAxis width needs
    // adjusted to fit within the margins.
    // These functions also update the yAxis, though it isn't necessary.
    // updateScaleDomains(); // Maybe not needed?
    updateScaleRanges();
    updateAxes();
    updateSlider(selectedSnappingDate);

    // Loop through the lineData array, drawing svg lines.

    if(settings.showLines) {
      for (var i = 0; i < lineData.length; i += 1) {
        drawLine(lineData[i]);
      }
    }
    // make the focus points for the lines.
    configFocusPoints();

  }

  // Adjusts the margin values, which determine the white space around the
  // chart, to fit the tick labels, which vary in width with the data.
  function updateMargins() {
    // Gets the bounding box of the yAxis, which includes tick labels, and
    // adds a 2px space between the label and the left edge of the chart div.
    var left = yAxisSVG.node().getBBox().width + 2;
    margins.left = left >= 30 ? left : 30;

    // The width and height variables and the SVG dimensions depend on the
    // margin sizes, so update them anytime the margins change.
    updateWidthHeight();
    updateSVGDimensions();
  }

  function setDateRange(newDatesArray) {
    snappingDateStrings = newDatesArray;
    snappingDates = [];
    snappingDateStrings.forEach(function(d) {
      snappingDates.push(parseTime(d));
    });

    // update the x axis.
    updateScaleDomains();
    updateScaleRanges(); // might not be needed
    updateAxes();
    updateLines();
  }

  function init() {
    fitToDiv();
    // Set up a starting location for the slider handle. Maybe the earliest date.
    configSlider();
    configFocusPoints();
    updateSlider(selectedSnappingDate);

  }

  init();  

  var dispatch = d3.dispatch("change");

  return {
    resize: function() {
      fitToDiv();
    },
    addLine: function(newLineData) {
      // format the data
      rawLineData.push(newLineData);
      lineData.push(formatLineData(newLineData));
      drawLines();
    },
    addMultipleLines: function(newLinesData) {
      for (var i = 0; i < newLinesData.length; i += 1) {
        rawLineData.push(newLinesData[i]);
        lineData.push(formatLineData(newLinesData[i]));
      }
      drawLines();
    },
    removeLines: function() {
      linesSVG.selectAll("path").remove();
      // margins.left = 35;
      lineData = [];
      rawLineData = [];
      drawLines();
    },
    setDateRange: function(newDatesArray) {
      setDateRange(newDatesArray);
    },
    getSelectedDate: function() {
      return selectedSnappingDate;
    },

    hideLines: function() {
      settings.showLines = false;
      drawLines();
    },

    showLines: function() {
      settings.showLines = true;
      drawLines();
    },

    setXAxisName: function(newName) {
      xAxisName = newName;
    },

    setYAxisName: function(newName) {
      yAxisName = newName;
    },

    // events!
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
    }
  }
};
