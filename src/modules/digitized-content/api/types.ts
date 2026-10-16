// Types cho nội dung tự số hóa — tách riêng để loader.ts và UI cùng dùng.

export interface DigitizedLessonMeta {
  id: string;
  bai: number;
  lesson_id: string;
  title: string;
}

export interface DigitizedChapterMeta {
  order_index: number;
  number: number;
  chapter_id: string;
  title: string;
  lessons: DigitizedLessonMeta[];
}

export interface DigitizedManifest {
  title: string;
  book_id: string;
  content_scope: string;
  chapters: DigitizedChapterMeta[];
}

export interface DigitizedQuestion {
  id: string;
  question_type: string;
  payload: Record<string, unknown>;
}

export interface DigitizedLessonItem {
  id: string;
  title: string | null;
  questions: DigitizedQuestion[];
}

export interface DigitizedLesson {
  id: string;
  /** lesson_id dạng số ("57001") — trùng với id trong content.json */
  lesson_id?: string;
  /** slug dạng "bai1" — trùng với id trong manifest.json */
  code?: string;
  /** lesson_code dạng số ("57001") */
  lesson_code?: string;
  title: string;
  lesson_items: DigitizedLessonItem[];
}

export interface DigitizedBookContent {
  id: string;
  book_id: string;
  title: string;
  book_code: string;
  chapters: Array<{
    id: string;
    title: string;
    lessons: DigitizedLesson[];
  }>;
}
