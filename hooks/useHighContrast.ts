"use client";
import { useContext } from "react";
import { HighContrastContext } from "../contexts/HighContrastContext";

export function useHighContrast() {
  return useContext(HighContrastContext);
}
