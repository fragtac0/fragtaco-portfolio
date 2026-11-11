/**
 * The painting engine's shader sources (see paint-engine.ts for what they do). Kept apart so the
 * engine stays short; they are plain strings with no logic.
 */

export const VERTEX_SRC =
  "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";

export const FRAGMENT_SRC = `precision highp float;varying vec2 v;
  uniform sampler2D uA,uB;uniform vec2 uRes,uFocA,uFocB,uDir;uniform float uAspA,uAspB,uZoomA,uZoomB,uP,uT,uMode,uHasA,uBlur,uDpr;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){return n(p)*.55+n(p*2.03+7.1)*.3+n(p*4.07-3.7)*.15;}
  vec2 cover(vec2 uv,float ia,vec2 foc,float z){float ca=uRes.x/uRes.y;vec2 s=ca>ia?vec2(1.,ia/ca):vec2(ca/ia,1.);s/=z;return foc*(1.-s)+uv*s;}
  vec3 soft(sampler2D t,vec2 uv){
    float b=uBlur*4.6;vec2 o=uBlur*vec2(.0055,.0095);
    vec3 c=texture2D(t,uv,b).rgb*2.+texture2D(t,uv+o,b).rgb+texture2D(t,uv-o,b).rgb+texture2D(t,uv+vec2(o.x,-o.y),b).rgb+texture2D(t,uv+vec2(-o.x,o.y),b).rgb;
    return c/6.*(1.-.36*uBlur);
  }
  vec3 finish(vec3 c){
    vec2 fc=gl_FragCoord.xy/uDpr;
    float d=length(fract(fc*.25)-.5)*4.;
    c=mix(c,vec3(.96,.937,.9),.065*(1.-smoothstep(.35,1.05,d)));
    return c+(h(floor(fc))-.5)*.04;
  }
  void main(){
    vec2 uv=vec2(v.x,1.-v.y);
    vec2 ub=cover(uv,uAspB,uFocB,uZoomB);
    if(uP>=1.){gl_FragColor=vec4(finish(uBlur>.002?soft(uB,ub):texture2D(uB,ub).rgb),1.);return;}
    if(uP<=0.&&uHasA<.5){gl_FragColor=vec4(finish(vec3(.02,.016,.012)),1.);return;}
    if(uMode>1.5){
      vec3 Bc=uBlur>.002?soft(uB,ub):texture2D(uB,ub).rgb;
      vec2 uc=cover(uv,uAspA,uFocA,uZoomA);
      vec3 Ac=uHasA<.5?vec3(.02,.016,.012):(uBlur>.002?soft(uA,uc):texture2D(uA,uc).rgb);
      gl_FragColor=vec4(finish(mix(Ac,Bc,uP)),1.);return;
    }
    float ca=uRes.x/uRes.y;vec2 pa=(uv-.5)*vec2(ca,1.);
    float d=uMode<.5?length(pa)/(.5*length(vec2(ca,1.))):dot(pa,uDir)/(.5*(abs(uDir.x)*ca+abs(uDir.y)))*.5+.5;
    d+=(fbm(pa*2.4+uT*.06)-.5)*.34;
    float f=mix(-.25,1.32,uP),w=.07;
    float mB=1.-smoothstep(f-w,f+w,d);
    float band=1.-abs(mB*2.-1.);
    float wake=smoothstep(f-.55,f,d)*mB;
    float s=(band+wake*.6+.1*sin(3.14159*uP))*(1.-smoothstep(.8,1.,uP));
    vec2 q=pa*3.1+vec2(uT*.07,-uT*.04);
    float e=.02,c=fbm(q);
    vec2 nrm=vec2(fbm(q+vec2(e,0.))-c,fbm(q+vec2(0.,e))-c)/e;
    vec2 off=nrm*.05*s;float k=1.+.4*s;
    vec2 ua=cover(uv,uAspA,uFocA,uZoomA);
    vec3 A=vec3(texture2D(uA,ua+off*k).r,texture2D(uA,ua+off).g,texture2D(uA,ua+off/k).b);
    if(uHasA<.5)A=vec3(.02,.016,.012);
    vec3 B=vec3(texture2D(uB,ub-off*k).r,texture2D(uB,ub-off).g,texture2D(uB,ub-off/k).b);
    vec3 col=mix(A,B,mB);
    vec3 N=normalize(vec3(-nrm*s*1.3,1.));
    col+=pow(max(dot(N,normalize(vec3(-.4,.5,1.))),0.),70.)*s*.55*vec3(1.,.97,.9);
    col+=band*.045*vec3(1.,.62,.38);
    gl_FragColor=vec4(finish(col),1.);
  }`;
