export interface Student {
  id: string;
  name?: string;
  phone?: string;
  className?: string;
  grade?: string;
  notes?: string;
  [key: string]: any; // Allow other Excel columns dynamically
}

export interface WhatsAppConfig {
  mode: "simulated" | "real" | "cloud_api";
  simulatedStatus: "disconnected" | "qr_ready" | "connecting" | "connected";
  simulatedPhone: string;
  hasCloudApiKey: boolean;
  cloudPhoneId: string;
  cloudAccountId: string;
}

export interface CampaignLog {
  id: string;
  studentName: string;
  phone: string;
  message: string;
  status: "pending" | "sending" | "success" | "failed";
  timestamp: string;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  total: number;
  sent: number;
  failed: number;
  status: "idle" | "running" | "completed" | "paused";
  startTime: string | null;
  endTime: string | null;
  restBreakUntil?: number | null;
  logs?: CampaignLog[];
}

export interface ReportItem {
  id: string;
  studentName: string;
  phone: string;
  grade?: string;
  className?: string;
  message: string;
  status: "pending" | "sending" | "success" | "failed";
  timestamp: string;
  campaignId?: string;
  campaignName?: string;
  type: "campaign" | "individual";
  error?: string;
}

export interface ReportFilterState {
  dateMode: "all" | "today" | "yesterday" | "last7days" | "last30days" | "specific_date" | "range";
  specificDate: string;
  startDate: string;
  endDate: string;
  grade: string;
  className: string;
  studentSearch: string;
  status: "all" | "success" | "failed";
  sourceType: "all" | "campaign" | "individual";
}

export interface SchoolSignatories {
  countryName?: string;
  ministryName?: string;
  administrationName?: string;
  schoolName?: string;
  principalName: string;
  vicePrincipalName: string;
  counselorName: string;
  systemManagerName?: string;
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  phone?: string;
  grade?: string;
  className?: string;
  date: string; // YYYY-MM-DD
  status: "present" | "absent_unexcused" | "absent_excused" | "tardy";
  tardyMinutes?: number;
  notes?: string;
  notified?: boolean;
  notifiedAt?: string;
  timestamp: string;
}

export interface DailyAttendanceSummary {
  date: string;
  totalStudents: number;
  presentCount: number;
  absentUnexcusedCount: number;
  absentExcusedCount: number;
  tardyCount: number;
}

export interface ReportPrintOptions {
  messageDisplayMode: "header_summary" | "table_column" | "both" | "hidden";
  tableFontSize: "normal" | "compact" | "ultra_compact";
  removeBlankLines: boolean;
  showSignatures: boolean;
  showStatsBox: boolean;
}

// Noor System Student Absence Record
export interface NoorStudentAbsence {
  id: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  className?: string;
  track?: string; // e.g. السنة المشتركة / مسارات
  phone?: string;
  // Excused absence count and specific dates from Noor
  excusedDaysCount: number;
  excusedDates: string[]; // e.g. ["1447/08/10", "1447/08/15", ...]
  // Unexcused absence count and specific dates from Noor
  unexcusedDaysCount: number;
  unexcusedDates: string[]; // e.g. ["1447/08/12", "1447/08/14", ...]
  // Absence percentage or total rate from Noor report (نسبة غياب الطالب)
  absenceRate?: string | number;
  // Tardiness count
  tardyCount?: number;
  lastUpdated?: string;
  source?: "noor_tool" | "manual" | "excel_import";
  notes?: string;
}

// Guidance & Counseling Procedural Action History
export interface GuidanceStudentAction {
  id: string;
  studentId: string;
  studentName: string;
  absenceType: "excused" | "unexcused";
  threshold: "3_days" | "5_days" | "10_days";
  actionType: "learning_plan" | "case_study" | "parent_whatsapp" | "committee_meeting" | "principal_referral" | "child_protection_escalation";
  title: string;
  details?: string;
  generatedDocumentType?: "learning_plan" | "case_study" | "committee_minutes" | "principal_referral";
  generatedDocumentContent?: string;
  whatsappMessageSent?: string;
  whatsappSentAt?: string;
  createdAt: string;
  status: "completed" | "pending";
}

// Guidance Committee Member
export interface GuidanceCommitteeMember {
  role: string;
  name: string;
}

