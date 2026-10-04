#!/usr/bin/env node

/**
 * export.mjs — Converts .excalidraw JSON → SVG + PNG
 *
 * Usage: node export.mjs input.excalidraw [output-prefix]
 *   Produces: output-prefix.svg and output-prefix.png
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

// ── Color defaults ─────────────────────────────────────────────────────────────

const DEFAULT_FONT =
  'font-family="Virgil, Segoe UI Emoji, Helvetica, Arial, sans-serif"';

// ── SVG element renderers ──────────────────────────────────────────────────────

function renderRect(el) {
  const rx = el.roundness?.type === 3 ? 8 : 0;
  const dashArray =
    el.strokeStyle === "dashed" ? ' stroke-dasharray="8 4"' : "";
  return `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rx}" ry="${rx}" fill="${el.backgroundColor}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${el.opacity / 100}"${dashArray} />`;
}

function renderText(el) {
  const lines = el.text.split("\n");
  const lineHeight = el.fontSize * (el.lineHeight || 1.25);
  const totalTextHeight = lines.length * lineHeight;

  let anchorX, textAnchor;
  if (el.textAlign === "center") {
    anchorX = el.x + el.width / 2;
    textAnchor = "middle";
  } else if (el.textAlign === "right") {
    anchorX = el.x + el.width;
    textAnchor = "end";
  } else {
    anchorX = el.x;
    textAnchor = "start";
  }

  let startY;
  if (el.verticalAlign === "middle" && el.containerId) {
    // For bound text, vertically center within the container
    startY = el.y + (el.height - totalTextHeight) / 2 + el.fontSize;
  } else {
    startY = el.y + el.fontSize;
  }

  const tspans = lines
    .map(
      (line, i) =>
        `    <tspan x="${anchorX}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("\n");

  return `  <text x="${anchorX}" y="${startY}" ${DEFAULT_FONT} font-size="${el.fontSize}" fill="${el.strokeColor}" text-anchor="${textAnchor}">
${tspans}
  </text>`;
}

function renderArrow(el) {
  if (!el.points || el.points.length < 2) return "";

  const absPoints = el.points.map(([px, py]) => [el.x + px, el.y + py]);
  const pointsStr = absPoints.map(([px, py]) => `${px},${py}`).join(" ");

  return `  <polyline points="${pointsStr}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" marker-end="url(#arrowhead)" />`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node export.mjs <input.excalidraw> [output-prefix]");
    process.exit(1);
  }

  const outputPrefix =
    process.argv[3] || inputPath.replace(/\.excalidraw$/, "");
  const data = JSON.parse(readFileSync(inputPath, "utf-8"));
  const elements = data.elements.filter((el) => !el.isDeleted);

  if (elements.length === 0) {
    console.error("No elements found in file.");
    process.exit(1);
  }

  // Compute viewBox
  const padding = 40;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const el of elements) {
    if (el.type === "arrow" && el.points) {
      for (const [px, py] of el.points) {
        minX = Math.min(minX, el.x + px);
        minY = Math.min(minY, el.y + py);
        maxX = Math.max(maxX, el.x + px);
        maxY = Math.max(maxY, el.y + py);
      }
    } else if (el.x !== undefined && el.width !== undefined) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
  }

  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  // Render SVG
  const svgParts = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">`,
  );

  // Defs (arrowhead marker)
  svgParts.push(`  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#1e1e1e" />
    </marker>
  </defs>`);

  // Background
  const bgColor = data.appState?.viewBackgroundColor || "#ffffff";
  svgParts.push(
    `  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgColor}" />`,
  );

  // Render elements in order: rects first, then arrows, then text (for z-order)
  const rects = elements.filter((e) => e.type === "rectangle");
  const arrows = elements.filter((e) => e.type === "arrow");
  const texts = elements.filter((e) => e.type === "text");

  for (const el of rects) svgParts.push(renderRect(el));
  for (const el of arrows) svgParts.push(renderArrow(el));
  for (const el of texts) svgParts.push(renderText(el));

  svgParts.push("</svg>");

  const svgContent = svgParts.join("\n");
  const svgPath = `${outputPrefix}.svg`;
  writeFileSync(svgPath, svgContent);
  console.log(`Exported ${svgPath}`);

  // Attempt PNG via sharp
  try {
    const sharp = (await import("sharp")).default;
    const pngPath = `${outputPrefix}.png`;
    const scale = 2;
    await sharp(Buffer.from(svgContent))
      .resize(Math.round(vbW * scale), Math.round(vbH * scale))
      .png()
      .toFile(pngPath);
    console.log(`Exported ${pngPath}`);
  } catch (err) {
    console.warn(
      "PNG export skipped (sharp unavailable):",
      err.message,
    );
    console.log("SVG export completed successfully.");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
