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

/**
 * Converts a color string (hex, rgb) into the appropriate RGB format for pdf-lib.
 * @param {string} color - The color string (e.g., "#ff0000" or "rgb(255, 0, 0)").
 * @returns {Object} An object with r, g, b values between 0 and 1 for pdf-lib's rgb function.
 */
export function parseColor(color) {
  let r = 0,
    g = 0,
    b = 0;

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (color.startsWith("rgb")) {
    const values = color.match(/\d+/g);
    if (values && values.length === 3) {
      [r, g, b] = values.map(Number);
    }
  }

  return { r, g, b };
}
