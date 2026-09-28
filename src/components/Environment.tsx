"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, InstancedMesh, Object3D } from "three";
import { Html, Text } from "@react-three/drei";
import StreetProps from "./StreetProps";
import Vehicle from "./Vehicle";
import { houses, streetProps, trees, vehicleShopItems } from "./world";
import { getTerrainHeight, mountains } from "@/lib/terrain";
import { getBirdBehavior, getNearbyFlocks, type BirdPerch } from "@/lib/birds";

const BLOCK_SIZE = 40;
const RENDER_RADIUS = 125;
const ROAD_RADIUS = 4;
const ROAD_WORLD_LIMIT = 5000;

function Mountains({ onTravelClick }: { onTravelClick?: (point: { x: number; z: number }) => void }) {
  return <group>
    {mountains.map(mountain => <group key={mountain.id}>
      <mesh position={[mountain.x, mountain.height / 2 - 0.5, mountain.z]} receiveShadow onPointerDown={event => {
        event.stopPropagation();
        onTravelClick?.({ x: event.point.x, z: event.point.z });
      }}>
        <coneGeometry args={[mountain.radius, mountain.height, 4]} />
        <meshStandardMaterial color={mountain.color} roughness={1} />
      </mesh>
      <Html position={[mountain.x, mountain.height + 2, mountain.z]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <span className="place-label">{mountain.name} · {mountain.height} m</span>
      </Html>
    </group>)}
  </group>;
}

function Bird({ x, z, crow }: { x: number; z: number; crow: boolean }) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Group>(null);
  const rightWingRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const perches = useMemo(() => {
    const size = crow ? 1.3 : 1.15;
    const road: BirdPerch = { x: x + (crow ? -3.2 : 3.2), y: getTerrainHeight(x + (crow ? -3.2 : 3.2), z + (crow ? 8 : -8)) - 0.46 + 0.3 * size, z: z + (crow ? 8 : -8), kind: 'road' };
    let nearest: (typeof houses)[number] | undefined;
    let distance = 55;
    for (const house of houses) {
      if (house.type === 'playground') continue;
      const candidate = Math.hypot(house.x - road.x, house.z - road.z);
      if (candidate < distance) { nearest = house; distance = candidate; }
    }
    if (!nearest) return { road, roof: { ...road, z: road.z + 16, y: getTerrainHeight(road.x, road.z + 16) - 0.46 + 0.3 * size } };
    const style = Math.abs(Math.round(nearest.x * 13 + nearest.z * 7)) % 5;
    const wallHeight = style === 1 || style === 4 ? 4.8 : 3.6;
    const top = nearest.type === 'hospital' ? 7.5 : wallHeight + (style === 1 ? 0 : style === 2 ? 1.2 : style === 3 ? 0.8 : 1.1);
    const roof: BirdPerch = { x: nearest.x, y: top + 0.3 * size, z: nearest.z, kind: 'roof' };
    return { road, roof };
  }, [x, z, crow]);
  useFrame(({ clock, camera }, delta) => {
    const pose = getBirdBehavior(perches.road, perches.roof, crow, clock.elapsedTime);
    if (groupRef.current) {
      groupRef.current.position.set(pose.x, pose.y, pose.z);
      const turn = pose.yaw - groupRef.current.rotation.y;
      groupRef.current.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-10 * Math.min(delta, 0.05)));
      // Fade in/out beyond the nearby area so streaming flocks do not pop.
      const distance = Math.hypot(camera.position.x - pose.x, camera.position.z - pose.z);
      groupRef.current.scale.setScalar((crow ? 1.3 : 1.15) * Math.max(0, Math.min(1, (110 - distance) / 30)));
    }
    if (leftWingRef.current) {
      leftWingRef.current.rotation.set(0, -(1 - pose.wings) * 1.2, pose.flap);
      leftWingRef.current.scale.x = 0.3 + pose.wings * 0.7;
    }
    if (rightWingRef.current) {
      rightWingRef.current.rotation.set(0, (1 - pose.wings) * 1.2, -pose.flap);
      rightWingRef.current.scale.x = 0.3 + pose.wings * 0.7;
    }
    if (headRef.current) headRef.current.rotation.x = pose.resting ? Math.max(0, Math.sin(clock.elapsedTime * 2)) * 0.3 : 0;
  });
  const color = crow ? "#111827" : "#f1f5f9";
  return <group ref={groupRef} position={[x, crow ? 3.1 : 3.8, z]}>
    <mesh scale={[0.8, 0.8, 1.5]}>
      <sphereGeometry args={[0.25, 8, 6]} /><meshStandardMaterial color={color} />
    </mesh>
    <group ref={headRef}>
    <mesh position={[0, 0.12, 0.32]}>
      <sphereGeometry args={[0.17, 8, 6]} /><meshStandardMaterial color={color} />
    </mesh>
    <mesh position={[0, 0.1, 0.53]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.07, 0.22, 4]} /><meshStandardMaterial color={crow ? '#334155' : '#f59e0b'} />
    </mesh>
    </group>
    {[-0.09, 0.09].map(footX => <mesh key={footX} position={[footX, -0.255, 0.04]}>
      <boxGeometry args={[0.045, 0.09, 0.16]} /><meshStandardMaterial color={crow ? '#334155' : '#d97706'} />
    </mesh>)}
    <mesh position={[0, -0.02, -0.42]} rotation={[-0.2, 0, 0]}>
      <boxGeometry args={[0.24, 0.045, 0.4]} /><meshStandardMaterial color={crow ? color : '#64748b'} />
    </mesh>
    <group ref={leftWingRef} position={[-0.2, 0, 0]}>
      <mesh position={[-0.38, 0, -0.05]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.8, 0.045, 0.27]} /><meshStandardMaterial color={color} />
      </mesh>
    </group>
    <group ref={rightWingRef} position={[0.2, 0, 0]}>
      <mesh position={[0.38, 0, -0.05]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.8, 0.045, 0.27]} /><meshStandardMaterial color={color} />
      </mesh>
    </group>
  </group>;
}

