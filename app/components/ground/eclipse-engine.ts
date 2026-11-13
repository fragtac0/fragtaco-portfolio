/**
 * The Eclipse ground's WebGL 1 engine (spec 5.1): one full-screen triangle and the preview's fragment shader
 * (eclipse-shader.ts). One canvas pixel per CSS pixel. A frame is drawn about every 30 ms while running; a
 * stopped engine has no timer and no animation frame at all, and its canvas keeps the last frame it drew (the
 * compositor holds it), so a pause shows no pop and no black. A placement change or a resize draws one frame at
 * once even while stopped (a resized canvas is cleared, so it must be drawn again in the same task).
 *
 * `createEclipseEngine` returns null where WebGL is not there or a shader does not compile (the still picture
 * stays). A lost context is final: `onLost` is called once and the owner takes the canvas away. Client only.
 */
import { ECLIPSE, START_CLOCK, advanceClock, canvasSize, frameDue, type Placement } from "./eclipse-look";
import { FRAGMENT_SRC, TRIANGLE, VERTEX_SRC } from "./eclipse-shader";

export interface EclipseEngine {
  /** Switches the placement and draws one frame at the current time. */
  setPlacement(placement: Placement): void;
  /** Starts or stops the loop. */
  setRunning(running: boolean): void;
  /** Reads the canvas's CSS size again and draws one frame (called when the box changes). */
  resize(): void;
  /** Stops, frees the GL objects and gives the context back. */
  destroy(): void;
}

interface EngineOptions {
  placement: Placement;
  onLost: () => void;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

export function createEclipseEngine(canvas: HTMLCanvasElement, options: EngineOptions): EclipseEngine | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    // low power: the ground is decoration and must not wake a laptop's big GPU; no software fallback (too slow for this shader)
    gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: true,
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const context = gl;
  const give = () => context.getExtension("WEBGL_lose_context")?.loseContext();

  const vertex = compile(context, context.VERTEX_SHADER, VERTEX_SRC);
  const fragment = compile(context, context.FRAGMENT_SHADER, FRAGMENT_SRC);
  const program = context.createProgram();
  if (!vertex || !fragment || !program) {
    give();
    return null;
  }
  context.attachShader(program, vertex);
  context.attachShader(program, fragment);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    give();
    return null;
  }
  context.useProgram(program);
  const buffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, TRIANGLE, context.STATIC_DRAW);
  const position = context.getAttribLocation(program, "a");
  context.enableVertexAttribArray(position);
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
  const uniform = (name: string) => context.getUniformLocation(program, name);
  const uRes = uniform("uRes");
  const uT = uniform("uT");
  const uPlace = uniform("uPlace");
  const uNoise = uniform("uNoise");
  const uGrain = uniform("uGrain");
  context.uniform1f(uNoise, ECLIPSE.noise);
  context.uniform1f(uGrain, ECLIPSE.grain);

  let placement = options.placement;
  let clock = START_CLOCK;
  let last = 0;
  let raf = 0;
  let running = false;
  let dead = false;

  const lost = () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    options.onLost();
  };
  canvas.addEventListener("webglcontextlost", lost);

  function draw() {
    if (dead || context.isContextLost()) return;
    context.uniform2f(uRes, canvas.width, canvas.height);
    context.uniform1f(uT, clock);
    context.uniform1f(uPlace, placement);
    context.drawArrays(context.TRIANGLES, 0, 3);
  }

  function resize() {
    if (dead) return;
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return; // not laid out (display none): nothing to draw into
    const [w, h] = canvasSize(canvas.clientWidth, canvas.clientHeight);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      context.viewport(0, 0, w, h);
    }
    draw();
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (last === 0) {
      last = now;
      return;
    }
    if (!frameDue(now, last)) return;
    clock = advanceClock(clock, now - last);
    last = now;
    draw();
  };

  resize();

  return {
    setPlacement(next) {
      placement = next;
      draw();
    },
    setRunning(on) {
      if (dead || on === running) return;
      running = on;
      cancelAnimationFrame(raf);
      if (on) {
        last = 0; // the first tick only takes the time, so a pause is not a jump
        raf = requestAnimationFrame(tick);
      }
    },
    resize,
    destroy() {
      dead = true;
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", lost);
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
      context.deleteShader(vertex);
      context.deleteShader(fragment);
      give();
    },
  };
}
