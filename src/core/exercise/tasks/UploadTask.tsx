import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileImage, File as FileIcon, Loader2 } from 'lucide-react';
import { PlayerHeader } from '../players/shared';
import type { ContentBlock } from '../players/shared';
// web-own: tasks/ nằm ngoài copy list sync studio (xem checklist WEB-OWN cuối
// scripts/detokenize-players.mjs) — studio không có module này.
import { isPayloadTooLarge, PAYLOAD_TOO_LARGE_MESSAGE } from '../../api/uploadErrors';

/** Một file trong answer.files — đúng wire format PUT answer / POST submit. */
export interface UploadAnswerFile {
  fileUrl: string;
  fileId: string;
  name?: string;
  size?: number;
  type?: string;
}

interface UploadTaskProps {
  title: string;
  instruction?: string;
  /**
   * Full authored content (paragraphs + images). When present, PlayerHeader
   * renders every block in order instead of just the plain-text `title` — so a
   * multi-paragraph stem is not truncated to its first line (issue #558).
   */
  richContent?: { blocks?: ContentBlock[] };
  allowedFileTypes?: string[];
  maxFileSizeMB?: number;
  onComplete: () => void;
  onAnswerChange?: (answer: unknown) => void;
  submitted?: boolean;
  // web-own: kênh khôi phục answer {files:[{fileUrl,fileId,…}]} khi chuyển câu
  // / xem lại bài — chưa upstream lên studio (cùng đợt với onUploadFile).
  answer?: unknown;
  /**
   * web-own: upload thật lên server (POST /attempt/upload-file). Có mặt →
   * mỗi file chọn được upload ngay và answer emit dạng {files:[…]} để đi theo
   * PUT answer / POST submit; vắng mặt → giữ hợp đồng cũ (metadata local,
   * /dev/players và studio không đổi hành vi).
   */
  onUploadFile?: (file: File) => Promise<{ fileId: string; fileUrl: string }>;
}

interface Entry {
  key: number;
  name: string;
  size?: number;
  type?: string;
  /** objectURL (file local) hoặc fileUrl (đã upload, là ảnh); '' nếu không có. */
  preview: string;
  status: 'local' | 'uploading' | 'uploaded';
  uploaded?: { fileUrl: string; fileId: string };
}

/** Tên file từ URL; percent-sequence hỏng thì giữ nguyên chuỗi thô thay vì throw. */
const safeDecodeBasename = (fileUrl: string): string => {
  const base = fileUrl.split('/').pop() ?? 'file';
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
};

