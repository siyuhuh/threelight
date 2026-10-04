# v0.1.0 validation

Checked on 2026-10-04:

- `npm install`: completed; npm reported zero dependency vulnerabilities.
- `npm run build`: passed. Vite reports a bundle-size advisory (Three.js is bundled); this is not a build failure.
- Desktop in-app browser: scene and volumetric shader rendered; no captured warning/error logs.
- Gallery, Arctic, Ember: preset selection and displayed parameters update.
- Scattering keyboard adjustment: updated from 1.05 to 1.06.
- Volume/particle toggles: comparison mode rendered without the effects.
- Low/high quality selection and motion toggle respond.
- Reset view returns to the initial composition.
- 390 × 844 emulated viewport: controls start collapsed, can expand, and presets work; low quality is selected.

Limitations: no physical mobile-device, cross-browser, GPU performance, or simulated context-loss validation has been performed. The renderer uses analytic occlusion for this scene only. This is an initial experimental release.

# Tube emitter update

Checked on 2026-10-04:

- Production build passed after adding the finite-line emitter.
- Tube length endpoints (0.5 m and 4 m), 90° rotation, and preset changes respond in the browser.
- Vertical and horizontal tubes produce visibly different illumination and shadows.
- Switching to Spotlight restores the cone and its beam-spread control; tube-only controls are hidden.
- Turning volumetric light off preserves tube geometry and surface illumination.
- 390 × 844 viewport: tube controls work, panel scrolls, and low quality is selected.
- No shader errors or browser warnings were captured during the local rendering checks.

Tube emission is approximated by six samples. Shadow banding and discrete highlights are known limitations; no claim of continuous area-light accuracy or physical mobile performance is made.

# Angular emission sector update

- Production build passed.
- The default 90° sector visibly limits atmospheric scattering and floor illumination.
- A 15° sector aimed upward removes tube direct illumination from the floor and objects.
- 360° restores omnidirectional illumination regardless of heading.
- Spotlight mode hides tube-sector controls and renders without shader errors.
- The SVG cross-section follows width and heading changes, including the full-circle case.
