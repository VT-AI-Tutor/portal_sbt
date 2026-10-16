/** React-query hooks cho khu Student SBT (năng lực + bài tập). */
import { useCallback } from "react";
import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { getBook } from "@/modules/catalog/api/catalogApi";
import type { BookDetail } from "@/modules/catalog/api/types";
import {
  CATALOG_STALE_TIME,
  catalogKeys,
} from "@/modules/catalog/hooks/useCatalog";
import {
  deriveCompetencyDashboard,
  type BookExerciseTotal,
} from "./competencyApi";
import { deriveMyExercises } from "./exercisesApi";
import { fetchAllExerciseGroups } from "./exerciseListApi";
import {
  fetchBookMastery,
  fetchChapterMastery,
  fetchLessonOverview,
} from "./masteryApi";

// Cùng queryKey với màn Bài tập của tôi ⇒ react-query chỉ quét một lần.
export function useSbtCompetencyDashboard() {
  return useQuery({
    queryKey: ["sbt", "exercise-list"] as const,
    queryFn: fetchAllExerciseGroups,
    staleTime: 30_000,
    select: deriveCompetencyDashboard,
  });
}

// Tổng số bài tập mỗi sách (mẫu số tiến độ) — cùng queryKey với useCatalogBook
// nên dùng lại cache chi tiết sách; sách lỗi/không tra được trả total null.
export function useSbtBookExerciseTotals(bookIds: string[]) {
  const combine = useCallback(
    (results: UseQueryResult<BookDetail, Error>[]) =>
      new Map<string, BookExerciseTotal>(
        bookIds.map((bookId, i) => [
          bookId,
          {
            total:
              results[i].data?.chapters.reduce(
                (count, chapter) => count + chapter.lessons.length,
                0,
              ) ?? null,
            isSettled: results[i].isFetched,
          },
        ]),
      ),
    [bookIds],
  );
  return useQueries({
    queries: bookIds.map((bookId) => ({
      queryKey: catalogKeys.detail(bookId),
      queryFn: () => getBook(bookId),
      staleTime: CATALOG_STALE_TIME,
      retry: false, // 404 (sách không tra được) là kết quả, không phải lỗi tạm.
      refetchOnWindowFocus: false,
    })),
    combine,
  });
}

// Màn Bài tập của tôi: nguồn exercise-list (tự đủ book + môn).
export function useSbtMyExercises() {
  return useQuery({
    queryKey: ["sbt", "exercise-list"] as const,
    queryFn: fetchAllExerciseGroups,
    staleTime: 30_000,
    select: deriveMyExercises,
  });
}

// ---------------------------------------------------------------------------
// Mastery (màn "Năng lực AI" /hoc-sinh/nang-luc-v2). Server tự lấy user từ
// JWT, FE không truyền userId — tránh lỗi precision khi id > MAX_SAFE_INTEGER.
//
// `enabled: !!accessToken` chặn gọi khi chưa đăng nhập. Khi accessToken đổi
// (login/logout/refresh), queryKey thay đổi → cache tự tách giữa các user.
//
// `retry: false` vì server Mastery là dev riêng; retry mặc định 3 lần của
// react-query gây spam DevTools và hiển thị 3 lỗi liên tiếp. Auth 401 đã
// được `lcmsAuthedFetchRaw` xử lý bằng refresh token.
// ---------------------------------------------------------------------------

export function useBookMastery(accessToken: string | null) {
  return useQuery({
    queryKey: ["mastery", "books", accessToken ? "authed" : "anon"] as const,
    queryFn: fetchBookMastery,
    enabled: !!accessToken,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useChapterMastery(accessToken: string | null) {
  return useQuery({
    queryKey: ["mastery", "chapters", accessToken ? "authed" : "anon"] as const,
    queryFn: fetchChapterMastery,
    enabled: !!accessToken,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useLessonOverview(accessToken: string | null) {
  return useQuery({
    queryKey: ["mastery", "overview", accessToken ? "authed" : "anon"] as const,
    queryFn: fetchLessonOverview,
    enabled: !!accessToken,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
