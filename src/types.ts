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

