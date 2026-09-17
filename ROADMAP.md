# Roadmap

## Background

This project starts from the "Phase 3" idea in
[unraid-disklocation](https://github.com/joshmans/unraid-disklocation)'s
[ROADMAP.md](https://github.com/joshmans/unraid-disklocation/blob/master/ROADMAP.md):
rebuild the Disk Location concept (tray/bay drive map, SMART health history) on Unraid's
modern plugin stack instead of the classic PHP/webGUI architecture, once that PHP codebase
reached feature-complete/maintenance mode. That milestone was reached 2026-09-16, and this
repo is the result of scoping what "rebuild on the modern stack" actually means in practice.

This is a clean-room rewrite. It does not share code, files, or git history with the PHP
plugin, and depends on nothing from it at runtime. The relationship is inspiration and
mechanics only — the tray-map/SMART-history *ideas* carry over conceptually; nothing else
does.

## Key finding that shaped this repo's architecture

The original framing was "a native `unraid-api` plugin that registers its own GraphQL
resolvers and WebGUI components," on the assumption that `unraid-api` (Unraid's built-in
NestJS/GraphQL service, shipped in the OS since 7.2, Aug 2025) has a documented extensibility
point for third-party plugins to hook into that process, the way the PHP webGUI has
`.plg`/`.page` files.

As of this writing (2026-09), that doesn't appear to exist for outside developers:

- The official [unraid/api](https://github.com/unraid/api) repo's own developer docs cover
  building the first-party API/Connect package itself, not a third-party plugin contract.
- Unraid's own published roadmap lists "Developer Tools for Plugins" as a Q2 2025 target,
  still unshipped as of this writing.
- Every real third-party project found in the wild that touches `unraid-api`
  (Home Assistant integrations, MCP servers, monitoring agents) does so as an external
  client authenticating with an API key and querying the existing GraphQL schema — none
  extend the schema or inject WebGUI components in-process.

Decision: build as a **standalone TypeScript/Node.js service** that authenticates to
`unraid-api` via an API key and reads array/disk/SMART state over GraphQL, rather than
attempting in-process plugin registration. If Unraid ships a real third-party plugin SDK
later, revisit — this project's GraphQL-client core should mostly carry over either way, since
the in-process gap is only in *how it's loaded and how it draws UI*, not in *how it reads
data*.

## Settled decisions

- **Minimum Unraid version: 7.2+.** `unraid-api` is not present before that, so there's no
  lower floor to design around.
- **Repo/codebase: fully separate from `unraid-disklocation`.** Independent history,
  independent versioning, independent distribution — not a package inside that repo.
- **Approach: full rewrite, not a gradual migration.** There's no PHP logic worth wrapping
  behind a resolver; the data access pattern (GraphQL query vs. file-parsing/`smartctl`
  shell-out) is different enough that a wrapper would be its own throwaway layer.

## Open questions (not yet decided)

- **Distribution mechanism.** Options to weigh: a Docker container installed via Community
  Apps (matches how most modern third-party Unraid tools ship today), vs. a lightweight
  `.plg` that installs and supervises a Node service directly on the array (closer to the
  original plugin's install experience, no separate container to manage). This affects the
  install UX and how deeply it can hook into Unraid's own webGUI navigation.
- **UI delivery.** Whether the web UI is served by this service standalone (its own page,
  linked from Unraid's nav via whatever the distribution mechanism allows) vs. designed to
  be embeddable inside the Unraid webGUI's own chrome. Depends partly on the distribution
  answer above.
- **SMART history storage.** The PHP version's purpose-built SQLite time series (temp,
  power-on hours, sector counts, wear level, overall status; configurable retention) is a
  good design and the plan is to carry the *idea* forward, but the implementation will be
  new (e.g. `better-sqlite3` or similar) — not yet built.
- **How much of the tray-map UI carries over conceptually vs. needs rebuilding.** The
  tray/bay visual metaphor is the whole point of this plugin and should carry over; the
  actual rendering will be rebuilt in whatever frontend approach comes out of the UI
  delivery question above, not ported.
- **Whether `unraid-api`'s session/SSO auth can be reused**, or whether this always relies
  on a user-generated static API key — depends on whether this ends up running "inside"
  Unraid's own webGUI origin or as a separate origin/container.

## Conventions carried forward

Same house rules as `unraid-disklocation`: one branch per feature, PR'd and merged
individually; verbose commit messages explaining *why* not just *what*; never bundle or
redistribute trademarked manufacturer logos (relevant again if/when a drive-brand-logo
feature is rebuilt here).
