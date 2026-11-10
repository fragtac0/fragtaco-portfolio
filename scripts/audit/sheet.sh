#!/bin/bash
# usage: sheet.sh <dir> <out-name> <cols> <cellw> <cellh> file1 file2 ...
D=$(dirname "$0"); dir=$1; out=$2; cols=$3; cw=$4; ch=$5; shift 5
n=$#; rows=$(( (n + cols - 1) / cols ))
{ echo "<body style='margin:0;background:#222;display:grid;grid-template-columns:repeat($cols,${cw}px);gap:4px;font:11px monospace;color:#fff'>"
  for f in "$@"; do echo "<div style='position:relative'><img src='file://$dir/$f.jpg' style='width:${cw}px;height:${ch}px;object-fit:contain;display:block;background:#000'><span style='position:absolute;left:4px;top:2px;background:#000a;padding:1px 4px'>$f</span></div>"; done
  echo "</body>"; } > "$dir/$out.html"
W=$(( cols * (cw + 4) )); H=$(( rows * (ch + 4) ))
echo "[{\"size\":[$W,$H],\"go\":\"file://$dir/$out.html\",\"wait\":900,\"shot\":\"$out\"}]" > "$dir/$out.json"
node "$D/cdp.mjs" "$dir/$out.json" "$dir/sheets" >/dev/null 2>&1; echo "$dir/sheets/$out.jpg"
