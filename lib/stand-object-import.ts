import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import type { Mesh } from "three";
import { validateObjectVertices, type StandObject } from "./stand-object";

export async function readStandObject(file: File): Promise<StandObject> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Choose a model smaller than 15 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "stl" && extension !== "obj") throw new Error("Choose an STL or OBJ model.");
  const vertices: number[] = [];
  try {
    if (extension === "stl") {
      const geometry = new STLLoader().parse(await file.arrayBuffer());
      try { const positions = geometry.getAttribute("position"); for (let i = 0; i < positions.count; i++) vertices.push(positions.getX(i), positions.getY(i), positions.getZ(i)); }
      finally { geometry.dispose(); }
    } else {
      const object = new OBJLoader().parse(await file.text());
      object.updateMatrixWorld(true);
      object.traverse(child => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const geometry = mesh.geometry;
        geometry.applyMatrix4(child.matrixWorld);
        const positions = geometry.getAttribute("position"), index = geometry.getIndex();
        for (let i = 0; i < (index?.count ?? positions.count); i++) {
          const j = index ? index.getX(i) : i;
          vertices.push(positions.getX(j), positions.getY(j), positions.getZ(j));
        }
        geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      });
    }
  } catch { throw new Error("The model could not be read. Export it again as a triangulated STL or OBJ."); }
  validateObjectVertices(vertices);
  return { name: file.name, vertices, units: "mm", up: extension === "stl" ? "z" : "y", turn: 0 };
}
