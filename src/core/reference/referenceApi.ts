import { getApiProvider, getCatalogApiBaseUrl } from "@/core/api/config";
// lcmsAdapter is the single LCMS boundary (memoized grade/subject loaders live
// there), so the provider switch imports it even though it sits in modules/.
import {
  lcmsListLevels,
  lcmsListSubjects,
} from "@/core/api/lcmsAdapter";
import type { ReferenceItem, ReferenceListResponse } from "./types";

async function fetchReference(path: string): Promise<ReferenceItem[]> {
  // Base URL is resolved per call: the runtime /config.js may load after this
  // module is evaluated.
  const res = await fetch(`${getCatalogApiBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Reference API error ${res.status}`);
  }
  const body = (await res.json()) as ReferenceListResponse;
  return body.data;
}

export const fetchSubjects = (): Promise<ReferenceItem[]> =>
  getApiProvider() === "lcms"
    ? lcmsListSubjects()
    : fetchReference("/api/v1/catalog/subjects");

export const fetchLevels = (): Promise<ReferenceItem[]> =>
  getApiProvider() === "lcms"
    ? lcmsListLevels()
    : fetchReference("/api/v1/catalog/levels");
