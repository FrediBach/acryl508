"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Color, InstancedMesh, Object3D } from "three";

export type Point = [number, number, number];
export type HardwareInstance = { position: Point; scale: Point; rotation?: Point; color?: string };

// Batch the repeated hardware so a large, multi-row system stays inexpensive to orbit.
export function PreviewHardware({ instances, children, metalness = 0.35, roughness = 0.42 }: {
  instances: HardwareInstance[]; children: ReactNode; metalness?: number; roughness?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new Object3D(), color = new Color();
    instances.forEach((instance, index) => {
      transform.position.set(...instance.position);
      transform.scale.set(...instance.scale);
      transform.rotation.set(...(instance.rotation ?? [0, 0, 0]));
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, color.set(instance.color ?? "#212527"));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);
  if (!instances.length) return null;
  return <instancedMesh key={instances.length} ref={ref} args={[undefined, undefined, instances.length]} castShadow receiveShadow>
    {children}<meshStandardMaterial metalness={metalness} roughness={roughness} />
  </instancedMesh>;
}

