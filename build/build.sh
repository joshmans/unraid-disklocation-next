#!/bin/bash
# Builds and (with --release) publishes a real installable release of the
# unraid-disklocation-next plugin: compiled frontend, esbuild-bundled +
# Node-SEA-packaged backend binary, packed into a Slackware .txz Unraid's own
# `<FILE Run="upgradepkg --install-new"><URL>...</URL><SHA256>...</SHA256></FILE>`
# convention expects (SHA256, not MD5 - the stronger hash Unraid's Community
# Apps review bot now retrofits onto plugins still declaring MD5), then
# (release mode only) tags, updates the .plg's version/SHA256 entities +
# CHANGES, and publishes a GitHub Release with the .txz attached. Modeled
# directly on unraid-docker-folders' own build.sh -
# see ROADMAP.md/the plan this came from for why that's the right template
# (it's a real, currently-published plugin using this exact pipeline shape).
#
# Must run on Linux x86_64 (matches Unraid's own host arch) - the SEA binary
# embeds a copy of whatever `node` builds it, so building on macOS would ship
# a binary that can't run on the target box. CI (.github/workflows/release.yml)
# runs this on ubuntu-latest; local runs are for testing the non-SEA steps
# only (bundle + a plain `node dist/bundle.cjs` smoke test), never for
# producing an artifact anyone ships.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

NAME="unraid-disklocation-next"
RELEASE_MODE=false
[[ "${1:-}" == "--release" ]] && RELEASE_MODE=true

VERSION="$(date +%Y.%m.%d)"
# Same-day re-run (a second release on one calendar day) gets a numeric
# suffix rather than colliding with an existing tag - mirrors
# unraid-docker-folders' own version-collision handling.
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
  n=2
  while git rev-parse "v${VERSION}-${n}" >/dev/null 2>&1; do n=$((n + 1)); done
  VERSION="${VERSION}-${n}"
fi
echo "Building ${NAME} ${VERSION}"

echo "--- tsc (backend) ---"
npm run build

echo "--- vite (frontend) ---"
npm run build:frontend

echo "--- esbuild bundle ---"
npm run build:bundle

echo "--- Node SEA binary ---"
npm run build:sea

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

EMHTTP_DIR="$STAGE/usr/local/emhttp/plugins/${NAME}"
RCD_DIR="$STAGE/usr/local/etc/rc.d"
mkdir -p "$EMHTTP_DIR/app/bin" "$RCD_DIR"

cp plugin/pages/DiskLocationNext.page "$EMHTTP_DIR/DiskLocationNext.page"
cp plugin/daemon-control.php "$EMHTTP_DIR/daemon-control.php"
mkdir -p "$EMHTTP_DIR/app/dist"
cp dist/frontend.js "$EMHTTP_DIR/app/dist/frontend.js"
cp dist/unraid-disklocation-next "$EMHTTP_DIR/app/bin/${NAME}"
cp plugin/rc.d/rc.unraid-disklocation-next "$RCD_DIR/rc.${NAME}"
chmod 755 "$EMHTTP_DIR/app/bin/${NAME}" "$RCD_DIR/rc.${NAME}"

ARCHIVE_DIR="$(pwd)/archive"
mkdir -p "$ARCHIVE_DIR"
ARCHIVE_NAME="${NAME}-${VERSION}.txz"
ARCHIVE_PATH="${ARCHIVE_DIR}/${ARCHIVE_NAME}"

echo "--- packing ${ARCHIVE_NAME} ---"
tar --owner=root --group=root -C "$STAGE" -cJf "$ARCHIVE_PATH" usr/

if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
else
  SHA256="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"
fi
echo "SHA256: $SHA256"

if ! $RELEASE_MODE; then
  echo "Built $ARCHIVE_PATH (not publishing - pass --release to tag and publish)"
  exit 0
fi

echo "--- updating plugin/${NAME}.plg ---"
PLG="plugin/${NAME}.plg"
sed -i.bak \
  -e "s#<!ENTITY version    \"[^\"]*\">#<!ENTITY version    \"${VERSION}\">#" \
  -e "s#<!ENTITY sha256     \"[^\"]*\">#<!ENTITY sha256     \"${SHA256}\">#" \
  "$PLG"
rm -f "${PLG}.bak"

CHANGE_NOTE="$(git log "$(git describe --tags --abbrev=0 2>/dev/null || echo "$(git rev-list --max-parents=0 HEAD)")..HEAD" --pretty='format: - %s' | grep -v '^$' || true)"
[[ -z "$CHANGE_NOTE" ]] && CHANGE_NOTE=" - Maintenance release."
python3 - "$PLG" "$VERSION" "$CHANGE_NOTE" <<'PY'
import sys
path, version, notes = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
marker = "<CHANGES>\n"
entry = f"{marker}###{version}\n{notes}\n\n"
text = text.replace(marker, entry, 1)
open(path, "w").write(text)
PY

git add "$PLG"
git commit -m "Release ${NAME} ${VERSION}"
git tag -a "v${VERSION}" -m "${NAME} ${VERSION}"
git push origin HEAD
git push origin "v${VERSION}"

echo "--- publishing GitHub release ---"
if gh release view "v${VERSION}" >/dev/null 2>&1; then
  gh release upload "v${VERSION}" "$ARCHIVE_PATH" --clobber
else
  gh release create "v${VERSION}" "$ARCHIVE_PATH" --title "${VERSION}" --notes "${CHANGE_NOTE}"
fi

echo "Released ${NAME} ${VERSION} (SHA256 ${SHA256})"
