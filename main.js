// Launch the app and configure the default start-up settings.
// TODO right now initial configuration happens in the module scripts. 
// Might should be moved in here.
$(document).ready(function() {
  LTVis.init(function(success) {
    if(success) {
      // var sliderDate = LTVis.GUI.getSelectedTimelineDate();
      LTVis.loadDataset("mr224_biomass");
    } else {
      throw new Error("LTVis.init() failed, probably a problem in LTVis.Map.init()");
    }
  });
});