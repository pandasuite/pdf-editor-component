import { setPanOffset, setScaleFactor } from "./state";
import { updateZonesOnTransform } from "./interactiveZones";
import { deselectAll } from "./selecto";

let infiniteViewer = null;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;

/**
 * Initializes the Infinite Viewer to enable zoom and scrolling for the PDF.
 */
export async function initInfiniteViewer() {
  const { default: InfiniteViewer } = await import("infinite-viewer");
  const container = document.getElementById("pdf-container");

  infiniteViewer = new InfiniteViewer(container, {
    zoom: 1,
    usePinch: true,
    useWheelScroll: true,
    useAutoZoom: true,
    zoomRange: [MIN_ZOOM, MAX_ZOOM],
    useTransform: true,
  });

  infiniteViewer.on("scroll", (e) => {
    setPanOffset({ x: e.scrollLeft, y: e.scrollTop });
    deselectAll();
    updateZonesOnTransform();
  });

  infiniteViewer.on("pinch", (e) => {
    setScaleFactor(e.zoom);
    deselectAll();
    updateZonesOnTransform();
  });
}

/**
 * Retrieves the current Infinite Viewer instance.
 * @returns {Object} The current Infinite Viewer instance.
 */
export function getInfiniteViewer() {
  return infiniteViewer;
}
