/**
 * The Eclipse ground's shaders (spec 5.1), ported from the fragment shader of round 7's preview 7 ("Eclipse"):
 * the shapes, the colour stops and the still coarse grain are the specification and are kept as they were written;
 * only the comments and the layout of this file are new. `eclipse-look.test.ts` holds the SHA-256 of the exact text
 * and its load-bearing lines, so the port cannot drift (and the test reads nothing from `docs/`). WebGL 1. The four placements
 * are chosen by the `uPlace` uniform (0 light on the right with the shoulder from the lower left, 1 the same mirrored,
 * 2 light from below behind a dark disc, 3 light from the upper right). `scripts/audit/make-eclipse-stills.mjs`
 * reads FRAGMENT_SRC from this file to draw the stills in `public/grounds/`, so keep it a single template literal.
 */

export const FRAGMENT_SRC = `precision highp float;
uniform vec2 uRes; uniform float uT, uPlace, uNoise, uGrain;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p=p*2.02+vec2(3.1,1.7); a*=.5; } return s; }
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y; float asp=uRes.x/uRes.y; float t=uT;
  vec2 w=p+.12*vec2(fbm(p*1.2+t*.03), fbm(p*1.2-t*.025+4.));        // no edge stays geometric
  vec2 c1, c2; float sIn=.82, sOut=1.3, reach=1.55;
  if(uPlace<.5){ c1=vec2(asp*.62,.08); c2=vec2(-asp*.18,-.95); }                    // light on the right, shoulder from the lower left
  else if(uPlace<1.5){ c1=vec2(-asp*.6,.1); c2=vec2(asp*.2,-.95); }                 // the same, mirrored
  else if(uPlace<2.5){ c1=vec2(0.,-.8); c2=vec2(0.,.62); sIn=.6; sOut=1.2; reach=1.7; } // light from below, a dark disc above: a sunrise behind a planet
  else { c1=vec2(asp*.45,.8); c2=vec2(-asp*.12,-.62); }                             // light from the upper right
  c1+=vec2(.11*sin(t*.05), .09*cos(t*.04));                         // the light wanders
  c2+=vec2(.13*sin(t*.035+1.), .11*cos(t*.045+2.));                 // the shoulder wanders against it
  float L=smoothstep(reach,.05,length(w-c1))*smoothstep(sIn,sOut,length(w-c2))*1.05;
  float nz=fbm(w*1.6+vec2(t*.06,-t*.04)), nz2=fbm(w*3.1-vec2(t*.05,t*.03)+9.);
  L*=1.+uNoise*(.6*(nz-.5)+.32*(nz2-.5));                           // the noise gradient: slow smoke in the light
  L=clamp(L,0.,1.);
  vec3 col=vec3(.045,.043,.040);
  col=mix(col,vec3(.20,.068,.022),smoothstep(0.,.34,L));
  col=mix(col,vec3(.80,.33,.075),smoothstep(.22,.82,L));
  col=mix(col,vec3(.97,.50,.14),smoothstep(.78,1.,L)*.55);
  // grain like the tooth of paper: coarse, strong and still. Two sizes of speck, stronger where the light is.
  float g1=h(floor(gl_FragCoord.xy/1.5))-.5, g2=n(gl_FragCoord.xy/2.6)-.5, g3=h(floor(gl_FragCoord.xy/3.)+41.)-.5;
  float gr=g1*.62+g2*.5+g3*.3; float lum=dot(col,vec3(.4,.45,.15));
  col+=vec3(1.,.82,.6)*gr*uGrain*(.13+.6*lum);
  col=max(col,vec3(0.));
  gl_FragColor=vec4(col,1.);
}`;

export const VERTEX_SRC = "attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }";

/** One triangle that covers the whole screen (clip space), as in the preview. */
export const TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);
