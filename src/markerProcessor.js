import { rgb, StandardFonts } from "pdf-lib";
import { parseColor } from "./utils";

/**
 * Processes the markers to replace zones with text or images based on their type.
 * @param {PDFDocument} pdfDoc - The PDF document to modify.
 * @param {Array} markers - The list of markers to process.
 */
export async function processMarkers(pdfDoc, markers) {
  for (const marker of markers) {
    switch (marker.type) {
      case "text":
        await replaceZoneWithText(pdfDoc, marker);
        break;
      case "image":
        await replaceZoneWithImage(pdfDoc, marker);
        break;
      default:
        console.warn(`Unknown marker type: ${marker.type}`);
    }
  }
}

/**
 * Replaces a marker zone with text, resizing and centering it within the specified area,
 * handling multiline text if necessary.
 * @param {PDFDocument} pdfDoc - The PDF document to modify.
 * @param {Object} marker - The marker object containing the zone details and text content.
 * @param {string} marker.align - The horizontal alignment of the text within the box ('left', 'center', 'right').
 * @param {string} marker.verticalAlign - The vertical alignment of the text within the box ('top', 'center', 'bottom').
 */
async function replaceZoneWithText(pdfDoc, marker) {
  const {
    page,
    position,
    width,
    height,
    content = "",
    align = "center",
    verticalAlign = "top",
    fontName = StandardFonts.Helvetica,
    color = "#000000",
  } = marker;
  let { fontSize = 12 } = marker;
  const pdfPage = pdfDoc.getPage(page - 1); // Zero-based page index

  const font = await pdfDoc.embedFont(fontName);
  let lines = [];
  let textHeight = font.heightAtSize(fontSize);

  function splitTextIntoLines(text, font, fontSize, maxWidth) {
    const words = text.split(" ");
    let currentLine = "";
    const result = [];

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testLineWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) {
      result.push(currentLine);
    }

    return result;
  }

  do {
    lines = splitTextIntoLines(content, font, fontSize, width);
    textHeight = font.heightAtSize(fontSize);

    const totalTextHeight = lines.length * textHeight;

    if (
      totalTextHeight <= height &&
      Math.max(
        ...lines.map((line) => font.widthOfTextAtSize(line, fontSize)),
      ) <= width
    ) {
      break;
    }

    fontSize -= 0.5;
  } while (fontSize > 1);

  let initialYPosition;
  const totalTextHeight = lines.length * textHeight;

  const convertedY = pdfPage.getHeight() - position.y;
  if (verticalAlign === "top") {
    initialYPosition = convertedY - textHeight;
  } else if (verticalAlign === "bottom") {
    initialYPosition = convertedY - height + totalTextHeight - textHeight;
  } else {
    initialYPosition = convertedY - (height - totalTextHeight) / 2 - textHeight;
  }

  const textColor = parseColor(color);

  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, fontSize);
    let xPosition;

    if (align === "left") {
      xPosition = position.x;
    } else if (align === "right") {
      xPosition = position.x + (width - lineWidth);
    } else {
      xPosition = position.x + (width - lineWidth) / 2;
    }

    const yPosition = initialYPosition - index * textHeight;

    pdfPage.drawText(line, {
      x: xPosition,
      y: yPosition,
      size: fontSize,
      font,
      color: rgb(textColor.r / 255, textColor.g / 255, textColor.b / 255),
    });
  });
}

/**
 * Replaces a marker zone with an image, adjusted according to the specified fit option.
 * @param {PDFDocument} pdfDoc - The PDF document to modify.
 * @param {Object} marker - The marker object containing the zone details and image content.
 */
async function replaceZoneWithImage(pdfDoc, marker) {
  const { page, position, useUrl, width, height, fit = "contain" } = marker;
  let { imageUrl } = marker;
  const pdfPage = pdfDoc.getPage(page - 1);

  if (!useUrl) {
    imageUrl = marker.image;
  }

  const response = await fetch(imageUrl).catch((error) => {
    console.error(error);
    return null;
  });
  if (!response?.ok) {
    return;
  }

  const contentType = response.headers.get("Content-Type");
  const imageBytes = await response.arrayBuffer();

  let image;
  let imageWidth, imageHeight;

  if (contentType === "image/jpeg") {
    image = await pdfDoc.embedJpg(imageBytes);
    imageWidth = image.width;
    imageHeight = image.height;
  } else if (contentType === "image/png") {
    image = await pdfDoc.embedPng(imageBytes);
    imageWidth = image.width;
    imageHeight = image.height;
  } else {
    console.warn(`Unsupported image type: ${contentType}`);
    return;
  }

  const adjustedY = pdfPage.getHeight() - position.y - height;

  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  const aspectRatio = imageWidth / imageHeight;
  const zoneAspectRatio = width / height;

  if (fit === "contain") {
    if (aspectRatio > zoneAspectRatio) {
      drawWidth = width;
      drawHeight = width / aspectRatio;
      offsetY = (height - drawHeight) / 2;
    } else {
      drawHeight = height;
      drawWidth = height * aspectRatio;
      offsetX = (width - drawWidth) / 2;
    }
  } else if (fit === "cover") {
    if (aspectRatio > zoneAspectRatio) {
      drawHeight = height;
      drawWidth = height * aspectRatio;
      offsetX = (width - drawWidth) / 2;
    } else {
      drawWidth = width;
      drawHeight = width / aspectRatio;
      offsetY = (height - drawHeight) / 2;
    }
  } else if (fit === "stretch") {
    drawWidth = width;
    drawHeight = height;
  }

  pdfPage.drawImage(image, {
    x: position.x + offsetX,
    y: adjustedY + offsetY,
    width: drawWidth,
    height: drawHeight,
  });
}
