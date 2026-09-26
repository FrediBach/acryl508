"use client";
import { useEffect, useMemo } from "react";
import { Color, DoubleSide, MeshStandardMaterial } from "three";
import type { MultiPolygon } from "polygon-clipping";
import { bentPanelGeometry } from "@/lib/bent-panel-geometry";
import type { AccessoryBend } from "@/lib/accessory-bends";
import type { AcrylicTransparency } from "@/lib/acrylic-material";
import { mapPolygons, polygonsToShapes } from "@/lib/custom-cutouts";
import type { ledSlot } from "@/lib/engravings";

const noBends: AccessoryBend[] = [];
type Slot = ReturnType<typeof ledSlot>;
// Geometry is in the sheet's local coordinates, millimetres. The tiny surface
// relief and granular normals model light scattered by laser-roughened acrylic.
export function EngravingSurface({ polygons, thickness, back = false, bends = noBends, direction = 1, transparency = "transparent", tint, led }: {
  polygons: MultiPolygon; thickness: number; back?: boolean; bends?: AccessoryBend[]; direction?: number;
  transparency?: AcrylicTransparency; tint: string; led?: Slot;
}) {
  const geometry = useMemo(() => bentPanelGeometry(polygonsToShapes(mapPolygons(polygons, (x, y) => [x / 100, y / 100])), 0.0003, bends, direction, 12, { offset: back ? -0.0004 : thickness / 100 + 0.0001, depth: thickness / 100 }), [polygons, thickness, back, bends, direction]);
  const material = useMemo(() => {
    const transmission = transparency === "opaque" ? 0.025 : transparency === "opal" ? 0.3 : transparency === "see-through" ? 0.65 : 1;
    const illumination = led && !led.error ? led.strip.intensity * transmission : 0;
    const lightColor = new Color(led?.strip.color ?? "#ffffff").multiply(new Color(tint).lerp(new Color("white"), 0.72));
    const material = new MeshStandardMaterial({ color: "#e0e6e5", roughness: 0.94, metalness: 0, side: DoubleSide, transparent: true, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    material.onBeforeCompile = shader => {
      shader.uniforms.etchLight = { value: lightColor };
      shader.uniforms.etchIntensity = { value: illumination };
      shader.uniforms.stripY = { value: (led?.y ?? 0) / 100 };
      shader.uniforms.stripHalfLength = { value: (led?.strip.length ?? 80) / 200 };
      shader.vertexShader = 'varying vec2 vEtchPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEtchPosition = position.xy;');
      shader.fragmentShader = `varying vec2 vEtchPosition;
        uniform vec3 etchLight; uniform float etchIntensity; uniform float stripY; uniform float stripHalfLength;
        float etchNoise(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.82 + 0.18 * etchNoise(vEtchPosition * 3700.0);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(normal + vec3((etchNoise(vEtchPosition * 3100.0) - 0.5) * 0.16, (etchNoise(vEtchPosition.yx * 2900.0) - 0.5) * 0.16, 0.0));');
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float distanceToStrip = length(vec2(max(0.0, abs(vEtchPosition.x) - stripHalfLength), vEtchPosition.y - stripY));
        float scatter = exp(-distanceToStrip * 1.4);
        float grain = 0.88 + 0.12 * etchNoise(vEtchPosition * 2300.0);
        diffuseColor.rgb *= grain;
        totalEmissiveRadiance += etchLight * etchIntensity * scatter * grain * 2.4;`);
    };
    material.customProgramCacheKey = () => "frosted-engraving-v1";
    return material;
  }, [led, transparency, tint]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return polygons.length ? <mesh geometry={geometry} material={material} renderOrder={2} /> : null;
}

export function LedStripPreview({ led, thickness }: { led: Slot; thickness: number }) {
  if (!led || led.error) return null;
  const { strip, y } = led, length = strip.length / 100, height = strip.slotHeight / 100, depth = thickness / 100;
  const count = Math.max(2, Math.ceil(strip.length / 16.7));
  return <group position={[0, y / 100, depth / 2]}>
    <mesh><boxGeometry args={[length, height * 0.5, depth * 0.9]} /><meshStandardMaterial color="#d5c9a1" roughness={0.6} metalness={0.2} /></mesh>
    {Array.from({ length: count }, (_, index) => <mesh key={index} position={[-length / 2 + (index + 0.5) * length / count, height * 0.3, 0]}><boxGeometry args={[Math.min(0.035, length / count * 0.65), height * 0.35, depth * 0.75]} /><meshStandardMaterial color="#fff6df" emissive={strip.color} emissiveIntensity={strip.intensity * 4} toneMapped={false} /></mesh>)}
  </group>;
}
