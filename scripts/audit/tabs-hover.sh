#!/bin/bash
# usage: tabs-hover.sh <outdir of home-tabs.json>
# Joins the two raw hover shots of home-tabs.json into docs/redesign/compare/round7/r7-tabs-hover-credits-about.jpg: the left
# 340 px of the credits shot beside the right 340 px of the about shot (both tabs hot), 680 by 900 (narrow, to keep the
# wordmark in the middle of the page out of it).
set -e
d=$1
ffmpeg -loglevel error -y -i "$d/r7-tabs-hover-credits.jpg" -i "$d/r7-tabs-hover-about.jpg" \
  -filter_complex "[0]crop=340:900:0:0[a];[1]crop=340:900:1100:0[b];[a][b]hstack" -q:v 3 -frames:v 1 \
  "$(dirname "$0")/../../docs/redesign/compare/round7/r7-tabs-hover-credits-about.jpg"
