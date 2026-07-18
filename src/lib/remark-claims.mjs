/**
 * Removes engine citation markers from rendered prose while keeping the raw
 * citation order logic available for provenance numbering.
 */
const CITE = /\[c:([0-9a-f]{16})\]/g;

export function citationOrder(rawBody) {
  const order = new Map();
  for (const m of rawBody.matchAll(CITE)) {
    if (!order.has(m[1])) order.set(m[1], order.size + 1);
  }
  return order;
}

/** Strip [c:id] markers from a plain string (TL;DR items bypass the remark
 * pipeline — they're frontmatter, not markdown body — so they need the same
 * marker removal applied by hand before rendering as visible prose). Also
 * collapses the leftover space when a marker sat between a word and
 * punctuation (legacy sentence-level content cited as "word [c:id].") so it
 * doesn't render as "word .". */
export function stripCites(text) {
  return (text ?? "")
    .replace(CITE, "")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function remarkClaimCites() {
  return (tree) => {
    dropSourcesSection(tree);
    walk(tree);
  };
}

function dropSourcesSection(tree) {
  const children = [];
  let skip = false;
  for (const child of tree.children ?? []) {
    if (!skip) {
      const isSourcesHeading =
        child.type === "heading" &&
        child.children?.some((grandchild) => grandchild.type === "text" && grandchild.value.trim().toLowerCase() === "sources");
      if (isSourcesHeading) {
        skip = true;
        continue;
      }
      children.push(child);
    }
  }
  tree.children = children;
}

function walk(node) {
  if (!node.children) return;
  const out = [];
  for (const child of node.children) {
    if (child.type !== "text" || !CITE.test(child.value)) {
      walk(child);
      out.push(child);
      continue;
    }
    CITE.lastIndex = 0;
    const cleaned = child.value.replace(CITE, "").replace(/ +([.,;:!?])/g, "$1");
    if (cleaned) out.push({ type: "text", value: cleaned });
  }
  node.children = out;
}
