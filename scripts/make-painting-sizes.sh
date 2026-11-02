#!/usr/bin/env bash
# Resize every available hero painting (content/site/hero-paintings.json,
# items without "missing": true) into public/paintings/1600 and
# public/paintings/2560 as quality-82 JPEGs. macOS only (uses sips).
# The originals in public/paintings/ are never modified.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
manifest="$root/content/site/hero-paintings.json"
src="$root/public/paintings"

files="$(node -e '
  const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const i of m.items) if (!i.missing) console.log(i.file);
' "$manifest")"

for size in 1600 2560; do
  mkdir -p "$src/$size"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    # sips -Z also upscales, so never ask for more than the original has.
    longest="$(sips -g pixelWidth -g pixelHeight "$src/$file" | awk '/pixel/ { if ($2 > m) m = $2 } END { print m }')"
    target=$(( longest < size ? longest : size ))
    sips -Z "$target" -s format jpeg -s formatOptions 82 "$src/$file" --out "$src/$size/$file" >/dev/null
  done <<< "$files"
  echo "wrote $(ls "$src/$size" | wc -l | tr -d ' ') files to public/paintings/$size"
done
