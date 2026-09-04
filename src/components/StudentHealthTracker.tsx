import React, { useState, useMemo, useRef } from "react";
import {
  HeartPulse,
  Search,
  Filter,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Printer,
  Sparkles,
  ChevronDown,
  FileText,
  Phone,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Activity,
  Brain,
  AlertTriangle,
  RefreshCw,
  Plus,
  Eye,
  Check,
  Lock,
  Layers,
  PauseCircle,
  PlayCircle,
  XCircle,
  X,
  Loader2,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  CheckSquare,
  Square,
  Info,
} from "lucide-react";
import { Student } from "../types";
import {
  StudentSupportProfile,
  SupportCase,
  HealthAuditLog,
  IndicatorLevel,
} from "../types/studentSupport";
import {
  calculateStudentIndicators,
  calculateOverallPriority,
  getIndicatorColor,
  getIndicatorLabel,
} from "../utils/studentSupportRulesEngine";
import StudentSupportDetailModal from "./StudentSupportDetailModal";
import TeacherSupportCardModal from "./TeacherSupportCardModal";

export interface BatchLogItem {
  id: string;
  studentName: string;
  phone: string;
  grade?: string;
  className?: string;
  status: "success" | "failed";
  timestamp: string;
  message?: string;
  error?: string;
}

export interface BatchProgressState {
  isOpen: boolean;
  isRunning: boolean;
  isPaused: boolean;
  currentIndex: number;
  total: number;
  sentCount: number;
  failedCount: number;
  currentStudentName: string;
  currentStudentPhone: string;
  countdownSeconds: number;
  currentJitter: number;
  isCompleted: boolean;
  logs: BatchLogItem[];
}

interface StudentHealthTrackerProps {
  students: Student[];
  supportProfiles: Record<string, StudentSupportProfile>;
  onSaveProfile: (profile: StudentSupportProfile) => Promise<boolean>;
  cases: SupportCase[];
  onSaveCase: (supportCase: SupportCase) => Promise<boolean>;
  auditLogs: HealthAuditLog[];
  onLogAudit: (action: "view" | "edit" | "print", dataType: string, reason: string) => void;
  onSendWhatsAppDirect?: (
    phone: string, 
    message: string, 
    studentName?: string, 
    grade?: string, 
    className?: string
  ) => Promise<{ success: boolean; error?: string }>;
  schoolName?: string;
  isWhatsAppConnected?: boolean;
  onNavigateToWhatsApp?: () => void;
}

