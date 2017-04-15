// Launch the app and configure the default start-up settings.
// TODO right now initial configuration happens in the module scripts. 
// Might should be moved in here.
$(document).ready(function() {
  LTVis.init(function(success) {
    // This whole "success" thing doesn't do much. The only thing that
    // can fail right now is the loading of the default dataset, which 
    // right now is mr224_biomass. But this structure might be more
    // useful later.
    if(success) {
      // var sliderDate = LTVis.GUI.getSelectedTimelineDate();
      LTVis.loadDataset("mr224_biomass");
    } else {
      throw new Error("LTVis.init() failed, probably a problem in LTVis.Map.init()");
    }
  });
});