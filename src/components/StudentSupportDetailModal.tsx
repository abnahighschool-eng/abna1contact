import React, { useState } from "react";
import {
  X,
  Printer,
  HeartPulse,
  Activity,
  Brain,
  GraduationCap,
  Users,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  User,
  Phone,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Plus,
  Send,
  Calendar,
  Lock,
  ChevronDown,
  Layers,
  HelpCircle
} from "lucide-react";
import {
  StudentSupportProfile,
  SupportCase,
  SupportCaseAction,
  HealthAuditLog,
  SupportRoleView,
} from "../types/studentSupport";
import {
  getIndicatorColor,
  getIndicatorLabel,
  generateTeacherSupportCard,
} from "../utils/studentSupportRulesEngine";

interface StudentSupportDetailModalProps {
  profile: StudentSupportProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: StudentSupportProfile) => Promise<boolean>;
  cases: SupportCase[];
  onSaveCase: (supportCase: SupportCase) => Promise<boolean>;
  auditLogs: HealthAuditLog[];
  onLogAudit: (action: "view" | "edit" | "print", dataType: string, reason: string) => void;
  currentUserRole?: string;
  currentUserName?: string;
}

export default function StudentSupportDetailModal({
  profile,
  isOpen,
  onClose,
  onSaveProfile,
  cases,
  onSaveCase,
  auditLogs,
  onLogAudit,
  currentUserRole = "admin",
  currentUserName = "المرشد الطلابي / الإدارة",
}: StudentSupportDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "indicators" | "case_management" | "teacher_card" | "role_preview" | "audit"
  >("indicators");

  // Role simulation state (for previewing access permissions)
  const [simulatedRole, setSimulatedRole] = useState<SupportRoleView>("counselor");

  // Case Management Form State
  const studentCases = cases.filter((c) => c.studentId === profile.studentId);
  const activeCase = studentCases[0] || null;

  const [caseReason, setCaseReason] = useState(activeCase?.reason || "متابعة دورية لاحتياجات الطالب ورعايته");
  const [caseDomain, setCaseDomain] = useState<SupportCase["domain"]>(activeCase?.domain || "general");
  const [casePriority, setCasePriority] = useState<SupportCase["priority"]>(activeCase?.priority || profile.overallPriority);
  const [caseStatus, setCaseStatus] = useState<SupportCase["status"]>(activeCase?.status || "in_progress");
  const [caseNotes, setCaseNotes] = useState(activeCase?.notes || "");
  const [nextFollowUp, setNextFollowUp] = useState(activeCase?.nextFollowUpDate || "");
  const [savingCase, setSavingCase] = useState(false);

  // Quick Action Logger
  const [actionType, setActionType] = useState<SupportCaseAction["type"]>("interviewed_student");
  const [actionNotes, setActionNotes] = useState("");
  const [recordingAction, setRecordingAction] = useState(false);

  if (!isOpen) return null;

  const teacherCard = generateTeacherSupportCard(profile);

  // Handle Save Case
  const handleSaveSupportCase = async () => {
    setSavingCase(true);
    try {
      const updatedCase: SupportCase = {
        id: activeCase?.id || `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentId: profile.studentId,
        studentName: profile.studentName,
        grade: profile.grade,
        className: profile.className,
        domain: caseDomain,
        reason: caseReason,
        priority: casePriority,
        openedAt: activeCase?.openedAt || new Date().toISOString(),
        assignedTo: currentUserName,
        status: caseStatus,
        actions: activeCase?.actions || [],
        nextFollowUpDate: nextFollowUp,
        notes: caseNotes,
        updatedAt: new Date().toISOString(),
      };

      await onSaveCase(updatedCase);
      onLogAudit("edit", "case_management", `تحديث بيانات حالة الطالب: ${profile.studentName}`);
      alert("تم حفظ بيانات الحالة بنجاح");
    } catch (e: any) {
      alert("حدث خطأ أثناء حفظ الحالة");
    } finally {
      setSavingCase(false);
    }
  };

  // Handle Add Quick Action
  const handleAddAction = async () => {
    if (!actionNotes.trim()) {
      alert("يرجى كتابة ملخص موجز للإجراء المتخذ");
      return;
    }
    setRecordingAction(true);
    try {
      const actionLabels: Record<SupportCaseAction["type"], string> = {
        contacted_guardian: "تم التواصل مع ولي الأمر",
        interviewed_student: "تمت مقابلة الطالب ودياً",
        observed_student: "تمت ملاحظة الطالب صفياً",
        prepared_support_plan: "تم إعداد خطة دعم ومساندة",
        referred_case: "تمت إحالة الحالة للمختص المعني",
        contacted_teacher: "تم التنسيق مع معلم الفصل",
        needs_later_followup: "تم جدولة متابعة لاحقة",
        closed_case: "تم إنهاء وإغلاق ملف المتابعة",
      };

      const newAction: SupportCaseAction = {
        id: `act_${Date.now()}`,
        type: actionType,
        label: actionLabels[actionType],
        performedBy: currentUserName,
        timestamp: new Date().toISOString(),
        notes: actionNotes.trim(),
      };

      const currentCase = activeCase || {
        id: `case_${Date.now()}`,
        studentId: profile.studentId,
        studentName: profile.studentName,
        grade: profile.grade,
        className: profile.className,
        domain: caseDomain,
        reason: caseReason,
        priority: casePriority,
        openedAt: new Date().toISOString(),
        assignedTo: currentUserName,
        status: caseStatus,
        actions: [],
      };

      const updatedCase: SupportCase = {
        ...currentCase,
        actions: [newAction, ...(currentCase.actions || [])],
        updatedAt: new Date().toISOString(),
      };

      await onSaveCase(updatedCase);
      setActionNotes("");
      onLogAudit("edit", "case_management", `إضافة إجراء جديد (${newAction.label}) للطالب ${profile.studentName}`);
    } catch (e: any) {
      alert("تعذر حفظ الإجراء");
    } finally {
      setRecordingAction(false);
    }
  };

  const handlePrint = () => {
    onLogAudit("print", "full_profile", `طباعة تقرير ملف الطالب: ${profile.studentName}`);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-xs">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-900 text-lg sm:text-xl">{profile.studentName}</h2>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  profile.overallPriority === "urgent"
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : profile.overallPriority === "high"
                    ? "bg-orange-50 border-orange-200 text-orange-800"
                    : profile.overallPriority === "medium"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  الأولوية: {profile.overallPriority === "urgent" ? "عاجل / طوارئ" : profile.overallPriority === "high" ? "مرتفعة" : profile.overallPriority === "medium" ? "متوسطة" : "منخفضة"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span>الصف: <strong className="text-slate-700">{profile.grade || "ثانوي"}</strong></span>
                <span>•</span>
                <span>الشعبة: <strong className="text-slate-700">{profile.className || "1"}</strong></span>
                <span>•</span>
                <span>ولي الأمر: <strong className="text-slate-700">{profile.guardianName || "ولي الأمر"} ({profile.guardianPhone || profile.activatedPhone || "غير محدد"})</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handlePrint}
              className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-bold">
          {[
            { id: "indicators", label: "المؤشرات والأدلة (5)", icon: Activity },
            { id: "profile", label: "إجابات الاستمارة الشاملة", icon: FileText },
            { id: "case_management", label: "إدارة الحالة والمتابعة", icon: ShieldCheck },
            { id: "teacher_card", label: "بطاقة المعلم الصفية", icon: GraduationCap },
            { id: "role_preview", label: "معاينة الأدوار والصلاحيات", icon: Layers },
            { id: "audit", label: "سجل الوصول والتدقيق", icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  onLogAudit("view", tab.id, `عرض تبويب ${tab.label} للطالب ${profile.studentName}`);
                }}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "border-teal-600 text-teal-800 bg-white shadow-xs rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* TAB 1: 5 INDEPENDENT INDICATORS WITH EVIDENCE */}
          {activeTab === "indicators" && (
            <div className="space-y-6">
              <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 text-xs text-teal-950 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>نظام المؤشرات المستقلة (Evidence-based Indicators):</strong>
                  <p className="mt-0.5 text-teal-900/90">
                    هذه المؤشرات مبنية بشكل مباشر على إفادات وملاحظات ولي الأمر، ولا تشكل أي تشخيص طبي أو نفسي، وإنما توجه التوجيه الطلابي والإرشاد الصحي لتقديم الدعم الملائم.
                  </p>
                </div>
              </div>

              {/* Grid of 5 Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    key: "health",
                    title: "مؤشر الصحة الجسدية (Health)",
                    icon: HeartPulse,
                    data: profile.indicators.health,
                  },
                  {
                    key: "learning",
                    title: "مؤشر التعلم والأساليب (Learning)",
                    icon: GraduationCap,
                    data: profile.indicators.learning,
                  },
                  {
                    key: "social",
                    title: "مؤشر العلاقات والاندماج (Social)",
                    icon: Users,
                    data: profile.indicators.social,
                  },
                  {
                    key: "wellbeing",
                    title: "مؤشر الصحة النفسية والانفعالية (Wellbeing)",
                    icon: Brain,
                    data: profile.indicators.wellbeing,
                  },
                  {
                    key: "behavior",
                    title: "مؤشر السلوك والتنظيم (Behavior)",
                    icon: Activity,
                    data: profile.indicators.behavior,
                  },
                ].map((ind) => {
                  const Icon = ind.icon;
                  const color = getIndicatorColor(ind.data.level);
                  return (
                    <div
                      key={ind.key}
                      className={`p-5 rounded-2xl border ${color.border} ${color.bg} flex flex-col justify-between space-y-4`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${color.text}`} />
                          <h4 className="font-bold text-slate-900 text-sm">{ind.title}</h4>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/80 border ${color.border} ${color.text}`}>
                          <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                          {getIndicatorLabel(ind.data.level)}
                        </span>
                      </div>

                      {/* Evidence List */}
                      <div className="space-y-1.5 bg-white/80 p-3 rounded-xl border border-black/5">
                        <span className="text-[11px] font-bold text-slate-500 block">الأدلة والملاحظات المستند إليها:</span>
                        <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside">
                          {ind.data.evidence.map((ev, idx) => (
                            <li key={idx} className="leading-relaxed">{ev}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-[10px] text-slate-400 text-left">
                        مصدر الإفادة: ولي الأمر • {new Date(ind.data.updatedAt).toLocaleDateString("ar-SA")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: FULL PROFILE ANSWERS */}
          {activeTab === "profile" && (
            <div className="space-y-6 text-xs">
              {/* Emergency Banner if applicable */}
              {(profile.emergencyInfo?.requiresUrgentIntervention === "yes" || profile.allergyDetails?.isEmergencyNotice) && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">تنبيه طوارئ معتمد من ولي الأمر (Emergency Flag)</h4>
                    <p className="mt-1">
                      {profile.emergencyInfo?.warningSigns || "يوجد تنبيه صحي عاجل يتطلب سرعة الاستجابة وتوفر دواء الطوارئ."}
                    </p>
                  </div>
                </div>
              )}

              {/* 1. Physical Health Details */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-sm text-slate-900 border-b border-slate-200/80 pb-1.5 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-teal-600" />
                  الصحة الجسدية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400 block">حالة صحية مستمرة:</span>
                    <strong className="text-slate-800">
                      {profile.hasChronicCondition === "yes" ? (profile.conditionTypes || []).join("، ") || "نعم" : "لا"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">التأثيرات المدرسية:</span>
                    <strong className="text-slate-800">
                      {(profile.schoolImpacts || []).join("، ") || "لا توجد تأثيرات مسجلة"}
                    </strong>
                  </div>
                  {profile.schoolHealthNotes && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block">ملاحظات ولي الأمر للمدرسة:</span>
                      <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 mt-1">
                        {profile.schoolHealthNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Medications & Allergies */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-sm text-slate-900 border-b border-slate-200/80 pb-1.5 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  الأدوية والحساسيات والطوارئ
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400 block">الأدوية المنتظمة:</span>
                    <strong className="text-slate-800">
                      {profile.takesRegularMedication === "yes"
                        ? `${profile.medicationDetails?.name || "دواء"} (${profile.medicationDetails?.reason || "علاج"})`
                        : "لا يتناول أدوية"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">الحساسية:</span>
                    <strong className="text-slate-800">
                      {profile.hasAllergies === "yes"
                        ? (profile.allergyDetails?.types || []).join("، ") || "توجد حساسية"
                        : "لا توجد حساسية"}
                    </strong>
                  </div>
                  {profile.emergencyInfo?.primaryContact?.name && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block">جهة الاتصال في الطوارئ:</span>
                      <strong className="text-slate-800">
                        {profile.emergencyInfo.primaryContact.name} ({profile.emergencyInfo.primaryContact.phone})
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Emotional & Behavior Observations */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-sm text-slate-900 border-b border-slate-200/80 pb-1.5 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-teal-600" />
                  ملاحظات السلوك والصحة النفسية (إفادة ولي الأمر)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {Object.entries(profile.emotionalObservations || {}).map(([k, v]) => {
                    if (v === "unknown" || v === "none") return null;
                    return (
                      <div key={k} className="p-2 bg-white rounded-lg border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">{k}</span>
                        <strong className="text-slate-800 font-bold">{v === "frequent" ? "متكرر" : "أحياناً"}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Confidential Counselor Note (Restricted) */}
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-2">
                <div className="flex items-center justify-between border-b border-purple-200 pb-1.5">
                  <h4 className="font-bold text-sm text-purple-950 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-700" />
                    المعلومات السرية الخاصة بالمرشد الطلابي (COUNSELOR_ONLY)
                  </h4>
                  <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-full">
                    محجوب عن المعلمين
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-purple-100">
                  {profile.hasConfidentialNote === "yes" && profile.confidentialNote
                    ? profile.confidentialNote
                    : "لا توجد ملاحظات سرية إضافية مدونة من ولي الأمر."}
                </p>
              </div>

              {/* 5. One Thing School Should Know */}
              {profile.oneThingSchoolShouldKnow && (
                <div className="p-4 bg-teal-50/60 rounded-2xl border border-teal-200 space-y-1.5">
                  <h4 className="font-bold text-sm text-teal-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-700" />
                    ما تمنى ولي الأمر أن تعرفه المدرسة عن ابنه
                  </h4>
                  <p className="text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-teal-100 italic">
                    "{profile.oneThingSchoolShouldKnow}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CASE MANAGEMENT & ACTIONS */}
          {activeTab === "case_management" && (
            <div className="space-y-6 text-xs">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">ملف متابعة الحالة (Case Record)</h3>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      توثيق إجراءات وخطط الرعاية للمرشد الطلابي والإدارة المدرسية
                    </p>
                  </div>
                  <button
                    onClick={handleSaveSupportCase}
                    disabled={savingCase}
                    className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{savingCase ? "جاري الحفظ..." : "حفظ بيانات الحالة"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">مجال الحالة (Domain)</label>
                    <select
                      value={caseDomain}
                      onChange={(e) => setCaseDomain(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="general">عام / شامل</option>
                      <option value="health">صحي جسدي</option>
                      <option value="wellbeing">نفسي وانفعالي</option>
                      <option value="learning">أكاديمي وتعليمي</option>
                      <option value="behavior">سلوكي وانضباطي</option>
                      <option value="social">اجتماعي وعلاقات</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">مستوى الأولوية</label>
                    <select
                      value={casePriority}
                      onChange={(e) => setCasePriority(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="low">منخفضة</option>
                      <option value="medium">متوسطة</option>
                      <option value="high">مرتفعة</option>
                      <option value="urgent">عاجل / طوارئ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">حالة الملف (Case Status)</label>
                    <select
                      value={caseStatus}
                      onChange={(e) => setCaseStatus(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="new">جديدة</option>
                      <option value="in_progress">قيد المتابعة</option>
                      <option value="needs_action">تحتاج إجراء عاجل</option>
                      <option value="referred">محالة لجهة خارجية/مختص</option>
                      <option value="stable">مستقرة</option>
                      <option value="closed">مغلقة</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">سبب المتابعة وخطة الدعم</label>
                  <textarea
                    rows={2}
                    value={caseReason}
                    onChange={(e) => setCaseReason(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Quick Action Logger */}
              <div className="p-5 bg-teal-50/50 border border-teal-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-sm text-teal-950 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-teal-700" />
                  تسجيل إجراء سريع في سجل الطالب
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">نوع الإجراء</label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as any)}
                      className="w-full p-2 bg-white border border-teal-300 rounded-lg text-xs"
                    >
                      <option value="interviewed_student">مقابلة الطالب</option>
                      <option value="contacted_guardian">تواصل مع ولي الأمر</option>
                      <option value="observed_student">ملاحظة صفية</option>
                      <option value="contacted_teacher">تنسيق مع المعلم</option>
                      <option value="prepared_support_plan">إعداد خطة دعم</option>
                      <option value="needs_later_followup">جدولة موعد لاحق</option>
                      <option value="closed_case">إغلاق المتابعة</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 mb-1">تفاصيل وملاحظات الإجراء</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="اكتب ملخص ما تم..."
                        className="flex-1 p-2 bg-white border border-teal-300 rounded-lg text-xs outline-hidden"
                      />
                      <button
                        onClick={handleAddAction}
                        disabled={recordingAction}
                        className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shrink-0 transition-all cursor-pointer"
                      >
                        {recordingAction ? "..." : "تسجيل"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action History Timeline */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">سجل الإجراءات المتخذة</h4>
                {activeCase?.actions && activeCase.actions.length > 0 ? (
                  <div className="space-y-2">
                    {activeCase.actions.map((act) => (
                      <div key={act.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{act.label}</span>
                            <span className="text-[10px] text-slate-400">بواسطة: {act.performedBy}</span>
                          </div>
                          {act.notes && <p className="text-slate-600 mt-1">{act.notes}</p>}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(act.timestamp).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">لم يتم تسجيل أي إجراءات سابقة لهذه الحالة.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TEACHER CARD PREVIEW */}
          {activeTab === "teacher_card" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-center justify-between">
                <div>
                  <strong>معاينة بطاقة الدعم الصفية للمعلم:</strong>
                  <p className="mt-0.5">
                    هذا النموذج المقتضب هو ما يتاح للمعلمين، ولا يحتوي على أسرار عائلية أو تفاصيل طبية خاصة.
                  </p>
                </div>
                <button
                  onClick={handlePrint}
                  className="py-1.5 px-3 bg-white text-blue-900 border border-blue-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة بطاقة المعلم</span>
                </button>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-black text-slate-900 text-base">{teacherCard.studentName}</h3>
                    <span className="text-xs text-slate-500">الصف: {teacherCard.grade} — {teacherCard.className}</span>
                  </div>
                  <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    بطاقة المعلم
                  </span>
                </div>

                {/* Health Notice */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-500 block mb-1">التنبيه الصحي الصفي:</span>
                  <p className="text-slate-800">{teacherCard.healthAlert.message}</p>
                </div>

                {/* Tips */}
                <div className="space-y-2">
                  <span className="font-bold text-xs text-slate-500 block">كيف أساعد الطالب داخل الصف؟:</span>
                  {teacherCard.classroomTips.map((tip, i) => (
                    <div key={i} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ROLE-BASED ACCESS PREVIEW */}
          {activeTab === "role_preview" && (
            <div className="space-y-5 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-sm text-slate-900">محاكاة صلاحيات العرض (Role-Based Access Simulation)</h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  نظراً لأن حسابات المعلمين لم تُنشأ بعد، يتيح هذا القسم للإدارة والمرشد معاينة شكل البيانات كما ستظهر لكل دور وظيفي فور اعتماد حسابه.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { id: "teacher", label: "دور المعلم (Teacher)" },
                    { id: "counselor", label: "دور المرشد الطلابي (Counselor)" },
                    { id: "health_counselor", label: "دور الإرشاد الصحي (Health Officer)" },
                    { id: "admin", label: "دور مدير المدرسة (School Admin)" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSimulatedRole(r.id as any)}
                      className={`py-2 px-3.5 rounded-xl border font-bold transition-all cursor-pointer ${
                        simulatedRole === r.id
                          ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Matrix for Selected Role */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h5 className="font-bold text-sm text-slate-800">
                    الصلاحيات المتاحة لدور: <strong className="text-teal-700">{simulatedRole}</strong>
                  </h5>
                  <span className="text-xs text-slate-400">حسب سياسة الخصوصية المعتمدة</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <span>بيانات الطالب الأساسية والصف</span>
                    <span className="text-emerald-700 font-bold">متاح للجميع</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <span>التوصيات الصفية وأساليب التعلم</span>
                    <span className="text-emerald-700 font-bold">متاح (المعلم، المرشد، الإدارة)</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <span>التنبيه الصحي الصفي المختصر</span>
                    <span className="text-emerald-700 font-bold">متاح للمعلم كملخص آمن</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <span>التفاصيل الطبية الكاملة وأدوية الطوارئ</span>
                    <span className={simulatedRole === "teacher" ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                      {simulatedRole === "teacher" ? "محجوب عن المعلم" : "متاح للمرشد الصحي والإدارة"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <span>الملاحظات السرية الخاصة (COUNSELOR_ONLY)</span>
                    <span className={simulatedRole === "counselor" || simulatedRole === "admin" ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                      {simulatedRole === "counselor" || simulatedRole === "admin" ? "متاح للمرشد الطلابي فقط" : "محجوب تماماً"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-sm text-slate-900">سجل التدقيق والوصول للبيانات الحساسة</h4>
                <span className="text-slate-400">توثيق العمليات حسب ضوابط حماية البيانات</span>
              </div>

              <div className="space-y-2">
                {auditLogs
                  .filter((log) => log.studentId === profile.studentId || log.studentName === profile.studentName)
                  .map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">{log.userName}</span>
                        <span className="text-slate-400 mx-1">({log.userRole})</span>
                        <span className="text-teal-700 mr-2 font-medium">{log.reason}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString("ar-SA")} - {new Date(log.timestamp).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                  ))}

                {auditLogs.filter((log) => log.studentId === profile.studentId).length === 0 && (
                  <div className="p-6 text-center text-slate-400 italic">
                    تم توثيق فتح الملف الآن في سجل العمليات تلقائياً.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
