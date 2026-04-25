import type { AccessLevel, AccessRestriction, GraphEdge } from "../graph/types";

const restrictionRank: Record<AccessRestriction, number> = {
  public: 0,
  student_only: 1,
  staff_only: 2,
};

const levelRank: Record<AccessLevel, number> = {
  public: 0,
  student: 1,
  staff: 2,
};

export function edgeAllowedForAccess(edge: GraphEdge, level: AccessLevel): boolean {
  return restrictionRank[edge.accessRestriction] <= levelRank[level];
}
