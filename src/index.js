import PandaBridge from "pandasuite-bridge";
import isEqual from "lodash/isEqual";
import debounce from "lodash/debounce";

import "./index.css";
import {
  initPdfViewer,
  getOrCreatePdf,
  updatePdf,
  reloadPdf,
} from "./pdfService";
import { setMarkers, setProperties } from "./state";
import { selectFromStudio } from "./selecto";
import { getMarkers } from "./state";
import { getMoveable } from "./moveable";

let markerToSelect = null;

/**
 * Function to handle the DOM loaded event.
 * It initializes the PDF and sets up the viewer.
 */
async function onDomLoaded() {
  if (PandaBridge.isStudio) {
    await initPdfViewer();

    if (markerToSelect) {
      selectFromStudio(markerToSelect.id, markerToSelect.page);
      markerToSelect = null;
    }
  }
}

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

  PandaBridge.onUpdate(async (pandaData) => {
    const markers = getMarkers();

    setProperties(pandaData.properties);
    setMarkers(pandaData.markers);

    if (PandaBridge.isStudio) {
      const markersChanged = !isEqual(pandaData.markers, markers);

      if (markersChanged) {
        debounce(() => {
          reloadPdf();
        }, 100)();
      }
    }
  });

  /* Markers */

  PandaBridge.getSnapshotData(() => null);

  PandaBridge.setSnapshotData(({ data, params }) => {
    const { id, page } = data || {};

    if (getMoveable()) {
      selectFromStudio(id, page);
    } else {
      markerToSelect = { id, page };
    }
  });

  /* Actions */

  PandaBridge.listen("download", async ([params] = []) => {
    const { fileName = "generated-panda-file.pdf" } = params || {};
    const pdfDoc = await getOrCreatePdf();
    const url = await updatePdf(pdfDoc);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
});