const looksLikeImage = (f: UploadAnswerFile): boolean =>
  (f.type ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(f.fileUrl);

/** Dựng lại danh sách file từ answer đã lưu (best-effort, sai dạng ⇒ rỗng). */
const entriesFromAnswer = (answer: unknown): Entry[] => {
  const files = (answer as { files?: UploadAnswerFile[] } | null | undefined)?.files;
  if (!Array.isArray(files)) return [];
  return files
    .filter((f) => f && typeof f.fileUrl === 'string' && f.fileId != null)
    .map((f, i) => ({
      // Âm để không đụng key của file chọn mới trong cùng lượt mount.
      key: -(i + 1),
      name: f.name ?? safeDecodeBasename(f.fileUrl),
      size: f.size,
      type: f.type,
      preview: looksLikeImage(f) ? f.fileUrl : '',
      status: 'uploaded' as const,
      uploaded: { fileUrl: f.fileUrl, fileId: String(f.fileId) },
    }));
};

export const UploadTask: React.FC<UploadTaskProps> = ({
  title, instruction, richContent, allowedFileTypes, maxFileSizeMB = 10,
  onAnswerChange, submitted = false, answer, onUploadFile,
}) => {
  const [entries, setEntries] = useState<Entry[]>(() => entriesFromAnswer(answer));
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Bản mới nhất cho các callback async (upload xong sau khi state đã đổi).
  const entriesRef = useRef(entries);
  const nextKeyRef = useRef(1);

  const acceptStr = allowedFileTypes?.join(',') ?? 'image/*,.pdf';

  const emitAnswer = (list: Entry[]) => {
    if (onUploadFile) {
      const files = list
        .filter((e) => e.uploaded)
        .map((e) => ({
          fileUrl: e.uploaded!.fileUrl,
          fileId: e.uploaded!.fileId,
          name: e.name,
          size: e.size,
          type: e.type,
        }));
      // Trống thì emit null chứ KHÔNG {files:[]}: isAnswerEmpty chỉ đệ quy vào
      // envelope `answers`, nên {files:[]} vẫn bị đếm "đã làm" — xoá hết file
      // xong cảnh báo "còn câu chưa làm" sẽ không bao giờ nổ.
      onAnswerChange?.(files.length > 0 ? { files } : null);
    } else {
      onAnswerChange?.(list.map((e) => ({ name: e.name, size: e.size, type: e.type })));
    }
  };

  const updateEntries = (fn: (prev: Entry[]) => Entry[], emit: boolean) => {
    const next = fn(entriesRef.current);
    entriesRef.current = next;
    setEntries(next);
    if (emit) emitAnswer(next);
  };

  // Hydrate MUỘN theo prop `answer` (cùng hợp đồng reactive với MindMapTask):
  // màn "Xem lại" mount runner NGAY rồi mới fetch bài đã nộp về — key player
  // không đổi khi setAnswers nổ, nên chỉ init lúc mount là danh sách file
  // vĩnh viễn trống. Không đè khi học sinh đang thao tác (local/uploading),
  // và bỏ qua echo answer do chính mình vừa emit (so theo fileId).
  useEffect(() => {
    if (entriesRef.current.some((e) => e.status !== 'uploaded')) return;
    const fromProp = entriesFromAnswer(answer);
    const idsOf = (list: Entry[]) => list.map((e) => e.uploaded!.fileId).join('|');
    if (idsOf(fromProp) === idsOf(entriesRef.current)) return;
    entriesRef.current = fromProp;
    setEntries(fromProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);

  // Dọn objectURL khi unmount — remove/upload-lỗi đã tự revoke, nhưng chuyển câu thì
  // component unmount mà blob preview vẫn ghim bytes ảnh tới hết phiên.
  useEffect(
    () => () => {
      for (const e of entriesRef.current) {
        if (e.preview.startsWith('blob:')) URL.revokeObjectURL(e.preview);
      }
    },
    [],
  );

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setError('');
    const accepted: File[] = [];
    for (const f of Array.from(fileList)) {
      if (f.size > maxFileSizeMB * 1024 * 1024) {
        setError(`File "${f.name}" vượt quá ${maxFileSizeMB}MB`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;

    const newEntries: Entry[] = accepted.map((f) => ({
      key: nextKeyRef.current++,
      name: f.name,
      size: f.size,
      type: f.type,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
      status: onUploadFile ? 'uploading' : 'local',
    }));
    updateEntries((prev) => [...prev, ...newEntries], !onUploadFile);

    if (!onUploadFile) return;
    // Upload SONG SONG — 5 tấm ảnh không phải xếp hàng 5 lượt spinner. An toàn
    // vì entry đã append theo thứ tự chọn từ trước, mỗi lượt xong chỉ vá đúng
    // entry của mình theo key (updateEntries nguyên tử qua entriesRef).
    await Promise.all(
      accepted.map(async (file, i) => {
        const entry = newEntries[i];
        try {
          const res = await onUploadFile(file);
          updateEntries(
            (prev) => prev.map((e) => e.key === entry.key
              ? { ...e, status: 'uploaded' as const, uploaded: { fileId: String(res.fileId), fileUrl: res.fileUrl } }
              : e),
            true,
          );
        } catch (err) {
          // File CHƯA lên server → gỡ khỏi danh sách, báo rõ để chọn lại.
          if (entry.preview.startsWith('blob:')) URL.revokeObjectURL(entry.preview);
          updateEntries((prev) => prev.filter((e) => e.key !== entry.key), false);
          // 413: trần thân request của máy chủ thấp hơn maxFileSizeMB in ngay
          // trong câu hỏi, nên guard phía trên không chặn. Câu chung chỉ bảo
          // "thử lại" — học sinh chọn đúng file đó thêm vài lượt vẫn hỏng.
          setError(
            isPayloadTooLarge(err)
              ? PAYLOAD_TOO_LARGE_MESSAGE
              : `Tải file "${entry.name}" lên thất bại. Em thử lại nhé!`,
          );
        }
      }),
    );
  };

  const removeFile = (key: number) => {
    const entry = entriesRef.current.find((e) => e.key === key);
    if (entry?.preview.startsWith('blob:')) URL.revokeObjectURL(entry.preview);
    updateEntries((prev) => prev.filter((e) => e.key !== key), true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-2">
        <div className="max-w-5xl mx-auto">
          <PlayerHeader title={title} richContent={richContent} instruction={instruction} />

          {/* Drop zone */}
          <div
            onClick={() => !submitted && inputRef.current?.click()}
            // Băng NGANG gọn (icon + chữ cùng hàng) thay ô thả cao chiếm nhiều
            // chiều dọc — để câu có ảnh/mô tả phía trên không bị chật, phải cuộn.
            className={`border-4 border-dashed rounded-2xl p-4 sm:p-5 flex items-center justify-center gap-4 text-center transition-all cursor-pointer ${
              submitted ? 'border-slate-200 bg-slate-100' : 'border-violet-200  bg-violet-50/30 hover:border-violet-400 hover:bg-violet-50 '
            }`}
          >
            <Upload className="shrink-0 text-violet-400" size={28} />
            <div className="text-left">
              <p className="font-black text-slate-500">Nhấn để chọn file</p>
              <p className="text-slate-500 text-sm">Tối đa {maxFileSizeMB}MB</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={acceptStr}
              multiple
              className="hidden"
              disabled={submitted}
              onChange={e => { void handleFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {error && <p className="text-red-500 font-bold text-sm mt-2">{error}</p>}

          {/* File list */}
          {entries.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {entries.map((e) => (
                <div key={e.key} className="flex items-center gap-3 bg-white rounded-2xl border-4 border-white shadow-lg p-3">
                  {e.preview ? (
                    <img src={e.preview} alt={e.name} className="w-16 h-16 object-cover rounded-xl" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
                      {(e.type ?? '').includes('pdf') ? <FileIcon size={24} className="text-slate-500" /> : <FileImage size={24} className="text-slate-500" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{e.name}</p>
                    <p className="text-slate-500 text-xs">
                      {e.status === 'uploading'
                        ? 'Đang tải lên…'
                        : e.size != null ? `${(e.size / 1024 / 1024).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  {e.status === 'uploading' ? (
                    <Loader2 size={18} className="animate-spin text-violet-400" />
                  ) : !submitted && (
                    <button aria-label={`Xoá ${e.name}`} onClick={() => removeFile(e.key)} className="p-1 rounded-full hover:bg-red-50 ">
                      <X size={18} className="text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
