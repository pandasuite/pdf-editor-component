import PandaBridge from "pandasuite-bridge";
import "./index.css";
import { PDFDocument } from "pdf-lib";

let pdfDocViewer = null;
let infiniteViewer = null;
let moveable = null;
let selecto = null;
let targets = [];

let totalPages = 0;
let currentPage = 1;
let lastValidPage = 1;

let scaleFactor = 1;
let panOffset = { x: 0, y: 0 };
let originalPDFWidth = 0;
let originalPDFHeight = 0;
const minZoom = 0.5;
const maxZoom = 3;

let properties = null;
let markers = null;

async function getPdfUrl() {
  const url = PandaBridge.resolvePath("document.pdf");

  if (!url) {
    return null;
  }

  const files = await fetch(`${url}.extract-content.json`)
    .then((res) => res.json())
    .catch(() => {
      console.log("No extract-content.json file", url);
      return null;
    });

  if (files) {
    const file = files.find((f) => f.endsWith(".pdf"));

    if (file) {
      return `${url}${file}?no_redirect`;
    }
  }
  return null;
}

async function getOrCreatePdf() {
  const url = await getPdfUrl();

  if (url) {
    const existingPdfBytes = await fetch(url).then((res) => res.arrayBuffer());
    return PDFDocument.load(existingPdfBytes);
  }
  return PDFDocument.create();
}

async function updatePdf(pdfDoc) {
  const form = pdfDoc.getForm();
  const fields = form?.getFields();
  // loop through the fields and print their names and values
  fields.forEach((field) => {
    // field.enableReadOnly();
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  return url;
}

async function changePage(pageNumber) {
  currentPage = pageNumber;
  lastValidPage = pageNumber;
  infiniteViewer.setZoom(1);
  scaleFactor = 1;
  await renderPage(pageNumber);
  syncInteractiveZones();
}

function initToolbar() {
  const pageCount = document.getElementById("pageCount");
  pageCount.innerText = totalPages;

  const toolbar = document.getElementById("toolbar-content");
  toolbar.style.opacity = 1;

  const currentPageInput = document.getElementById("currentPageInput");
  currentPageInput.max = totalPages;

  currentPageInput.addEventListener("change", async (e) => {
    const pageNumber = parseInt(e.target.value, 10);
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      changePage(pageNumber);
    } else {
      e.target.value = lastValidPage;
    }
  });
}

async function initPdfViewer(url) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.entry");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  const { getDocument } = pdfjs;

  pdfDocViewer = await getDocument({ url }).promise;
  totalPages = pdfDocViewer.numPages;
  initToolbar();

  await initInfiniteViewer();
  await initMoveable();
  await initSelecto();
  await renderPage(currentPage);
  syncInteractiveZones();
}

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

  originalPDFWidth = viewport.width;
  originalPDFHeight = viewport.height;

  const resolutionScale = (window.devicePixelRatio || 1) * maxZoom;

  const scaledViewport = page.getViewport({
    scale: minScaleFactor * resolutionScale,
  });

  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  canvas.style.width = `${scaledViewport.width / resolutionScale}px`;
  canvas.style.height = `${scaledViewport.height / resolutionScale}px`;

  canvas.style.opacity = 0;
  await page.render({ canvasContext: context, viewport: scaledViewport });
  infiniteViewer.scrollCenter();
  canvas.style.opacity = 1;

  updateZonesOnTransform();
}

function addInteractiveZone(rect, existingId = null) {
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
    updateMarkerFromPosition(marker, position, true);
    updateZoneStyle(newDiv, position, containerRect);
  } else {
    updateZonesOnTransform();
  }
}

function syncInteractiveZones() {
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
    }
  });
}

function updateMarkerFromPosition(marker, position, sendEvent = false) {
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
  marker.page = currentPage;

  if (sendEvent && isChanged) {
    PandaBridge.send(PandaBridge.UPDATED, {
      markers: marker,
    });
  }
}

function updateZoneStyle(zone, position, containerRect) {
  const scaleX = containerRect.width / originalPDFWidth;
  const scaleY = containerRect.height / originalPDFHeight;

  const absoluteX = position.x * scaleX - panOffset.x * scaleFactor;
  const absoluteY = position.y * scaleY - panOffset.y * scaleFactor;
  const absoluteWidth = position.width * scaleX;
  const absoluteHeight = position.height * scaleY;

  zone.style.transform = `translate(${absoluteX}px, ${absoluteY}px)`;
  zone.style.width = `${absoluteWidth}px`;
  zone.style.height = `${absoluteHeight}px`;
}

