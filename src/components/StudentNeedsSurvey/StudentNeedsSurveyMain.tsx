import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Send,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Users,
  Eye,
  FileText,
  MessageSquare,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Lock,
  HeartPulse,
  BookOpen,
  Calendar,
  X,
  Play,
  Pause,
  Printer,
  FileSpreadsheet,
  HelpCircle,
  BadgeAlert,
  ArrowUpDown,
  Download,
  Phone,
  PauseCircle,
  Check,
  Loader2,
  XCircle,
  Settings,
} from "lucide-react";
import {
  StudentNeedsProfile,
  SurveyPriorityLevel,
  SurveyCategory,
  SurveyStatus,
  CaseAction,
} from "../../types/studentNeedsSurvey";
import { AppUser, SchoolSignatories } from "../../types";
import {
  extractStudentPhone,
  extractStudentName,
  extractStudentGrade,
  extractStudentClass,
} from "../AttendanceSystem";

interface BatchSendProgress {
  isOpen: boolean;
  isRunning: boolean;
  isCompleted: boolean;
  total: number;
  currentIndex: number;
  sentCount: number;
  failedCount: number;
  countdownSeconds: number;
  currentStudentName: string;
  logs: {
    id: string;
    studentName: string;
    phone: string;
    status: "success" | "failed";
    message?: string;
    error?: string;
  }[];
}

interface StudentNeedsSurveyMainProps {
  students: any[];
  currentUser?: AppUser | null;
  schoolName?: string;
  isWhatsAppConnected?: boolean;
  schoolSignatories?: SchoolSignatories;
  onOpenSignatoriesModal?: () => void;
  onNavigateToWhatsApp?: () => void;
}

