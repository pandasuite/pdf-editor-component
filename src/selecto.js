import { setTargets, getMoveable } from "./moveable";
import { addInteractiveZone } from "./interactiveZones";
import { getMarkers } from "./state";
import PandaBridge from "pandasuite-bridge";
import { changePage } from "./pdfService";
import { getCurrentPage } from "./state";

let selecto = null;

/**
 * Initializes the Selecto component to allow selection of interactive zones.
 */
export async function initSelecto() {
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
    const markers = getMarkers();
    const marker = markers.find((m) => m.id === e.inputEvent.target.id);

    if (marker) {
      PandaBridge.send(PandaBridge.UPDATED, {
        markers: marker,
      });
    } else {
      deselectAll();
    }
  });

  selecto.on("dragStart", (e) => {
    const { inputEvent } = e;
    const { target } = inputEvent;
    const moveable = getMoveable();

    if (
      moveable.isMoveableElement(target) ||
      moveable.target.some((t) => t === target || t.contains(target))
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
    }
    setTargets(e.selected);
  });
}

export async function selectFromStudio(id, page) {
  if (getMoveable()) {
    if (!id) {
      return setTargets([]);
    }
    if (getCurrentPage() !== page) {
      const currentPageInput = document.getElementById("currentPageInput");
      currentPageInput.value = page;
      await changePage(page);
    }
    const element = document.getElementById(id);
    if (element) {
      return setTargets([element]);
    }
  }
}

/**
 * Deselects all targets and notifies Studio that the zones are deselected.
 */
export function deselectAll() {
  setTargets([]);
  PandaBridge.send(PandaBridge.UPDATED, {
    markers: null,
  });
}
