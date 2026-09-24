import type { Project } from "./project";
export type SavedProject = { id: string; updated: string; project: Project };
export type ProjectEntry = { id: string; updated: string; name: string };
let pending: Promise<IDBDatabase> | undefined;
function database() {
  if (!pending) pending = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Browser storage is unavailable. Download a project file to keep your work.")); return; }
    const request = indexedDB.open("acryl508-projects", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects", { keyPath: "id" });
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); pending = undefined; }; resolve(request.result); };
    request.onerror = () => reject(request.error ?? new Error("Browser storage could not be opened."));
    request.onblocked = () => reject(new Error("Close other Acryl508 tabs and try again to enable browser storage."));
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
export async function readSavedProject(id: string): Promise<SavedProject | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("projects", "readonly"), request = transaction.objectStore("projects").get(id);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? request.error);
  });
}
export async function writeSavedProject(id: string, project: Project) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("projects", "readwrite");
    transaction.objectStore("projects").put({ id, updated: new Date().toISOString(), project } satisfies SavedProject);
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Could not save this project. Browser storage may be full; download a project file."));
  });
}
export async function listSavedProjects(): Promise<ProjectEntry[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const entries: ProjectEntry[] = [], transaction = db.transaction("projects", "readonly");
    const request = transaction.objectStore("projects").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const value = cursor.value as SavedProject;
      if (value.id !== "autosave") entries.push({ id: value.id, name: value.project.name, updated: value.updated });
      cursor.continue();
    };
    transaction.oncomplete = () => resolve(entries.sort((a, b) => b.updated.localeCompare(a.updated)));
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? request.error);
  });
}
