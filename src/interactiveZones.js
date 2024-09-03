import { set } from "lodash";
import { getMoveable, setTargets } from "./moveable";
import {
  getMarkers,
  setMarkers,
  getCurrentPage,
  getOriginalPDFWidth,
  getOriginalPDFHeight,
  getPanOffset,
  getScaleFactor,
} from "./state";
import { calculatePosition, updateMarkerFromPosition } from "./utils";

/**
 * Adds an interactive zone to the PDF.
 * @param {Object} rect The dimensions of the zone.
 * @param {string|null} existingId The unique identifier of the zone, or null if it's a new zone.
 */
export function addInteractiveZone(rect, existingId = null) {
  const markers = getMarkers();
  const uniqueId = existingId
    ? existingId
    : Date.now().toString(36) + Math.random().toString(36).substring(2);

  const newDiv = document.createElement("div");
  newDiv.className = "zone-interactive";
  newDiv.id = uniqueId;
  document.getElementById("pdf-container").appendChild(newDiv);

  if (existingId == null) {
    const containerRect = document
      .getElementById("pdf-canvas")
      .getBoundingClientRect();
    const position = calculatePosition(rect, containerRect);
    const marker = { id: uniqueId };

    markers.push(marker);
    setMarkers(markers);
    updateMarkerFromPosition(marker, position, true);
    updateZoneStyle(newDiv, position, containerRect);
  } else {
    updateZonesOnTransform();
  }
}

/**
 * Synchronizes the interactive zones with the markers and the current page.
 */
export function syncInteractiveZones() {
  const markers = getMarkers();
  const currentPage = getCurrentPage();
  const containerRect = document
    .getElementById("pdf-canvas")
    .getBoundingClientRect();

  markers.forEach((marker) => {
    if (marker.page !== currentPage) {
      return;
    }

    const zone = document.getElementById(marker.id);
    if (zone) {
      updateZoneStyle(
        zone,
        {
          x: marker.position.x,
          y: marker.position.y,
          width: marker.width,
          height: marker.height,
        },
        containerRect,
      );
    } else {
      addInteractiveZone(
        {
          left: marker.position.x,
          top: marker.position.y,
          width: marker.width,
          height: marker.height,
        },
        marker.id,
      );
    }
  });

  document.querySelectorAll(".zone-interactive").forEach((zone) => {
    const marker = markers.find((m) => m.id === zone.id);
    if (!marker || marker.page !== currentPage) {
      zone.remove();
      if (getMoveable().target.find((t) => t === zone)) {
        setTargets([]);
      }
    }
  });
}

/**
 * Updates the style of an interactive zone based on its position and the container's dimensions.
 * @param {HTMLElement} zone The interactive zone to update.
 * @param {Object} position The new coordinates of the zone.
 * @param {Object} containerRect The dimensions of the zone's container.
 */
function updateZoneStyle(zone, position, containerRect) {
  const scaleX = containerRect.width / getOriginalPDFWidth();
  const scaleY = containerRect.height / getOriginalPDFHeight();
  const panOffset = getPanOffset();
  const scaleFactor = getScaleFactor();

  const absoluteX = position.x * scaleX - panOffset.x * scaleFactor;
  const absoluteY = position.y * scaleY - panOffset.y * scaleFactor;
  const absoluteWidth = position.width * scaleX;
  const absoluteHeight = position.height * scaleY;

  zone.style.transform = `translate(${absoluteX}px, ${absoluteY}px)`;
  zone.style.width = `${absoluteWidth}px`;
  zone.style.height = `${absoluteHeight}px`;
}

/**
 * Updates the zones when a transformation (scrolling, zooming) occurs.
 */
export function updateZonesOnTransform() {
  const markers = getMarkers();
  const containerRect = document
    .getElementById("pdf-canvas")
    .getBoundingClientRect();

  document.querySelectorAll(".zone-interactive").forEach((zone) => {
    const marker = markers.find((m) => m.id === zone.id);

    if (marker) {
      updateZoneStyle(
        zone,
        {
          x: marker.position.x,
          y: marker.position.y,
          width: marker.width,
          height: marker.height,
        },
        containerRect,
      );
    }
  });
}

/**
 * Updates the positions of markers based on the current positions of interactive zones.
 */
export function updatePositions() {
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
