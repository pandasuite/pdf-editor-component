import PandaBridge from "pandasuite-bridge";
import "./index.css";
import { initPdfViewer, getOrCreatePdf, updatePdf } from "./pdfService";
import { syncInteractiveZones } from "./interactiveZones";
import { setMarkers, setProperties } from "./state";
import { selectFromStudio } from "./selecto";

/**
 * Function to handle the DOM loaded event.
 * It initializes the PDF and sets up the viewer.
 */
async function onDomLoaded() {
  const pdfDoc = await getOrCreatePdf();
  const url = await updatePdf(pdfDoc);

  if (PandaBridge.isStudio) {
    await initPdfViewer(url);
  } else {
    console.log("Not in studio mode, TODO: implement non-studio behavior", url);
  }
}

// PandaBridge initialization
PandaBridge.init(() => {
  PandaBridge.onLoad((pandaData) => {
    setProperties(pandaData.properties);
    setMarkers(pandaData.markers);

    if (document.readyState === "complete") {
      onDomLoaded();
    } else {
      document.addEventListener("DOMContentLoaded", onDomLoaded, false);
    }
  });

  PandaBridge.onUpdate((pandaData) => {
    setProperties(pandaData.properties);
    setMarkers(pandaData.markers);
    syncInteractiveZones();
  });

  /* Markers */

  PandaBridge.getSnapshotData(() => null);

  PandaBridge.setSnapshotData(async ({ data, params }) => {
    const { id, page } = data || {};

    selectFromStudio(id, page);
  });
});
