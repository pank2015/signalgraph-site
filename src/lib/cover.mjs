// Deterministic, zero-cost "art card" cover generator. No AI image spend: every
// post gets a unique but reproducible abstract pattern derived from its own
// seed (slug/concept), tinted by pillar hue (or the accent teal for
// pillar-less explainers) — the same token system Flowkit diagrams use.

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HUES = {
  "agentic-ai": "var(--pillar-agentic)",
  hardware: "var(--pillar-hardware)",
  quantum: "var(--pillar-quantum)",
  "data-platforms": "var(--pillar-data)",
  "ea-practice": "var(--pillar-practice)",
};

export function coverHue(pillar) {
  return HUES[pillar] ?? "var(--accent)";
}

// 1200x630 — standard social-card ratio; also the viewBox for the on-page
// hero and card thumbnail, which just scale the same markup down.
export function coverSvg(seedText, pillar) {
  const rnd = mulberry32(hashString(seedText || "signalgraph"));
  const hue = coverHue(pillar);
  const W = 1200;
  const H = 630;

  const rings = Array.from({ length: 3 }, () => ({
    cx: 120 + rnd() * (W - 240),
    cy: 100 + rnd() * (H - 200),
    r: 60 + rnd() * 180,
    op: 0.1 + rnd() * 0.22,
  }));

  const lineCount = 5 + Math.floor(rnd() * 4);
  const lines = Array.from({ length: lineCount }, (_, i) => {
    const y = ((i + 0.5) / lineCount) * H;
    const skew = (rnd() - 0.5) * 140;
    return `M0,${(y + skew).toFixed(1)} L${W},${(y - skew).toFixed(1)}`;
  });

  const dotStep = 34;
  const dotOffsetX = rnd() * dotStep;
  const dotOffsetY = rnd() * dotStep;
  const patternId = `cover-dots-${hashString(seedText || "signalgraph").toString(36)}`;

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <rect width="${W}" height="${H}" fill="var(--bg-raised)"></rect>
  <defs>
    <pattern id="${patternId}" width="${dotStep}" height="${dotStep}" patternUnits="userSpaceOnUse"
      x="${dotOffsetX.toFixed(1)}" y="${dotOffsetY.toFixed(1)}">
      <circle cx="1.4" cy="1.4" r="1.4" fill="var(--hairline)"></circle>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${patternId})"></rect>
  ${lines.map((d) => `<path d="${d}" stroke="${hue}" stroke-opacity="0.16" stroke-width="1.5" fill="none"></path>`).join("\n  ")}
  ${rings.map((r) => `<circle cx="${r.cx.toFixed(1)}" cy="${r.cy.toFixed(1)}" r="${r.r.toFixed(1)}" fill="none" stroke="${hue}" stroke-opacity="${r.op.toFixed(2)}" stroke-width="2"></circle>`).join("\n  ")}
  <rect width="${W}" height="${H}" fill="none" stroke="var(--hairline)" stroke-width="2"></rect>
</svg>`.trim();
}
