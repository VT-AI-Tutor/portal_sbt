import { describe, expect, it } from "vitest";
import { questionAudioUrl, resolveAudioSlots } from "./QuestionAudioButton";

const AUDIO = "/uploads/audio/bai-doc.mp3";

describe("questionAudioUrl", () => {
  it("đọc payload.audioUrl", () => {
    expect(questionAudioUrl("single_choice", { audioUrl: AUDIO })).toBe(AUDIO);
  });
  it("bỏ qua rỗng/whitespace/không phải chuỗi", () => {
    expect(questionAudioUrl("single_choice", { audioUrl: "" })).toBeUndefined();
    expect(questionAudioUrl("single_choice", { audioUrl: "   " })).toBeUndefined();
    expect(questionAudioUrl("single_choice", { audioUrl: 123 })).toBeUndefined();
    expect(questionAudioUrl("single_choice", {})).toBeUndefined();
    expect(questionAudioUrl("single_choice", null)).toBeUndefined();
  });
  it("loại tự phát audio (dictation/media_anchored) → undefined kể cả có audioUrl", () => {
    expect(questionAudioUrl("dictation", { audioUrl: AUDIO })).toBeUndefined();
    expect(questionAudioUrl("media_anchored", { audioUrl: AUDIO })).toBeUndefined();
  });
});

describe("resolveAudioSlots", () => {
  it("mạch ĐỌC có audioUrl: reading = audioUrl, nút câu tắt", () => {
    const slots = resolveAudioSlots({
      line: "ĐỌC",
      questionType: "single_choice",
      payload: { audioUrl: AUDIO },
      lessonAudioUrl: "/uploads/extra-media.mp3",
    });
    expect(slots.readingAudioUrl).toBe(AUDIO);
    expect(slots.questionAudioUrl).toBeUndefined();
  });
  it("mạch ĐỌC không có audioUrl: reading fallback lessonAudioUrl, nút câu vẫn tắt", () => {
    const slots = resolveAudioSlots({
      line: "ĐỌC",
      questionType: "single_choice",
      payload: {},
      lessonAudioUrl: "/uploads/extra-media.mp3",
    });
    expect(slots.readingAudioUrl).toBe("/uploads/extra-media.mp3");
    expect(slots.questionAudioUrl).toBeUndefined();
  });
  it("mạch khác ĐỌC có audioUrl: không có slot bài đọc, nút câu đọc audioUrl", () => {
    const slots = resolveAudioSlots({
      line: "VIẾT",
      questionType: "single_choice",
      payload: { audioUrl: AUDIO },
      lessonAudioUrl: "/uploads/extra-media.mp3",
    });
    expect(slots.readingAudioUrl).toBeUndefined();
    expect(slots.questionAudioUrl).toBe(AUDIO);
  });
  it("không tra được mạch (line thiếu): xử như mạch khác", () => {
    const slots = resolveAudioSlots({
      line: undefined,
      questionType: "single_choice",
      payload: { audioUrl: AUDIO },
      lessonAudioUrl: undefined,
    });
    expect(slots.readingAudioUrl).toBeUndefined();
    expect(slots.questionAudioUrl).toBe(AUDIO);
  });
});
