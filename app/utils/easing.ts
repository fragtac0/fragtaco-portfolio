// Standard cubic-bezier(x1,y1,x2,y2) -> progress-fraction easing function,
// used so Lenis' scrollTo animates with the same house ease used everywhere
// else (`cubic-bezier(0.16, 1, 0.3, 1)`) instead of its own default curve.
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 0.0000001;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const SPLINE_TABLE_SIZE = 11;
  const SAMPLE_STEP_SIZE = 1 / (SPLINE_TABLE_SIZE - 1);

  const a = (x1: number, x2: number) => 1 - 3 * x2 + 3 * x1;
  const b = (x1: number, x2: number) => 3 * x2 - 6 * x1;
  const c = (x1: number) => 3 * x1;

  const calcBezier = (t: number, x1: number, x2: number) =>
    ((a(x1, x2) * t + b(x1, x2)) * t + c(x1)) * t;

  const getSlope = (t: number, x1: number, x2: number) =>
    3 * a(x1, x2) * t * t + 2 * b(x1, x2) * t + c(x1);

  const sampleValues = new Float32Array(SPLINE_TABLE_SIZE);
  for (let i = 0; i < SPLINE_TABLE_SIZE; i += 1) {
    sampleValues[i] = calcBezier(i * SAMPLE_STEP_SIZE, p1x, p2x);
  }

  const binarySubdivide = (x: number, startT: number, endT: number) => {
    let a0 = startT;
    let b0 = endT;
    let currentX = 0;
    let currentT = 0;
    let i = 0;

    do {
      currentT = a0 + (b0 - a0) / 2;
      currentX = calcBezier(currentT, p1x, p2x) - x;
      if (currentX > 0) {
        b0 = currentT;
      } else {
        a0 = currentT;
      }
      i += 1;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && i < SUBDIVISION_MAX_ITERATIONS);

    return currentT;
  };

  const newtonRaphsonIterate = (x: number, guessT: number) => {
    let t = guessT;
    for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
      const slope = getSlope(t, p1x, p2x);
      if (slope === 0) return t;
      const currentX = calcBezier(t, p1x, p2x) - x;
      t -= currentX / slope;
    }
    return t;
  };

  const getTForX = (x: number) => {
    let intervalStart = 0;
    let currentSample = 1;
    const lastSample = SPLINE_TABLE_SIZE - 1;

    for (; currentSample !== lastSample && sampleValues[currentSample] <= x; currentSample += 1) {
      intervalStart += SAMPLE_STEP_SIZE;
    }
    currentSample -= 1;

    const distBetween =
      (x - sampleValues[currentSample]) /
      (sampleValues[currentSample + 1] - sampleValues[currentSample]);
    const guessForT = intervalStart + distBetween * SAMPLE_STEP_SIZE;
    const initialSlope = getSlope(guessForT, p1x, p2x);

    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return newtonRaphsonIterate(x, guessForT);
    }
    if (initialSlope === 0) {
      return guessForT;
    }
    return binarySubdivide(x, intervalStart, intervalStart + SAMPLE_STEP_SIZE);
  };

  return (x: number) => {
    if (p1x === p1y && p2x === p2y) return x;
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return calcBezier(getTForX(x), p1y, p2y);
  };
}

export const houseEaseFn = cubicBezier(0.16, 1, 0.3, 1);
export const HOUSE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