function updateZonesOnTransform() {
  if (moveable.target.length > 0) {
    setTargets([]);
    deselectStudio();
  }

  const containerRect = document
    .getElementById("pdf-canvas")
    .getBoundingClientRect();

  document.querySelectorAll(".zone-interactive").forEach((zone, index) => {
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

async function initInfiniteViewer() {
  const { default: InfiniteViewer } = await import("infinite-viewer");

  infiniteViewer = new InfiniteViewer(
    document.getElementById("pdf-container"),
    {
      zoom: 1,
      usePinch: true,
      useWheelScroll: true,
      useAutoZoom: true,
      zoomRange: [minZoom, maxZoom],
      useTransform: true,
    },
  );

  infiniteViewer.on("scroll", (e) => {
    panOffset = { x: e.scrollLeft, y: e.scrollTop };
    updateZonesOnTransform();
  });

  infiniteViewer.on("pinch", (e) => {
    scaleFactor = e.zoom;
    updateZonesOnTransform();
  });
}

function setTargets(newTargets) {
  targets = newTargets;
  moveable.target = targets;
}

async function initMoveable() {
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

function deselectStudio() {
  PandaBridge.send(PandaBridge.UPDATED, {
    markers: null,
  });
}

async function initSelecto() {
  const { default: Selecto } = await import("selecto");

  selecto = new Selecto({
    container: document.body,
    selectableTargets: [".zone-interactive"],
    selectByClick: true,
    selectFromInside: false,
    hitRate: 0,
    ratio: 0,
  });

  selecto.on("select", (e) => {
    const marker = markers.find((m) => m.id === e.inputEvent.target.id);

    if (marker) {
      PandaBridge.send(PandaBridge.UPDATED, {
        markers: marker,
      });
    } else {
      deselectStudio();
    }
  });

  selecto.on("dragStart", (e) => {
    const { inputEvent } = e;
    const { target } = inputEvent;

    if (
      moveable.isMoveableElement(target) ||
      targets.some((t) => t === target || t.contains(target))
    ) {
      e.stop();
    }
  });

  selecto.on("dragEnd", (e) => {
    if (
      e.inputEvent.target.className.includes("zone-interactive") ||
      !e.isDrag ||
      e.rect.width < 2 ||
      e.rect.height < 2
    ) {
      return;
    }
    addInteractiveZone(e.rect);
  });

  selecto.on("selectEnd", (e) => {
    if (e.isDragStart) {
      e.inputEvent.preventDefault();
      moveable.waitToChangeTarget().then(() => {
        moveable.dragStart(e.inputEvent);
      });
    }
    setTargets(e.selected);
  });
}

function calculatePosition(rect, containerRect) {
  const x =
    (rect.left - containerRect.left) * (originalPDFWidth / containerRect.width);
  const y =
    (rect.top - containerRect.top) * (originalPDFHeight / containerRect.height);
  const width = (rect.width / containerRect.width) * originalPDFWidth;
  const height = (rect.height / containerRect.height) * originalPDFHeight;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function updatePositions() {
  const containerRect = document
    .getElementById("pdf-canvas")
    .getBoundingClientRect();

  document.querySelectorAll(".zone-interactive").forEach((zone) => {
    const rect = zone.getBoundingClientRect();
    const position = calculatePosition(rect, containerRect);
    const marker = markers.find((m) => m.id === zone.id);

    if (marker) {
      updateMarkerFromPosition(marker, position, true);
    }
  });
}

async function onDomLoaded() {
  const pdfDoc = await getOrCreatePdf();
  const url = await updatePdf(pdfDoc);
  initPdfViewer(url);
}

PandaBridge.init(() => {
  PandaBridge.onLoad((pandaData) => {
    properties = pandaData.properties;
    markers = pandaData.markers;

    if (document.readyState === "complete") {
      onDomLoaded();
    } else {
      document.addEventListener("DOMContentLoaded", onDomLoaded, false);
    }
  });

  PandaBridge.onUpdate((pandaData) => {
    properties = pandaData.properties;
    markers = pandaData.markers;
    syncInteractiveZones();
    if (moveable?.target?.length > 0) {
      moveable.updateTarget();
    }
  });

  /* Markers */

  PandaBridge.getSnapshotData(() => null);

  PandaBridge.setSnapshotData(async ({ data, params }) => {
    const { id, page } = data || {};

    if (moveable) {
      if (!id) {
        return setTargets([]);
      }
      if (currentPage !== page) {
        const currentPageInput = document.getElementById("currentPageInput");
        currentPageInput.value = page;
        await changePage(page);
      }
      const element = document.getElementById(id);
      if (element) {
        return setTargets([element]);
      }
    }
  });

  /* Actions */

  PandaBridge.listen("changeColor", (args) => {});

  PandaBridge.synchronize("synchroImages", (percent) => {});
});
