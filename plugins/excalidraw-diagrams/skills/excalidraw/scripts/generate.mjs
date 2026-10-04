#!/usr/bin/env node

/**
 * generate.mjs — Converts IR JSON (stdin) → Excalidraw JSON file
 *
 * Usage: cat ir.json | node generate.mjs output.excalidraw
 */

import dagre from "@dagrejs/dagre";
import { randomUUID, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";

// ── Color palette ──────────────────────────────────────────────────────────────

const PALETTE = {
  blue:   { bg: "#a5d8ff", stroke: "#1971c2" },
  green:  { bg: "#b2f2bb", stroke: "#2f9e44" },
  orange: { bg: "#ffd8a8", stroke: "#e8590c" },
  red:    { bg: "#ffc9c9", stroke: "#e03131" },
  purple: { bg: "#d0bfff", stroke: "#7048e8" },
  yellow: { bg: "#ffec99", stroke: "#f08c00" },
  gray:   { bg: "#dee2e6", stroke: "#495057" },
};

// ── Text sizing helpers ────────────────────────────────────────────────────────

function estimateTextSize(label) {
  const lines = label.split("\n");
  const maxLineLen = Math.max(...lines.map((l) => l.length));
  const width = Math.min(Math.max(maxLineLen * 10, 120), 280);
  const height = 40 + lines.length * 24;
  return { width, height };
}

// ── Excalidraw element factories ───────────────────────────────────────────────

function makeRect(id, x, y, w, h, color, boundElementIds) {
  const c = PALETTE[color] || PALETTE.gray;
  return {
    id,
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: c.stroke,
    backgroundColor: c.bg,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: randomInt(1, 2147483647),
    version: 1,
    versionNonce: randomInt(1, 2147483647),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    boundElements: boundElementIds.map((eid) => ({
      id: eid,
      type: eid.startsWith("text-") ? "text" : "arrow",
    })),
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function makeText(id, containerId, text, x, y, w, h, strokeColor) {
  return {
    id,
    type: "text",
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: randomInt(1, 2147483647),
    version: 1,
    versionNonce: randomInt(1, 2147483647),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text,
    fontSize: 16,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    containerId,
    originalText: text,
    autoResize: true,
    lineHeight: 1.25,
  };
}

function makeArrow(id, points, startBinding, endBinding, label) {
  const el = {
    id,
    type: "arrow",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: randomInt(1, 2147483647),
    version: 1,
    versionNonce: randomInt(1, 2147483647),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    points,
    lastCommittedPoint: null,
    startBinding,
    endBinding,
    startArrowhead: null,
    endArrowhead: "arrow",
  };

  if (label) {
    const labelId = `text-${id}`;
    el.boundElements = [{ id: labelId, type: "text" }];
  }

  return el;
}

function makeGroupBox(id, x, y, w, h, label) {
  const groupId = `grp-${id}`;
  const textId = `text-grpbox-${id}`;
  const rect = {
    id,
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: "#495057",
    backgroundColor: "#f8f9fa",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roughness: 1,
    opacity: 60,
    seed: randomInt(1, 2147483647),
    version: 1,
    versionNonce: randomInt(1, 2147483647),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    boundElements: [{ id: textId, type: "text" }],
    updated: Date.now(),
    link: null,
    locked: false,
  };

  const textEl = {
    id: textId,
    type: "text",
    x: x + 8,
    y: y + 8,
    width: w - 16,
    height: 24,
    angle: 0,
    strokeColor: "#495057",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: randomInt(1, 2147483647),
    version: 1,
    versionNonce: randomInt(1, 2147483647),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text: label,
    fontSize: 14,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: label,
    autoResize: true,
    lineHeight: 1.25,
  };

  return { rect, textEl, groupId };
}

// ── Main pipeline ──────────────────────────────────────────────────────────────

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    console.error("Usage: cat ir.json | node generate.mjs <output.excalidraw>");
    process.exit(1);
  }

  // Read IR from stdin
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const ir = JSON.parse(input);
  const direction = ir.direction || "TB";
  const nodes = ir.nodes || [];
  const edges = ir.edges || [];
  const groups = ir.groups || [];

  // Build dagre graph
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Map node IDs to their data and element IDs
  const nodeMap = new Map();
  for (const node of nodes) {
    const size = estimateTextSize(node.label);
    const rectId = `rect-${node.id}`;
    const textId = `text-${node.id}`;
    nodeMap.set(node.id, { ...node, rectId, textId, ...size });
    g.setNode(node.id, { width: size.width + 40, height: size.height + 20 });
  }

  for (const edge of edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  // Collect all Excalidraw elements
  const elements = [];

  // ── Groups ─────────────────────────────────────────────────────────────────
  const groupMemberPositions = new Map();

  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    const info = nodeMap.get(node.id);
    const x = dagreNode.x - (info.width + 40) / 2;
    const y = dagreNode.y - (info.height + 20) / 2;
    groupMemberPositions.set(node.id, {
      x,
      y,
      w: info.width + 40,
      h: info.height + 20,
    });
  }

  const groupIdMap = new Map(); // group id → groupId string
  for (const group of groups) {
    const memberPositions = group.members
      .filter((m) => groupMemberPositions.has(m))
      .map((m) => groupMemberPositions.get(m));

    if (memberPositions.length === 0) continue;

    const padding = 30;
    const labelHeight = 30;
    const gx = Math.min(...memberPositions.map((p) => p.x)) - padding;
    const gy =
      Math.min(...memberPositions.map((p) => p.y)) - padding - labelHeight;
    const gx2 =
      Math.max(...memberPositions.map((p) => p.x + p.w)) + padding;
    const gy2 = Math.max(...memberPositions.map((p) => p.y + p.h)) + padding;

    const boxId = `groupbox-${group.id}`;
    const { rect, textEl, groupId } = makeGroupBox(
      boxId,
      gx,
      gy,
      gx2 - gx,
      gy2 - gy,
      group.label || group.id,
    );
    groupIdMap.set(group.id, groupId);
    elements.push(rect);
    elements.push(textEl);
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────
  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    const info = nodeMap.get(node.id);
    const w = info.width + 40;
    const h = info.height + 20;
    const x = dagreNode.x - w / 2;
    const y = dagreNode.y - h / 2;
    const color = node.color || "gray";

    // Collect IDs that bind to this rect
    const boundIds = [info.textId];
    for (const edge of edges) {
      if (edge.from === node.id || edge.to === node.id) {
        boundIds.push(`arrow-${edge.from}-${edge.to}`);
      }
    }

    const c = PALETTE[color] || PALETTE.gray;
    const rect = makeRect(info.rectId, x, y, w, h, color, boundIds);

    // Assign group IDs if node belongs to a group
    for (const group of groups) {
      if (group.members.includes(node.id) && groupIdMap.has(group.id)) {
        rect.groupIds.push(groupIdMap.get(group.id));
      }
    }

    elements.push(rect);

    const textEl = makeText(
      info.textId,
      info.rectId,
      node.label,
      x + 20,
      y + 10,
      info.width,
      info.height,
      c.stroke,
    );
    // Copy group IDs to text element too
    textEl.groupIds = [...rect.groupIds];
    elements.push(textEl);
  }

  // ── Edges (Arrows) ────────────────────────────────────────────────────────
  for (const edge of edges) {
    const fromDagre = g.node(edge.from);
    const toDagre = g.node(edge.to);
    const fromInfo = nodeMap.get(edge.from);
    const toInfo = nodeMap.get(edge.to);

    if (!fromDagre || !toDagre || !fromInfo || !toInfo) continue;

    const arrowId = `arrow-${edge.from}-${edge.to}`;

    // Compute arrow start/end points at box edges
    const fromW = fromInfo.width + 40;
    const fromH = fromInfo.height + 20;
    const toW = toInfo.width + 40;
    const toH = toInfo.height + 20;

    let startX, startY, endX, endY;

    if (direction === "TB") {
      startX = fromDagre.x;
      startY = fromDagre.y + fromH / 2;
      endX = toDagre.x;
      endY = toDagre.y - toH / 2;
    } else {
      // LR
      startX = fromDagre.x + fromW / 2;
      startY = fromDagre.y;
      endX = toDagre.x - toW / 2;
      endY = toDagre.y;
    }

    const points = [
      [0, 0],
      [endX - startX, endY - startY],
    ];

    const arrow = makeArrow(
      arrowId,
      points,
      { elementId: fromInfo.rectId, focus: 0, gap: 1 },
      { elementId: toInfo.rectId, focus: 0, gap: 1 },
      edge.label,
    );
    arrow.x = startX;
    arrow.y = startY;
    arrow.width = Math.abs(endX - startX);
    arrow.height = Math.abs(endY - startY);
    elements.push(arrow);

    // Edge label
    if (edge.label) {
      const labelId = `text-${arrowId}`;
      const midX = startX + (endX - startX) / 2;
      const midY = startY + (endY - startY) / 2;
      const labelSize = estimateTextSize(edge.label);
      const labelEl = makeText(
        labelId,
        arrowId,
        edge.label,
        midX - labelSize.width / 2,
        midY - labelSize.height / 2,
        labelSize.width,
        labelSize.height,
        "#1e1e1e",
      );
      labelEl.fontSize = 14;
      elements.push(labelEl);
    }
  }

  // Build Excalidraw file
  const excalidrawFile = {
    type: "excalidraw",
    version: 2,
    source: "claude-code-excalidraw-plugin",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null,
    },
    files: {},
  };

  writeFileSync(outputPath, JSON.stringify(excalidrawFile, null, 2));
  console.log(`Generated ${outputPath} with ${elements.length} elements`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
