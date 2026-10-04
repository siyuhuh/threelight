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
