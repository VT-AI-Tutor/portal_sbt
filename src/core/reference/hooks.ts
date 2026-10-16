import { useQuery } from "@tanstack/react-query";
import { fetchLevels, fetchSubjects } from "./referenceApi";
import type { ReferenceItem } from "./types";

// Danh mục có thể được admin sửa — cache 5 phút, khớp TTL server.
const REFERENCE_STALE_TIME = 5 * 60 * 1000;

export function useSubjects() {
  return useQuery<ReferenceItem[], Error>({
    queryKey: ["reference", "subjects"],
    queryFn: fetchSubjects,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useLevels() {
  return useQuery<ReferenceItem[], Error>({
    queryKey: ["reference", "levels"],
    queryFn: fetchLevels,
    staleTime: REFERENCE_STALE_TIME,
  });
}
