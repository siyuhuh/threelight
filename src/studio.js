import * as THREE from "three";

// Large procedural softboxes create broad, readable reflections without HDR assets.
export function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color("#11151d");
  const cards = [
    { position: [-5, 4, 5], size: [4, 7], color: [2.2, 2.35, 2.6] },
    { position: [4, 5, -4], size: [3, 6], color: [1.2, 1.45, 1.8] },
    { position: [0, 9, 1], size: [9, 3], color: [1.8, 1.7, 1.5] },
  ];
  for (const card of cards) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(...card.size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(...card.color),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...card.position);
    mesh.lookAt(0, 1, 0);
    studio.add(mesh);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const result = generator.fromScene(studio, 0.025);
  studio.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  generator.dispose();
  return result;
}
