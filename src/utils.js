import PandaBridge from "pandasuite-bridge";
import {
  getOriginalPDFWidth,
  getOriginalPDFHeight,
  getCurrentPage,
} from "./state";

/**
 * Calculates the position of an interactive zone based on the container's dimensions.
 * @param {Object} rect The dimensions of the interactive zone.
 * @param {Object} containerRect The dimensions of the container.
 * @returns {Object} The calculated position of the zone.
 */
export function calculatePosition(rect, containerRect) {
  const x =
    (rect.left - containerRect.left) *
    (getOriginalPDFWidth() / containerRect.width);
  const y =
    (rect.top - containerRect.top) *
    (getOriginalPDFHeight() / containerRect.height);
  const width = (rect.width / containerRect.width) * getOriginalPDFWidth();
  const height = (rect.height / containerRect.height) * getOriginalPDFHeight();

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Updates the position and size of a marker based on the new coordinates.
 * @param {Object} marker The marker to update.
 * @param {Object} position The new coordinates of the marker.
 * @param {boolean} sendEvent Indicates whether to send an update event.
 */
export function updateMarkerFromPosition(marker, position, sendEvent = false) {
  const isChanged =
    !marker.position ||
    marker.position.x !== position.x ||
    marker.position.y !== position.y ||
    marker.width !== position.width ||
    marker.height !== position.height;

  marker.position = {
    x: position.x,
    y: position.y,
  };
  marker.width = position.width;
  marker.height = position.height;
  marker.page = getCurrentPage();

  if (sendEvent && isChanged) {
    PandaBridge.send(PandaBridge.UPDATED, {
      markers: marker,
    });
  }
}
