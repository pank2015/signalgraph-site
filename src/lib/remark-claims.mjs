/**
 * Turns the engine's [c:<16-hex>] citation markers into numbered footnote
 * links. Numbering follows order of first appearance, which is exactly how
 * citationOrder() numbers the provenance cards — the two stay in lockstep
 * because both scan the same raw body with the same regex.
 */
const CITE = /\[c:([0-9a-f]{16})\]/g;

export function citationOrder(rawBody) {
  const order = new Map();
  for (const m of rawBody.matchAll(CITE)) {
    if (!order.has(m[1])) order.set(m[1], order.size + 1);
  }
  return order;
}

export function remarkClaimCites() {
  return (tree) => {
    const order = new Map();
    const num = (id) => {
      if (!order.has(id)) order.set(id, order.size + 1);
      return order.get(id);
    };
    walk(tree, num);
  };
}

function walk(node, num) {
  if (!node.children) return;
  const out = [];
  for (const child of node.children) {
    if (child.type !== "text" || !CITE.test(child.value)) {
      walk(child, num);
      out.push(child);
      continue;
    }
    CITE.lastIndex = 0;
    let last = 0;
    for (const m of child.value.matchAll(CITE)) {
      if (m.index > last) out.push({ type: "text", value: child.value.slice(last, m.index) });
      const n = num(m[1]);
      out.push({
        type: "html",
        value: `<sup class="cite"><a href="#c-${m[1]}" aria-label="claim ${n}">${n}</a></sup>`,
      });
      last = m.index + m[0].length;
    }
    if (last < child.value.length) out.push({ type: "text", value: child.value.slice(last) });
  }
  node.children = out;
}
