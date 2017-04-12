// Launch the app and configure the default start-up settings.
// TODO right now initial configuration happens in the module scripts. 
// Might should be moved in here.
$(document).ready(function() {
  LTVis.init(function(success) {
    if(success) {
      // var sliderDate = LTVis.GUI.getSelectedTimelineDate();
      LTVis.loadDataset("mr224_biomass");
    } else {
      throw new Error("something went wrong with LTVis.init(), probably in LTVis.Map.init()")
    }
  });
});