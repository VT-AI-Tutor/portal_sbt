import { useQuery } from "@tanstack/react-query";
import {
  lcmsListProvinces,
  type LcmsProfile,
  type LcmsProvince,
} from "@/core/api/lcmsAdapter";
import { useLcmsCurrentUser } from "./useLcmsAvatar";

interface ProfileLoad {
  loading: boolean;
  loadError: string | null;
  profile: LcmsProfile | null;
  provinces: LcmsProvince[];
}

/** Danh mục tỉnh không đổi trong một phiên — tải một lần rồi dùng lại. */
const LCMS_PROVINCES_QUERY_KEY = ["lcms", "provinces"];

/**
 * Nạp hồ sơ user hiện tại (và tuỳ chọn danh sách tỉnh) cho các dialog hồ sơ.
 *
 * Hồ sơ lấy từ cache dùng chung với header (`useLcmsCurrentUser`), nên mở dialog
 * lần thứ hai là hiện ngay, không gọi lại /current.
 */
export function useLcmsProfileLoad(
  open: boolean,
  withProvinces = false,
): ProfileLoad {
  const profileQuery = useLcmsCurrentUser(open);
  const provincesQuery = useQuery<LcmsProvince[]>({
    queryKey: LCMS_PROVINCES_QUERY_KEY,
    queryFn: lcmsListProvinces,
    enabled: open && withProvinces,
    staleTime: Infinity,
  });

  const error =
    profileQuery.error ?? (withProvinces ? provincesQuery.error : null);
  return {
    loading:
      profileQuery.isLoading || (withProvinces && provincesQuery.isLoading),
    loadError: error ? (error as Error).message : null,
    profile: profileQuery.data ?? null,
    provinces: provincesQuery.data ?? [],
  };
}
