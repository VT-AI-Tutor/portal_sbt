/**
 * Types cho quản lý lớp/buổi học GV (GAP-132). Trích từ hợp đồng Classes API.
 * Dùng `[key: string]: unknown` để chịu field BE trả thêm mà không vỡ.
 */

export type ClassStatus = string; // ClassStatus enum BE (draft|scheduled|published|cancelled|archived…)
export type PublishStatus = "draft" | "published" | "unpublished";
export type DeliveryMode = "online" | "offline" | "blended";
export type Visibility = "internal" | "public" | "private";

export interface ClassSummary {
  id: string;
  name: string;
  display_name?: string;
  code: string;
  class_type?: string;
  delivery_mode?: DeliveryMode;
  publish_status?: PublishStatus;
  visibility?: Visibility;
  capacity?: number | null;
  status?: ClassStatus;
  roster_count?: number;
  students?: number;
  next_session?: string | null;
  class_start_at?: string | null;
  class_end_at?: string | null;
  location_name?: string | null;
  meeting_url?: string | null;
  internal_notes?: string | null;
  lead_instructor_id?: string | null;
  [key: string]: unknown;
}

export interface ClassDetailSummary {
  roster_count: number;
  active_roster_count: number;
  session_count: number;
  completed_session_count: number;
  materials_count: number;
  assignments_count: number;
}

export interface ClassDetail extends ClassSummary {
  sessions?: SessionSummary[];
  roster?: RosterRow[];
  class_materials?: MaterialRow[];
  assignments?: AssignmentRow[];
  summary?: ClassDetailSummary;
}

export interface ClassFormValues {
  code: string;
  name: string;
  display_name?: string;
  class_type?: string;
  delivery_mode?: DeliveryMode;
  visibility?: Visibility;
  capacity?: number | null;
  class_start_at?: string;
  class_end_at?: string;
  enrollment_open_at?: string;
  enrollment_close_at?: string;
  timezone?: string;
  location_name?: string;
  location_address?: string;
  meeting_platform?: string;
  meeting_url?: string;
  internal_notes?: string;
}

export interface RosterRow {
  id: string; // learner user id
  enrollment_id: string;
  status: "active" | "waitlisted" | "completed" | "dropped";
  name: string;
  department?: string | null;
  progress?: number;
  participation?: number;
  last_score?: number | null;
  risk?: "high" | "low" | "none";
  joined_at?: string | null;
  [key: string]: unknown;
}

export interface PendingEnrollment {
  enrollment_id: string;
  learner_user_id: string;
  created_at: string | null;
  [key: string]: unknown;
}

export interface JoinCodeInfo {
  join_code: string;
  join_via_code_enabled: boolean;
}

export type SessionStatus = string;

export interface SessionSummary {
  id: string;
  title: string;
  session_no?: number;
  date?: string | null;
  time?: string | null;
  duration?: string | null;
  status?: SessionStatus;
  start_at?: string | null;
  end_at?: string | null;
  timezone?: string;
  session_type?: string;
  delivery_mode?: DeliveryMode;
  location_name?: string | null;
  meeting_url?: string | null;
  attendance_required?: boolean;
  present_count?: number;
  late_count?: number;
  absent_count?: number;
  [key: string]: unknown;
}

export interface SessionDetail extends SessionSummary {
  allowed_actions?: string[];
  schedule?: {
    start_at: string;
    end_at: string;
    timezone: string;
    date_label?: string;
    time_label?: string;
    duration?: string;
  };
  attendance_settings?: { required: boolean; summary?: unknown };
}

export interface SessionFormValues {
  title: string;
  start_at: string;
  end_at: string;
  timezone?: string;
  session_type?: string;
  delivery_mode?: DeliveryMode;
  location_name?: string;
  meeting_url?: string;
  attendance_required?: boolean;
  notes?: string;
  /** BE yêu cầu khi status != draft — mặc định GV chủ nhiệm lớp. */
  instructor_id?: string;
}

export type AttendanceStatus = "present" | "absent" | "late";

export interface AttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
  time?: string;
  method?: "qr" | "gps" | "manual";
}

export interface MaterialRow {
  id: string;
  class_id: string;
  session_id?: string | null;
  material_id: string;
  material_type?: string;
  name: string;
  is_required?: boolean;
  release_at?: string | null;
  due_at?: string | null;
  visibility?: "enrolled_only" | "instructor_only" | "public";
  status?: string;
  [key: string]: unknown;
}

export interface AttachMaterialInput {
  material_id: string;
  title_snapshot: string;
  material_type?: string;
  session_id?: string;
  is_required?: boolean;
  release_at?: string;
  due_at?: string;
  visibility?: "enrolled_only" | "instructor_only" | "public";
}

export interface AssignmentRow {
  id: string;
  assignment_id: string;
  title: string;
  class_id: string;
  class_name: string;
  session_id: string | null;
  deadline: string | null;
  status: string;
  [key: string]: unknown;
}

export interface OperationalSummary {
  class_id: string;
  status?: ClassStatus;
  publish_status?: PublishStatus;
  roster: { active: number; waitlisted: number; dropped: number; completed: number };
  sessions: {
    total: number;
    scheduled: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    rescheduled: number;
  };
  materials_count: number;
  assignments_count: number;
  attendance: { present: number; late: number; absent: number; attendance_rate: number };
}

/** Props chung cho mọi tab trong TeacherClassDetailPage (CHỐT ở WAVE 0). */
export interface TabProps {
  classId: string;
  token: string;
  cls: ClassDetail;
  /** Gọi lại getClass để làm tươi chi tiết + summary sau thao tác. */
  reload: () => void;
}
