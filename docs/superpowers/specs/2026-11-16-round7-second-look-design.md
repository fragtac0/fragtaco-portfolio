# Round 7: the dock without its cut-out, a 2.25 s change, whole books in the box

Date: 2026-11-16. Adds to the three earlier round 7 specs; where they differ, this one wins.
Source: Aditya's feedback on the two half-built previews (`docs/redesign/feedback-log.md`, "Feedback on two half-built previews").

## 1. Intent

1. The dark box behind the dock on the portfolio page looks wrong. It is the cut-out that keeps thumbnails from showing under the dock.
2. The page change should run 2.25 s, not 2.5 s, with its fringe.
3. In the home box the books are cut off and the ledge is missing.

Two more of his points (the walls arriving late, the dock dropping and coming back) are task 28 and need nothing new.

## 2. Goals, non-goals, anti-goals

- Goals: no box, shadow or fade round the dock; the dock's tabs stay readable with a thumbnail under them; the change takes 2.25 s and nothing else about it changes; the reading box shows every book whole on its ledge.
- Non-goals: no change to the thumbnails' sizes, to the opening's move, to the wall's box, or to the open shelf.
- Anti-goals: a new fade or shade that reads as another box; tabs that cannot be read over a bright thumbnail; books that jump or re-crop when the box is clicked.

## 3. His choices

| Question | His answer |
|---|---|
| Thumbnails near the dock | Pass under the glass |
| Length of the page change | 2.25 s |
| What the reading box shows | No preference given; my call: whole books on the ledge |
| What is wrong with the opening | No preference given; no change |

## 4. The dock on the portfolio page (task 29)

- The mask on the video rings, the pointer block and the keep-out's variables go. A thumbnail that turns through the dock's place passes under the dock and is seen through its glass, blurred as the glass blurs everything else.
- The rings are planned for the whole screen again: `coverage()` counts every tile in full. No audit size gets smaller tiles or fewer tiles than today; the 40 px room round the title block stays.
- The tabs stay readable: every label and icon of the dock keeps a contrast of at least 4.5 to 1 against what is behind it with the brightest thumbnail of the set under the dock. If the glass as it is does not give that, its tint is raised just enough, on every page alike, and the before and after values are recorded.
- A tile under the dock cannot be clicked through it. Keyboard focus never rests on a tile that is more than half under the dock: the ring is held or the tile is brought clear while it has focus.
- Check: at 1440 by 900, 390 by 844 and 320 by 568, with a video tile placed under the dock, a picture of the foot of the screen: tile pixels reach the dock's edge on every side, and no pixel outside the dock is darker than the same pixel without the dock.

## 5. The length of the change (task 29)

- `GLASS.ms` is 2250. The ease, band, wander, bend, fringe, glow, shade, the hold of task 28 and `UNCOVERED_AT` stay. Everything keyed to the length follows it.
- Task 27's cost gate keeps its limits (450 and 300 ms inside the change); the 34 ms gate holds.

## 6. The reading box (task 30)

- In the home box the shelf shows every book whole, standing on the wooden ledge, with the dot field round it. No book is cut by the box's edge; the ledge's top edge and front face are inside the box; the tallest book's top is at least 6% of the box's height below the box's top.
- Within that, the row is as large as fits, so the spines read as well as the box allows.
- The opening stays one move on the same canvas. The picture may ease from the box's framing to the open page's framing over the move: steadily, with no step at either end. The frame before the click and the frame after it still differ in under 1% of the box's pixels, and the last frame of the move is the open page.
- Closing is the same backwards. Reduced motion, the plain grid and the flat preview without WebGL are unchanged (the flat preview already shows the ledge).
- The wall's box is unchanged.
- Check: from the engine's own projected boxes, at 1440 by 900, 1366 by 768 and 390 by 844: every book and the ledge's line are inside the box's frame. The box-open films are made again.

## 7. My experience: where the words sit (task 31)

Source: his third message of 2026-11-16 (`docs/redesign/feedback-log.md`, "Feedback after the second look").

