"use client";
import { useMemo, useState } from "react";
import { geometryInputCache } from "@/lib/geometry-input";

export function useGeometryInput<T extends object>(config: T) {
  const [cache] = useState(() => geometryInputCache<T>());
  return useMemo(() => cache(config), [cache, config]);
}
