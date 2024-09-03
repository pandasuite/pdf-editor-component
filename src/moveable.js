import { getMarkers } from "./state";
import { calculatePosition, updateMarkerFromPosition } from "./utils";

let moveable = null;
let targets = [];

/**
 * Initializes the Moveable component to enable dragging and resizing of interactive zones.
 */
export async function initMoveable() {
  const { default: Moveable } = await import("moveable");

  moveable = new Moveable(document.body, {
    target: targets,
    draggable: true,
    resizable: true,
    keepRatio: false,
  });

  moveable.on("drag", (e) => {
    e.target.style.transform = e.transform;
  });

  moveable.on("dragEnd", () => {
    updatePositions();
  });

  moveable.on("resize", (e) => {
    e.target.style.width = `${e.width}px`;
    e.target.style.height = `${e.height}px`;
    e.target.style.transform = e.drag.transform;
  });

  moveable.on("resizeEnd", () => {
    updatePositions();
  });
}

/**
 * Returns the current instance of Moveable.
 * @returns {Object} The current Moveable instance.
 */
export function getMoveable() {
  return moveable;
}

/**
 * Updates the targets of Moveable with new targets.
 * @param {Array} newTargets The new targets to manipulate.
 */
export function setTargets(newTargets) {
  targets = newTargets;
  if (moveable) {
    moveable.target = targets;
  }
}

/**
 * Updates the positions of markers based on the current positions of interactive zones.
 */
function updatePositions() {
  const containerRect = document
    .getElementById("pdf-canvas")
    .getBoundingClientRect();

  document.querySelectorAll(".zone-interactive").forEach((zone) => {
    const rect = zone.getBoundingClientRect();
    const position = calculatePosition(rect, containerRect);
    const markers = getMarkers();
    const marker = markers.find((m) => m.id === zone.id);

    if (marker) {
      updateMarkerFromPosition(marker, position, true);
    }
  });
}
