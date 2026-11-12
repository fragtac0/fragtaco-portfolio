import type { ReactNode } from "react";

interface WorkBackgroundProps {
  /**
   * The ground of the work addresses: draws the still CSS picture (`.work-wash`, the first frame of the
   * shader ground) and its own ground colour, fixed behind the pages; `children` (the shader canvas, if
   * it runs) go between that picture and the dot screen. Without it: the flat page ground of the
   * timeline page, which has the map for a ground.
   */
  ground?: boolean;
  children?: ReactNode;
}

/**
 * The dark ground: the site's dot screen and grain, which stay still and sit on top of everything
 * here, over the page's ground (tokens.css --ground). With `ground`, also the still gradient under
 * them, which is what shows before the shader is up and wherever it cannot run (no WebGPU, reduced
 * motion, save-data, a failed start). It used to carry two huge drifting glows that read as haze (R42);
 * the ground's pool and ember are weak and small on purpose (spec 6.4). Decorative.
 */
export default function WorkBackground({ ground = false, children }: WorkBackgroundProps) {
  return (
    <div className={ground ? "work-bg work-bg-ground" : "work-bg"} aria-hidden="true">
      {ground ? <div className="work-wash" /> : null}
      {children}
      <div className="work-tex" />
    </div>
  );
}