function SkyLife({ center }: { center: { x: number; z: number } }) {
  const flocks = useMemo(() => getNearbyFlocks(center.x, center.z), [center.x, center.z]);
  return <group>{flocks.map(flock => <group key={flock.id}>
    <Bird x={flock.x} z={flock.z} crow />
    <Bird x={flock.x} z={flock.z} crow={false} />
  </group>)}</group>;
}

function Trees({ positions }: { positions: [number, number][] }) {
  const trunks = useRef<InstancedMesh>(null);
  const lower = useRef<InstancedMesh>(null);
  const upper = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const object = new Object3D();
    for (const [ref, height] of [[trunks, 0], [lower, 1], [upper, 1.7]] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      positions.forEach(([x, z], index) => {
        object.position.set(x, height, z);
        object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix);
      });
      mesh.count = positions.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [positions]);
  return <group>
    <instancedMesh ref={trunks} args={[undefined, undefined, positions.length]}>
      <cylinderGeometry args={[0.2, 0.3, 1, 8]} /><meshStandardMaterial color="#78350f" roughness={0.9} />
    </instancedMesh>
    <instancedMesh ref={lower} args={[undefined, undefined, positions.length]}>
      <coneGeometry args={[1, 2, 8]} /><meshStandardMaterial color="#166534" roughness={0.8} />
    </instancedMesh>
    <instancedMesh ref={upper} args={[undefined, undefined, positions.length]}>
      <coneGeometry args={[0.8, 1.5, 8]} /><meshStandardMaterial color="#15803d" roughness={0.8} />
    </instancedMesh>
  </group>;
}

