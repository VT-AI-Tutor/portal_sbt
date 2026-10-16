/**
 * DatePicker — chọn 1 ngày, dựng từ Popover + Calendar + Button (kiểu shadcn).
 * Giá trị vào/ra là chuỗi civil-date "yyyy-MM-dd" (không kèm giờ/múi giờ) nên
 * không bị lệch ngày khi đổi timezone. Mốc "hôm nay" (chặn ngày tương lai, tháng
 * mặc định) tính theo múi giờ Việt Nam (UTC+7) mặc định — xem {@link DEFAULT_TIME_ZONE}.
 */
import { useMemo, useState } from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { Button } from "@/core/ui/button";
import { Calendar } from "@/core/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/core/ui/popover";

/** Múi giờ mặc định: Hà Nội / Việt Nam (UTC+7, không có DST). */
export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

const VALUE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "dd/MM/yyyy";

/**
 * Ngày hiện tại theo `timeZone` dưới dạng Date (nửa đêm địa phương, chỉ phần
 * ngày). `now` tách ra để test được với thời điểm cố định.
 */
export function todayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): Date {
  const civil = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parse(civil, VALUE_FORMAT, now);
}

/** "yyyy-MM-dd" → "dd/MM/yyyy" y hệt cách DatePicker hiển thị; chuỗi hỏng → "". */
export function formatDisplayDate(value: string): string {
  const parsed = value ? parse(value, VALUE_FORMAT, new Date()) : undefined;
  return parsed && isValid(parsed) ? format(parsed, DISPLAY_FORMAT) : "";
}

export interface DatePickerProps {
  /** Giá trị "yyyy-MM-dd"; rỗng = chưa chọn. */
  value: string;
  /** Trả về "yyyy-MM-dd", hoặc "" khi người dùng bỏ chọn. */
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  /** Năm sớm nhất chọn được (mép dropdown năm). Mặc định 1950. */
  fromYear?: number;
  /** Chặn mọi ngày sau "hôm nay" (theo `timeZone`). Hữu ích cho ngày sinh. */
  disableFuture?: boolean;
  /** Múi giờ tính "hôm nay". Mặc định UTC+7 (Việt Nam). */
  timeZone?: string;
}

export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Chọn ngày",
  className,
  fromYear = 1950,
  disableFuture = false,
  timeZone = DEFAULT_TIME_ZONE,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => todayInTimeZone(timeZone), [timeZone]);
  // Chuỗi hỏng (không phải yyyy-MM-dd) → coi như chưa chọn, tránh format() ném lỗi.
  const selected = useMemo(() => {
    const parsed = value ? parse(value, VALUE_FORMAT, today) : undefined;
    return parsed && isValid(parsed) ? parsed : undefined;
  }, [value, today]);
  const startMonth = useMemo(() => new Date(fromYear, 0), [fromYear]);
  const disabledDays = useMemo(
    () => (disableFuture ? { after: today } : undefined),
    [disableFuture, today],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          {selected ? format(selected, DISPLAY_FORMAT) : placeholder}
          <CalendarIcon className="size-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? format(d, VALUE_FORMAT) : "");
            setOpen(false);
          }}
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={disableFuture ? today : undefined}
          defaultMonth={selected ?? today}
          disabled={disabledDays}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
