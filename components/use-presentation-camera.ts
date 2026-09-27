"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Spherical, Vector3 } from "three";
import type { OrbitControls } from "three-stdlib";
import { presentationPose, type PresentationPose } from "@/lib/presentation-path";

export function usePresentationCamera(controls: RefObject<OrbitControls | null>, active: boolean) {
  const { camera, invalidate } = useThree();
  const motion = useRef<{ start: PresentationPose; seconds: number } | null>(null);
  const scratch = useRef({ spherical: new Spherical(), offset: new Vector3(), position: new Vector3(), target: new Vector3() });
  useEffect(() => {
    motion.current = null;
    // Clear residual drag damping before handing the camera to the animation.
    if (active && controls.current) controls.current.update();
    invalidate();
  }, [active, camera, controls, invalidate]);
  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!active || !orbit) return;
    const { spherical, offset, position, target } = scratch.current;
    // Geometry edits and resizing can refit the camera. Rebase from that pose.
    if (!motion.current || position.distanceToSquared(camera.position) > 1e-10 || !target.equals(orbit.target)) {
      spherical.setFromVector3(offset.copy(camera.position).sub(orbit.target));
      motion.current = { start: { radius: spherical.radius, phi: spherical.phi, theta: spherical.theta }, seconds: 0 };
    } else {
      // Resume gently after a background tab or a stalled frame.
      motion.current.seconds += Math.min(delta, 0.05);
    }
    const pose = presentationPose(motion.current.start, motion.current.seconds);
    spherical.set(Math.max(orbit.minDistance, Math.min(orbit.maxDistance, pose.radius)), Math.max(orbit.minPolarAngle, Math.min(orbit.maxPolarAngle, pose.phi)), pose.theta);
    camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
    camera.lookAt(orbit.target);
    position.copy(camera.position);
    target.copy(orbit.target);
    // Preserve demand rendering when paused; only the active mode loops.
    invalidate();
  });
}
