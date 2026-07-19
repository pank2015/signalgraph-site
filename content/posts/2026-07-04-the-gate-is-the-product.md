---
title: "The gate is the product"
description: "A publish pipeline that cannot ship an unverified sentence is worth more than a faster one that can."
date: "2026-07-04"
pillar: "agentic-ai"
format: "daily_signal"
focus: "Signalgraph"
diagram: "2026-07-04-the-gate-is-the-product.json"
provenance: "2026-07-04-the-gate-is-the-product.json"
claims_cited: 5
sources_count: 1
tldr:
  - "Signalgraph's gate is a seven-check pipeline, and it's fail-closed: nothing publishes unless every check passes.[c:aaaaaaaaaaaaaaa3]"
  - "The entailment judge always runs on a different model than the writer, so a model can't grade its own \"homework\".[c:aaaaaaaaaaaaaaa4]"
  - "Merging the PR is the only way a post goes live — there is no auto-publish path.[c:aaaaaaaaaaaaaaa5]"
engine_run: "fixture"
draft: true
---

Signalgraph publishes nothing it cannot trace to a source [c:aaaaaaaaaaaaaaa1]. Every claim in its knowledge base carries a verbatim quote span, a trust tier, and a freshness class, and the writer is restricted to citing exactly those claims [c:aaaaaaaaaaaaaaa2].

## Verification is decorrelated by construction

A draft faces seven checks before it can become a pull request [c:aaaaaaaaaaaaaaa3]. The entailment judge runs on a different provider — or at minimum a different model family — than the writer, so a model never grades its own prose [c:aaaaaaaaaaaaaaa4].

## Merge is the only publish path

A gate-passed draft opens a pull request on this site's repository; branch protection makes the curator's merge the sole road to production [c:aaaaaaaaaaaaaaa5]. Days without a passing draft are skipped, not padded [c:aaaaaaaaaaaaaaa3].

## Sources

- [Signalgraph engine docs](https://github.com/pank2015/signalgraph-site) — primary, evergreen
