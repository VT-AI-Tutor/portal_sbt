import { describe, it, expect } from "vitest";
import {
  hidesChainMatchHint,
  isTapVietSubject,
  isTopicBasedSubject,
  lessonLabels,
  referenceGroups,
  topicPrefix,
} from "./lessonLabels";
import type { LessonExtraMedia } from "@/modules/catalog/api/types";

const media = (
  type: LessonExtraMedia["type"],
  title: string,
): LessonExtraMedia => ({
  code: title,
  title,
  url: `https://cdn.example.vn/lcms/${title}`,
  type,
});

const video = media("video", "Trang 15.1 Bài 19 chữ ng");
const video2 = media("video", "Trang 4.7 số 7");
const image = media("image", "Hình minh hoạ");
const audio = media("audio", "Ghi âm bài đọc");

describe("isTapVietSubject", () => {
  it("nhận môn tập viết theo subject_code của LCMS", () => {
    expect(isTapVietSubject({ code: "tap-viet", name: "Tập viết" })).toBe(true);
  });

  it("luồng preview không có subject_code thì nhận theo tên môn", () => {
    expect(isTapVietSubject({ name: "Tập viết" })).toBe(true);
  });

  it("môn khác không dính, kể cả môn có chữ 'viết' trong mã", () => {
    expect(isTapVietSubject({ code: "tieng-viet", name: "Tiếng Việt" })).toBe(
      false,
    );
    expect(isTapVietSubject({})).toBe(false);
  });
});

describe("hidesChainMatchHint", () => {
  it("nhận Đạo đức theo subject_code của LCMS", () => {
    expect(hidesChainMatchHint({ code: "dao-duc", name: "Đạo đức" })).toBe(true);
  });

  it("luồng preview không có subject_code thì nhận theo tên môn", () => {
    expect(hidesChainMatchHint({ name: "Đạo đức" })).toBe(true);
  });

  it("môn khác giữ nguyên dòng gợi ý", () => {
    expect(hidesChainMatchHint({ code: "toan", name: "Toán" })).toBe(false);
    expect(hidesChainMatchHint({})).toBe(false);
  });

  it("KHÔNG đi theo TOPIC_BASED_SUBJECTS: Lịch sử và Địa lí vẫn có gợi ý", () => {
    // Ca này đỏ = ai đó đã gộp hai danh sách, và một yêu cầu về nhãn mục lục
    // vừa lặng lẽ đổi cả màn làm bài.
    const lichSuDiaLi = { code: "lich-su-dia-li", name: "Lịch sử và Địa lí" };
    expect(isTopicBasedSubject(lichSuDiaLi)).toBe(true);
    expect(hidesChainMatchHint(lichSuDiaLi)).toBe(false);
  });
});

describe("isTopicBasedSubject", () => {
  it("nhận theo subject_code của LCMS", () => {
    expect(isTopicBasedSubject({ code: "dao-duc", name: "Đạo đức" })).toBe(true);
    expect(
      isTopicBasedSubject({
        code: "lich-su-dia-li",
        name: "Lịch sử và Địa lí",
      }),
    ).toBe(true);
  });

  it("luồng preview không có subject_code thì nhận theo tên môn", () => {
    expect(isTopicBasedSubject({ name: "Đạo đức" })).toBe(true);
    expect(isTopicBasedSubject({ name: "Lịch sử và Địa lí" })).toBe(true);
  });

  it("môn họ hàng không dính — so khớp phải bằng tuyệt đối, không phải chứa", () => {
    // "giao-duc-cong-dan" chứa "duc"; "lich-su" và "dia-li" là tiền tố/hậu tố
    // của "lich-su-dia-li" và là môn RIÊNG ở cấp 2.
    expect(
      isTopicBasedSubject({
        code: "giao-duc-cong-dan",
        name: "Giáo dục công dân",
      }),
    ).toBe(false);
    expect(isTopicBasedSubject({ code: "lich-su", name: "Lịch sử" })).toBe(
      false,
    );
    expect(isTopicBasedSubject({ code: "dia-li", name: "Địa lí" })).toBe(false);
    expect(isTopicBasedSubject({ code: "tieng-viet", name: "Tiếng Việt" })).toBe(
      false,
    );
    expect(isTopicBasedSubject({})).toBe(false);
  });
});

describe("topicPrefix", () => {
  it("môn chia theo chủ đề thì gọi nhóm bài là chủ đề", () => {
    expect(topicPrefix({ code: "dao-duc", name: "Đạo đức" })).toBe("Chủ đề");
    expect(topicPrefix({ name: "Lịch sử và Địa lí" })).toBe("Chủ đề");
  });

  it("môn khác giữ nguyên nhãn tuần theo phân phối chương trình", () => {
    expect(topicPrefix({ code: "toan", name: "Toán" })).toBe("Tuần");
    expect(topicPrefix({})).toBe("Tuần");
  });
});

describe("lessonLabels", () => {
  it("mặc định: vở bài tập", () => {
    expect(lessonLabels(false)).toEqual({
      pdfBook: "Vở bài tập",
      pdfBookFull: "Vở bài tập PDF",
      showLessonNumber: true,
    });
  });

  it("tập viết: đổi tên sách và tắt nhãn số bài", () => {
    expect(lessonLabels(true)).toEqual({
      pdfBook: "Vở tập viết",
      pdfBookFull: "Vở tập viết PDF",
      showLessonNumber: false,
    });
  });
});

describe("referenceGroups", () => {
  it("không có tài liệu thì không có tab nào", () => {
    expect(referenceGroups(true, [])).toEqual([]);
    expect(referenceGroups(false, [])).toEqual([]);
  });

  it("môn khác: gộp mọi loại vào một tab video hướng dẫn như trước", () => {
    const groups = referenceGroups(false, [video, image, audio]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("reference-video");
    expect(groups[0].label).toBe("Video hướng dẫn");
    expect(groups[0].items).toEqual([video, image, audio]);
  });

  it("tập viết chỉ có video: một tab video hướng dẫn", () => {
    const groups = referenceGroups(true, [video, video2]);
    expect(groups.map((g) => g.label)).toEqual(["Video hướng dẫn"]);
    expect(groups[0].items).toEqual([video, video2]);
  });

  it("tập viết chỉ có tranh: một tab hình minh hoạ", () => {
    const groups = referenceGroups(true, [image]);
    expect(groups.map((g) => g.label)).toEqual(["Hình minh hoạ"]);
    expect(groups[0].key).toBe("reference-image");
  });

  it("tập viết có cả hai loại: hai tab riêng, video trước", () => {
    const groups = referenceGroups(true, [image, video, video2]);
    expect(groups.map((g) => g.label)).toEqual([
      "Video hướng dẫn",
      "Hình minh hoạ",
    ]);
    expect(groups[0].items).toEqual([video, video2]);
    expect(groups[1].items).toEqual([image]);
  });

  it("tập viết: audio đi cùng tab video, không đứng riêng", () => {
    const groups = referenceGroups(true, [audio, image]);
    expect(groups.map((g) => g.label)).toEqual([
      "Video hướng dẫn",
      "Hình minh hoạ",
    ]);
    expect(groups[0].items).toEqual([audio]);
  });

  it("mỗi mục chỉ nằm ở đúng một tab", () => {
    const items = [image, video, audio, video2];
    const groups = referenceGroups(true, items);
    expect(groups.flatMap((g) => g.items)).toHaveLength(items.length);
  });
});