- On a wide screen (at least 900 px wide and wider than it is high) the title block sits to the left of the mountain and the mountain's block to the right, both centred on the summit's row.
  - Left: "MY EXPERIENCE" with its description under it, as now, at the left gutter. Its right edge stays at least 24 px clear of the mountain's scarp at its rows; the title shrinks toward 34 px to keep that, never below.
  - Right: "OLYMPUS MONS", its line, the figures and the credit, set flush right at the right gutter, at most 32 characters wide. It stays at least 32 px clear of every milestone, of the trail and of the mode switch; if the first milestone is in the way the block moves up or down the least it needs.
- The chart's labels keep out of both blocks as they keep out of the words today.
- A narrow or upright screen keeps today's places (title top left, the mountain's block lower left). My call: there is no room beside the mountain.
- In My climb both blocks leave, as now. The order of importance of the words (spec 9.6 of the first round 7 spec) and their sizes stay.

## 8. My experience: the entrance (task 31)

He wants the words to arrive as the page change completes, and the path to trace itself. This is one made entrance for the page, and the one exception to task 28's rule that nothing appears after the reveal: the picture, the chart, the frame, the dock and the switch are finished before the reveal as task 28 says; the words, the trail and the milestones come in on a clock.

Times are counted from the start of the reveal (T is its length, 2250 ms):

| What | Starts | How |
|---|---|---|
| "MY EXPERIENCE" | 0.70 T | Letter by letter from the left: each letter fades in and rises 6 px over 300 ms, 28 ms after the one before |
| Its description | 120 ms after the title starts | Fades in and rises 8 px over 400 ms |
| "OLYMPUS MONS" | 240 ms after the title starts | Letter by letter, as the title, 22 ms apart |
| Its lines | 360 ms after the title starts | Fade in and rise 8 px over 400 ms, 60 ms apart |
| The trail | When the reveal ends | Draws itself from the first milestone to "now" over 2200 ms, eased in and out, with a small bright head at its tip |
| Each milestone | When the trail's tip reaches its foot | Its bead fades in and grows from 0.6 to 1 over 260 ms |
| "Now" | When the trail arrives | Turns orange; the radar starts |
| The dotted way ahead | 100 ms after the trail arrives | Its dots appear in order toward the summit over 600 ms |

- Before their time the words, the trail and the milestones are not shown at all (not dimmed).
- Only opacity and transform move. Nothing in the entrance changes the layout.
- A click or a key press on a milestone, on the switch or on the page during the entrance finishes it at once: everything is shown and the action is taken. A milestone that has focus is shown.
- If the map's drawing is not ready when the reveal ends, the trail starts when it is; the words do not wait for it.
- A first load or a deep link plays the same entrance, counted from the moment the picture is shown.
- Coming back from My climb to the overview does not replay it: the words fade in as today and the trail is there.
- Reduced motion: no letters, no drawing; everything fades in together over 200 ms when the reveal ends.
- Without the map (no canvas, less data, a failed picture) the words still enter; there is no trail.
- Check: a film of the change from the portfolio page at 1440 by 900 and 390 by 844 with pictures at 0.6 T, 0.8 T, T, T + 1100 ms and T + 3200 ms: no words at 0.6 T, the title partly in at 0.8 T, the trail half drawn at T + 1100 ms with only the milestones behind its tip, everything at T + 3200 ms. No layout shift from the start of the reveal to T + 4 s. Task 28's arrival check for this page leaves the words, the trail and the milestones out of its comparison and is otherwise unchanged.

## 9. Order

Tasks 29 and 31 run in lane A after task 28, on `r7/r56-arrival`. Task 30 runs in lane B after task 26, on `r7/r55-live-boxes`. The join waits for both.

## 10. For Aditya to check

- The dock on the portfolio page with thumbnails passing under it.
- The 2.25 s change with its fringe, on the joined build.
- The opening of both boxes on the joined build: he said they still open oddly but not how.
- My experience: the two blocks beside the mountain on his own screen, the words arriving with the change, and the trail drawing itself.
