"use client";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, DoubleSide } from "three";
import { positionStandObject, type StandObject } from "@/lib/stand-object";

export function UploadedObject({ object, angle, floor = 0, centeredDepth = false, lift = 0 }: { object: StandObject; angle: number; floor?: number; centeredDepth?: boolean; lift?: number }) {
  const geometry = useMemo(() => {
    const posed = positionStandObject(object, angle, floor);
    const depthOffset = centeredDepth ? posed.depth / 2 : 0;
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(posed.points.flatMap(([x, y, z]) => [x * 0.01, y * 0.01, -(z - depthOffset) * 0.01]), 3));
    result.computeVertexNormals();
    return result;
  }, [object, angle, floor, centeredDepth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[0, lift, 0]}><meshStandardMaterial color="#535c58" roughness={0.7} side={DoubleSide} /></mesh>;
}
