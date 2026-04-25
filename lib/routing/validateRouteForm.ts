import type { RouteParams } from "./types";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateRouteForm(params: Partial<RouteParams>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!params.origin || params.origin.trim() === "") {
    errors.push({ field: "origin", message: "Origin is required." });
  }
  if (!params.destination || params.destination.trim() === "") {
    errors.push({ field: "destination", message: "Destination is required." });
  }
  return errors;
}
