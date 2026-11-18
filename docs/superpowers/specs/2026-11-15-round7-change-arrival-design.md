# Round 7: a lighter page change, and a page that arrives finished

Date: 2026-11-15. Adds to `2026-11-13-round7-design.md` and `2026-11-14-round7-followups-design.md`; where they differ, this one wins.
Source: Aditya's feedback on the R54 build and his four choices (`docs/redesign/feedback-log.md`, "Feedback on the page change as built").

## 1. Intent

Two things he saw in the built page change:

1. It lags. The measurements say the bend is the cost, and about two thirds of that is how the filter is built (24 map pictures in each of two filters, walked every frame), not how it looks.
2. "The page shifts in position once it loads." The reveal uncovers a page that is not finished: the dock has one row and grows after, the wall is empty and its thumbnails arrive after, the painting is a blur and sharpens after, the rings start turning after. And the bend slides the arriving page's content about 56 px.

## 2. Goals, non-goals, anti-goals

- Goals: the change looks as it does now on the page being left; it costs about a third of what it costs now; the first change after a load is as smooth as the tenth; when the reveal ends nothing on the page appears, grows, swaps or starts abruptly.
- Non-goals: no change to the reveal's length (2.5 s), shape, edge width, wander, glow or shade; no change to what any page looks like at rest; nothing in lane B's files (the home boxes).
- Anti-goals: a click that waits visibly long before anything happens; a change that is smooth only in a headless browser; a page that is "finished" by hiding its content until later.

## 3. His choices

| Question | His answer |
|---|---|
| How to make it lighter | Same look, leaner: one map picture, a warm-up, the bend dropped if frames slip |
| How the arriving page behaves | Finished before the reveal |
| The bend on the arriving page | Half strength |
| The dock | Fixed regardless (my proposal, he marked it as one of the shifts) |

## 4. The lighter change (task 27)

- Each bend filter holds one map picture in use, not 24. How (one picture whose source changes, one sheet read through a moving window, or another way) is the builder's, as long as the cost gate holds and the look does not change on the page being left.
- The arriving page is bent at half strength (`BEND_NEW = 0.5` of the push, the colour split in the same proportion). The page being left keeps the full bend and fringe.
- Warm-up: once the bend's pictures are ready and the browser is idle, the filters are run once where nobody sees it, so the first change after a load does no first-time work. Never during a change.
- Guard: during a change, if four frames in a row take longer than 25 ms, the bend is switched off for the rest of that change (the edge, wander, glow and shade stay). A second change that trips the guard in the same tab switches the bend off until the tab is reloaded.
- Cost gate (replaces the gap-between-frames gate as the pass mark for the bend; that gate stays as a second check): a trace of one warmed change from home to the portfolio page, at 1512 by 982 at 2x and at 1920 by 1080 at 1x, on a quiet machine. Inside the change, the renderer's compositor thread is busy for at most 450 ms and the display compositor thread for at most 300 ms (today about 1,000 and 600), and every frame is presented. Three cold runs (the first change after a load): no frame over 34 ms.
- Check by eye: the sheet of task 22 again (20, 35, 50, 65, 80% of the time) beside R54.1b's frames. The page being left must look the same; the arriving page's push is visibly gentler.

## 5. The page arrives finished (task 28)

### 5.1 The hold

- When a change's pictures are up, the reveal does not start until the arriving page says it is ready, or 500 ms have passed, whichever is first. During the hold the screen shows the page being left, held still.
- Ready means, for the part of the page inside the window:
  - Home: the current painting sharp (not the blurred placeholder), its caption, the lockup in its resting state.
  - Portfolio: every ring item mounted with its picture decoded, every tile in its resting style.
  - Long form and Short form: every tile of the wall at its final place with its picture decoded. If the WebGL wall cannot be drawn within the hold, the plain grid is the wall at the reveal and the WebGL wall takes over after the change with no visible difference.
  - My experience: the overview picture decoded, the words and the frame present.
  - The ground on every page in its resting state.
- If the hold ends at 500 ms with something missing, the reveal starts anyway and the late part fades in over 200 ms when it comes. It never pops and never moves anything else.
- A press during the hold finishes the change, as a press during the reveal does (R58 to R63 stay).
- Reduced motion: the 120 ms fade waits the same way, for at most 300 ms.
- A first load or a deep link has no change and is not held; the walls' arrival and the painting's opening stay as they are there.

### 5.2 The dock

- The dock's second row keeps its state across a change. Between two pages that both have the row, the dock does not move at all.
- From Home (one row) to a page with the row, and back, the dock changes shape once, during the reveal, and has its final shape by the time the reveal is over.
- Focus inside the row is kept when the row stays.

### 5.3 After the reveal

- In the two seconds after a change ends: no layout shift, no element appears or disappears, no element changes size, no picture swaps.
- Motion that belongs to a page at rest (the rings' turn, the wall's drift, the painting's slow zoom) starts from standstill and reaches its speed over at least 800 ms.
- Work that makes nothing visible (starting WebGL behind an identical picture, loading the heights for the map) may still wait for the change to be over.

### 5.4 Check

For home to portfolio, portfolio to long form, portfolio to short form, portfolio to my experience, portfolio to home and long form to portfolio, at 1512 by 982 at 2x and at 390 by 844 at 3x:

- The change is frozen at 99% of its time and photographed (F), ended and photographed within 50 ms (E), and again 700 ms later (L).
- F and E differ in under 0.5% of pixels.
- Between E and L, outside the elements that are in resting motion, under 0.5% of pixels differ; no element in resting motion has moved more than 2 px in its first frame.
- No layout-shift entry in the 2 s after the end. The dock's box is the same in F, E and L.
- From the click to the reveal's first frame: at most 500 ms more than today on a warm cache, and the cap holds with every picture blocked.

## 6. Rulings this reverses

- R75 (the wall's arrival runs after the reveal settles): after a page change the wall is there when the reveal starts. The arrival stays for a first load.
- R77 (links show after 1.5 s without an engine draw): after a page change the plain grid is shown from the start of the reveal if the engine has not drawn within the hold.
- Task 5's rule that the dock's second row is in neither picture.

## 7. Order

Tasks 27 and 28 run in lane A's tree on `r7/r56-arrival` (from `r7/r54-change-rings`) while lane B finishes tasks 25 and 26. The join then merges `r7/r56-arrival` into `r7/r55-live-boxes`, and R55's pull request is opened against `r7/r56-arrival`.

## 8. Left to the builder

- How the filter gets down to one map picture (4).
- How the reveal is held: pausing the reveal's clock while the pictures are up, or making the transition later. The page being left may be a still picture during the hold.
- How each page reports ready, and how the plain grid and the WebGL wall are made to match.

## 9. For Aditya to check

- The change on his 120 Hz display with nothing else running on the machine.
- Whether the half-strength bend on the arriving page still reads as glass.
- Whether the wait after a click (at most half a second) is acceptable on the walls.
