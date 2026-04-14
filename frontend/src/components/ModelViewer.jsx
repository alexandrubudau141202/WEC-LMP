import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Environment } from '@react-three/drei';
import { Suspense } from 'react';

function Porsche963Model() {
  const { scene } = useGLTF('/porsche_963.glb');
  return <primitive object={scene} scale={350} position={[0, -1, 0]} />;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[2, 1, 4]} />
      <meshStandardMaterial color="#f97316" wireframe />
    </mesh>
  );
}

export default function ModelViewer() {
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
        
        {/* Model with loading fallback */}
        <Suspense fallback={<LoadingFallback />}>
          <Porsche963Model />
        </Suspense>
        
        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#111" opacity={0.3} transparent />
        </mesh>
      </Canvas>
      
      <div className="model-controls-hint">
        <p>Click and drag to rotate • Scroll to zoom • Right-click to pan</p>
      </div>
    </div>
  );
}