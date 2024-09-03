import { PDFDocument } from "pdf-lib";
import PandaBridge from "pandasuite-bridge";

import { initToolbar } from "./toolbar";
import {
  setOriginalPDFWidth,
  setOriginalPDFHeight,
  setCurrentPage,
} from "./state";
import {
  syncInteractiveZones,
  updateZonesOnTransform,
} from "./interactiveZones";
import { setTotalPages } from "./state";
import {
  getInfiniteViewer,
  initInfiniteViewer,
  MAX_ZOOM,
} from "./infiniteViewer";
import { initMoveable } from "./moveable";
import { initSelecto } from "./selecto";
import { getCurrentPage } from "./state";
import { setLastValidPage } from "./state";
import { setScaleFactor } from "./state";

let pdfDocViewer = null;

/**
 * Fetches the PDF URL from the provided path and JSON configuration.
 * @returns {Promise<string|null>} The URL of the PDF file or null if not found.
 */
export async function getPdfUrl() {
  const url = PandaBridge.resolvePath("document.pdf");
  if (!url) return null;

  try {
    const files = await fetch(`${url}.extract-content.json`).then((res) =>
      res.json(),
    );
    const file = files.find((f) => f.endsWith(".pdf"));
    return file ? `${url}${file}?no_redirect` : null;
  } catch {
    console.log("No extract-content.json file found at", url);
    return null;
  }
}

/**
 * Creates a new PDF or loads an existing one from the fetched URL.
 * @returns {Promise<PDFDocument>} The loaded or newly created PDF document.
 */
export async function getOrCreatePdf() {
  const url = await getPdfUrl();
  if (url) {
    const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
    return PDFDocument.load(existingPdfBytes);
  }
  return PDFDocument.create();
}

/**
 * Updates the PDF document and returns the blob URL for rendering.
 * @param {PDFDocument} pdfDoc The PDF document to update.
 * @returns {Promise<string>} The URL of the updated PDF blob.
 */
export async function updatePdf(pdfDoc) {
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/**
 * Initializes the PDF viewer with the given URL and sets up the viewer environment.
 * @param {string} url The URL of the PDF document.
 */
export async function initPdfViewer(url) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.entry");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  const { getDocument } = pdfjs;

  pdfDocViewer = await getDocument({ url }).promise;
  const total = pdfDocViewer.numPages;
  setTotalPages(total);
  setCurrentPage(1);
  initToolbar(total);

  await initInfiniteViewer();
  await initMoveable();
  await initSelecto();
  await renderPage(getCurrentPage());
  syncInteractiveZones();
}

/**
 * Changes the page in the PDF viewer and syncs the state.
 * @param {number} pageNumber The page number to change to.
 */
export async function changePage(pageNumber) {
  setCurrentPage(pageNumber);
  setLastValidPage(pageNumber);
  getInfiniteViewer().setZoom(1);
  setScaleFactor(1);
  await renderPage(pageNumber);
  syncInteractiveZones();
}

/**
 * Renders the specified page number in the PDF viewer.
 * @param {number} pageNumber The page number to render.
 */
async function renderPage(pageNumber) {
  const page = await pdfDocViewer.getPage(pageNumber);

  const viewport = page.getViewport({ scale: 1 });
  const container = document.getElementById("pdf-container");
  const canvas = document.getElementById("pdf-canvas");
  const context = canvas.getContext("2d");

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  const minScaleFactor = Math.min(
    containerWidth / viewport.width,
    containerHeight / viewport.height,
  );

  setOriginalPDFWidth(viewport.width);
  setOriginalPDFHeight(viewport.height);

  const resolutionScale = (window.devicePixelRatio || 1) * MAX_ZOOM;

  const scaledViewport = page.getViewport({
    scale: minScaleFactor * resolutionScale,
  });

  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  canvas.style.width = `${scaledViewport.width / resolutionScale}px`;
  canvas.style.height = `${scaledViewport.height / resolutionScale}px`;

  canvas.style.opacity = 0;
  await page.render({ canvasContext: context, viewport: scaledViewport });
  getInfiniteViewer().scrollCenter();
  canvas.style.opacity = 1;

  updateZonesOnTransform();
}
