# ThreeLight

**Give light some space.** A small, interactive study of volumetric light, built with Three.js and original GLSL.

[Live playground](https://siyuhuh.github.io/threelight/) · [Report a bug](https://github.com/siyuhuh/threelight/issues)

![ThreeLight Gallery preset](docs/preview.jpg)

## Explore

- Continuous tube highlights from LTC rectangular area lights, plus a procedurally generated, prefiltered studio environment for metal reflections.
- Tube and spotlight emitters, with a visible light source. Tube length (0.5–4 m) and rotation (0–180°) change the source geometry and illumination together.
- Tube emission sector: adjustable 15–360° width and ±180° direction, with a live cross-section diagram. Defaults to a 90° downward sector.
- Three atmosphere presets: Gallery, Arctic, and Ember.
- Live scattering, intensity, and beam spread controls.
- Toggle volumetric light and particles to compare the effect.
- Orbit and zoom around an entirely procedural scene.
- Low (32 steps at quarter width/height) and high (56 steps at half width/height) rendering modes.
- Motion toggle, reduced-motion preference support, and pause while the tab is hidden.
- WebGL initialization and context-loss feedback.

No account, backend, model downloads, external fonts, or API keys are required.

## Run locally

Use Node.js 22.12+ (Node.js 24 is recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To build and preview the production bundle:

```sh
npm run build
npm run preview
```

## How it works

1. Three.js draws the procedural scene into a half-float color target with a depth texture. A spotlight or four narrow rectangular area lights illuminate the surfaces. The rectangles approximate the sides of a tube with continuous LTC highlights; analytic primitive visibility avoids cube shadow maps. The tube uses an angular emission sector around its axis; 360° restores omnidirectional emission. Beam spread applies only to spotlight mode.
2. A fullscreen shader reconstructs a world-space view ray from the camera matrices and the scene depth.
3. The shader samples atmospheric scattering along that ray, stopping at the visible surface. Spotlight cone falloff or continuous finite-line attenuation, distance attenuation, and a slowly varying density field shape the illumination.
4. Ray/sphere and ray/box intersections approximate visibility toward each emitter sample for the three scene objects. The floating sphere position is shared with the shader.
5. Light is integrated into a reduced-resolution target and reconstructed with depth-aware weights before compositing with the full-resolution scene. A quarter-resolution separable bloom pass adds restrained source glow. Shader-animated point sprites add suspended dust.

This is a visual approximation, not a physically accurate participating-media renderer. The volume occlusion is specific to the procedural objects: adding arbitrary meshes requires extending the occlusion representation. Particles are depth-tested against visible geometry but do not sample spotlight shadows. Atmospheric brightness uses an analytic regularized finite-line integral; visibility and particles use six midpoint samples. Surfaces use four continuous rectangular area lights aligned with the tube. The environment reflection is prefiltered once at startup from three original procedural softbox cards, with no external asset download. Total sampled light power stays fixed as length changes. Narrowing the emission sector masks directions rather than redistributing their energy into the remaining sector. The sector mask is shared by the surface-light shader, volumetric shader, and particles, with a softened boundary of up to roughly 5.7°. Direction 0° points downward for a horizontal tube, +90° toward world +Z, and ±180° upward; this local frame rotates with the tube. Ambient and rim lighting are unaffected. Volumetric shadows can still show finite-sampling artifacts. Surface angular gating uses the nearest point on the tube axis; visibility averages six samples with a soft sphere-shadow approximation rather than integrating across each rectangle, so sector boundaries and shadows remain approximations. The four rectangles approximate a cylinder; this is not an exact cylindrical emitter solution. Tube radius is fixed, and position or arbitrary mesh-shaped emitters are not yet configurable. There is no temporal denoising or multiple scattering.

## Project structure

```text
src/main.js      Scene, interaction, controls, and rendering lifecycle
src/emitter.js   Shared finite-line sample layout and emitter shader helpers
src/volume.js    Original volumetric scattering and occlusion shaders
src/studio.js    Procedural softbox environment, prefiltered at startup
src/bloom.js     Reduced-resolution separable glow shader
src/style.css    Responsive interface, using system fonts
```

## Deployment

The included GitHub Actions workflow builds on pull requests and pushes to `main`. Pushes to `main` deploy to GitHub Pages. In repository **Settings → Pages**, select **GitHub Actions** as the source. Relative asset URLs also allow deploying `dist/` to another static host.

## Compatibility and performance

A browser with WebGL 2 and renderable half-float textures is required. Mobile viewports default to low quality. Both modes cap pixel ratio at 1. High mode samples volume at half width/height with 56 steps and 4× scene MSAA; low mode uses quarter width/height with 32 steps and no MSAA. When motion is disabled, settled scenes stop drawing until controls or camera change. Turning off volumetric light skips its render pass. Tube surface shadows average six analytic visibility samples for this procedural scene, avoiding cube shadow maps. The environment map is precomputed once, not rerendered every frame. The footer reports observed FPS and draw calls; these are device-dependent, not a benchmark guarantee. The higher sample count, soft surface shadows, and bloom cost more than v0.5. Actual frame rate depends on the GPU and viewport; physical-device mobile testing remains part of release validation.

## Inspiration and provenance

Inspired by the visual exploration in [cullenwebber/three-volumetric-light](https://github.com/cullenwebber/three-volumetric-light). This repository is a separately authored implementation, not a fork or a distribution of that project's code. It includes none of that project's shaders, models, fonts, or other assets. All displayed geometry is generated by this project.

Three.js and Vite are third-party dependencies distributed under their own licenses. The MIT license in this repository covers this project's original source.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Small, focused improvements and reproducible graphics bug reports are welcome.

## License

[MIT](LICENSE).
