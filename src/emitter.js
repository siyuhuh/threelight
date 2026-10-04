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

export const emitterGLSL = /* glsl */ `
uniform vec3 emitterPositions[6];
uniform bool tubeMode;
uniform vec3 lightPosition, lightDirection;
uniform float coneCos;
vec3 emitterPosition(int index) {
 return tubeMode ? emitterPositions[index] : lightPosition;
}
float emitterEnvelope(vec3 fromLight) {
 if(tubeMode) return 1.;
 return smoothstep(coneCos,coneCos+.055,dot(normalize(fromLight),lightDirection));
}
`;
