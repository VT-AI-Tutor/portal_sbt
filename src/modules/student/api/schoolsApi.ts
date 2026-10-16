import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();

export interface SchoolOption {
  id: string;
  name: string;
  path: string;
  ward_name?: string | null;
  province_name?: string | null;
}

/** Search school org units by name (authenticated, any role). Backed by GET /api/v1/schools?q=. */
export async function searchSchools(q: string, token: string): Promise<SchoolOption[]> {
  const res = await fetch(`${API_BASE}/api/v1/schools?q=${encodeURIComponent(q)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: SchoolOption[]; message?: string; error_code?: string };
  if (!res.ok || body.success === false) throw new Error(body.message ?? body.error_code ?? `Schools API error ${res.status}`);
  return body.data ?? [];
}
