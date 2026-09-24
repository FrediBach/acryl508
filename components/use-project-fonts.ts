"use client";
import { useSyncExternalStore } from "react";
import { getFonts, getServerFonts, subscribeFonts } from "@/lib/project-fonts";
export function useProjectFonts() { return useSyncExternalStore(subscribeFonts, getFonts, getServerFonts); }
