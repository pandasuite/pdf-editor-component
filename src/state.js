let markers = [];
let properties = {};

let currentPage = 1;
let lastValidPage = 1;
let totalPages = 0;

let originalPDFWidth = 0;
let originalPDFHeight = 0;
let panOffset = { x: 0, y: 0 };
let scaleFactor = 1;

export function getMarkers() {
  return markers;
}

export function setMarkers(newMarkers) {
  markers = newMarkers;
}

export function getProperties() {
  return properties;
}

export function setProperties(newProperties) {
  properties = newProperties;
}

export function getCurrentPage() {
  return currentPage;
}

export function setCurrentPage(page) {
  currentPage = page;
}

export function getLastValidPage() {
  return lastValidPage;
}

export function setLastValidPage(page) {
  lastValidPage = page;
}

export function getOriginalPDFWidth() {
  return originalPDFWidth;
}

export function setOriginalPDFWidth(width) {
  originalPDFWidth = width;
}

export function getOriginalPDFHeight() {
  return originalPDFHeight;
}

export function setOriginalPDFHeight(height) {
  originalPDFHeight = height;
}

export function getPanOffset() {
  return panOffset;
}

export function setPanOffset(offset) {
  panOffset = offset;
}

export function getScaleFactor() {
  return scaleFactor;
}

export function setScaleFactor(factor) {
  scaleFactor = factor;
}

export function getTotalPages() {
  return totalPages;
}

export function setTotalPages(pages) {
  totalPages = pages;
}
