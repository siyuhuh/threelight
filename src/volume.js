import { emitterGLSL, occlusionGLSL } from "./emitter.js";

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
uniform float density, power, time;
uniform int steps;
uniform bool enabled;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
${occlusionGLSL}
void main(){


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
 gl_FragColor=vec4(sum,transmittance);
}
`;

// Depth-aware reconstruction keeps reduced-resolution light off silhouettes.
export const compositeFragmentShader = /* glsl */ `
varying vec2 vUv;
uniform sampler2D sceneColor, sceneDepth, volumeTexture;
uniform vec2 volumeSize;
uniform bool volumeEnabled;
void main(){
 vec3 base=texture2D(sceneColor,vUv).rgb;
 float depth=texture2D(sceneDepth,vUv).r;
 vec2 grid=vUv*volumeSize-.5;
 vec2 origin=floor(grid+.5);
 vec4 light=vec4(0.,0.,0.,1.);
 if(volumeEnabled){
  light=vec4(0.);float total=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 cell=origin+vec2(float(x),float(y));
   vec2 uv=(cell+.5)/volumeSize;
   vec2 offset=cell-grid;
   float neighborDepth=texture2D(sceneDepth,uv).r;
   float weight=exp(-.7*dot(offset,offset))/(.0002+abs(neighborDepth-depth));
   light+=texture2D(volumeTexture,uv)*weight;total+=weight;
  }
  light/=max(total,.00001);
 }
 gl_FragColor=vec4(base*light.a+light.rgb,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
