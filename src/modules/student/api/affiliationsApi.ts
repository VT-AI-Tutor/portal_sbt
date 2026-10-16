import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();
const ROOT = "/api/v1/me/affiliations";
const json = { "Content-Type": "application/json" };

export interface MyAffiliation {
  membership_id: string;
  org_unit_id: string | null;
  org_unit_name: string | null;
  org_unit_path: string | null;
  member_type: string;
  affiliation: "guest" | "official";
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; message?: string; error_code?: string };
  if (!res.ok || body.success === false) throw new Error(body.message ?? body.error_code ?? `Affiliation API error ${res.status}`);
  return body.data as T;
}

export const affiliationsApi = {
  list: (token: string) => call<MyAffiliation[]>(ROOT, token),
  declare: (schoolOrgUnitId: string, token: string) =>
    call<{ membership_id: string; affiliation: "guest" }>(ROOT, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ school_org_unit_id: schoolOrgUnitId }),
    }),
  leave: (membershipId: string, token: string) => call<unknown>(`${ROOT}/${membershipId}`, token, { method: "DELETE" }),
};
