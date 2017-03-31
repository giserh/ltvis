// TODO: Lots.
// Dates are currently just years, yyyy. Could be updates to dd/mm/yyyy
LTVis.TimelineChart = function(divID, initialData){
  "use strict";

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
  
  // Layer up all the visual elements of the chart. This is done now to ensure everything
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