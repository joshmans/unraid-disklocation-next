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
- **Distribution: `.plg`-installed Node.js daemon, not a Docker container.** Closer to the
  original plugin's install experience and lets it register in Unraid's own nav (`Tools/`),
  rather than living in the Docker tab as a separate app. Precedent: plugins like
  netbird-unraid already install/supervise non-PHP daemons this way, via an `rc.d` script
  under `/usr/local/etc/rc.d/` (never `/etc/rc.d/`, which Unraid owns as a runtime symlink -
  packaging into it can break nginx/php-fpm/samba/docker) started by an array-start event
  hook. Skeleton: [plugin/rc.d/rc.unraid-disklocation-next](plugin/rc.d/rc.unraid-disklocation-next),
  [plugin/unraid-disklocation-next.plg](plugin/unraid-disklocation-next.plg).
- **UI delivery: mounted into the DOM, not an iframe.** The `.page` file is a normal plugin
  page with a mount `<div>` and a `<script>` tag loading this project's own bundled
  frontend JS - it renders in the same document, not a nested browsing context (iframing
  Unraid's own UI is a known source of breakage, e.g. the Connect plugin's iframe issues on
  the forums). API calls stay same-origin via an nginx `conf.d` drop-in snippet that
  reverse-proxies a path to the local daemon - Unraid's nginx already includes
  `/etc/nginx/conf.d/*.conf`, so this needs no separate reverse-proxy container. Skeleton:
  [plugin/pages/DiskLocationNext.page](plugin/pages/DiskLocationNext.page),
  [plugin/nginx/unraid-disklocation-next.conf](plugin/nginx/unraid-disklocation-next.conf).

## Open questions (not yet decided)

- **Runtime packaging.** Unraid doesn't ship Node.js by default (users typically add it via
  a separate NerdPack-style plugin), so a `.plg` that just execs `node index.js` adds an
  external dependency and a more fragile install. The better option is likely a
  self-contained compiled binary (Bun's `--compile`, Node's Single Executable Application
  support, or `pkg`) so the plugin has no separate runtime prerequisite - not yet decided
  which, and not yet built either way. The current `rc.d` skeleton assumes a system Node
  as a placeholder and is marked accordingly.
- **SMART history storage.** The PHP version's purpose-built SQLite time series (temp,
  power-on hours, sector counts, wear level, overall status; configurable retention) is a
  good design and the plan is to carry the *idea* forward, but the implementation will be
  new (e.g. `better-sqlite3` or similar) — not yet built.
- **How much of the tray-map UI carries over conceptually vs. needs rebuilding.** The
  tray/bay visual metaphor is the whole point of this plugin and should carry over; the
  actual rendering will be rebuilt from scratch (frontend framework/bundler not yet chosen),
  not ported.
- **Whether `unraid-api`'s session/SSO auth can be reused**, or whether this always relies
  on a user-generated static API key stored in this plugin's own config. Since the daemon
  now runs on the box itself (not a separate container), reuse is more plausible than it
  was under the Docker option, but not yet verified against a live instance.
- **The actual GraphQL schema.** [src/graphql/client.ts](src/graphql/client.ts) is a bare
  request wrapper with no real queries yet - the array/disk/SMART shape needs to be explored
  against a live Unraid 7.2+ instance's schema before any of that can be written for real.

## Conventions carried forward

Same house rules as `unraid-disklocation`: one branch per feature, PR'd and merged
individually; verbose commit messages explaining *why* not just *what*; never bundle or
redistribute trademarked manufacturer logos (relevant again if/when a drive-brand-logo
feature is rebuilt here).
