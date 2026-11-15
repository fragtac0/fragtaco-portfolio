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

## 7. Order

Task 29 runs in lane A after task 28, on `r7/r56-arrival`. Task 30 runs in lane B after task 26, on `r7/r55-live-boxes`. The join waits for both.

## 8. For Aditya to check

- The dock on the portfolio page with thumbnails passing under it.
- The 2.25 s change with its fringe, on the joined build.
- The opening of both boxes on the joined build: he said they still open oddly but not how.