export default function StudentNeedsSurveyMain({
  students,
  currentUser,
  schoolName = "ثانوية الأبناء الأولى",
  isWhatsAppConnected = false,
  schoolSignatories,
  onOpenSignatoriesModal,
  onNavigateToWhatsApp,
}: StudentNeedsSurveyMainProps) {
  // Main Sub-Tabs
  const [activeTab, setActiveTab] = useState<"roster" | "dashboard" | "cases" | "alerts" | "official_report">("roster");

  // Profiles Store from Server
  const [profiles, setProfiles] = useState<Record<string, StudentNeedsProfile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Roster Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "pending" | "urgent">("all");

  // Official Comprehensive Report Filters
  const [reportCategoryFilter, setReportCategoryFilter] = useState<string>("all");
  const [reportPriorityFilter, setReportPriorityFilter] = useState<string>("all");
  const [reportGradeFilter, setReportGradeFilter] = useState<string>("all");
  const [reportClassFilter, setReportClassFilter] = useState<string>("all");
  const [reportSearchQuery, setReportSearchQuery] = useState<string>("");
  const [reportOnlyFlagged, setReportOnlyFlagged] = useState<boolean>(true);

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Toast / Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Case Detail Modal
  const [selectedCaseProfile, setSelectedCaseProfile] = useState<StudentNeedsProfile | null>(null);

  // Batch WhatsApp Dispatch Engine State (Matching AttendanceSystem Dispatch Exactly)
  const [batchProgress, setBatchProgress] = useState<BatchSendProgress>({
    isOpen: false,
    isRunning: false,
    isCompleted: false,
    total: 0,
    currentIndex: 0,
    sentCount: 0,
    failedCount: 0,
    countdownSeconds: 0,
    currentStudentName: "",
    logs: [],
  });
  const abortBatchRef = useRef(false);

  // WhatsApp Message Template State
  const [messageTemplate, setMessageTemplate] = useState<string>(
    `ولي أمر الطالب/ـة: {اسم الطالب} ({الصف} - {الشعبة})
نأمل منكم التكرم بتعبئة الاستمارة الإلكترونية المختصرة التالية، والتي تهدف إلى تعزيز متابعة المدرسة ودعم الطالب/ـة بما يناسب احتياجاته الصحية والاجتماعية والتعليمية.
🔗 الرابط: {الرابط}
🔑 رمز التفعيل الرقمي: {رمز التفعيل}
نشكركم على حسن تعاونكم واهتمامكم.
- إدارة {اسم المدرسة}`
  );

  // Action input modal in case card
  const [newActionType, setNewActionType] = useState<string>("review_survey");
  const [newActionNotes, setNewActionNotes] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  // Teacher Guidance Editing state
  const [editingGuidance, setEditingGuidance] = useState(false);
  const [guidanceCustomNote, setGuidanceCustomNote] = useState("");

  // Fetch Profiles from Server
  const fetchProfiles = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await fetch("/api/student-needs-survey/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || {});
      }
    } catch (e) {
      console.error("Error fetching survey profiles:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [students.length]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Grades and Classes derived from active students
  const grades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.grade) set.add(s.grade);
    });
    return Array.from(set);
  }, [students]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.className) set.add(String(s.className));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [students]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (gradeFilter !== "all" && s.grade !== gradeFilter) return false;
      if (classFilter !== "all" && String(s.className) !== classFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = s.name?.toLowerCase().includes(q);
        const idMatch = s.nationalId?.includes(q) || s.id?.includes(q);
        const phoneMatch = s.phone?.includes(q);
        if (!nameMatch && !idMatch && !phoneMatch) return false;
      }

      const p = profiles[s.id];
      if (statusFilter === "submitted") {
        if (!p || p.submissionCount === 0) return false;
      } else if (statusFilter === "pending") {
        if (p && p.submissionCount > 0) return false;
      } else if (statusFilter === "urgent") {
        if (!p || (p.overallPriority !== "urgent" && p.overallPriority !== "high")) return false;
      }

      return true;
    });
  }, [students, profiles, gradeFilter, classFilter, searchQuery, statusFilter]);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Helper to construct survey link
  const getSurveyLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?survey_token=${token}`;
  };

  // Build filled message for a student
  const buildStudentMessage = (student: any) => {
    const p = profiles[student.id];
    const token = p?.activationToken || `sn_${student.id}`;
    const code = p?.activationCode || "123456";
    const link = getSurveyLink(token);

    return messageTemplate
      .replace(/{اسم الطالب}/g, student.name || "طالبنا العزيز")
      .replace(/{الصف}/g, student.grade || "المرحلة الثانوية")
      .replace(/{الشعبة}/g, student.className || "1")
      .replace(/{الرابط}/g, link)
      .replace(/{رمز التفعيل}/g, code)
      .replace(/{اسم المدرسة}/g, schoolName);
  };

  // Copy single student link and code
  const handleCopyLink = (student: any) => {
    const p = profiles[student.id];
    const token = p?.activationToken || `sn_${student.id}`;
    const code = p?.activationCode || "123456";
    const link = getSurveyLink(token);
    const text = `رابط استبيان الطالب: ${student.name}\nالرابط: ${link}\nرمز التفعيل: ${code}`;

    navigator.clipboard.writeText(text).then(() => {
      showToast(`✓ تم نسخ رابط ورمز تفعيل الطالب: ${student.name}`);
    });
  };

  // Single WhatsApp send
  const handleSendSingleWhatsApp = async (student: any) => {
    const studentPhone = extractStudentPhone(student);
    const studentName = extractStudentName(student);
    const studentGrade = extractStudentGrade(student);
    const studentClass = extractStudentClass(student);

    if (!studentPhone) {
      showToast("⚠️ لا يوجد رقم جوال مسجل لهذا الطالب في الكشف");
      return;
    }

    const message = buildStudentMessage(student);
    try {
      showToast(`جاري إرسال الاستبيان للطالب: ${studentName}...`);
      const res = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: studentPhone,
          message,
          studentName,
          grade: studentGrade,
          className: studentClass,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success || data.status === "success" || data.messages)) {
        showToast(`✓ تم إرسال رابط الاستبيان بنجاح لولي أمر: ${studentName}`);
        // Update invite status on server
        await fetch("/api/student-needs-survey/batch-update-invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: [student.id], status: "sent" }),
        });
        fetchProfiles();
      } else {
        // Fallback open WhatsApp web link
        const cleanPhone = studentPhone.replace(/[^0-9]/g, "");
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
        showToast(`تم فتح نافذة الواتساب لإرسال الرسالة إلى: ${studentName}`);
      }
    } catch (err) {
      const cleanPhone = studentPhone.replace(/[^0-9]/g, "");
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");
      showToast(`تم فتح نافذة الواتساب لإرسال الرسالة إلى: ${studentName}`);
    }
  };

  // Live Interactive Batch Sender Engine (Matching AttendanceSystem Anti-Ban Engine with 15s + random jitter)
  const startBatchDispatch = async () => {
    const targets = filteredStudents.filter((s) => selectedStudentIds.includes(s.id));
    if (targets.length === 0) {
      showToast("يرجى تحديد طالب واحد على الأقل قبل بدء الإرسال");
      return;
    }

    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      isRunning: true,
      isCompleted: false,
      total: targets.length,
      currentIndex: 0,
      sentCount: 0,
      failedCount: 0,
      countdownSeconds: 0,
      currentStudentName: "",
      logs: [],
    });

    let sent = 0;
    let failed = 0;
    const dispatchedIds: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      if (abortBatchRef.current) break;

      const student = targets[i];
      const studentName = extractStudentName(student);
      const studentPhone = extractStudentPhone(student);
      const studentGrade = extractStudentGrade(student);
      const studentClass = extractStudentClass(student);

      setBatchProgress((prev) => ({
        ...prev,
        currentIndex: i + 1,
        currentStudentName: studentName,
        countdownSeconds: 0,
      }));

      if (!studentPhone) {
        failed++;
        setBatchProgress((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName,
              phone: "بدون جوال",
              status: "failed",
              error: "لا يوجد رقم جوال مسجل في الكشف",
            },
            ...prev.logs,
          ],
        }));
        continue;
      }

      const message = buildStudentMessage(student);

      try {
        const res = await fetch("/api/whatsapp/send-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: studentPhone,
            message,
            studentName,
            grade: studentGrade,
            className: studentClass,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && (data.success || data.status === "success" || data.messages)) {
          sent++;
          dispatchedIds.push(student.id);
          setBatchProgress((prev) => ({
            ...prev,
            sentCount: sent,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName,
                phone: studentPhone,
                status: "success",
                message: "تم الإرسال بنجاح عبر الواتساب",
              },
              ...prev.logs,
            ],
          }));
        } else {
          failed++;
          setBatchProgress((prev) => ({
            ...prev,
            failedCount: failed,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName,
                phone: studentPhone,
                status: "failed",
                error: data.error || "تعذر الإرسال عبر الخادم",
              },
              ...prev.logs,
            ],
          }));
        }
      } catch (err: any) {
        failed++;
        setBatchProgress((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName,
              phone: studentPhone,
              status: "failed",
              error: err.message || "خطأ في الاتصال بالشبكة",
            },
            ...prev.logs,
          ],
        }));
      }

      // Safe 15-second Anti-Ban Delay with human-like jitter variation between messages (except for the last message)
      if (i < targets.length - 1 && !abortBatchRef.current) {
        // Safe 15-second interval + random jitter (between 14s and 18s)
        const jitterSecs = Math.floor(Math.random() * 4) - 1; // -1 to +2
        const totalDelaySecs = Math.max(14, 15 + jitterSecs);

        for (let countdown = totalDelaySecs; countdown > 0; countdown--) {
          if (abortBatchRef.current) break;
          setBatchProgress((prev) => ({
            ...prev,
            countdownSeconds: countdown,
          }));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Batch sending completion
    if (!abortBatchRef.current) {
      setBatchProgress((prev) => ({
        ...prev,
        isRunning: false,
        isCompleted: true,
        countdownSeconds: 0,
      }));
      showToast("✓ اكتمل إرسال روابط الاستبيان بنجاح");
    } else {
      setBatchProgress((prev) => ({
        ...prev,
        isRunning: false,
        countdownSeconds: 0,
      }));
      showToast("تم إيقاف الإرسال مؤقتاً");
    }

    if (dispatchedIds.length > 0) {
      fetch("/api/student-needs-survey/batch-update-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: dispatchedIds, status: "sent" }),
      }).then(() => fetchProfiles());
    }
  };

  // Add Action to selected case
  const handleAddCaseAction = async () => {
    if (!selectedCaseProfile || !newActionNotes.trim()) return;

    try {
      setSavingAction(true);
      const actionLabels: Record<string, string> = {
        review_survey: "مراجعة الاستبيان",
        contact_guardian: "تواصل مع ولي الأمر",
        interview_student: "مقابلة فردية مع الطالب",
        counselor_note: "تسجيل ملاحظة إرشادية",
        teacher_guidance_issued: "توجيه تربوي للمعلمين",
        schedule_followup: "جدولة موعد متابعة",
        case_stabilized: "تسجيل استقرار الحالة",
        case_closed: "إغلاق ملف الحالة",
      };

      const res = await fetch("/api/student-needs-survey/case-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedCaseProfile.studentId,
          action: {
            actionType: newActionType,
            actionLabel: actionLabels[newActionType] || "إجراء إرشادي",
            performedBy: currentUser?.name || "الموجه الطلابي",
            notes: newActionNotes.trim(),
          },
          newStatus:
            newActionType === "case_closed"
              ? "closed"
              : newActionType === "case_stabilized"
              ? "stable"
              : "in_progress",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedCaseProfile(data.profile);
        setProfiles((prev) => ({ ...prev, [data.profile.studentId]: data.profile }));
        setNewActionNotes("");
        showToast("✓ تم توثيق الإجراء بنجاح في سجل متابعة الحالة");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAction(false);
    }
  };

  // Approve Teacher Guidance
  const handleApproveTeacherGuidance = async () => {
    if (!selectedCaseProfile) return;
    try {
      const res = await fetch("/api/student-needs-survey/teacher-guidance/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedCaseProfile.studentId,
          guidance: {
            ...selectedCaseProfile.teacherGuidance,
            customGuidanceNote: guidanceCustomNote || selectedCaseProfile.teacherGuidance?.customGuidanceNote,
          },
          approvedBy: currentUser?.name || "الموجه الطلابي",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCaseProfile(data.profile);
        setProfiles((prev) => ({ ...prev, [data.profile.studentId]: data.profile }));
        setEditingGuidance(false);
        showToast("✓ تم اعتماد بطاقة توجيه المعلمين بنجاح");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const list: StudentNeedsProfile[] = Object.values(profiles) as StudentNeedsProfile[];
    const submitted = list.filter((p) => p.submissionCount > 0);
    const urgent = submitted.filter((p) => p.overallPriority === "urgent");
    const high = submitted.filter((p) => p.overallPriority === "high");
    const medium = submitted.filter((p) => p.overallPriority === "medium");
    const low = submitted.filter((p) => p.overallPriority === "low");

    const categoryCounts: Record<string, number> = {
      academic: 0,
      social: 0,
      behavioral: 0,
      health: 0,
      family: 0,
      attendance: 0,
      temporary: 0,
    };

    submitted.forEach((p) => {
      (p.primaryCategories || []).forEach((cat) => {
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
      });
    });

    const activeCases = submitted.filter((p) => p.status !== "closed");
    const closedCases = submitted.filter((p) => p.status === "closed");

    return {
      totalStudents: students.length,
      submittedCount: submitted.length,
      urgentCount: urgent.length,
      highCount: high.length,
      mediumCount: medium.length,
      lowCount: low.length,
      activeCasesCount: activeCases.length,
      closedCasesCount: closedCases.length,
      categoryCounts,
    };
  }, [profiles, students.length]);

  return (
    <div className="space-y-6 font-sans pb-12" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white py-3 px-6 rounded-2xl shadow-2xl border border-slate-700 text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Section Header Card */}
      <div className="bg-gradient-to-l from-teal-800 via-teal-700 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl text-xs text-teal-200 border border-white/15">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
              <span>نظام الرصد الذكي للحالات الاجتماعية والصحية ودعم الطالب</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              استبيان احتياجات الطلاب
            </h1>
            <p className="text-teal-100/90 text-xs sm:text-sm max-w-2xl leading-relaxed">
              جمع معلومات استباقية ومختصرة من أولياء الأمور برمز تفعيل رقمي آمن، وتحليل المؤشرات لتقديم التوصيات للموجه وبطاقات التوجيه التربوي للمعلمين مع الحفاظ الصارم على الخصوصية.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchProfiles(true)}
              disabled={refreshing}
              className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>تحديث البيانات</span>
            </button>

            {metrics.submittedCount > 0 && (
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2.5 text-center">
                <div className="text-[10px] text-teal-200">الاستبيانات المستلمة</div>
                <div className="text-lg font-black text-white">
                  {metrics.submittedCount}{" "}
                  <span className="text-[11px] font-normal text-teal-200">من {metrics.totalStudents}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/15 overflow-x-auto no-scrollbar">
          {[
            { id: "roster", label: "قائمة الطلاب والإرسال", icon: Users, count: filteredStudents.length },
            { id: "dashboard", label: "لوحة المؤشرات والتحليل الذكي", icon: Sparkles, count: metrics.submittedCount },
            { id: "cases", label: "سجل الحالات والمتابعة", icon: FileText, count: metrics.activeCasesCount },
            { id: "alerts", label: "التنبيهات وسجل التدقيق", icon: BadgeAlert, count: metrics.urgentCount + metrics.highCount },
            { id: "official_report", label: "التقرير الرسمي الشامل", icon: Printer, count: metrics.activeCasesCount },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-white text-teal-900 shadow-md scale-102"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isActive ? "bg-teal-100 text-teal-900" : "bg-white/20 text-white"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Roster & Dispatch Engine */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="البحث باسم الطالب أو رقم الهوية أو الجوال..."
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-600 focus:bg-white transition-all"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Grade */}
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-teal-600"
                >
                  <option value="all">جميع الصفوف</option>
                  {grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                {/* Class */}
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-teal-600"
                >
                  <option value="all">جميع الشعب</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      شعبة {c}
                    </option>
                  ))}
                </select>

                {/* Survey Status */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-teal-600"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="submitted">تم استلام الاستبيان</option>
                  <option value="pending">بانتظار التعبئة</option>
                  <option value="urgent">أولوية عاجلة / مرتفعة</option>
                </select>
              </div>
            </div>

            {/* Selection & Batch Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-teal-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                  <span>تحديد الكل ({filteredStudents.length})</span>
                </button>

                {selectedStudentIds.length > 0 && (
                  <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-xl">
                    تم تحديد: {selectedStudentIds.length} طالب
                  </span>
                )}
              </div>

              {/* Batch Send WhatsApp Button */}
              <div className="flex items-center gap-2">
                <button
                  disabled={selectedStudentIds.length === 0}
                  onClick={startBatchDispatch}
                  className="py-2.5 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال الروابط عبر الواتساب ({selectedStudentIds.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
                    <th className="p-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredStudents.length > 0 &&
                          selectedStudentIds.length === filteredStudents.length
                        }
                        onChange={handleSelectAll}
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="p-4">اسم الطالب / الهوية</th>
                    <th className="p-4">الصف والشعبة</th>
                    <th className="p-4">جوال ولي الأمر</th>
                    <th className="p-4">رمز التفعيل</th>
                    <th className="p-4">حالة الاستبيان</th>
                    <th className="p-4">المؤشر والأولوية</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 space-y-2">
                        <User className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-sm font-bold">لا يوجد طلاب مطابقون لمعايير البحث</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const isSelected = selectedStudentIds.includes(student.id);
                      const p = profiles[student.id];
                      const code = p?.activationCode || "123456";
                      const token = p?.activationToken || `sn_${student.id}`;
                      const hasSubmitted = p && p.submissionCount > 0;
                      const priority = p?.overallPriority || "low";

                      return (
                        <tr
                          key={student.id}
                          className={`transition-colors hover:bg-slate-50/60 ${
                            isSelected ? "bg-teal-50/30" : ""
                          }`}
                        >
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectStudent(student.id)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-900 text-sm">{student.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {student.nationalId || student.id}
                            </div>
                          </td>
                          <td className="p-4 text-slate-700">
                            <div>{student.grade || "المرحلة الثانوية"}</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              شعبة {student.className || "1"}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-slate-700 text-xs">
                            {student.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span dir="ltr">{student.phone}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">غير مسجل</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-lg text-xs tracking-wider">
                              {code}
                            </span>
                          </td>
                          <td className="p-4">
                            {hasSubmitted ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>تم الاستلام ({p.submissionCount})</span>
                              </span>
                            ) : p?.lastInviteSentAt ? (
                              <span className="inline-flex items-center gap-1 text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg text-[11px] font-medium">
                                <Clock className="w-3 h-3" />
                                <span>تم الإرسال</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">لم يُرسل بعد</span>
                            )}
                          </td>
                          <td className="p-4">
                            {hasSubmitted ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black ${
                                  priority === "urgent"
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : priority === "high"
                                    ? "bg-orange-100 text-orange-800 border border-orange-200"
                                    : priority === "medium"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                <span>
                                  {priority === "urgent" && "🔴 عاجل"}
                                  {priority === "high" && "🟠 مرتفع"}
                                  {priority === "medium" && "🟡 متوسط"}
                                  {priority === "low" && "🟢 منخفض"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {hasSubmitted ? (
                                <button
                                  onClick={() => {
                                    setSelectedCaseProfile(p);
                                  }}
                                  className="py-1.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                  title="فتح بطاقة الحالة للموجه"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                  <span>بطاقة الحالة</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSendSingleWhatsApp(student)}
                                  className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                  title="إرسال عبر الواتساب"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>إرسال</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleCopyLink(student)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                                title="نسخ رابط ورمز التفعيل"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Dashboard & Indicators Engine */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Top Counters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-500">إجمالي الاستبيانات المستلمة</div>
              <div className="text-3xl font-black text-teal-700">{metrics.submittedCount}</div>
              <div className="text-[11px] text-slate-400">
                نسبة الاستجابة: {Math.round((metrics.submittedCount / (metrics.totalStudents || 1)) * 100)}%
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="text-xs font-bold text-rose-600">حالات أولوية عاجلة / مرتفعة</div>
              <div className="text-3xl font-black text-rose-700">
                {metrics.urgentCount + metrics.highCount}
              </div>
              <div className="text-[11px] text-rose-500 font-medium">تستوجب مراجعة الموجه السريعة</div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="text-xs font-bold text-amber-600">حالات أولوية متوسطة</div>
              <div className="text-3xl font-black text-amber-700">{metrics.mediumCount}</div>
              <div className="text-[11px] text-slate-400">متابعة إرشادية وتربوية دورية</div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="text-xs font-bold text-emerald-600">حالات مستقرة / منخفضة</div>
              <div className="text-3xl font-black text-emerald-700">{metrics.lowCount}</div>
              <div className="text-[11px] text-slate-400">متابعة عامة وتشجيع مستمر</div>
            </div>
          </div>

          {/* Urgent Cases Alert Section */}
          {metrics.urgentCount + metrics.highCount > 0 && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-black text-base">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>حالات تتطلب الانتباه السريع من الموجه الطلابي ({metrics.urgentCount + metrics.highCount})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {(Object.values(profiles) as StudentNeedsProfile[])
                  .filter((p) => p.overallPriority === "urgent" || p.overallPriority === "high")
                  .map((p) => (
                    <div
                      key={p.studentId}
                      className="bg-white rounded-2xl p-4 border border-rose-200/90 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{p.studentName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {p.grade} — شعبة {p.className}
                        </div>
                        <div className="text-xs font-bold text-rose-700 mt-1">
                          الأولوية: {p.overallPriority === "urgent" ? "🔴 عاجل" : "🟠 مرتفع"}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCaseProfile(p)}
                        className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        مراجعة الحالة
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Distribution by Category */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <span>توزيع مؤشرات الاحتياج حسب المجال</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "academic", label: "أكاديمي ودراسي", icon: BookOpen, color: "text-blue-700 bg-blue-50 border-blue-200" },
                { id: "social", label: "اجتماعي وبيئي", icon: Users, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                { id: "behavioral", label: "سلوكي وانفعالي", icon: AlertCircle, color: "text-amber-700 bg-amber-50 border-amber-200" },
                { id: "health", label: "صحي وقائي", icon: HeartPulse, color: "text-rose-700 bg-rose-50 border-rose-200" },
                { id: "family", label: "أسري ومواقف مؤثرة", icon: ShieldCheck, color: "text-purple-700 bg-purple-50 border-purple-200" },
                { id: "attendance", label: "حضور ومواظبة", icon: Clock, color: "text-teal-700 bg-teal-50 border-teal-200" },
                { id: "temporary", label: "ظروف مؤقتة", icon: Calendar, color: "text-slate-700 bg-slate-50 border-slate-200" },
              ].map((cat) => {
                const count = metrics.categoryCounts[cat.id] || 0;
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.id}
                    className={`p-4 rounded-2xl border ${cat.color} flex items-center justify-between gap-3`}
                  >
                    <div>
                      <div className="text-xs font-bold">{cat.label}</div>
                      <div className="text-xl font-black mt-1">{count}</div>
                    </div>
                    <Icon className="w-6 h-6 opacity-60 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Cases & Counselor Smart Card */}
      {activeTab === "cases" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">سجل حالات دعم الطلاب والمتابعة</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                قائمة الحالات التي تم استلام استبياناتها من أولياء الأمور
              </p>
            </div>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
              {metrics.submittedCount} استبيان مستلم
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.values(profiles) as StudentNeedsProfile[])
              .filter((p) => p.submissionCount > 0)
              .map((p) => {
                const priority = p.overallPriority;
                return (
                  <div
                    key={p.studentId}
                    className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-base">{p.studentName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {p.grade} — شعبة {p.className}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                            priority === "urgent"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : priority === "high"
                              ? "bg-orange-100 text-orange-800 border border-orange-200"
                              : priority === "medium"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {priority === "urgent" && "🔴 عاجل"}
                          {priority === "high" && "🟠 مرتفع"}
                          {priority === "medium" && "🟡 متوسط"}
                          {priority === "low" && "🟢 منخفض"}
                        </span>
                      </div>

                      {/* Smart Summary snippet */}
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        {p.smartSummary || "لا يوجد ملخص متوفر"}
                      </p>

                      {/* Categories chips */}
                      <div className="flex flex-wrap gap-1">
                        {(p.primaryCategories || []).map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold"
                          >
                            {cat === "academic" && "أكاديمي"}
                            {cat === "social" && "اجتماعي"}
                            {cat === "behavioral" && "سلوكي"}
                            {cat === "health" && "صحي"}
                            {cat === "family" && "أسري"}
                            {cat === "attendance" && "حضور"}
                            {cat === "general" && "عام"}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedCaseProfile(p)}
                      className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>فتح بطاقة الموجه والإجراءات</span>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 4: Alerts & Audit Logs */}
      {activeTab === "alerts" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BadgeAlert className="w-5 h-5 text-teal-600" />
              <span>مركز التنبيهات الذكية للحالات</span>
            </h3>

            <div className="space-y-2">
              {(Object.values(profiles) as StudentNeedsProfile[])
                .filter((p) => p.submissionCount > 0 && (p.overallPriority === "urgent" || p.overallPriority === "high"))
                .map((p) => (
                  <div
                    key={p.studentId}
                    className="p-4 rounded-2xl border bg-rose-50/70 border-rose-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 font-bold">
                        ⚠️
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          حالة {p.overallPriority === "urgent" ? "عاجلة" : "مرتفعة الأولوية"}: {p.studentName}
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          تم رصد مؤشرات تستوجب المراجعة والتواصل مع ولي الأمر
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCaseProfile(p)}
                      className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer"
                    >
                      متابعة
                    </button>
                  </div>
                ))}

              {metrics.submittedCount === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold">لا توجد تنبيهات عاجلة حالياً</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Comprehensive Official Report (التقرير الرسمي الشامل) */}
      {activeTab === "official_report" && (
        <div className="space-y-6">
          {/* Print Styles */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #official-comprehensive-report, #official-comprehensive-report * {
                visibility: visible;
              }
              #official-comprehensive-report {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 15px;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          {/* Administrative Control Bar (Hidden on Print) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4 no-print">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-teal-800 font-bold text-xs">
                  <Printer className="w-4 h-4 text-teal-600" />
                  <span>الإدارة المدرسية والرعاية الطلابية</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  التقرير الرسمي الشامل لحالات واحتياجات الطلاب
                </h2>
                <p className="text-xs text-slate-500">
                  كشف إداري رسمي موحد يجمع كافة الحالات التي ظهرت عليها ملاحظات وكيفية التعامل معها داخل الفصول وإجراءات التوجيه المعتمدة.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                {onOpenSignatoriesModal && (
                  <button
                    type="button"
                    onClick={onOpenSignatoriesModal}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                    title="تخصيص بيانات المدرسة، الشعار، سطر التوجيه الطلابي والمعتمدين"
                    id="btn-report-edit-school-signatories"
                  >
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span>بيانات المدرسة والشعار</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-4.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-teal-400" />
                  <span>طباعة التقرير الرسمي (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    // Export CSV
                    const flagged = students.filter((st) => {
                      const p = profiles[st.id];
                      if (reportOnlyFlagged) {
                        return p && (p.overallPriority === "urgent" || p.overallPriority === "high" || p.overallPriority === "medium" || (p.actions && p.actions.length > 0));
                      }
                      return true;
                    });

                    if (flagged.length === 0) {
                      showToast("لا توجد بيانات مطابقة لتصديرها");
                      return;
                    }

                    const headers = ["م", "اسم الطالب", "السجل المدني", "الصف", "الشعبة", "مستوى الأولوية", "الملاحظة والاحتياج المرصود", "التوجيه الصفي للمعلمين", "الإجراء الإرشادي المتخذ", "حالة المتابعة"];
                    const rows = flagged.map((st, idx) => {
                      const p = profiles[st.id];
                      const name = extractStudentName(st);
                      const idNum = st.nationalId || st.idNumber || st.id || "-";
                      const grade = extractStudentGrade(st);
                      const cls = extractStudentClass(st);
                      const prio = p?.overallPriority === "urgent" ? "عاجلة" : p?.overallPriority === "high" ? "مرتفعة" : p?.overallPriority === "medium" ? "متوسطة" : "مستقرة";
                      const summary = p?.smartSummary || "لا توجد ملاحظات مرصودة";
                      const guidance = (p?.teacherGuidance?.whatStudentNeeds || []).join(" | ") || "توفير الدعم المعنوي والتشجيع داخل الصف";
                      const actions = (p?.actions || []).map((a) => `${a.actionLabel}: ${a.notes}`).join(" | ") || "قيد المتابعة الإرشادية";
                      const status = p?.teacherGuidance?.isApprovedByCounselor ? "معتمد ومشارك مع المعلمين" : "قيد الدراسة والمتابعة";

                      return [
                        idx + 1,
                        `"${name.replace(/"/g, '""')}"`,
                        `"${String(idNum).replace(/"/g, '""')}"`,
                        `"${grade.replace(/"/g, '""')}"`,
                        `"${cls.replace(/"/g, '""')}"`,
                        `"${prio}"`,
                        `"${summary.replace(/"/g, '""')}"`,
                        `"${guidance.replace(/"/g, '""')}"`,
                        `"${actions.replace(/"/g, '""')}"`,
                        `"${status}"`,
                      ].join(",");
                    });

                    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", `التقرير_الرسمي_الشامل_للحالات_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    showToast("✓ تم تصدير التقرير الرسمي الشامل بصيغة CSV");
                  }}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Excel (CSV)</span>
                </button>
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder="البحث باسم الطالب أو رقم الهوية..."
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-600"
                />
              </div>

              {/* Priority Filter */}
              <div>
                <select
                  value={reportPriorityFilter}
                  onChange={(e) => setReportPriorityFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-teal-600"
                >
                  <option value="all">جميع مستويات الأولوية</option>
                  <option value="urgent">🔴 أولوية عاجلة فقط</option>
                  <option value="high">🟠 أولوية مرتفعة فقط</option>
                  <option value="medium">🟡 أولوية متوسطة</option>
                  <option value="low">🟢 أولوية منخفضة / مستقرة</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={reportCategoryFilter}
                  onChange={(e) => setReportCategoryFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-teal-600"
                >
                  <option value="all">كافة مجالات الاحتياج</option>
                  <option value="health">🏥 صحية وطبية</option>
                  <option value="family">👨‍👩‍👦 أسرية واجتماعية</option>
                  <option value="academic">📚 تعليمية وصفية</option>
                </select>
              </div>

              {/* Grade Filter */}
              <div>
                <select
                  value={reportGradeFilter}
                  onChange={(e) => setReportGradeFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-teal-600"
                >
                  <option value="all">جميع الصفوف</option>
                  {grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Flagged-only toggle */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportOnlyFlagged}
                  onChange={(e) => setReportOnlyFlagged(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <span>حصر الحالات التي ظهرت عليها ملاحظات فقط (موصى به عند تقديم تقرير رسمي للإدارة)</span>
              </label>

              <span className="text-xs text-slate-500 font-bold">
                عدد الحالات المستعرضة في التقرير:{" "}
                <span className="text-teal-700 font-mono text-sm">
                  {students.filter((st) => {
                    const p = profiles[st.id];
                    const name = extractStudentName(st);
                    const idNum = st.nationalId || st.idNumber || st.id || "";
                    const grade = extractStudentGrade(st);

                    if (reportSearchQuery.trim()) {
                      const q = reportSearchQuery.trim().toLowerCase();
                      if (!name.toLowerCase().includes(q) && !String(idNum).toLowerCase().includes(q)) return false;
                    }
                    if (reportGradeFilter !== "all" && grade !== reportGradeFilter) return false;
                    if (reportPriorityFilter !== "all" && (p?.overallPriority || "low") !== reportPriorityFilter) return false;
                    if (reportCategoryFilter !== "all") {
                      if (!p?.categories || !(p.categories as any)[reportCategoryFilter]?.detected) return false;
                    }
                    if (reportOnlyFlagged) {
                      return p && (p.overallPriority === "urgent" || p.overallPriority === "high" || p.overallPriority === "medium" || (p.actions && p.actions.length > 0));
                    }
                    return true;
                  }).length}
                </span>{" "}
                طالب
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar (Hidden on Print) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الحالات المرصودة</span>
              <span className="text-2xl font-black text-slate-900">{metrics.activeCasesCount}</span>
            </div>
            <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 block">حالات أولوية عاجلة</span>
              <span className="text-2xl font-black text-rose-800">{metrics.urgentCount}</span>
            </div>
            <div className="p-4 bg-orange-50/70 rounded-2xl border border-orange-200 shadow-xs">
              <span className="text-[11px] font-bold text-orange-700 block">حالات أولوية مرتفعة</span>
              <span className="text-2xl font-black text-orange-800">{metrics.highCount}</span>
            </div>
            <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200 shadow-xs">
              <span className="text-[11px] font-bold text-teal-700 block">توجيهات معتمدة للمعلمين</span>
              <span className="text-2xl font-black text-teal-800">
                {(Object.values(profiles) as StudentNeedsProfile[]).filter((p) => p.teacherGuidance?.isApprovedByCounselor).length}
              </span>
            </div>
          </div>

          {/* Official Printable Report Document Container */}
          <div
            id="official-comprehensive-report"
            className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-300 shadow-lg text-right space-y-6"
          >
            {/* 1. Official Header (ترويسة وزارة التعليم الرسمية) */}
            <div className="border-b-2 border-slate-900 pb-6">
              <div className="flex items-center justify-between gap-4">
                {/* Right: Ministry hierarchy */}
                <div className="text-xs font-bold text-slate-800 space-y-1">
                  <p>{schoolSignatories?.countryName || "المملكة العربية السعودية"}</p>
                  <p>{schoolSignatories?.ministryName || "وزارة التعليم"}</p>
                  <p>{schoolSignatories?.administrationName || "الإدارة العامة للتعليم بمنطقة تبوك"}</p>
                  <p className="font-extrabold text-teal-900">{schoolSignatories?.schoolName || schoolName}</p>
                  {schoolSignatories?.showStudentGuidanceLine !== false && (
                    <p className="text-slate-600 font-bold">التوجيه الطلابي</p>
                  )}
                </div>

                {/* Center: Title & Vision / Logo */}
                <div className="text-center space-y-2">
                  {schoolSignatories?.logoUrl ? (
                    <div className="flex justify-center mb-1">
                      <img
                        src={schoolSignatories.logoUrl}
                        alt="شعار المدرسة"
                        className="object-contain"
                        style={{
                          width: `${schoolSignatories.logoWidth || 76}px`,
                          maxHeight: "86px",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-800 text-white flex items-center justify-center font-black shadow-md">
                      <ShieldCheck className="w-8 h-8 text-teal-200" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-lg sm:text-xl font-black text-slate-900">
                      التقرير الرسمي الشامل لرعاية ودراسة احتياجات الطلاب
                    </h1>
                    <p className="text-xs font-bold text-slate-600">
                      للعام الدراسي 1446 / 1447هـ — الفصل الدراسي الحالي
                    </p>
                  </div>
                </div>

                {/* Left: Metadata and Confidentiality */}
                <div className="text-left text-xs font-mono font-bold text-slate-700 space-y-1" dir="ltr">
                  <div>
                    <span className="font-sans font-bold text-slate-500">التاريخ: </span>
                    {new Date().toLocaleDateString("ar-SA")}
                  </div>
                  <div>
                    <span className="font-sans font-bold text-slate-500">الوقت: </span>
                    {new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-[10px] font-sans font-black">
                    سري للغاية للاستخدام الإداري
                  </div>
                </div>
              </div>

              {/* Introductory Note */}
              <div className="mt-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <strong>البيان الإداري:</strong> يشتمل هذا التقرير الشامل على حصر رسمي دقيق لكافة الطلاب الذين أظهرت نتائج الاستبيان أو المتابعة الميدانية وجود ملاحظات أو احتياجات خاصة لديهم (صحية، أسرية، أو تعليمية)، مع بيان التوجيهات الصفية المعتمدة لمعلمي الفصول، والإجراءات المتخذة من قبل التوجيه الطلابي لتقديم الرعاية الشاملة وضمان استقرار البيئة التعليمية وفق الأنظمة والتعليمات الوزارية.
              </div>
            </div>

            {/* 2. Official Cases Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-extrabold border-b-2 border-slate-300">
                    <th className="p-3 w-10 text-center border-l border-slate-300">م</th>
                    <th className="p-3 w-44 border-l border-slate-300">اسم الطالب / الهوية</th>
                    <th className="p-3 w-28 border-l border-slate-300">الصف والشعبة</th>
                    <th className="p-3 w-32 border-l border-slate-300">تصنيف ومستوى الحالة</th>
                    <th className="p-3 border-l border-slate-300">الملاحظة والاحتياج المرصود</th>
                    <th className="p-3 border-l border-slate-300">كيفية التعامل والتوجيه الميداني للمعلمين</th>
                    <th className="p-3 w-40">الإجراء الإرشادي وحالة المتابعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students
                    .filter((st) => {
                      const p = profiles[st.id];
                      const name = extractStudentName(st);
                      const idNum = st.nationalId || st.idNumber || st.id || "";
                      const grade = extractStudentGrade(st);

                      if (reportSearchQuery.trim()) {
                        const q = reportSearchQuery.trim().toLowerCase();
                        if (!name.toLowerCase().includes(q) && !String(idNum).toLowerCase().includes(q)) return false;
                      }
                      if (reportGradeFilter !== "all" && grade !== reportGradeFilter) return false;
                      if (reportPriorityFilter !== "all" && (p?.overallPriority || "low") !== reportPriorityFilter) return false;
                      if (reportCategoryFilter !== "all") {
                        if (!p?.categories || !(p.categories as any)[reportCategoryFilter]?.detected) return false;
                      }
                      if (reportOnlyFlagged) {
                        return p && (p.overallPriority === "urgent" || p.overallPriority === "high" || p.overallPriority === "medium" || (p.actions && p.actions.length > 0));
                      }
                      return true;
                    })
                    .map((st, idx) => {
                      const p = profiles[st.id];
                      const studentName = extractStudentName(st);
                      const nationalId = st.nationalId || st.idNumber || st.id || "-";
                      const studentGrade = extractStudentGrade(st);
                      const studentClass = extractStudentClass(st);

                      const isUrgent = p?.overallPriority === "urgent";
                      const isHigh = p?.overallPriority === "high";
                      const isMedium = p?.overallPriority === "medium";

                      const categoriesText = [];
                      if (p?.categories?.health?.detected) categoriesText.push("صحية/طبية");
                      if (p?.categories?.family?.detected) categoriesText.push("أسرية/اجتماعية");
                      if (p?.categories?.academic?.detected) categoriesText.push("تعليمية/صفية");

                      const whatNeeds = p?.teacherGuidance?.whatStudentNeeds || [];
                      const whatAvoid = p?.teacherGuidance?.whatToAvoid || [];

                      return (
                        <tr key={st.id || idx} className={isUrgent ? "bg-rose-50/40" : isHigh ? "bg-orange-50/30" : ""}>
                          <td className="p-3 text-center font-bold text-slate-600 border-l border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-extrabold text-slate-900 border-l border-slate-200">
                            <div>{studentName}</div>
                            <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
                              ID: {nationalId}
                            </div>
                          </td>
                          <td className="p-3 font-bold text-slate-700 border-l border-slate-200">
                            {studentGrade} — {studentClass}
                          </td>
                          <td className="p-3 border-l border-slate-200">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-black border ${
                                isUrgent
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : isHigh
                                  ? "bg-orange-100 text-orange-800 border-orange-300"
                                  : isMedium
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                              }`}
                            >
                              {isUrgent ? "أولوية عاجلة" : isHigh ? "أولوية مرتفعة" : isMedium ? "أولوية متوسطة" : "حالة مستقرة"}
                            </span>
                            {categoriesText.length > 0 && (
                              <div className="text-[10px] text-slate-500 mt-1 font-bold">
                                {categoriesText.join(" • ")}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-700 leading-relaxed border-l border-slate-200">
                            {p?.smartSummary ? (
                              <p className="text-[11px] leading-relaxed">{p.smartSummary}</p>
                            ) : (
                              <span className="text-slate-400 italic">بانتظار استكمال استبيان ولي الأمر</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700 border-l border-slate-200">
                            {whatNeeds.length > 0 || whatAvoid.length > 0 ? (
                              <div className="space-y-1 text-[11px]">
                                {whatNeeds.length > 0 && (
                                  <div>
                                    <span className="font-bold text-teal-800 block">ما يحتاجه في الصف:</span>
                                    <ul className="list-disc list-inside text-slate-700 space-y-0.5 pr-1">
                                      {whatNeeds.map((item, i) => (
                                        <li key={i}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {whatAvoid.length > 0 && (
                                  <div className="pt-0.5">
                                    <span className="font-bold text-rose-800 block">ما يجب تجنبه:</span>
                                    <ul className="list-disc list-inside text-slate-700 space-y-0.5 pr-1">
                                      {whatAvoid.map((item, i) => (
                                        <li key={i}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">
                                مراعاة الدعم والتشجيع الإيجابي داخل الصف والرجوع للموجه عند أي مستجد.
                              </span>
                            )}
                          </td>
                          <td className="p-3 space-y-1 text-[11px]">
                            <div className="font-bold text-slate-900">
                              {p?.teacherGuidance?.isApprovedByCounselor ? (
                                <span className="text-emerald-700">✓ تم التوجيه الميداني</span>
                              ) : (
                                <span className="text-amber-700">⏳ قيد المتابعة</span>
                              )}
                            </div>
                            {p?.actions && p.actions.length > 0 ? (
                              <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                {p.actions[p.actions.length - 1].actionLabel}: {p.actions[p.actions.length - 1].notes}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400">لا توجد إجراءات إضافية</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* 3. Official Signatories Approval Block (التوقيعات الرسمية الثلاثية المعتمدة) */}
            <div className="pt-8 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-center text-xs font-bold text-slate-800">
              <div className="space-y-8">
                <p>الموجه الطلابي</p>
                <div className="text-slate-900 font-extrabold text-sm">
                  {schoolSignatories?.counselorName || "الموجه الطلابي"}
                </div>
                <div className="text-[11px] text-slate-400 font-normal">التوقيع: ................................</div>
              </div>

              <div className="space-y-8">
                <p>وكيل الشؤون التعليمية</p>
                <div className="text-slate-900 font-extrabold text-sm">
                  {schoolSignatories?.vicePrincipalName || "وكيل الشؤون التعليمية"}
                </div>
                <div className="text-[11px] text-slate-400 font-normal">التوقيع: ................................</div>
              </div>

              <div className="space-y-8">
                <p>مدير المدرسة (يعتمد)</p>
                <div className="text-slate-900 font-extrabold text-sm">
                  {schoolSignatories?.principalName || "مدير المدرسة"}
                </div>
                <div className="text-[11px] text-slate-400 font-normal">الختم والتوقيع: ................................</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Interactive Batch Sender Modal with Anti-Ban Protection Display (مثل رسائل الغياب تماما) */}
      {batchProgress.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-right space-y-5 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                    batchProgress.isCompleted
                      ? "bg-emerald-100 text-emerald-700"
                      : batchProgress.isRunning
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {batchProgress.isRunning ? (
                    <Loader2 className="w-5 h-5 animate-spin text-amber-700" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {batchProgress.isCompleted
                      ? "اكتمل إرسال روابط الاستبيان بنجاح ✓"
                      : batchProgress.isRunning
                      ? "جارِ إرسال روابط الاستبيان لأولياء الأمور بأمان..."
                      : "تم إيقاف عملية الإرسال"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {batchProgress.isRunning
                      ? `جاري معالجة الطالب (${batchProgress.currentStudentName})...`
                      : batchProgress.isCompleted
                      ? `تم إرسال روابط الاستبيان لكافة الطلاب المحددين بنجاح وتحديث حالتهم.`
                      : `تمت معالجة (${batchProgress.currentIndex}) من أصل (${batchProgress.total}) طالب.`}
                  </p>
                </div>
              </div>

              {!batchProgress.isRunning && (
                <button
                  onClick={() => setBatchProgress((prev) => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Anti-Ban Safety Protection Status Banner */}
            <div className="bg-emerald-950 text-white rounded-2xl p-3 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-emerald-300 block">
                    درع الحماية الذكي من حظر الواتساب نشط
                  </span>
                  <span className="text-[10px] text-emerald-100/80">
                    فاصل أمان (15 ثانية) مع تفاوت زمني بشري عشوائي لمنع كشف الرسائل المتتابعة.
                  </span>
                </div>
              </div>

              {batchProgress.isRunning && (batchProgress.countdownSeconds ?? 0) > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-1.5 font-mono text-xs font-black shrink-0 animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  <span>انتظار: {batchProgress.countdownSeconds}ث</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>
                  التقدم الإجمالي ({batchProgress.currentIndex} من {batchProgress.total})
                </span>
                <span>
                  {batchProgress.total > 0
                    ? Math.round((batchProgress.currentIndex / batchProgress.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${
                      batchProgress.total > 0
                        ? (batchProgress.currentIndex / batchProgress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Live Counters */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-bold">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">تم الإرسال بنجاح</span>
                <span className="text-lg font-extrabold">{batchProgress.sentCount}</span>
              </div>
              <div className="p-3 bg-red-50 text-red-800 rounded-2xl border border-red-200">
                <span className="text-[10px] text-red-600 block">تعذر الإرسال</span>
                <span className="text-lg font-extrabold">{batchProgress.failedCount}</span>
              </div>
              <div className="p-3 bg-slate-50 text-slate-800 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block">المتبقي</span>
                <span className="text-lg font-extrabold">
                  {Math.max(0, batchProgress.total - batchProgress.currentIndex)}
                </span>
              </div>
            </div>

            {/* Live Logs Feed */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-600 block">سجل الإرسال المباشر:</span>
              <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                {batchProgress.logs.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 font-medium">
                    جاري بدء عملية الإرسال الآمنة...
                  </p>
                ) : (
                  batchProgress.logs.map((lg) => (
                    <div
                      key={lg.id}
                      className={`p-2 rounded-xl flex items-center justify-between text-right border ${
                        lg.status === "success"
                          ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                          : "bg-red-50/80 border-red-200 text-red-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {lg.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-bold">{lg.studentName}</span>
                        <span className="text-[10px] font-mono text-slate-500" dir="ltr">
                          {lg.phone}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium">{lg.error || lg.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {batchProgress.isRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    abortBatchRef.current = true;
                    setBatchProgress((prev) => ({ ...prev, isRunning: false }));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center gap-2"
                >
                  <PauseCircle className="w-4 h-4" />
                  <span>إيقاف الإرسال الآن</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setBatchProgress((prev) => ({ ...prev, isOpen: false }))}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>إغلاق والعودة لقائمة الطلاب (جاهز)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: DETAILED SMART CASE CARD (بطاقة الحالة الذكية للموجه الطلابي) --- */}
      {selectedCaseProfile && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto animate-fadeIn">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900">
                      {selectedCaseProfile.studentName}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                        selectedCaseProfile.overallPriority === "urgent"
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : selectedCaseProfile.overallPriority === "high"
                          ? "bg-orange-100 text-orange-800 border border-orange-200"
                          : selectedCaseProfile.overallPriority === "medium"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {selectedCaseProfile.overallPriority === "urgent" && "🔴 أولوية عاجلة"}
                      {selectedCaseProfile.overallPriority === "high" && "🟠 أولوية مرتفعة"}
                      {selectedCaseProfile.overallPriority === "medium" && "🟡 أولوية متوسطة"}
                      {selectedCaseProfile.overallPriority === "low" && "🟢 أولوية منخفضة"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedCaseProfile.grade} — شعبة {selectedCaseProfile.className} | جوال ولي الأمر:{" "}
                    <span dir="ltr" className="font-mono font-bold text-slate-700">
                      {selectedCaseProfile.guardianPhone || "غير مسجل"}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCaseProfile(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 1. نظام "لماذا ظهر هذا المؤشر؟" (Explainable AI) */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-amber-700" />
                <span>لماذا ظهر هذا المؤشر؟ (أسباب تصنيف الحالة)</span>
              </div>
              {selectedCaseProfile.indicatorExplanations?.length > 0 ? (
                <div className="space-y-2 pt-1 text-xs text-amber-900/90">
                  {selectedCaseProfile.indicatorExplanations.map((exp, idx) => (
                    <div key={idx} className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                      <strong className="block text-amber-950 font-bold mb-1">{exp.categoryLabel}:</strong>
                      <ul className="list-disc list-inside space-y-0.5">
                        {exp.reasons.map((r, rIdx) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-800">
                  تم التصنيف بناءً على استقرار الإجابات العامة لولي الأمر وعدم وجود صعوبات ملحوظة.
                </p>
              )}
            </div>

            {/* 2. الملخص الذكي */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>الملخص الذكي للحالة:</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {selectedCaseProfile.smartSummary}
              </p>
            </div>

            {/* 3. التوصية الذكية للموجه الطلابي */}
            <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 sm:p-5 space-y-2">
              <div className="text-xs font-bold text-teal-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
                <span>التوصيات المقترحة للموجه الطلابي:</span>
              </div>
              <ul className="list-disc list-inside text-xs sm:text-sm text-teal-950 space-y-1">
                {(selectedCaseProfile.smartRecommendations || []).map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* 4. بطاقة توجيه المعلم (Teacher Guidance Card) خالية من البيانات الحساسة */}
            <div className="bg-linear-to-b from-indigo-50/80 to-white border-2 border-indigo-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                  <BookOpen className="w-4 h-4 text-indigo-700" />
                  <span>بطاقة توجيه المعلمين (مخصصة ومحمية الخصوصية)</span>
                </div>
                {selectedCaseProfile.teacherGuidance?.isApprovedByCounselor ? (
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold">
                    ✓ معتمدة للمشاركة
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold">
                    بانتظار اعتماد الموجه
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-500">
                🔒 تطبق هذه البطاقة قاعدة الحد الأدنى من المعلومات: لا تظهر للمعلم أي تشخيصات أو أسرار خاصة، بل توجيهات تربوية عملية فقط.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                  <span className="font-bold text-indigo-900 block">ما يحتاجه الطالب:</span>
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {(selectedCaseProfile.teacherGuidance?.whatStudentNeeds || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                  <span className="font-bold text-rose-900 block">ما يجب تجنبه:</span>
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {(selectedCaseProfile.teacherGuidance?.whatToAvoid || []).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Approve / Edit Guidance button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleApproveTeacherGuidance}
                  className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>اعتماد ومشاركة التوجيهات مع معلمي الشعبة</span>
                </button>
              </div>
            </div>

            {/* 5. مركز الإجراءات والمتابعة */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>مركز إجراءات ومتابعة التوجيه الطلابي</span>
              </h4>

              {/* Add Action Row */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value)}
                    className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="review_survey">مراجعة الاستبيان</option>
                    <option value="contact_guardian">تواصل مع ولي الأمر</option>
                    <option value="interview_student">مقابلة الطالب</option>
                    <option value="teacher_guidance_issued">توجيه للمعلمين</option>
                    <option value="schedule_followup">جدولة موعد متابعة</option>
                    <option value="case_stabilized">تسجيل استقرار الحالة</option>
                    <option value="case_closed">إغلاق الحالة</option>
                  </select>

                  <input
                    type="text"
                    value={newActionNotes}
                    onChange={(e) => setNewActionNotes(e.target.value)}
                    placeholder="ملاحظات الإجراء المتخذ..."
                    className="sm:col-span-2 p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:border-teal-600 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={savingAction || !newActionNotes.trim()}
                    onClick={handleAddCaseAction}
                    className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {savingAction ? "جاري الحفظ..." : "+ توثيق الإجراء في السجل"}
                  </button>
                </div>
              </div>

              {/* Actions History */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {(selectedCaseProfile.actions || []).map((act) => (
                  <div
                    key={act.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{act.actionLabel}</span>
                      <span className="text-slate-500 mr-2">— {act.notes}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(act.actionDate).toLocaleDateString("ar-SA")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
