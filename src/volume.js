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
uniform float density, power, time, emitterLength;
uniform int steps;
uniform bool enabled;
${occlusionGLSL}
void clipHalfSpace(vec3 normal,vec3 center,vec3 ray,inout float entry,inout float exit){
 float origin=dot(eye-center,normal),direction=dot(ray,normal);
 if(abs(direction)<.00001){if(origin<0.)exit=-1.;return;}
 float crossing=-origin/direction;
 if(direction>0.)entry=max(entry,crossing);else exit=min(exit,crossing);
}
void main(){


 float depth=texture2D(sceneDepth,vUv).r;
 vec4 view=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);
 vec3 surface=(cameraWorld*vec4(view.xyz/view.w,1.)).xyz;
 vec3 ray=normalize(surface-eye);float distanceToSurface=min(length(surface-eye),22.);
 // Restrict integration to the atmosphere slab rather than wasting steps in empty sky.
 float entry=0.,exit=distanceToSurface;
 if(abs(ray.y)>.0001){
  float a=(.015-eye.y)/ray.y,b=(5.8-eye.y)/ray.y;
  entry=max(0.,min(a,b));exit=min(exit,max(a,b));
 }
 if(tubeMode && sectorHalfAngle<=1.5708){
  vec3 center=(emitterPositions[0]+emitterPositions[5])*.5;
  vec3 side=normalize(cross(tubeAxis,sectorDirection));
  clipHalfSpace(sectorDirection*sin(sectorHalfAngle)+side*cos(sectorHalfAngle),center,ray,entry,exit);
  clipHalfSpace(sectorDirection*sin(sectorHalfAngle)-side*cos(sectorHalfAngle),center,ray,entry,exit);
 }
 if(exit<=entry){gl_FragColor=vec4(0.,0.,0.,1.);return;}
 float stride=(exit-entry)/float(steps);
 // Midpoint quadrature is stable when paused and avoids magnified random speckles.
 float jitter=.5;
 vec3 sum=vec3(0.);float transmittance=1.;
 for(int i=0;i<64;i++){
  if(i>=steps || !enabled)break;
  vec3 p=eye+ray*(entry+(float(i)+jitter)*stride);
  float bounds=smoothstep(0.,.22,p.y)*(1.-smoothstep(5.,6.,p.y));
  if(bounds<.001)continue;
  float mist=.83+.17*sin(p.x*2.1+time*.15)*sin(p.z*2.7-p.y+time*.12);
  float amount=density*bounds*mist*.13;
  float illumination=0.;float envelopeTotal=0.;
  if(tubeMode){
   vec3 center=(emitterPositions[0]+emitterPositions[5])*.5;
   vec3 offset=p-center;float axial=dot(offset,tubeAxis);
   vec3 radial=offset-tubeAxis*axial;
   float r=sqrt(dot(radial,radial)+.12);
   float halfLength=emitterLength*.5;
   // Exact integral of the regularized inverse-square falloff along a finite line.
   float falloff=1.2*(atan((halfLength-axial)/r)+atan((halfLength+axial)/r))/(emitterLength*r);
   float envelope=tubeSector(offset);
   envelopeTotal=envelope;
   if(envelope>.001){
    float visibility=0.;
    for(int j=0;j<6;j++)visibility+=visibleLight(p,emitterPositions[j])/6.;
    float phase=.7+.65*pow(max(dot(ray,normalize(offset)),0.),4.);
    illumination=envelope*visibility*phase*falloff;
   }
  }else{
   vec3 fromLight=p-lightPosition;float d=max(length(fromLight),.001);
   float envelope=emitterEnvelope(fromLight);envelopeTotal=envelope;
   if(envelope>.001){
    float phase=.65+1.2*pow(max(dot(ray,fromLight/d),0.),4.);
    illumination=envelope*visibleLight(p,lightPosition)*phase*7./(1.+d*d*.15);
   }
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
uniform sampler2D sceneColor, sceneDepth, volumeTexture, bloomTexture;
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
 gl_FragColor=vec4(base*light.a+light.rgb+texture2D(bloomTexture,vUv).rgb*.16,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