export default function StudentHealthTracker({
  students,
  supportProfiles,
  onSaveProfile,
  cases,
  onSaveCase,
  auditLogs,
  onLogAudit,
  onSendWhatsAppDirect,
  schoolName = "ثانوية الأبناء الأولى",
  isWhatsAppConnected = false,
  onNavigateToWhatsApp,
}: StudentHealthTrackerProps) {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "completed" | "in_progress" | "not_started">("all");
  const [selectedPriority, setSelectedPriority] = useState<"all" | "urgent" | "high" | "medium" | "low">("all");
  const [selectedIndicatorFilter, setSelectedIndicatorFilter] = useState<"all" | "health_attn" | "wellbeing_attn" | "urgent_flags">("all");

  // Selection for bulk WhatsApp
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // WhatsApp Anti-Ban Rate Limiting & Human Jitter (تفاوت عشوائي لمنع الحظر)
  const [delayPreset, setDelayPreset] = useState<"safe" | "balanced" | "custom">("safe");
  const [baseDelaySecs, setBaseDelaySecs] = useState<number>(15); // 15 seconds safe anti-ban delay
  const [enableJitter, setEnableJitter] = useState<boolean>(true); // Human-like dynamic jitter
  const [jitterRangeSecs, setJitterRangeSecs] = useState<number>(3); // ±3s variation (12s to 18s)
  const [showDelaySettings, setShowDelaySettings] = useState<boolean>(false);

  // Interactive Live Batch Progress State
  const [batchProgress, setBatchProgress] = useState<BatchProgressState>({
    isOpen: false,
    isRunning: false,
    isPaused: false,
    currentIndex: 0,
    total: 0,
    sentCount: 0,
    failedCount: 0,
    currentStudentName: "",
    currentStudentPhone: "",
    countdownSeconds: 0,
    currentJitter: 0,
    isCompleted: false,
    logs: [],
  });

  // Batch Control Refs
  const abortBatchRef = useRef<boolean>(false);
  const pauseBatchRef = useRef<boolean>(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: "success" | "error" | "info" } | null>(null);

  // Modals state
  const [activeDetailProfile, setActiveDetailProfile] = useState<StudentSupportProfile | null>(null);
  const [activeTeacherCardProfile, setActiveTeacherCardProfile] = useState<StudentSupportProfile | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null);

  // Available Grades & Classes from students list
  const grades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.grade) set.add(s.grade);
    });
    return Array.from(set).sort();
  }, [students]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set).sort();
  }, [students]);

  // Merge Students with their Support Profile (or synthesize a default empty profile)
  const mergedStudentProfiles = useMemo(() => {
    return students.map((student) => {
      const existing = supportProfiles[student.id];
      if (existing) return existing;

      // Deterministic or clean token based on student ID
      const token = `ht_${student.id}`;

      // Synthesize clean unstarted profile
      const emptyIndicators = calculateStudentIndicators({});
      const synthesized: StudentSupportProfile = {
        studentId: student.id,
        studentName: student.name || "طالب غير مسمى",
        nationalId: (student as any).nationalId || student.id,
        grade: student.grade || "المرحلة الثانوية",
        className: student.className || "1",
        guardianName: (student as any).guardianName || (student as any).fatherName || "ولي الأمر",
        guardianPhone: student.phone || "",
        activationToken: token,
        isActivated: false,
        completionPercentage: 0,
        status: "not_started",
        basicInfoConfirmed: false,
        hasChronicCondition: "unknown",
        conditionTypes: [],
        schoolImpacts: [],
        takesRegularMedication: "unknown",
        hasAllergies: "unknown",
        emotionalObservations: {
          isolation: "unknown",
          anxiety: "unknown",
          irritability: "unknown",
          sleepDisturbance: "unknown",
          appetiteChange: "unknown",
          concentrationDifficulty: "unknown",
          lowMotivation: "unknown",
          lossOfInterest: "unknown",
          fatigueComplaints: "unknown",
        },
        behaviorDifficulties: {
          followingInstructions: "unknown",
          emotionalRegulation: "unknown",
          peerInteraction: "unknown",
          waitingTurn: "unknown",
          focus: "unknown",
          completingTasks: "unknown",
          activityTransitions: "unknown",
          expressingNeeds: "unknown",
          handlingCriticism: "unknown",
          handlingChange: "unknown",
        },
        learningDifficulties: [],
        helpfulLearningStrategies: [],
        hasFamilyCircumstances: "unknown",
        hasConfidentialNote: "no",
        peerRelationshipQuality: "unknown",
        negativeExperiences: [],
        supportPreferences: [],
        privacyConsentAccepted: false,
        source: "guardian",
        timeline: [],
        indicators: emptyIndicators,
        overallPriority: "low",
      };
      return synthesized;
    });
  }, [students, supportProfiles]);

  // Filtered List
  const filteredProfiles = useMemo(() => {
    return mergedStudentProfiles.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.studentName.toLowerCase().includes(query);
        const matchesPhone = (p.guardianPhone || p.activatedPhone || "").includes(query);
        const matchesId = (p.nationalId || p.studentId).toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesId) return false;
      }

      // Grade
      if (selectedGrade !== "all" && p.grade !== selectedGrade) return false;

      // Class
      if (selectedClass !== "all" && p.className !== selectedClass) return false;

      // Status
      if (selectedStatus !== "all") {
        if (selectedStatus === "completed" && p.status !== "completed") return false;
        if (selectedStatus === "in_progress" && p.status !== "in_progress") return false;
        if (selectedStatus === "not_started" && p.status !== "not_started") return false;
      }

      // Priority
      if (selectedPriority !== "all" && p.overallPriority !== selectedPriority) return false;

      // Indicator filter
      if (selectedIndicatorFilter === "urgent_flags") {
        if (p.overallPriority !== "urgent") return false;
      } else if (selectedIndicatorFilter === "health_attn") {
        if (p.indicators.health.level === "none") return false;
      } else if (selectedIndicatorFilter === "wellbeing_attn") {
        if (p.indicators.wellbeing.level === "none") return false;
      }

      return true;
    });
  }, [
    mergedStudentProfiles,
    searchQuery,
    selectedGrade,
    selectedClass,
    selectedStatus,
    selectedPriority,
    selectedIndicatorFilter,
  ]);

  // Overall Metrics
  const metrics = useMemo(() => {
    const total = mergedStudentProfiles.length;
    const completed = mergedStudentProfiles.filter((p) => p.status === "completed").length;
    const inProgress = mergedStudentProfiles.filter((p) => p.status === "in_progress").length;
    const urgent = mergedStudentProfiles.filter((p) => p.overallPriority === "urgent").length;
    const healthAttention = mergedStudentProfiles.filter((p) => p.indicators.health.level !== "none").length;
    const wellbeingAttention = mergedStudentProfiles.filter((p) => p.indicators.wellbeing.level !== "none").length;
    const sentInviteCount = mergedStudentProfiles.filter(
      (p) => p.lastInviteSentAt || p.inviteWhatsAppStatus === "success"
    ).length;
    const unsentInviteCount = total - sentInviteCount;

    return {
      total,
      completed,
      inProgress,
      urgent,
      healthAttention,
      wellbeingAttention,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      sentInviteCount,
      unsentInviteCount,
    };
  }, [mergedStudentProfiles]);

  const unsentFilteredCount = useMemo(() => {
    return filteredProfiles.filter(
      (p) => !p.lastInviteSentAt || p.inviteWhatsAppStatus !== "success"
    ).length;
  }, [filteredProfiles]);

  // Build Approved WhatsApp Message
  const getWhatsAppMessage = (p: StudentSupportProfile) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const formUrl = `${origin}/?health_token=${p.activationToken}`;
    return `عزيزي ولي أمر الطالب : حرصا على تقديم أفضل دعم ومتابعة لابنكم نأمل منكم تعبئة الاستمارة من خلال الرابط التالي :\n${formUrl}\nعلما ان الاستمارة متاحة للتحديث واضافة ما يطرأ متى ما أردت ${schoolName} - التوجيه الطلابي`;
  };

  // Copy Link Handler
  const handleCopyLink = (p: StudentSupportProfile) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const formUrl = `${origin}/?health_token=${p.activationToken}`;
    navigator.clipboard.writeText(formUrl);
    setCopiedId(p.studentId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Send WhatsApp to Single Student (Direct & Immediate)
  const handleSendSingleWhatsApp = async (p: StudentSupportProfile) => {
    const phone = p.activatedPhone || p.guardianPhone;
    if (!phone) {
      alert(`لا يوجد رقم جوال مسجل لولي أمر الطالب (${p.studentName})`);
      return;
    }

    const message = getWhatsAppMessage(p);
    setSendingSingleId(p.studentId);

    try {
      if (onSendWhatsAppDirect) {
        const result = await onSendWhatsAppDirect(phone, message, p.studentName, p.grade, p.className);
        if (result.success) {
          const nowIso = new Date().toISOString();
          const updated: StudentSupportProfile = {
            ...p,
            lastInviteSentAt: nowIso,
            inviteWhatsAppStatus: "success",
          };
          await onSaveProfile(updated);
          onLogAudit("edit", "full_profile", `إرسال رابط استمارة الدعم عبر واتساب لولي أمر الطالب: ${p.studentName}`);

          setToastMessage(`✓ تم إرسال رابط استمارة الدعم لولي أمر الطالب (${p.studentName}) بنجاح`);
          setTimeout(() => setToastMessage(null), 4000);
        } else {
          const errorMsg = result.error || "تعذر إرسال الرسالة عبر خادم الواتساب";
          const updated: StudentSupportProfile = {
            ...p,
            inviteWhatsAppStatus: "failed",
          };
          await onSaveProfile(updated);

          const shouldOpenWeb = confirm(
            `❌ تعذر إرسال الرسالة لولي أمر (${p.studentName}):\n${errorMsg}\n\nهل ترغب في فتح محادثة الواتساب يدوياً الآن للإرسال المباشر؟`
          );
          if (shouldOpenWeb) {
            const clean = phone.replace(/[^0-9]/g, "");
            const formatted = clean.startsWith("05") ? `966${clean.substring(1)}` : clean;
            window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, "_blank");
          }
        }
      } else {
        const clean = phone.replace(/[^0-9]/g, "");
        const formatted = clean.startsWith("05") ? `966${clean.substring(1)}` : clean;
        window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, "_blank");
      }
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء إرسال رسالة الواتساب");
    } finally {
      setSendingSingleId(null);
    }
  };

  // Launch Interactive Batch WhatsApp Sender with Anti-Ban Delay & Human-Like Jitter
  const handleStartBatchWhatsApp = async (customCandidates?: StudentSupportProfile[]) => {
    let batchCandidates: StudentSupportProfile[] = [];

    if (customCandidates && customCandidates.length > 0) {
      batchCandidates = customCandidates;
    } else if (selectedStudentIds.length > 0) {
      batchCandidates = mergedStudentProfiles.filter((p) => selectedStudentIds.includes(p.studentId));
    } else {
      batchCandidates = filteredProfiles;
    }

    if (batchCandidates.length === 0) {
      alert("لا يوجد طلاب محددين لإرسال روابط الاستمارات إليهم. يرجى تحديد طالب واحد على الأقل.");
      return;
    }

    // Single student direct dispatch without waiting interval
    if (batchCandidates.length === 1) {
      await handleSendSingleWhatsApp(batchCandidates[0]);
      return;
    }

    // Check WhatsApp Connection
    if (!isWhatsAppConnected) {
      const proceed = confirm(
        "⚠️ تنبيه درع الحماية:\nجهاز الواتساب يبدو غير متصل حالياً في النظام.\nهل ترغب في الانتقال أولاً لصفحة 'ربط الواتساب' لربط الجوال وضمان وصول الرسائل؟\n(اضغط 'موافق' للانتقال إلى الربط، أو 'إلغاء' للمحاولة على أي حال)"
      );
      if (proceed && onNavigateToWhatsApp) {
        onNavigateToWhatsApp();
        return;
      }
    }

    abortBatchRef.current = false;
    pauseBatchRef.current = false;

    setBatchProgress({
      isOpen: true,
      isRunning: true,
      isPaused: false,
      currentIndex: 0,
      total: batchCandidates.length,
      sentCount: 0,
      failedCount: 0,
      currentStudentName: "",
      currentStudentPhone: "",
      countdownSeconds: 0,
      currentJitter: 0,
      isCompleted: false,
      logs: [],
    });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < batchCandidates.length; i++) {
      if (abortBatchRef.current) {
        break;
      }

      // Handle Pause state
      while (pauseBatchRef.current && !abortBatchRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      if (abortBatchRef.current) break;

      const profile = batchCandidates[i];
      const studentName = profile.studentName || "طالب";
      const studentPhone = profile.activatedPhone || profile.guardianPhone || "";

      setBatchProgress((prev) => ({
        ...prev,
        currentIndex: i + 1,
        currentStudentName: studentName,
        currentStudentPhone: studentPhone,
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
              grade: profile.grade,
              className: profile.className,
              status: "failed",
              timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              error: "لا يوجد رقم جوال مسجل لولي الأمر في الكشف",
            },
            ...prev.logs,
          ],
        }));
        continue;
      }

      const message = getWhatsAppMessage(profile);

      try {
        if (!onSendWhatsAppDirect) {
          throw new Error("دالة الإرسال المباشر غير متوفرة في النظام");
        }

        const res = await onSendWhatsAppDirect(
          studentPhone, 
          message, 
          studentName, 
          profile.grade, 
          profile.className
        );

        if (res.success) {
          sent++;
          const nowIso = new Date().toISOString();
          const updatedProfile: StudentSupportProfile = {
            ...profile,
            lastInviteSentAt: nowIso,
            inviteWhatsAppStatus: "success",
          };
          await onSaveProfile(updatedProfile);

          // Automatically unselect successfully sent student
          setSelectedStudentIds((prev) => prev.filter((id) => id !== profile.studentId));

          setBatchProgress((prev) => ({
            ...prev,
            sentCount: sent,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName,
                phone: studentPhone,
                grade: profile.grade,
                className: profile.className,
                status: "success",
                timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                message: "تم إرسال رابط الاستمارة بنجاح",
              },
              ...prev.logs,
            ],
          }));
        } else {
          failed++;
          const updatedProfile: StudentSupportProfile = {
            ...profile,
            inviteWhatsAppStatus: "failed",
          };
          await onSaveProfile(updatedProfile);

          setBatchProgress((prev) => ({
            ...prev,
            failedCount: failed,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName,
                phone: studentPhone,
                grade: profile.grade,
                className: profile.className,
                status: "failed",
                timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                error: res.error || "فشل التسليم عبر خادم الواتساب",
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
              grade: profile.grade,
              className: profile.className,
              status: "failed",
              timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              error: err.message || "خطأ في الاتصال بالشبكة",
            },
            ...prev.logs,
          ],
        }));
      }

      // Safe Anti-Ban Delay with Dynamic Human-Like Jitter (التفاوت الزمني العشوائي)
      // Applied between messages (except after the last one)
      if (i < batchCandidates.length - 1 && !abortBatchRef.current) {
        const jitter = enableJitter
          ? Math.floor(Math.random() * (jitterRangeSecs * 2 + 1)) - jitterRangeSecs
          : 0;
        const totalDelaySecs = Math.max(3, baseDelaySecs + jitter);

        setBatchProgress((prev) => ({
          ...prev,
          currentJitter: jitter,
        }));

        for (let countdown = totalDelaySecs; countdown > 0; countdown--) {
          if (abortBatchRef.current) break;

          // Check if paused during countdown
          while (pauseBatchRef.current && !abortBatchRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
          if (abortBatchRef.current) break;

          setBatchProgress((prev) => ({
            ...prev,
            countdownSeconds: countdown,
          }));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Completion Handling
    if (!abortBatchRef.current) {
      setBatchProgress((prev) => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        isCompleted: true,
        countdownSeconds: 0,
      }));

      onLogAudit(
        "edit",
        "full_profile",
        `إرسال جماعي لروابط الاستمارة الصحية لـ ${sent} طالب بفاصل زمني (${baseDelaySecs}ث) وتفاوت بشري (${enableJitter ? `±${jitterRangeSecs}ث` : "معطل"})`
      );

      setToastMessage({
        text: `✓ اكتمل إرسال روابط الاستمارات لـ (${sent}) من أولياء الأمور بنجاح`,
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 5000);
    } else {
      setBatchProgress((prev) => ({
        ...prev,
        isRunning: false,
        countdownSeconds: 0,
      }));
      setToastMessage({
        text: "تم إيقاف عملية الإرسال الجماعي بناءً على طلب المستخدم.",
        type: "info",
      });
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Selection Helpers
  const handleSelectAllFiltered = () => {
    setSelectedStudentIds(filteredProfiles.map((p) => p.studentId));
  };

  const handleSelectUnsentFiltered = () => {
    const unsent = filteredProfiles
      .filter((p) => !p.lastInviteSentAt || p.inviteWhatsAppStatus !== "success")
      .map((p) => p.studentId);
    setSelectedStudentIds(unsent);
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds([]);
  };

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredProfiles.length && filteredProfiles.length > 0) {
      handleDeselectAll();
    } else {
      handleSelectAllFiltered();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* SECTION HEADER */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold border border-teal-100 mb-2">
              <HeartPulse className="w-4 h-4 text-teal-600" />
              <span>نظام دعم الطالب والرعاية الصحية الشاملة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">المتابعة الصحية للطالب</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-2xl leading-relaxed">
              إدارة الاستمارات الذكية لأولياء الأمور، تحليل المؤشرات الوقائية المستقلة، إعداد بطاقات الدعم الصفية للمعلمين، ومتابعة الحالات برعاية التوجيه الطلابي والإرشاد الصحي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* WhatsApp Connection Status Badge */}
            {isWhatsAppConnected ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>الواتساب متصل</span>
              </div>
            ) : (
              <button
                onClick={onNavigateToWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="اضغط للانتقال إلى شاشة ربط الواتساب"
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>الواتساب غير متصل (اضغط للربط)</span>
              </button>
            )}

            {/* Anti-Ban Delay & Jitter Settings Toggle Button */}
            <button
              onClick={() => setShowDelaySettings(!showDelaySettings)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                showDelaySettings
                  ? "bg-teal-700 text-white border-teal-700 shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
              }`}
              title="تخصيص الفاصل الزمني والتفاوت العشوائي لمنع الحظر"
            >
              <ShieldAlert className="w-4 h-4 text-teal-600" />
              <span>درع الحظر: {baseDelaySecs}ث {enableJitter ? `(±${jitterRangeSecs}ث)` : ""}</span>
              <SlidersHorizontal className="w-3.5 h-3.5 opacity-70" />
            </button>

            <button
              onClick={() => {
                const completedOnes = filteredProfiles.filter(p => p.status === "completed");
                if (completedOnes.length > 0) {
                  setActiveTeacherCardProfile(completedOnes[0]);
                } else if (filteredProfiles.length > 0) {
                  setActiveTeacherCardProfile(filteredProfiles[0]);
                } else {
                  alert("لا توجد بيانات طلاب لعرض بطاقة المعلم");
                }
              }}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-teal-700" />
              <span>معاينة بطاقة المعلم</span>
            </button>

            {selectedStudentIds.length > 0 && (
              <button
                onClick={() => handleStartBatchWhatsApp()}
                className="py-2.5 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال الرابط للمحددين ({selectedStudentIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* EXPANDABLE ANTI-BAN SETTINGS PANEL */}
        {showDelaySettings && (
          <div className="mt-5 p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-3.5 animate-fadeIn text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-100 pb-2.5">
              <div className="flex items-center gap-2 text-teal-950 font-bold">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>إعدادات درع الحظر (الفاصل الزمني والتفاوت البشري العشوائي)</span>
              </div>
              <span className="text-[11px] text-teal-800">
                يحاكي نمط الإرسال البشري لتفادي الحظر الآلي في خوادم واتساب
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Presets */}
              <div className="space-y-1.5">
                <span className="text-slate-600 font-bold block">معدل الفاصل الزمني:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setDelayPreset("safe");
                      setBaseDelaySecs(15);
                      setJitterRangeSecs(3);
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold border transition-all cursor-pointer text-center ${
                      delayPreset === "safe"
                        ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    🛡️ آمن (15ث)
                  </button>
                  <button
                    onClick={() => {
                      setDelayPreset("balanced");
                      setBaseDelaySecs(8);
                      setJitterRangeSecs(2);
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold border transition-all cursor-pointer text-center ${
                      delayPreset === "balanced"
                        ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    ⚡ متوازن (8ث)
                  </button>
                  <button
                    onClick={() => setDelayPreset("custom")}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold border transition-all cursor-pointer text-center ${
                      delayPreset === "custom"
                        ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    ⚙️ مخصص
                  </button>
                </div>
              </div>

              {/* Custom Delay Input if chosen */}
              <div className="space-y-1.5">
                <span className="text-slate-600 font-bold block">الفاصل الأساسي (بالثواني):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={4}
                    max={60}
                    value={baseDelaySecs}
                    onChange={(e) => {
                      setBaseDelaySecs(Math.max(4, parseInt(e.target.value) || 15));
                      setDelayPreset("custom");
                    }}
                    className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-slate-900"
                  />
                  <span className="text-slate-500 text-[11px]">ثوانٍ بين كل رسالة وأخرى</span>
                </div>
              </div>

              {/* Dynamic Jitter Toggle */}
              <div className="space-y-1.5">
                <span className="text-slate-600 font-bold block">التفاوت الزمني العشوائي (Jitter):</span>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={enableJitter}
                    onChange={(e) => setEnableJitter(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <span className="text-slate-800 font-medium">
                    تفعيل التفاوت البشري (±{jitterRangeSecs}ث عشوائياً)
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 text-xs block">إجمالي الطلاب</span>
            <strong className="text-xl font-black text-slate-900">{metrics.total}</strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
            <span className="text-emerald-700 text-xs block">ملفات مكتملة</span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-black text-emerald-950">{metrics.completed}</strong>
              <span className="text-[11px] text-emerald-700 font-bold">({metrics.completionRate}%)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100">
            <span className="text-amber-700 text-xs block">قيد الاستكمال</span>
            <strong className="text-xl font-black text-amber-950">{metrics.inProgress}</strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100">
            <span className="text-rose-700 text-xs block">حالات طوارئ / عاجلة</span>
            <strong className="text-xl font-black text-rose-950">{metrics.urgent}</strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-100">
            <span className="text-teal-700 text-xs block">روابط مرسلة للواتساب</span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-black text-teal-950">{metrics.sentInviteCount}</strong>
              <span className="text-[11px] text-teal-700">من {metrics.total}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100">
            <span className="text-indigo-700 text-xs block">ملاحظات نفسية/صحية</span>
            <strong className="text-xl font-black text-indigo-950">
              {metrics.healthAttention + metrics.wellbeingAttention}
            </strong>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <input
              type="text"
              placeholder="البحث باسم الطالب أو رقم الهوية أو جوال ولي الأمر..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden"
            >
              <option value="all">جميع الصفوف الدراسية</option>
              {grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden"
            >
              <option value="all">جميع الفصول / الشعب</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden"
            >
              <option value="all">جميع حالات الملف</option>
              <option value="completed">مكتمل</option>
              <option value="in_progress">قيد الاستكمال</option>
              <option value="not_started">لم يبدأ بعد</option>
            </select>
          </div>
        </div>

        {/* Quick Indicator Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold ml-1">تصفية سريعة:</span>
          {[
            { id: "all", label: "الكل" },
            { id: "urgent_flags", label: "الحالات العاجلة / الطوارئ 🚨" },
            { id: "health_attn", label: "ملاحظات صحية 🩺" },
            { id: "wellbeing_attn", label: "ملاحظات نفسية وانفعالية 🧠" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedIndicatorFilter(tab.id as any)}
              className={`py-1.5 px-3 rounded-lg font-medium transition-all cursor-pointer ${
                selectedIndicatorFilter === tab.id
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <div className="mr-auto text-xs text-slate-400">
            عرض {filteredProfiles.length} من أصل {mergedStudentProfiles.length} طالب
          </div>
        </div>
      </div>

      {/* BULK SELECTION & ANTI-BAN CONTROLS BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-bold">
            <Users className="w-4 h-4 text-slate-500" />
            <span>المحدد: {selectedStudentIds.length} من {filteredProfiles.length} طالب</span>
          </div>

          <button
            onClick={handleSelectAllFiltered}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
            <span>تحديد كل القائمة ({filteredProfiles.length})</span>
          </button>

          <button
            onClick={handleSelectUnsentFiltered}
            className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="تحديد الطلاب الذين لم يُرسل لهم الرابط بعد"
          >
            <Send className="w-3.5 h-3.5 text-teal-600" />
            <span>تحديد غير المرسل لهم ({unsentFilteredCount})</span>
          </button>

          {selectedStudentIds.length > 0 && (
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>إلغاء التحديد</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mr-auto">
          {/* Active Anti-Ban badge summary */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-xs">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>الفاصل: <strong>{baseDelaySecs}ث</strong></span>
            {enableJitter && (
              <span className="text-[11px] text-teal-700 font-mono font-bold">(±{jitterRangeSecs}ث تفاوت)</span>
            )}
          </div>

          {/* Trigger Batch Send Button */}
          <button
            onClick={() => handleStartBatchWhatsApp()}
            disabled={selectedStudentIds.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
              selectedStudentIds.length > 0
                ? "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>إرسال الرابط للمحددين ({selectedStudentIds.length})</span>
          </button>
        </div>
      </div>

      {/* STUDENTS TABLE / ROSTER */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.length === filteredProfiles.length && filteredProfiles.length > 0}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300"
                  />
                </th>
                <th className="py-3.5 px-4">الطالب والصف</th>
                <th className="py-3.5 px-4">ولي الأمر والجوال</th>
                <th className="py-3.5 px-4 text-center">حالة الاستمارة والرابط</th>
                <th className="py-3.5 px-4 text-center">المؤشرات المستقلة (5)</th>
                <th className="py-3.5 px-4 text-center">الأولوية</th>
                <th className="py-3.5 px-4 text-center">آخر تحديث</th>
                <th className="py-3.5 px-4 text-center">إجراءات المتابعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((p) => {
                  const isSelected = selectedStudentIds.includes(p.studentId);
                  const isCompleted = p.status === "completed";
                  const isUrgent = p.overallPriority === "urgent";

                  return (
                    <tr
                      key={p.studentId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isUrgent ? "bg-rose-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds((prev) => [...prev, p.studentId]);
                            } else {
                              setSelectedStudentIds((prev) => prev.filter((id) => id !== p.studentId));
                            }
                          }}
                          className="w-4 h-4 text-teal-600 rounded border-slate-300"
                        />
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{p.studentName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          <span>{p.grade || "ثانوي"}</span>
                          <span className="mx-1">•</span>
                          <span>فصل {p.className || "1"}</span>
                          {p.isActivated && (
                            <span className="mr-2 inline-flex items-center gap-0.5 text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded text-[10px]">
                              <Lock className="w-2.5 h-2.5" /> موثق
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Guardian Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{p.guardianName || "ولي الأمر"}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                          {p.activatedPhone || p.guardianPhone || "غير مسجل"}
                        </div>
                      </td>

                      {/* Status & % & WhatsApp Invite Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                              isCompleted
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : p.status === "in_progress"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isCompleted ? "مكتمل" : p.status === "in_progress" ? "قيد التعبئة" : "لم يبدأ"}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 font-mono">
                            {p.completionPercentage}%
                          </span>

                          {/* WhatsApp Invite Delivery Status */}
                          {p.lastInviteSentAt ? (
                            <span
                              title={`تاريخ آخر إرسال عبر واتساب: ${new Date(p.lastInviteSentAt).toLocaleString("ar-SA")}`}
                              className="mt-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>أُرسل الرابط</span>
                            </span>
                          ) : p.inviteWhatsAppStatus === "failed" ? (
                            <span className="mt-1 text-[9px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                              <span>تعذر الإرسال</span>
                            </span>
                          ) : (
                            <span className="mt-1 text-[9px] text-slate-400">
                              لم يُرسل
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5 Independent Indicators */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Health */}
                          <span
                            title={`الصحة: ${getIndicatorLabel(p.indicators.health.level)}`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              getIndicatorColor(p.indicators.health.level).bg
                            } ${getIndicatorColor(p.indicators.health.level).text} border ${
                              getIndicatorColor(p.indicators.health.level).border
                            }`}
                          >
                            ص
                          </span>
                          {/* Learning */}
                          <span
                            title={`التعلم: ${getIndicatorLabel(p.indicators.learning.level)}`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              getIndicatorColor(p.indicators.learning.level).bg
                            } ${getIndicatorColor(p.indicators.learning.level).text} border ${
                              getIndicatorColor(p.indicators.learning.level).border
                            }`}
                          >
                            ت
                          </span>
                          {/* Social */}
                          <span
                            title={`الاجتماعي: ${getIndicatorLabel(p.indicators.social.level)}`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              getIndicatorColor(p.indicators.social.level).bg
                            } ${getIndicatorColor(p.indicators.social.level).text} border ${
                              getIndicatorColor(p.indicators.social.level).border
                            }`}
                          >
                            ج
                          </span>
                          {/* Wellbeing */}
                          <span
                            title={`النفسي: ${getIndicatorLabel(p.indicators.wellbeing.level)}`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              getIndicatorColor(p.indicators.wellbeing.level).bg
                            } ${getIndicatorColor(p.indicators.wellbeing.level).text} border ${
                              getIndicatorColor(p.indicators.wellbeing.level).border
                            }`}
                          >
                            ن
                          </span>
                          {/* Behavior */}
                          <span
                            title={`السلوك: ${getIndicatorLabel(p.indicators.behavior.level)}`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              getIndicatorColor(p.indicators.behavior.level).bg
                            } ${getIndicatorColor(p.indicators.behavior.level).text} border ${
                              getIndicatorColor(p.indicators.behavior.level).border
                            }`}
                          >
                            س
                          </span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.overallPriority === "urgent"
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : p.overallPriority === "high"
                              ? "bg-orange-100 text-orange-800 border-orange-200"
                              : p.overallPriority === "medium"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {p.overallPriority === "urgent"
                            ? "عاجل"
                            : p.overallPriority === "high"
                            ? "مرتفعة"
                            : p.overallPriority === "medium"
                            ? "متوسطة"
                            : "منخفضة"}
                        </span>
                      </td>

                      {/* Last Updated */}
                      <td className="py-3.5 px-4 text-center text-slate-400 text-[11px]">
                        {p.lastUpdatedAt
                          ? new Date(p.lastUpdatedAt).toLocaleDateString("ar-SA")
                          : "لم يحدّث"}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {/* WhatsApp button */}
                          <button
                            onClick={() => handleSendSingleWhatsApp(p)}
                            disabled={sendingSingleId === p.studentId}
                            title={
                              p.lastInviteSentAt
                                ? `إعادة إرسال الرابط عبر واتساب (أُرسل سابقاً: ${new Date(p.lastInviteSentAt).toLocaleDateString("ar-SA")})`
                                : "إرسال رابط الاستمارة عبر واتساب"
                            }
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              p.lastInviteSentAt
                                ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                : "text-emerald-600 hover:bg-emerald-50"
                            } disabled:opacity-50`}
                          >
                            {sendingSingleId === p.studentId ? (
                              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>

                          {/* Copy Link */}
                          <button
                            onClick={() => handleCopyLink(p)}
                            title="نسخ رابط الاستمارة"
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedId === p.studentId ? (
                              <Check className="w-4 h-4 text-teal-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          {/* Teacher Support Card */}
                          <button
                            onClick={() => setActiveTeacherCardProfile(p)}
                            title="عرض بطاقة المعلم الصفية"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <GraduationCap className="w-4 h-4" />
                          </button>

                          {/* Full Detail Modal */}
                          <button
                            onClick={() => {
                              setActiveDetailProfile(p);
                              onLogAudit("view", "full_profile", `فتح ملف الدعم الشامل للطالب: ${p.studentName}`);
                            }}
                            className="py-1 px-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold transition-all cursor-pointer mr-1"
                          >
                            فتح الملف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد سجلات تطابق معايير البحث والتصفية المحددة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BATCH WHATSAPP PROGRESS & ANTI-BAN MODAL */}
      {batchProgress.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-teal-50/40">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  batchProgress.isCompleted
                    ? "bg-emerald-100 text-emerald-700"
                    : batchProgress.isPaused
                    ? "bg-amber-100 text-amber-700"
                    : "bg-teal-100 text-teal-700"
                }`}>
                  {batchProgress.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : batchProgress.isRunning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {batchProgress.isCompleted
                      ? "اكتمل إرسال روابط الاستمارات"
                      : batchProgress.isPaused
                      ? "الإرسال متوقف مؤقتاً"
                      : "جاري إرسال روابط استمارات المتابعة الصحية"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    نظام الإرسال الذكي لرسائل أولياء الأمور مع درع الحماية ضد الحظر
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (batchProgress.isRunning) {
                    if (confirm("هل ترغب حقاً في إيقاف الإرسال وإغلاق النافذة؟")) {
                      abortBatchRef.current = true;
                      setBatchProgress((prev) => ({ ...prev, isOpen: false, isRunning: false }));
                    }
                  } else {
                    setBatchProgress((prev) => ({ ...prev, isOpen: false }));
                  }
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Anti-Ban Protection Banner with active countdown & jitter */}
              <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200/80 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-teal-950 font-bold">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    درع حظر الواتساب نشط: فاصل {baseDelaySecs} ثوانٍ
                    {enableJitter ? ` بتفاوت بشري (±${jitterRangeSecs}ث)` : ""}
                  </span>
                </div>

                {batchProgress.countdownSeconds > 0 && batchProgress.isRunning && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-600 text-white font-mono font-bold text-xs animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    <span>انتظار: {batchProgress.countdownSeconds}ث</span>
                    {batchProgress.currentJitter !== 0 && (
                      <span className="text-[10px] opacity-85">
                        ({batchProgress.currentJitter > 0 ? `+${batchProgress.currentJitter}` : batchProgress.currentJitter}ث)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span>التقدم الإجمالي:</span>
                    <span className="text-teal-700">
                      {batchProgress.currentIndex} من {batchProgress.total}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500">
                    {batchProgress.total > 0
                      ? Math.round((batchProgress.currentIndex / batchProgress.total) * 100)
                      : 0}
                    %
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
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

              {/* Counters Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                  <span className="text-[11px] text-emerald-700 font-bold block">تم بنجاح</span>
                  <span className="text-xl font-black text-emerald-950">{batchProgress.sentCount}</span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                  <span className="text-[11px] text-rose-700 font-bold block">تعذر الإرسال</span>
                  <span className="text-xl font-black text-rose-950">{batchProgress.failedCount}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[11px] text-slate-500 font-bold block">المتبقي</span>
                  <span className="text-xl font-black text-slate-800">
                    {Math.max(0, batchProgress.total - batchProgress.currentIndex)}
                  </span>
                </div>
              </div>

              {/* Currently Processing Student Card */}
              {batchProgress.isRunning && batchProgress.currentStudentName && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                    <div>
                      <div className="font-bold text-slate-900">{batchProgress.currentStudentName}</div>
                      <div className="text-slate-400 font-mono text-[11px]" dir="ltr">
                        {batchProgress.currentStudentPhone || "جاري التجهيز..."}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px]">
                    جاري المعالجة
                  </span>
                </div>
              )}

              {/* Real-time Dispatch Logs Feed */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 block">سجل الإرسال المباشر:</span>
                <div className="h-44 overflow-y-auto border border-slate-200 rounded-2xl p-2.5 space-y-1.5 bg-slate-50/50">
                  {batchProgress.logs.length > 0 ? (
                    batchProgress.logs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-2 rounded-xl text-xs flex items-center justify-between border ${
                          log.status === "success"
                            ? "bg-emerald-50/60 border-emerald-200/60 text-emerald-900"
                            : "bg-rose-50/60 border-rose-200/60 text-rose-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {log.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-bold">{log.studentName}</span>
                            <span className="mx-1 text-slate-400">•</span>
                            <span className="font-mono text-[11px] text-slate-500" dir="ltr">
                              {log.phone}
                            </span>
                            {log.error && (
                              <span className="text-rose-600 text-[10px] block truncate">
                                {log.error}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono opacity-70 shrink-0 mr-2">
                          {log.timestamp}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      يبدأ تدفق السجل مع بدء أول رسالة...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              {batchProgress.isRunning ? (
                <>
                  <div className="flex items-center gap-2">
                    {/* Pause / Resume Button */}
                    <button
                      onClick={() => {
                        pauseBatchRef.current = !pauseBatchRef.current;
                        setBatchProgress((prev) => ({
                          ...prev,
                          isPaused: pauseBatchRef.current,
                        }));
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                        batchProgress.isPaused
                          ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      {batchProgress.isPaused ? (
                        <>
                          <PlayCircle className="w-4 h-4" />
                          <span>استئناف الإرسال</span>
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-4 h-4" />
                          <span>إيقاف مؤقت</span>
                        </>
                      )}
                    </button>

                    {/* Abort Button */}
                    <button
                      onClick={() => {
                        if (confirm("هل ترغب بالتأكيد في إيقاف الإرسال لبقية الطلاب الآن؟")) {
                          abortBatchRef.current = true;
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>إيقاف الإرسال نهائياً</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    يمكنك إيقاف الإرسال في أي وقت
                  </span>
                </>
              ) : (
                <button
                  onClick={() => setBatchProgress((prev) => ({ ...prev, isOpen: false }))}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all cursor-pointer text-center"
                >
                  إغلاق النافذة
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold border ${
              toastMessage.type === "success"
                ? "bg-emerald-900 text-white border-emerald-700"
                : toastMessage.type === "error"
                ? "bg-rose-900 text-white border-rose-700"
                : "bg-slate-900 text-white border-slate-700"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* MODAL 1: Full Detail Modal */}
      {activeDetailProfile && (
        <StudentSupportDetailModal
          profile={activeDetailProfile}
          isOpen={true}
          onClose={() => setActiveDetailProfile(null)}
          onSaveProfile={onSaveProfile}
          cases={cases}
          onSaveCase={onSaveCase}
          auditLogs={auditLogs}
          onLogAudit={onLogAudit}
        />
      )}

      {/* MODAL 2: Teacher Support Card Modal */}
      {activeTeacherCardProfile && (
        <TeacherSupportCardModal
          profile={activeTeacherCardProfile}
          isOpen={true}
          onClose={() => setActiveTeacherCardProfile(null)}
          onContactCounselor={(name) => {
            alert(`تم تسجيل طلب التواصل مع المرشد الطلابي بشأن الطالب: ${name}`);
          }}
        />
      )}
    </div>
  );
}
