export const bloomFragmentShader = /* glsl */ `
varying vec2 vUv;
uniform sampler2D source;
uniform vec2 direction;
uniform bool extract;
vec3 sampleLight(vec2 uv){
 vec3 c=texture2D(source,uv).rgb;
 if(extract){float peak=max(c.r,max(c.g,c.b));c*=max(peak-1.15,0.)/max(peak,.0001);}
 return c;
}
void main(){
 vec3 light=sampleLight(vUv)*.227027;
 light+=(sampleLight(vUv+direction*1.384615)+sampleLight(vUv-direction*1.384615))*.316216;
 light+=(sampleLight(vUv+direction*3.230769)+sampleLight(vUv-direction*3.230769))*.070270;
 gl_FragColor=vec4(light,1.);
}
`;
