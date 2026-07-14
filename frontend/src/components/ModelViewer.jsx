import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Environment } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';

// Loads a glb and auto-fits it: models come in wildly different export
// scales (the 963 needs ~350x, others much less), so normalize to a
// ~5-unit car sitting on the ground plane at y = -0.5.
function CarModel({ url }) {
  const { scene } = useGLTF(url);

  const { scale, position } = useMemo(() => {
    // useGLTF returns the SAME cached scene object on every mount, so the
    // fit must never depend on leftover state from a previous mount:
    // normalize the root transform before measuring, and apply the fit to
    // a wrapper <group> below instead of mutating the scene itself.
    scene.position.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 5 / maxDim;
    const center = box.getCenter(new THREE.Vector3());
    return {
      scale: s,
      position: [-center.x * s, -box.min.y * s - 0.5, -center.z * s],
    };
  }, [scene]);

  // dispose={null}: without it R3F disposes the cached geometry/materials on
  // unmount, and switching back to this car would render an empty model.
  return (
    <group scale={scale} position={position}>
      <primitive object={scene} dispose={null} />
    </group>
  );
}

function PlaceholderChassis() {
  return (
    <mesh position={[0, 0.1, 0]}>
      <boxGeometry args={[2, 1, 4]} />
      <meshStandardMaterial color="#f97316" wireframe />
    </mesh>
  );
}

// Renders the selected garage car (frontend/src/cars.js supplies the url).
export default function ModelViewer({ modelUrl, label }) {
  return (
    <div className="model-viewer">
      <div className="viewport-background"></div>
      <Canvas>
        <PerspectiveCamera makeDefault position={[8, 4, 8]} fov={60} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={20}
        />

        {/* Lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <directionalLight position={[-10, -10, -5]} intensity={0.8} />
        <pointLight position={[0, 8, 0]} intensity={1} />
        <spotLight position={[5, 5, 5]} intensity={1} angle={0.3} penumbra={1} />

        {/* Environment */}
        <Environment preset="sunset" />

        {/* Model with loading fallback — keyed so switching car remounts cleanly */}
        <Suspense fallback={<PlaceholderChassis />}>
          {modelUrl ? <CarModel key={modelUrl} url={modelUrl} /> : <PlaceholderChassis />}
        </Suspense>

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#111" opacity={0.3} transparent />
        </mesh>
      </Canvas>

      <div className="model-controls-hint">
        <p>{label} • Click and drag to rotate • Scroll to zoom • Right-click to pan</p>
      </div>
    </div>
  );
}
