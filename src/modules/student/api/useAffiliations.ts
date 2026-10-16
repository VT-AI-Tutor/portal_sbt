import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessToken } from "@/core/auth/AuthContext";
import { affiliationsApi, type MyAffiliation } from "./affiliationsApi";

export const affiliationsKeys = { all: ["my-affiliations"] as const };

export function useMyAffiliations() {
  const token = useAccessToken();
  return useQuery<MyAffiliation[], Error>({
    queryKey: affiliationsKeys.all,
    queryFn: () => affiliationsApi.list(token!),
    enabled: !!token,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: affiliationsKeys.all });
}

export function useDeclareAffiliation() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (schoolOrgUnitId: string) => affiliationsApi.declare(schoolOrgUnitId, token!), onSuccess: invalidate });
}

export function useLeaveAffiliation() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (membershipId: string) => affiliationsApi.leave(membershipId, token!), onSuccess: invalidate });
}
