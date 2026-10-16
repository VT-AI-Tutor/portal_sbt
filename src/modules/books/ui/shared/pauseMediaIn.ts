/**
 * Dừng mọi audio/video đang phát bên trong `root`.
 *
 * Runner bài tập bị ẩn chứ KHÔNG unmount khi học sinh thoát (giữ attemptId +
 * đáp án đang làm), mà `display: none` không dừng media — không tự tay dừng thì
 * giọng đọc vẫn vang lên ở hub và màn PDF, không còn nút nào để tắt.
 */
export function pauseMediaIn(root: HTMLElement | null) {
  root
    ?.querySelectorAll<HTMLMediaElement>("audio, video")
    .forEach((media) => media.pause());
}
