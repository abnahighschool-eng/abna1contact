import React, { useState, useMemo } from "react";
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
  GraduationCap,
  Activity,
  Brain,
  AlertTriangle,
  RefreshCw,
  Plus,
  Eye,
  Check,
  Lock,
  Layers
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

interface StudentHealthTrackerProps {
  students: Student[];
  supportProfiles: Record<string, StudentSupportProfile>;
  onSaveProfile: (profile: StudentSupportProfile) => Promise<boolean>;
  cases: SupportCase[];
  onSaveCase: (supportCase: SupportCase) => Promise<boolean>;
  auditLogs: HealthAuditLog[];
  onLogAudit: (action: "view" | "edit" | "print", dataType: string, reason: string) => void;
  onSendWhatsAppDirect?: (phone: string, message: string) => Promise<{ success: boolean; error?: string }>;
  schoolName?: string;
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
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

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

    return {
      total,
      completed,
      inProgress,
      urgent,
      healthAttention,
      wellbeingAttention,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [mergedStudentProfiles]);

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

  // Send WhatsApp to Single Student
  const handleSendSingleWhatsApp = async (p: StudentSupportProfile) => {
    const phone = p.activatedPhone || p.guardianPhone;
    if (!phone) {
      alert("لا يوجد رقم جوال مسجل لولي أمر هذا الطالب");
      return;
    }

    const message = getWhatsAppMessage(p);
    setSendingSingleId(p.studentId);

    try {
      if (onSendWhatsAppDirect) {
        const result = await onSendWhatsAppDirect(phone, message);
        if (result.success) {
          alert(`تم إرسال رابط استمارة الدعم لولي أمر الطالب (${p.studentName}) بنجاح`);
          // Mark invite sent
          const updated: StudentSupportProfile = {
            ...p,
            lastInviteSentAt: new Date().toISOString(),
            inviteWhatsAppStatus: "success",
          };
          await onSaveProfile(updated);
          onLogAudit("edit", "full_profile", `إرسال رابط الاستمارة عبر واتساب للطالب: ${p.studentName}`);
        } else {
          // Open WhatsApp web as fallback
          const encoded = encodeURIComponent(message);
          window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encoded}`, "_blank");
        }
      } else {
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encoded}`, "_blank");
      }
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء إرسال رسالة الواتساب");
    } finally {
      setSendingSingleId(null);
    }
  };

  // Bulk WhatsApp Sender
  const handleSendBulkWhatsApp = async () => {
    if (selectedStudentIds.length === 0) {
      alert("يرجى تحديد طلاب أولاً لإرسال الرابط إليهم");
      return;
    }

    const confirmed = confirm(
      `هل ترغب في إرسال رابط استمارة المتابعة الصحية لـ (${selectedStudentIds.length}) من أولياء الأمور؟`
    );
    if (!confirmed) return;

    setSendingBulk(true);
    setBulkProgress({ current: 0, total: selectedStudentIds.length });

    let sentCount = 0;
    for (let i = 0; i < selectedStudentIds.length; i++) {
      const id = selectedStudentIds[i];
      const p = mergedStudentProfiles.find((x) => x.studentId === id);
      if (p) {
        const phone = p.activatedPhone || p.guardianPhone;
        if (phone && onSendWhatsAppDirect) {
          const msg = getWhatsAppMessage(p);
          await onSendWhatsAppDirect(phone, msg);
          sentCount++;
        }
      }
      setBulkProgress({ current: i + 1, total: selectedStudentIds.length });
      // Minor delay to respect rate limit
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    setSendingBulk(false);
    setBulkProgress(null);
    setSelectedStudentIds([]);
    alert(`تم إرسال رابط الاستمارة بنجاح إلى (${sentCount}) من أولياء الأمور`);
    onLogAudit("edit", "full_profile", `إرسال جماعي لروابط الاستمارة لـ ${sentCount} طالب`);
  };

  // Toggle selection for all filtered
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredProfiles.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredProfiles.map((p) => p.studentId));
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
                onClick={handleSendBulkWhatsApp}
                disabled={sendingBulk}
                className="py-2.5 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>إرسال الرابط للمحددين ({selectedStudentIds.length})</span>
              </button>
            )}
          </div>
        </div>

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
            <span className="text-teal-700 text-xs block">ملاحظات صحية</span>
            <strong className="text-xl font-black text-teal-950">{metrics.healthAttention}</strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100">
            <span className="text-indigo-700 text-xs block">ملاحظات نفسية/انفعالية</span>
            <strong className="text-xl font-black text-indigo-950">{metrics.wellbeingAttention}</strong>
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

      {/* BULK PROGRESS BAR */}
      {bulkProgress && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-2">
          <div className="flex justify-between text-xs font-bold text-teal-900">
            <span>جاري إرسال الرسائل عبر واتساب...</span>
            <span>{bulkProgress.current} من {bulkProgress.total}</span>
          </div>
          <div className="w-full h-2 bg-teal-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 transition-all duration-300"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

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
                <th className="py-3.5 px-4 text-center">حالة الاستمارة</th>
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

                      {/* Status & % */}
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
                            title="إرسال رابط الاستمارة عبر واتساب"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
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
