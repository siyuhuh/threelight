import { emitterGLSL } from "./emitter.js";

// Independently authored fullscreen single-scattering approximation.
// Depth terminates the view ray; analytic primitives occlude each emitter sample.
export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}
`;
export const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D sceneColor, sceneDepth;
uniform mat4 inverseProjection, cameraWorld;
uniform vec3 eye, lightColor;
${emitterGLSL}
uniform vec3 sphereCenter;
uniform float sphereRadius, density, power, time;
uniform int steps;
uniform bool enabled;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
bool boxHit(vec3 origin,vec3 direction,vec3 lo,vec3 hi,float limit){
 vec3 safeDir=mix(vec3(-1.),vec3(1.),step(vec3(0.),direction))*max(abs(direction),vec3(0.00001));
 vec3 a=(lo-origin)/safeDir,b=(hi-origin)/safeDir;
 vec3 nearT=min(a,b),farT=max(a,b);
 float entry=max(max(nearT.x,nearT.y),nearT.z);
 float leave=min(min(farT.x,farT.y),farT.z);
 return leave>max(entry,0.) && entry<limit;
}
float visibleLight(vec3 p,vec3 source){
 vec3 delta=source-p;float limit=length(delta);vec3 dir=delta/limit;
 vec3 offset=p-sphereCenter;float b=dot(offset,dir);
 float disc=b*b-dot(offset,offset)+sphereRadius*sphereRadius;
 if(disc>0.){float hit=-b-sqrt(disc);if(hit>0.002 && hit<limit)return 0.;}
 if(boxHit(p,dir,vec3(-.75,0.,-.75),vec3(.75,.65,.75),limit))return 0.;
 if(boxHit(p,dir,vec3(-2.1,0.,-.4),vec3(-1.7,2.7,0.),limit))return 0.;
 return 1.;
}
void main(){
 vec3 base=texture2D(sceneColor,vUv).rgb;

 float depth=texture2D(sceneDepth,vUv).r;
 vec4 view=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);
 vec3 surface=(cameraWorld*vec4(view.xyz/view.w,1.)).xyz;
 vec3 ray=normalize(surface-eye);float distanceToSurface=min(length(surface-eye),22.);
 float stride=distanceToSurface/float(steps);float jitter=hash(gl_FragCoord.xy);
 vec3 sum=vec3(0.);float transmittance=1.;
 for(int i=0;i<56;i++){
  if(i>=steps || !enabled)break;
  vec3 p=eye+ray*(float(i)+jitter)*stride;
  float bounds=smoothstep(0.,.22,p.y)*(1.-smoothstep(5.,6.,p.y));
  if(bounds<.001)continue;
  float mist=.83+.17*sin(p.x*2.1+time*.15)*sin(p.z*2.7-p.y+time*.12);
  float amount=density*bounds*mist*.13;
  float illumination=0.;float envelopeTotal=0.;
  // Total power stays fixed as tube length changes. Each sample carries 1/6.
  for(int sourceIndex=0;sourceIndex<6;sourceIndex++){
   if(!tubeMode && sourceIndex>0)break;
   vec3 source=emitterPosition(sourceIndex);
   vec3 fromLight=p-source;float d=max(length(fromLight),.001);
   float envelope=emitterEnvelope(fromLight);
   float weight=tubeMode ? 1./6. : 1.;
   envelopeTotal+=envelope*weight;
   if(envelope<.001)continue;
   float phase=.65+1.2*pow(max(dot(ray,fromLight/d),0.),4.);
   float falloff=tubeMode ? 1.2/(.08+d*d) : 7./(1.+d*d*.15);
   illumination+=weight*envelope*visibleLight(p,source)*phase*falloff;
  }
  sum+=transmittance*lightColor*power*amount*stride*illumination;
  transmittance*=exp(-amount*envelopeTotal*stride*.32);
 }
 gl_FragColor=vec4(base*transmittance+sum,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
