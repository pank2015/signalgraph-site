/**
 * Flowkit layout: DSL JSON -> positioned geometry, at build time.
 * The single deterministic renderer (FlowDiagram.astro) draws every diagram
 * from this output — stencil consistency is structural, not aspirational.
 * The LLM never emits SVG; it emits the DSL validated by G7 engine-side.
 */
import dagre from "@dagrejs/dagre";

const CHAR_W = 7.4; // ~13px Inter average; labels are capped at 24 chars by schema

function nodeSize(n) {
  const chars = Math.max(n.label.length, (n.sub || "").length * 0.88);
  return { width: Math.max(chars * CHAR_W + 30, 92), height: n.sub ? 54 : 42 };
}

function toPath(pts) {
  if (pts.length < 3) {
    return `M${pts[0].x},${pts[0].y} L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${pts[i].x},${pts[i].y} ${mx},${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last.x},${last.y}`;
}

export function layoutDiagram(dsl) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: dsl.direction === "tb" ? "TB" : "LR",
    nodesep: 30,
    ranksep: 58,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of dsl.nodes) g.setNode(n.id, { ...nodeSize(n), meta: n });
  dsl.edges.forEach((e, i) => {
    g.setEdge(
      e.from,
      e.to,
      e.label ? { meta: e, width: e.label.length * 6.4 + 10, height: 18, labelpos: "c" } : { meta: e },
      `e${i}`,
    );
  });

  dagre.layout(g);

  const nodes = g.nodes().map((id) => {
    const n = g.node(id);
    return { ...n.meta, x: n.x - n.width / 2, y: n.y - n.height / 2, w: n.width, h: n.height };
  });

  const edges = g.edges().map((ref) => {
    const e = g.edge(ref);
    return {
      ...e.meta,
      path: toPath(e.points),
      label: e.meta.label,
      lx: e.x,
      ly: e.y,
    };
  });

  // Group containers: bounding box of member nodes + padding, label top-left.
  const PAD = 16;
  const groups = (dsl.groups || []).map((grp) => {
    const members = nodes.filter((n) => n.group === grp.id);
    if (!members.length) return null;
    const x0 = Math.min(...members.map((n) => n.x)) - PAD;
    const y0 = Math.min(...members.map((n) => n.y)) - PAD - 14; // room for the label
    const x1 = Math.max(...members.map((n) => n.x + n.w)) + PAD;
    const y1 = Math.max(...members.map((n) => n.y + n.h)) + PAD;
    return { ...grp, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }).filter(Boolean);

  // viewBox covers the dagre canvas AND group containers (which pad outward).
  const { width, height } = g.graph();
  let minX = 0, minY = 0, maxX = width, maxY = height;
  for (const grp of groups) {
    minX = Math.min(minX, grp.x - 4);
    minY = Math.min(minY, grp.y - 4);
    maxX = Math.max(maxX, grp.x + grp.w + 4);
    maxY = Math.max(maxY, grp.y + grp.h + 4);
  }
  return {
    title: dsl.title,
    vx: Math.floor(minX), vy: Math.floor(minY),
    width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY),
    nodes, edges, groups,
  };
}
