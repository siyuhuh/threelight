import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { vertexShader, fragmentShader } from "./volume.js";
import "./style.css";
import {
  TUBE_SAMPLES,
  TUBE_CENTER,
  sampleTube,
  emitterGLSL,
} from "./emitter.js";

const $ = (id) => document.getElementById(id);
const settings = { density: 0.65, power: 1, spread: 24 };
const presets = {
  gallery: {
    color: "#dce9b2",
    density: 0.65,
    power: 1,
    spread: 24,
    label: "01 / GALLERY",
  },
  arctic: {
    color: "#91ceff",
    density: 0.9,
    power: 1.2,
    spread: 30,
    label: "02 / ARCTIC",
  },
  ember: {
    color: "#ff9963",
    density: 1.05,
    power: 1.4,
    spread: 19,
    label: "03 / EMBER",
  },
};
let renderer;
function fail(message) {
  $("status").hidden = false;
  $("status").querySelector("strong").textContent =
    "The light study could not start.";
  $("status-detail").textContent = message;
  $("retry").hidden = false;
}
$("retry").onclick = () => location.reload();
try {
  start();
} catch (error) {
  console.error(error);
  fail(
    "This experience needs WebGL 2. Try enabling hardware acceleration or opening it in another browser.",
  );
}

function start() {
  $("controls").open = !matchMedia("(max-width: 760px)").matches;
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  if (!renderer.extensions.has("EXT_color_buffer_float"))
    throw new Error("Half-float rendering is unavailable.");
  renderer.setClearColor("#101416");
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  $("scene").appendChild(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    fail(
      "The graphics context was interrupted. Close other graphics-heavy tabs and try again.",
    );
  });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#101416");
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 40);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.9, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 17;
  controls.maxPolarAngle = Math.PI * 0.48;
  function resetView() {
    camera.position.set(7, 4.6, 10.5);
    controls.target.set(0, 1.9, 0);
    controls.update();
  }
  resetView();
  $("reset").onclick = resetView;
  scene.add(new THREE.HemisphereLight("#aec0bb", "#242821", 0.55));
  const spot = new THREE.SpotLight(
    "#dce9b2",
    150,
    22,
    THREE.MathUtils.degToRad(24),
    0.35,
    2,
  );
  spot.position.set(-3.3, 5.8, 1.3);
  spot.target.position.set(0.5, 0.4, -0.3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0003;
  spot.shadow.normalBias = 0.025;
  scene.add(spot, spot.target);
  const tubeLights = Array.from({ length: TUBE_SAMPLES }, () => {
    const light = new THREE.PointLight(spot.color, 150 / TUBE_SAMPLES, 22, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256);
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 22;
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.025;
    scene.add(light);
    return light;
  });
  const emitterPositions = tubeLights.map((light) => light.position);
  const emitterUniforms = {
    emitterPositions: { value: emitterPositions },
    tubeMode: { value: true },
  };
  const emitterMaterial = new THREE.MeshBasicMaterial({
    color: spot.color.clone().multiplyScalar(4),
  });
  const tubeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1, 16),
    emitterMaterial,
  );
  tubeMesh.position.fromArray(TUBE_CENTER);
  scene.add(tubeMesh);
  const spotMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 12),
    emitterMaterial,
  );
  spotMesh.position.copy(spot.position);
  scene.add(spotMesh);
  const rim = new THREE.DirectionalLight("#c4d4df", 1.7);
  rim.position.set(3, 4, -4);
  scene.add(rim);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: "#343b35", roughness: 0.92 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const material = new THREE.MeshStandardMaterial({
    color: "#707b6b",
    roughness: 0.28,
    metalness: 0.65,
  });
  function solid(geometry, position, mat = material) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  solid(
    new THREE.BoxGeometry(1.5, 0.65, 1.5),
    [0, 0.325, 0],
    new THREE.MeshStandardMaterial({ color: "#313b32", roughness: 0.8 }),
  );
  const sphere = solid(new THREE.SphereGeometry(0.78, 64, 32), [0, 1.62, 0]);
  solid(new THREE.BoxGeometry(0.4, 2.7, 0.4), [-1.9, 1.35, -0.2]);
  const rings = new THREE.GridHelper(30, 30, "#485445", "#29332b");
  rings.position.y = 0.003;
  rings.material.transparent = true;
  rings.material.opacity = 0.16;
  scene.add(rings);
  const positions = new Float32Array(420 * 3);
  let seed = 23;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (random() - 0.5) * 6;
    positions[i + 1] = random() * 5;
    positions[i + 2] = (random() - 0.5) * 5;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...emitterUniforms,
      lightPosition: { value: spot.position },
      lightDirection: { value: new THREE.Vector3() },
      color: { value: spot.color },
      coneCos: { value: 0 },
      time: { value: 0 },
      pixelRatio: { value: 1 },
    },
    vertexShader: `uniform float time,pixelRatio; varying vec3 world; void main(){vec3 p=position;p.y=mod(p.y+time*.065,5.);world=(modelMatrix*vec4(p,1.)).xyz;vec4 mv=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(17./-mv.z,1.,3.)*pixelRatio;}`,
    fragmentShader: `${emitterGLSL}
      uniform vec3 color; varying vec3 world;
      void main(){
        float radius=length(gl_PointCoord-.5);if(radius>.5)discard;
        float illumination=0.;
        for(int i=0;i<6;i++){
          if(!tubeMode && i>0)break;
          vec3 delta=world-emitterPosition(i);
          illumination+=emitterEnvelope(delta)*7./(1.+dot(delta,delta)*.15)*(tubeMode?1./6.:1.);
        }
        gl_FragColor=vec4(color,clamp(illumination,0.,1.)*(1.-radius*2.)*.45);
      }`,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
  });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const direction = spot.target.position.clone().sub(spot.position).normalize();
  const uniforms = {
    ...emitterUniforms,
    sceneColor: { value: target.texture },
    sceneDepth: { value: target.depthTexture },
    inverseProjection: { value: camera.projectionMatrixInverse },
    cameraWorld: { value: camera.matrixWorld },
    eye: { value: camera.position },
    lightPosition: { value: spot.position },
    lightDirection: { value: direction },
    lightColor: { value: spot.color },
    sphereCenter: { value: sphere.position },
    sphereRadius: { value: 0.78 },
    density: { value: 0.65 },
    power: { value: 1 },
    coneCos: { value: Math.cos(spot.angle) },
    time: { value: 0 },
    steps: { value: 56 },
    enabled: { value: true },
  };
  particleMaterial.uniforms.lightDirection.value.copy(direction);
  const composite = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const screen = new THREE.Scene();
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));
  const screenCamera = new THREE.Camera();
  function syncEmitter() {
    const tube = $("shape").value === "tube";
    const length = Number($("length").value);
    const angle = Number($("angle").value);
    emitterUniforms.tubeMode.value = tube;
    $("tube-controls").hidden = !tube;
    $("spot-controls").hidden = tube;
    $("length-value").textContent = length.toFixed(1) + " m";
    $("angle-value").textContent = angle + "°";
    spot.visible = !tube;
    spotMesh.visible = !tube;
    tubeMesh.visible = tube;
    tubeMesh.scale.y = length;
    tubeMesh.rotation.z = THREE.MathUtils.degToRad(angle) - Math.PI / 2;
    emitterMaterial.color.copy(spot.color).multiplyScalar(4);
    const samples = sampleTube(length, angle);
    tubeLights.forEach((light, i) => {
      light.visible = tube;
      light.position.fromArray(samples[i]);
      light.intensity = (150 * settings.power) / TUBE_SAMPLES;
      light.color.copy(spot.color);
    });
  }
  for (const key of ["shape", "length", "angle"])
    $(key).addEventListener("input", syncEmitter);
  function sync() {
    for (const key of ["density", "power", "spread"]) {
      settings[key] = Number($(key).value);
      $(key + "-value").textContent =
        key === "spread" ? settings[key] + "°" : settings[key].toFixed(2);
    }
    spot.intensity = 150 * settings.power;
    spot.angle = THREE.MathUtils.degToRad(settings.spread);
    uniforms.density.value = settings.density;
    uniforms.power.value = settings.power;
    uniforms.coneCos.value = Math.cos(spot.angle);
    particleMaterial.uniforms.coneCos.value = uniforms.coneCos.value;
    syncEmitter();
  }
  for (const key of ["density", "power", "spread"])
    $(key).addEventListener("input", sync);
  document.querySelectorAll("[data-preset]").forEach((button) =>
    button.addEventListener("click", () => {
      const preset = presets[button.dataset.preset];
      spot.color.set(preset.color);
      for (const key of ["density", "power", "spread"])
        $(key).value = preset[key];
      $("preset-name").textContent = preset.label;
      document
        .querySelectorAll("[data-preset]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      sync();
    }),
  );
  $("volume").onchange = () => (uniforms.enabled.value = $("volume").checked);
  $("particles").onchange = () => (particles.visible = $("particles").checked);
  $("motion").checked = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("quality").value = matchMedia("(max-width: 760px)").matches
    ? "low"
    : "high";
  function resize() {
    const high = $("quality").value === "high";
    const ratio = Math.min(devicePixelRatio, high ? 1.5 : 1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight);
    target.setSize(
      Math.floor(innerWidth * ratio),
      Math.floor(innerHeight * ratio),
    );
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    uniforms.steps.value = high ? 56 : 24;
    particleMaterial.uniforms.pixelRatio.value = ratio;
  }
  window.addEventListener("resize", resize);
  $("quality").onchange = resize;
  resize();
  sync();
  let previous = 0,
    elapsed = 0;
  function frame(now) {
    const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    if ($("motion").checked) elapsed += delta;
    sphere.position.y = 1.62 + Math.sin(elapsed * 0.65) * 0.13;
    uniforms.time.value = elapsed;
    particleMaterial.uniforms.time.value = elapsed;
    controls.update();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(screen, screenCamera);
    $("status").hidden = true;
  }
  renderer.setAnimationLoop(frame);
  document.addEventListener("visibilitychange", () => {
    previous = 0;
    renderer.setAnimationLoop(document.hidden ? null : frame);
  });
}
