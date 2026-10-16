/**
 * Đếm số upload đang chạy để "Nộp bài" chờ file lên xong. Cửa sổ race: file
 * chỉ vào `answers` SAU khi upload resolve, nên nộp trong lúc spinner còn quay
 * là bài thiếu file mà không ai được báo — đặc biệt khi câu đã có sẵn một file
 * (được đếm "đã làm", không dính dialog cảnh báo câu trống).
 */
export interface PendingUploadGate {
  /** Bọc một upload; đếm từ lúc gọi tới lúc resolve/reject. */
  wrap: <T>(run: () => Promise<T>) => Promise<T>;
  hasPending: () => boolean;
}

export function createPendingUploadGate(): PendingUploadGate {
  let pending = 0;
  return {
    wrap: async (run) => {
      pending++;
      try {
        return await run();
      } finally {
        pending--;
      }
    },
    hasPending: () => pending > 0,
  };
}
