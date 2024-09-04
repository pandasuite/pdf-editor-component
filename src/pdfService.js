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
import { getMarkers } from "./state";
import { processMarkers } from "./markerProcessor";
import { getProperties } from "./state";

let pdfDocViewer = null;
let currentRenderTask = null;

/**
 * Fetches the PDF URL from the provided path and JSON configuration.
 * @returns {Promise<string|null>} The URL of the PDF file or null if not found.
 */
export async function getPdfUrl() {
  const properties = getProperties();

  if (!properties.newDocument) {
    const url = PandaBridge.resolvePath("document.pdf");
    if (url) {
      return `${url}${properties.fileName}?no_redirect`;
    }
  }
  return null;
}

/**
 * Creates a new PDF or loads an existing one from the fetched URL.
 * @returns {Promise<PDFDocument>} The loaded or newly created PDF document.
 */
export async function getOrCreatePdf() {
  const { width, height } = getProperties();
  const url = await getPdfUrl();

  if (url) {
    const existingPdfBytes = await fetch(url)
      .then((res) => {
        if (res.ok) {
          return res.arrayBuffer();
        }
        return null;
      })
      .catch((e) => {
        console.error(e);
        return null;
      });
    if (existingPdfBytes) {
      return PDFDocument.load(existingPdfBytes);
    }
  }
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([width, height]);

  return pdfDoc;
}

/**
 * Updates the PDF document and returns the blob URL for rendering.
 * @param {PDFDocument} pdfDoc The PDF document to update.
 * @returns {Promise<string>} The URL of the updated PDF blob.
 */
export async function updatePdf(pdfDoc, { blob: useBlob = false } = {}) {
  const markers = getMarkers();
  await processMarkers(pdfDoc, markers);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  if (useBlob) {
    return blob;
  }
  return URL.createObjectURL(blob);
}

async function initPdfDocViewer() {
  const pdfDoc = await getOrCreatePdf();
  const url = await updatePdf(pdfDoc);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.entry");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  const { getDocument } = pdfjs;

  pdfDocViewer = await getDocument({ url }).promise;
  URL.revokeObjectURL(url);
  const total = pdfDocViewer.numPages;
  setTotalPages(total);
}

/**
 * Initializes the PDF viewer and sets up the viewer environment.
 */
export async function initPdfViewer() {
  await initPdfDocViewer();

  setCurrentPage(1);
  initToolbar();

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
async function renderPage(pageNumber, withTransform = true) {
  try {
    if (currentRenderTask) {
      currentRenderTask.cancel();
      currentRenderTask = null;
    }

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
    currentRenderTask = page.render({
      canvasContext: context,
      viewport: scaledViewport,
    });
    await currentRenderTask.promise;
    currentRenderTask = null;
    if (withTransform) {
      getInfiniteViewer().scrollCenter();
    }
    canvas.style.opacity = 1;

    if (withTransform) {
      updateZonesOnTransform();
    }
  } catch (error) {
    if (error.name === "RenderingCancelledException") {
      console.log("Render canceled, a new one has started.");
    } else {
      console.error("Error while rendering the page:", error);
    }
  }
}

/**
 * Reloads the updated PDF in the viewer and restores the previous state.
 */
export async function reloadPdf() {
  await initPdfDocViewer();
  await renderPage(getCurrentPage(), false);
  syncInteractiveZones();
}
