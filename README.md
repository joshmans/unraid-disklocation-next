**Disk Location: Next**

A ground-up rewrite of the [Disk Location](https://github.com/joshmans/unraid-disklocation) Unraid
plugin concept — locating drives and mapping them to a graphical tray/bay layout — built as a
standalone TypeScript/Node.js service that talks to Unraid's native `unraid-api` GraphQL
interface (Unraid 7.2+), instead of a classic PHP webGUI plugin parsing `/var/local/emhttp` and
shelling out to `smartctl` directly.

This is a **separate codebase**, not a fork or a migration of the PHP plugin. No PHP code,
files, or history carry over — only the underlying idea (a visual tray/bay map, SMART health
history over time) and the lessons learned building the original. See
[ROADMAP.md](ROADMAP.md) for the architecture decisions and open questions behind that choice.

Status: early scaffolding, not yet functional.

Licensed under the MIT License — see [LICENSE](LICENSE).
