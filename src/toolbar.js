import { changePage } from "./pdfService";
import { getTotalPages, setCurrentPage, getCurrentPage } from "./state";

/**
 * Initializes the toolbar for navigating through the PDF pages.
 */
export function initToolbar() {
  const totalPages = getTotalPages();
  const pageCount = document.getElementById("pageCount");
  pageCount.innerText = totalPages;

  const toolbar = document.getElementById("toolbar-content");
  toolbar.style.opacity = 1;

  const currentPageInput = document.getElementById("currentPageInput");
  currentPageInput.max = totalPages;

  currentPageInput.addEventListener("change", async (e) => {
    const pageNumber = parseInt(e.target.value, 10);
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      await changePage(pageNumber);
      setCurrentPage(pageNumber);
    } else {
      e.target.value = getCurrentPage();
    }
  });
}