function Road({ center, onTravelClick }: { center: { x: number; z: number }; onTravelClick?: (point: { x: number; z: number }) => void }) {
  const centerGX = Math.round(center.x / BLOCK_SIZE);
  const centerGZ = Math.round(center.z / BLOCK_SIZE);
  const xBlocks = Array.from({ length: ROAD_RADIUS * 2 + 1 }, (_, i) => (centerGX - ROAD_RADIUS + i) * BLOCK_SIZE)
    .filter(pos => pos >= -ROAD_WORLD_LIMIT && pos <= ROAD_WORLD_LIMIT);
  const zBlocks = Array.from({ length: ROAD_RADIUS * 2 + 1 }, (_, i) => (centerGZ - ROAD_RADIUS + i) * BLOCK_SIZE)
    .filter(pos => pos >= -ROAD_WORLD_LIMIT && pos <= ROAD_WORLD_LIMIT);
  return (
    <group>
      {/* Jins Highways Watermark */}
      <Text
        position={[0, -0.45, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={4}
        color="#facc15"
        fillOpacity={0.6}
        anchorX="center"
        anchorY="middle"
      >
        Jins Highways
      </Text>
      {/* Grid of roads */}
      {xBlocks.map(pos => (
        <group key={`road-z-${pos}`}>
          <mesh position={[pos, -0.485, 0]} receiveShadow onPointerDown={(event) => {
            event.stopPropagation();
            onTravelClick?.({ x: event.point.x, z: event.point.z });
          }}>
            <boxGeometry args={[8, 0.03, ROAD_WORLD_LIMIT * 2 + 8]} />
            <meshStandardMaterial color="#334155" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
          <mesh position={[pos, -0.455, 0]} onPointerDown={(event) => {
            event.stopPropagation();
            onTravelClick?.({ x: event.point.x, z: event.point.z });
          }}>
            <boxGeometry args={[0.18, 0.012, ROAD_WORLD_LIMIT * 2 + 8]} />
            <meshStandardMaterial color="#eab308" polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
          </mesh>
        </group>
      ))}
      {zBlocks.map(pos => (
        <group key={`road-x-${pos}`}>
          <mesh position={[0, -0.475, pos]} receiveShadow onPointerDown={(event) => {
            event.stopPropagation();
            onTravelClick?.({ x: event.point.x, z: event.point.z });
          }}>
            <boxGeometry args={[ROAD_WORLD_LIMIT * 2 + 8, 0.03, 8]} />
            <meshStandardMaterial color="#334155" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
          <mesh position={[0, -0.445, pos]} onPointerDown={(event) => {
            event.stopPropagation();
            onTravelClick?.({ x: event.point.x, z: event.point.z });
          }}>
            <boxGeometry args={[ROAD_WORLD_LIMIT * 2 + 8, 0.012, 0.18]} />
            <meshStandardMaterial color="#eab308" polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

import { windowMaterial } from "./Lighting";

function Hospital({ x, z }: { x: number; z: number }) {
  return <group position={[x, -0.5, z]}>
    <mesh position={[0, 4, 0]} castShadow receiveShadow>
      <boxGeometry args={[12, 8, 12]} /><meshStandardMaterial color="#f8fafc" />
    </mesh>
    <mesh position={[0, 8.5, 6.1]} castShadow>
      <boxGeometry args={[1, 3, 0.2]} /><meshStandardMaterial color="#ef4444" />
    </mesh>
    <mesh position={[0, 8.5, 6.1]} castShadow>
      <boxGeometry args={[3, 1, 0.2]} /><meshStandardMaterial color="#ef4444" />
    </mesh>
    <Text position={[0, 9, 6.2]} fontSize={0.7} color="#ef4444" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#ffffff">
      HOSPITAL
    </Text>
  </group>;
}

function Playground({ x, z }: { x: number; z: number }) {
  return <group position={[x, -0.5, z]}>
    <mesh position={[0, 0.05, 0]} receiveShadow>
      <boxGeometry args={[14, 0.1, 14]} /><meshStandardMaterial color="#fcd34d" />
    </mesh>
    <mesh position={[-2, 1.5, -2]} castShadow>
      <boxGeometry args={[2, 3, 2]} /><meshStandardMaterial color="#ef4444" />
    </mesh>
    <mesh position={[-2, 1, 1]} rotation={[-Math.PI / 4, 0, 0]} castShadow>
      <boxGeometry args={[1, 0.1, 4]} /><meshStandardMaterial color="#3b82f6" />
    </mesh>
    <mesh position={[3, 2, 2]} castShadow>
      <boxGeometry args={[0.2, 4, 0.2]} /><meshStandardMaterial color="#64748b" />
    </mesh>
    <mesh position={[5, 2, 2]} castShadow>
      <boxGeometry args={[0.2, 4, 0.2]} /><meshStandardMaterial color="#64748b" />
    </mesh>
    <mesh position={[4, 4, 2]} castShadow>
      <boxGeometry args={[2.2, 0.2, 0.2]} /><meshStandardMaterial color="#64748b" />
    </mesh>
  </group>;
}

function House({ x, z, color }: { x: number; z: number; color: string }) {
  const style = Math.abs(Math.round(x * 13 + z * 7)) % 5;
  const tall = style === 1 || style === 4;
  const wide = style === 2;
  const width = wide ? 8.4 : 7;
  const depth = style === 3 ? 7.2 : 6;
  const height = tall ? 4.8 : 3.6;
  const roofColor = ['#6b4551', '#334155', '#854d0e', '#7f1d1d', '#365314'][style];
  return <group position={[x, -0.5, z]}>
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={color} />
    </mesh>
    {style === 1 ? (
      <mesh position={[0, height + 0.25, 0]} castShadow>
        <boxGeometry args={[width + 0.7, 0.5, depth + 0.7]} /><meshStandardMaterial color={roofColor} />
      </mesh>
    ) : style === 2 ? (
      <mesh position={[0, height + 0.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[6.1, 1.7, 4]} /><meshStandardMaterial color={roofColor} />
      </mesh>
    ) : style === 3 ? (
      <mesh position={[0, height + 0.65, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[width + 0.6, 1.3, depth + 0.6]} /><meshStandardMaterial color={roofColor} />
      </mesh>
    ) : (
      <mesh position={[0, height + 0.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[5.4, 2, 4]} /><meshStandardMaterial color={roofColor} />
      </mesh>
    )}
    <mesh position={[0, 1.1, depth / 2 + 0.02]}><boxGeometry args={[1.2, 2.2, 0.12]} /><meshStandardMaterial color="#654735" /></mesh>
    {(style === 4 ? [-2.4, 0, 2.4] : [-2.1, 2.1]).map(windowX => <mesh key={windowX} position={[windowX, tall ? 2.8 : 2, depth / 2 + 0.07]} material={windowMaterial}>
      <boxGeometry args={[style === 1 ? 0.9 : 1.2, style === 4 ? 1 : 1.25, 0.14]} />
    </mesh>)}
    {tall && [-2.1, 2.1].map(windowX => <mesh key={`upper-${windowX}`} position={[windowX, 1.45, depth / 2 + 0.07]} material={windowMaterial}>
      <boxGeometry args={[0.95, 0.9, 0.14]} />
    </mesh>)}
    <mesh position={[width / 2 - 1.1, height + 0.5, -depth / 4]} castShadow><boxGeometry args={[0.65, 1.8, 0.65]} /><meshStandardMaterial color="#87594c" /></mesh>
    <mesh position={[0, 0.06, depth / 2 + 1.2]} receiveShadow><boxGeometry args={[1.8, 0.12, 2.4]} /><meshStandardMaterial color="#cbd5c8" /></mesh>
    {style === 2 && <mesh position={[-width / 2 - 0.08, 1.2, -1.4]} castShadow><boxGeometry args={[0.16, 2.4, 2.4]} /><meshStandardMaterial color="#e5e7eb" /></mesh>}
    {style === 3 && <mesh position={[width / 2 + 0.35, 0.55, 0]} castShadow><boxGeometry args={[0.7, 1.1, depth - 1.2]} /><meshStandardMaterial color="#94a3b8" /></mesh>}
  </group>;
}

function VehicleShop() {
  return <group>
    <group position={[-30, -0.5, 28]}>
      <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[7.5, 4.4, 15]} /><meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 4.65, 0]} castShadow>
        <boxGeometry args={[8.4, 0.7, 16]} /><meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[3.81, 2.4, 0]} material={windowMaterial}>
        <boxGeometry args={[0.12, 2.1, 11.5]} />
      </mesh>
      <Text position={[3.95, 4.3, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.75} color="#0f172a" anchorX="center" anchorY="middle">
        VEHICLE SHOP
      </Text>
    </group>
    {vehicleShopItems.map(item => (
      <group key={item.kind} position={[item.x, -0.47, item.z]}>
        <mesh receiveShadow>
          <boxGeometry args={[3.2, 0.08, 2.6]} /><meshStandardMaterial color="#e2e8f0" />
        </mesh>
        <group position={[0, 0.15, 0]} rotation={[0, Math.PI / 2, 0]} scale={item.kind === 'cycle' ? 0.85 : 0.75}>
          <Vehicle kind={item.kind} color={item.color} occupied={false} />
        </group>
        <Html position={[0, 1.6, 0]} center style={{ pointerEvents: "none" }}>
          <span className="street-sign">{item.name} · {item.cost} coins · E</span>
        </Html>
      </group>
    ))}
  </group>;
}

function Leaves({ center }: { center: { x: number; z: number } }) {
  const leavesMesh = useRef<InstancedMesh>(null);
  const positions = useMemo(() => {
    const list: [number, number, number, number][] = [];
    const centerGX = Math.round(center.x / BLOCK_SIZE);
    const centerGZ = Math.round(center.z / BLOCK_SIZE);
    const hash = (x: number, z: number) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
    for (let gx = centerGX - ROAD_RADIUS; gx <= centerGX + ROAD_RADIUS; gx++) {
      for (let gz = centerGZ - ROAD_RADIUS; gz <= centerGZ + ROAD_RADIUS; gz++) {
        const cx = gx * BLOCK_SIZE;
        const cz = gz * BLOCK_SIZE;
        if (hash(gx, gz) > 0.3) {
            for (let i = 0; i < 5; i++) {
                const lx = cx + (hash(gx + i, gz) - 0.5) * 40;
                const lz = cz + (hash(gx, gz + i) > 0.5 ? 4.8 : -4.8) + (hash(gx + i, gz + i) - 0.5) * 1.5;
                list.push([lx, lz, 0.4 + hash(lx, lz) * 0.4, hash(lz, lx) * Math.PI * 2]);
            }
        }
        if (hash(gx + 1, gz + 1) > 0.3) {
            for (let i = 0; i < 5; i++) {
                const lx = cx + (hash(gx + i + 1, gz) > 0.5 ? 4.8 : -4.8) + (hash(gx + i, gz + i + 1) - 0.5) * 1.5;
                const lz = cz + (hash(gx, gz + i + 1) - 0.5) * 40;
                list.push([lx, lz, 0.4 + hash(lx, lz) * 0.4, hash(lz, lx) * Math.PI * 2]);
            }
        }
      }
    }
    return list;
  }, [center.x, center.z]);

  useLayoutEffect(() => {
    if (!leavesMesh.current) return;
    const object = new Object3D();
    positions.forEach(([x, z, scale, rot], index) => {
      object.position.set(x, getTerrainHeight(x, z) - 0.48, z);
      object.rotation.set(-Math.PI / 2, 0, rot);
      object.scale.set(scale, scale, scale);
      object.updateMatrix();
      leavesMesh.current!.setMatrixAt(index, object.matrix);
    });
    leavesMesh.current.count = positions.length;
    leavesMesh.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh ref={leavesMesh} args={[undefined, undefined, positions.length]}>
      <planeGeometry args={[0.8, 0.8]} />
      <meshStandardMaterial color="#ea580c" roughness={1} />
    </instancedMesh>
  );
}

function inRange(x: number, z: number, center: { x: number; z: number }, radius = RENDER_RADIUS) {
  return Math.abs(x - center.x) <= radius && Math.abs(z - center.z) <= radius;
}

function EnvironmentProps({ center = { x: 0, z: 0 }, onTravelClick, mobile = false }: { mobile?: boolean; center?: { x: number; z: number }; onTravelClick?: (point: { x: number; z: number }) => void }) {
  const radius = mobile ? 85 : RENDER_RADIUS;
  const visibleHouses = useMemo(() => houses.filter(h => inRange(h.x, h.z, center, radius)), [center, radius]);
  const visibleTrees = useMemo(() => trees.filter(([x, z]) => inRange(x, z, center, radius)), [center, radius]);
  const visibleStreetProps = useMemo(() => streetProps.filter(prop => inRange(prop.x, prop.z, center, radius)), [center, radius]);

  const namedPlaces = useMemo(() => visibleHouses
    .filter(h => Math.hypot(h.x - center.x, h.z - center.z) < 55)
    .sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z))
    .slice(0, 6), [visibleHouses, center]);

  return <group>
    {namedPlaces.map(h => <Html key={`name:${h.x}:${h.z}`} position={[h.x, h.type === 'hospital' ? 10 : h.type === 'playground' ? 4.5 : 7, h.z]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <span className="place-label">{h.name}</span>
    </Html>)}
    <Mountains onTravelClick={onTravelClick} />
    {!mobile && <SkyLife center={center} />}
    <Road center={center} onTravelClick={onTravelClick} />
    <StreetProps props={visibleStreetProps} center={center} />
    {inRange(-30, 28, center) && <VehicleShop />}
    {visibleHouses.map(h => {
      if (h.type === 'hospital') return <Hospital key={`${h.x}:${h.z}`} x={h.x} z={h.z} />;
      if (h.type === 'playground') return <Playground key={`${h.x}:${h.z}`} x={h.x} z={h.z} />;
      return <House key={`${h.x}:${h.z}`} {...h} />;
    })}
    {visibleTrees.length > 0 && <Trees positions={visibleTrees} />}
    {!mobile && <Leaves center={center} />}
  </group>;
}

export default memo(EnvironmentProps);
