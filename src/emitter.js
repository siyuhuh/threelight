// Midpoint quadrature for a finite line emitter. The same samples drive
// surface lighting, atmospheric scattering, and particle illumination.
export const TUBE_SAMPLES = 6;
export const TUBE_CENTER = [0, 4, 1.2];

export function sampleTube(length, angleDegrees) {
  const angle = (angleDegrees * Math.PI) / 180;
  const axis = [Math.cos(angle), Math.sin(angle), 0];
  return Array.from({ length: TUBE_SAMPLES }, (_, i) => {
    const offset = ((i + 0.5) / TUBE_SAMPLES - 0.5) * length;
    return TUBE_CENTER.map(
      (value, component) => value + axis[component] * offset,
    );
  });
}

// Angular mask around the tube axis, shared by volume, particles and surfaces.
export const tubeSectorGLSL = /* glsl */ `
uniform vec3 tubeAxis, sectorDirection;
uniform float sectorHalfAngle;
float tubeSector(vec3 fromLight) {
 if(sectorHalfAngle>=3.1415) return 1.;
 vec3 radial=fromLight-tubeAxis*dot(fromLight,tubeAxis);
 float radius=length(radial);
 if(radius<.00001) return 0.;
 float angle=acos(clamp(dot(radial/radius,sectorDirection),-1.,1.));
 float feather=min(.10,sectorHalfAngle*.3);
 return 1.-smoothstep(sectorHalfAngle-feather,sectorHalfAngle,angle);
}
`;

export const emitterGLSL = /* glsl */ `
${tubeSectorGLSL}
uniform vec3 emitterPositions[6];
uniform bool tubeMode;
uniform vec3 lightPosition, lightDirection;
uniform float coneCos;
vec3 emitterPosition(int index) {
 return tubeMode ? emitterPositions[index] : lightPosition;
}
float emitterEnvelope(vec3 fromLight) {
 if(tubeMode) return tubeSector(fromLight);
 return smoothstep(coneCos,coneCos+.055,dot(normalize(fromLight),lightDirection));
}
`;

export const occlusionGLSL = /* glsl */ `
uniform vec3 sphereCenter;
uniform float sphereRadius;
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
`;

// Soft visibility for surfaces: sphere penumbra plus finite-line box visibility.
export const surfaceOcclusionGLSL = occlusionGLSL
  .replace(
    "visibleLight(vec3 p,vec3 source)",
    "surfaceVisibleLight(vec3 p,vec3 source)",
  )
  .replace(
    "if(disc>0.){float hit=-b-sqrt(disc);if(hit>0.002 && hit<limit)return 0.;}",
    `float visibility=1.;
  float along=-b;
  if(length(offset)>sphereRadius+.025 && along>0. && along<limit){
   float separation=length(offset+dir*along)-sphereRadius;
   float penumbra=.035+.09*along/max(limit-along,.2);
   visibility=smoothstep(-penumbra,penumbra,separation);
  }`,
  )
  .replace("return 1.;", "return visibility;");

// Rounded receivers lie slightly inside their conservative box occluders.
// Skip their own box, while keeping that box as an occluder for other receivers.
export const roundedSurfaceOcclusionGLSL = surfaceOcclusionGLSL
  .replace(
    "if(boxHit(p,dir,vec3(-.75,0.,-.75),vec3(.75,.65,.75),limit))",
    "if((any(lessThan(p,vec3(-.76,-.01,-.76))) || any(greaterThan(p,vec3(.76,.66,.76)))) && boxHit(p,dir,vec3(-.75,0.,-.75),vec3(.75,.65,.75),limit))",
  )
  .replace(
    "if(boxHit(p,dir,vec3(-2.1,0.,-.4),vec3(-1.7,2.7,0.),limit))",
    "if((any(lessThan(p,vec3(-2.11,-.01,-.41))) || any(greaterThan(p,vec3(-1.69,2.71,.01)))) && boxHit(p,dir,vec3(-2.1,0.,-.4),vec3(-1.7,2.7,0.),limit))",
  );
