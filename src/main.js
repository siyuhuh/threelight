import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  vertexShader,
  fragmentShader,
  compositeFragmentShader,
} from "./volume.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createStudioEnvironment } from "./studio.js";
import { bloomFragmentShader } from "./bloom.js";
import "./style.css";
import {
  TUBE_SAMPLES,
  TUBE_CENTER,
  sampleTube,
  emitterGLSL,
  tubeSectorGLSL,
  roundedSurfaceOcclusionGLSL,
} from "./emitter.js";

const $ = (id) => document.getElementById(id);
const settings = { density: 0.65, power: 1, spread: 24 };
const presets = {
  gallery: {
    color: "#ffe3c1",
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
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  const environmentTarget = createStudioEnvironment(renderer);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.65;
  scene.background = new THREE.Color("#0a1018");
  scene.fog = new THREE.FogExp2("#0a1018", 0.065);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 40);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.9, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 17;
  controls.maxPolarAngle = Math.PI * 0.48;
  function resetView() {
    camera.position.set(5.5, 3.4, 8);
    controls.target.set(0, 1.9, 0);
    controls.update();
  }
  resetView();
  $("reset").onclick = resetView;
  scene.add(new THREE.HemisphereLight("#aec0bb", "#242821", 0.18));
  const spot = new THREE.SpotLight(
    "#ffe3c1",
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
  // Atmosphere uses quadrature samples; surfaces use continuous LTC area lights.
  const emitterPositions = Array.from(
    { length: TUBE_SAMPLES },
    () => new THREE.Vector3(),
  );
  const tubeAreaLights = Array.from({ length: 4 }, () => {
    const light = new THREE.RectAreaLight(spot.color, 20, 3, 0.11);
    light.position.fromArray(TUBE_CENTER);
    scene.add(light);
    return light;
  });
  const emitterUniforms = {
    emitterPositions: { value: emitterPositions },
    tubeMode: { value: true },
    tubeAxis: { value: new THREE.Vector3(1, 0, 0) },
    sectorDirection: { value: new THREE.Vector3(0, -1, 0) },
    sectorHalfAngle: { value: Math.PI / 4 },
    sphereCenter: { value: new THREE.Vector3(0, 1.62, 0) },
    sphereRadius: { value: 0.78 },
    cameraWorld: { value: camera.matrixWorld },
    emitterLength: { value: 3 },
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
  const rim = new THREE.DirectionalLight("#c4d4df", 0.25);
  rim.position.set(3, 4, -4);
  scene.add(rim);
  function sectorMaterial(options) {
    const material = new THREE.MeshStandardMaterial(options);
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, emitterUniforms);
      shader.fragmentShader =
        tubeSectorGLSL +
        roundedSurfaceOcclusionGLSL +
        "uniform mat4 cameraWorld; uniform float emitterLength; uniform vec3 emitterPositions[6];\n" +
        shader.fragmentShader;
      let lighting = THREE.ShaderChunk.lights_fragment_begin;
      lighting = lighting.replace(
        "RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",
        `{ vec3 receiver=(cameraWorld*vec4(geometryPosition,1.)).xyz;
           vec3 source=(cameraWorld*vec4(rectAreaLight.position,1.)).xyz;
           // Closest point on the finite line gives a smooth visibility estimate.
           source+=tubeAxis*clamp(dot(receiver-source,tubeAxis),-.5*emitterLength,.5*emitterLength);
           vec3 delta=source-receiver;
           float visibility=0.;
           for(int sampleIndex=0;sampleIndex<6;sampleIndex++){
             vec3 sampleDelta=emitterPositions[sampleIndex]-receiver;
             visibility+=surfaceVisibleLight(receiver+normalize(sampleDelta)*.006,emitterPositions[sampleIndex])/6.;
           }
           rectAreaLight.color*=tubeSector(-delta)*visibility;
           RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); }`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        lighting,
      );
    };
    material.customProgramCacheKey = () => "tube-area-soft-shadow-v3";
    return material;
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    sectorMaterial({
      color: "#202b36",
      roughness: 0.7,
      metalness: 0.12,
      envMapIntensity: 0.3,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const material = sectorMaterial({
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
    new RoundedBoxGeometry(1.5, 0.65, 1.5, 3, 0.045),
    [0, 0.325, 0],
    sectorMaterial({ color: "#344452", roughness: 0.38, metalness: 0.4 }),
  );
  const sphere = solid(
    new THREE.SphereGeometry(0.78, 96, 64),
    [0, 1.62, 0],
    sectorMaterial({ color: "#b8c4cf", roughness: 0.2, metalness: 0.9 }),
  );
  solid(new RoundedBoxGeometry(0.4, 2.7, 0.4, 3, 0.035), [-1.9, 1.35, -0.2]);
  emitterUniforms.sphereCenter.value = sphere.position;
  const positions = new Float32Array(180 * 3);
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
        gl_FragColor=vec4(color,clamp(illumination,0.,1.)*(1.-radius*2.)*.2);
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
  const volumeMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const volumeTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  const bloomTargets = [0, 1].map(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
      }),
  );
  const bloomMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: bloomFragmentShader,
    uniforms: {
      source: { value: target.texture },
      direction: { value: new THREE.Vector2() },
      extract: { value: true },
    },
    depthTest: false,
    depthWrite: false,
  });
  const composite = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: compositeFragmentShader,
    uniforms: {
      sceneColor: { value: target.texture },
      sceneDepth: { value: target.depthTexture },
      volumeTexture: { value: volumeTarget.texture },
      volumeSize: { value: new THREE.Vector2(1, 1) },
      volumeEnabled: uniforms.enabled,
      bloomTexture: { value: bloomTargets[1].texture },
    },
    depthTest: false,
    depthWrite: false,
  });
  const screen = new THREE.Scene();
  const screenQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    volumeMaterial,
  );
  screen.add(screenQuad);
  const screenCamera = new THREE.Camera();
  function syncEmitter() {
    const tube = $("shape").value === "tube";
    const length = Number($("length").value);
    const angle = Number($("angle").value);
    const sector = Number($("sector").value);
    const heading = Number($("heading").value);
    const axisAngle = THREE.MathUtils.degToRad(angle);
    const headingAngle = THREE.MathUtils.degToRad(heading);
    emitterUniforms.tubeAxis.value.set(
      Math.cos(axisAngle),
      Math.sin(axisAngle),
      0,
    );
    emitterUniforms.sectorDirection.value.set(
      Math.sin(axisAngle) * Math.cos(headingAngle),
      -Math.cos(axisAngle) * Math.cos(headingAngle),
      Math.sin(headingAngle),
    );
    emitterUniforms.sectorHalfAngle.value = THREE.MathUtils.degToRad(
      sector / 2,
    );
    $("sector-value").textContent = sector + "°";
    $("heading-value").textContent = heading + "°";
    // Cross-section diagram: 0° is downward, positive heading turns toward +Z.
    const start = THREE.MathUtils.degToRad(heading - sector / 2);
    const end = THREE.MathUtils.degToRad(heading + sector / 2);
    const point = (a) => `${36 * Math.sin(a)},${36 * Math.cos(a)}`;
    $("sector-path").setAttribute(
      "d",
      sector === 360
        ? "M 0,-36 A 36,36 0 1 1 0,36 A 36,36 0 1 1 0,-36 Z"
        : `M 0,0 L ${point(start)} A 36,36 0 ${sector > 180 ? 1 : 0} 0 ${point(end)} Z`,
    );
    $("sector-diagram").setAttribute(
      "aria-label",
      `Tube cross-section: ${sector} degree emission, heading ${heading} degrees`,
    );
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
    emitterUniforms.emitterLength.value = length;
    samples.forEach((position, i) => emitterPositions[i].fromArray(position));
    const axis = emitterUniforms.tubeAxis.value;
    const down = new THREE.Vector3(
      Math.sin(axisAngle),
      -Math.cos(axisAngle),
      0,
    );
    tubeAreaLights.forEach((light, i) => {
      light.visible = tube;
      light.width = length;
      light.intensity = (600 * settings.power) / length;
      light.color.copy(spot.color);
      const azimuth = (i * Math.PI) / 2;
      const emission = down
        .clone()
        .multiplyScalar(Math.cos(azimuth))
        .add(new THREE.Vector3(0, 0, Math.sin(azimuth)));
      const localZ = emission.negate();
      const localY = new THREE.Vector3().crossVectors(localZ, axis);
      light.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(axis, localY, localZ),
      );
    });
  }
  for (const key of ["shape", "length", "angle", "sector", "heading"])
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
    const ratio = Math.min(devicePixelRatio, 1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight);
    const samples = high ? 4 : 0;
    if (target.samples !== samples) {
      target.dispose();
      target.samples = samples;
    }
    target.setSize(
      Math.floor(innerWidth * ratio),
      Math.floor(innerHeight * ratio),
    );
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const scale = high ? 0.5 : 0.25;
    const vw = Math.max(1, Math.floor(innerWidth * ratio * scale));
    const vh = Math.max(1, Math.floor(innerHeight * ratio * scale));
    volumeTarget.setSize(vw, vh);
    composite.uniforms.volumeSize.value.set(vw, vh);
    bloomTargets.forEach((rt) =>
      rt.setSize(
        Math.max(1, Math.floor(innerWidth / 4)),
        Math.max(1, Math.floor(innerHeight / 4)),
      ),
    );
    uniforms.steps.value = high ? 56 : 32;
    particleMaterial.uniforms.pixelRatio.value = ratio;
  }
  window.addEventListener("resize", resize);
  $("quality").onchange = resize;
  resize();
  sync();
  let dirty = true;
  controls.addEventListener("change", () => {
    dirty = true;
  });
  document.addEventListener("click", () => {
    dirty = true;
  });
  document.addEventListener("input", () => {
    dirty = true;
  });
  document.addEventListener("change", () => {
    dirty = true;
  });
  window.addEventListener("resize", () => {
    dirty = true;
  });
  $("reset").addEventListener("click", () => {
    dirty = true;
  });
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  let measuredFrames = 0,
    measureStart = performance.now(),
    renderedFrames = 0;
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
    if (!dirty && !$("motion").checked) {
      $("render-status").textContent = "Paused · redraw on interaction";
      return;
    }
    renderer.info.reset();
    dirty = false;
    spot.shadow.needsUpdate = spot.visible;
    renderer.shadowMap.needsUpdate = spot.visible;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    if (uniforms.enabled.value) {
      screenQuad.material = volumeMaterial;
      renderer.setRenderTarget(volumeTarget);
      renderer.render(screen, screenCamera);
    }
    screenQuad.material = bloomMaterial;
    bloomMaterial.uniforms.source.value = target.texture;
    bloomMaterial.uniforms.extract.value = true;
    bloomMaterial.uniforms.direction.value.set(1 / bloomTargets[0].width, 0);
    renderer.setRenderTarget(bloomTargets[0]);
    renderer.render(screen, screenCamera);
    bloomMaterial.uniforms.source.value = bloomTargets[0].texture;
    bloomMaterial.uniforms.extract.value = false;
    bloomMaterial.uniforms.direction.value.set(0, 1 / bloomTargets[1].height);
    renderer.setRenderTarget(bloomTargets[1]);
    renderer.render(screen, screenCamera);
    screenQuad.material = composite;
    renderer.setRenderTarget(null);
    renderer.render(screen, screenCamera);
    $("status").hidden = true;
    renderedFrames++;
    measuredFrames++;
    $("render-status").dataset.frames = String(renderedFrames);
    $("render-status").dataset.draws = String(renderer.info.render.calls);
    if (now - measureStart >= 500) {
      $("render-status").textContent =
        `${Math.round((measuredFrames * 1000) / (now - measureStart))} FPS · ${renderer.info.render.calls} draws`;
      measureStart = now;
      measuredFrames = 0;
    }
  }
  renderer.setAnimationLoop(frame);
  document.addEventListener("visibilitychange", () => {
    previous = 0;
    dirty = true;
    renderer.setAnimationLoop(document.hidden ? null : frame);
  });
}
