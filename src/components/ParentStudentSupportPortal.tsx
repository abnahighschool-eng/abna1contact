import React, { useState, useEffect } from "react";
import {
  HeartPulse,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Save,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  Activity,
  Pill,
  Sparkles,
  Phone,
  AlertTriangle,
  Lock,
  EyeOff,
  HelpCircle,
  RotateCcw,
  Check,
  Send,
  Home,
  LogOut
} from "lucide-react";
import {
  StudentSupportProfile,
  GeneralResponseChoice,
  FrequencyChoice,
  BehaviorChoice,
} from "../types/studentSupport";
import { calculateStudentIndicators, calculateOverallPriority } from "../utils/studentSupportRulesEngine";

interface ParentStudentSupportPortalProps {
  token: string;
  initialProfile?: StudentSupportProfile | null;
  onSaveProfile: (profile: StudentSupportProfile) => Promise<boolean>;
  onExit?: () => void;
}

export default function ParentStudentSupportPortal({
  token,
  initialProfile,
  onSaveProfile,
  onExit,
}: ParentStudentSupportPortalProps) {
  // State for activation and phone lock
  const [profile, setProfile] = useState<StudentSupportProfile | null>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState<string | null>(null);

  // Phone Lock Verification Gate
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  // Parent Home Dashboard vs Form View
  const [viewMode, setViewMode] = useState<"home" | "form" | "submitted">("home");
  const [currentStep, setCurrentStep] = useState(1);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Update existing vs unchanged modal/flag
  const [updateMode, setUpdateMode] = useState<"all" | "selective">("selective");
  const [sectionsChanged, setSectionsChanged] = useState<Record<string, boolean>>({});

  // Fetch or load profile by token
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/health-tracker/token/${token}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "تعذر العثور على رابط الاستمارة أو انتهت صلاحيته");
        }
        const data = await res.json();
        setProfile(data.profile);

        // Check if phone was already verified in this browser session
        const savedSessionPhone = localStorage.getItem(`abna_parent_phone_${token}`);
        if (data.profile.isActivated && data.profile.activatedPhone) {
          if (savedSessionPhone === data.profile.activatedPhone) {
            setIsPhoneVerified(true);
          }
        }
      } catch (err: any) {
        setError(err.message || "حدث خطأ أثناء تحميل الاستمارة");
      } finally {
        setLoading(false);
      }
    }

    if (!initialProfile) {
      loadData();
    } else {
      setProfile(initialProfile);
      if (initialProfile.isActivated && initialProfile.activatedPhone) {
        const savedSessionPhone = localStorage.getItem(`abna_parent_phone_${token}`);
        if (savedSessionPhone === initialProfile.activatedPhone) {
          setIsPhoneVerified(true);
        }
      }
    }
  }, [token, initialProfile]);

  // Handle Phone Activation / Verification
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    if (!phoneInput || phoneInput.trim().length < 9) {
      setPhoneError("يرجى إدخال رقم جوال صحيح (مثال: 05xxxxxxxx)");
      return;
    }

    setVerifyingPhone(true);
    try {
      const res = await fetch("/api/health-tracker/token/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, phone: phoneInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "رقم الجوال المدخل لا يتطابق مع الجوال المعتمد للتفعيل");
      }

      // Successfully activated or verified
      setProfile(data.profile);
      setIsPhoneVerified(true);
      localStorage.setItem(`abna_parent_phone_${token}`, data.profile.activatedPhone || phoneInput.trim());
    } catch (err: any) {
      setPhoneError(err.message || "تعذر التحقق من رقم الجوال");
    } finally {
      setVerifyingPhone(false);
    }
  };

  // Profile field update helper
  const updateField = (updater: (prev: StudentSupportProfile) => StudentSupportProfile) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = updater(prev);
      // Auto recalculate indicators & priority
      const indicators = calculateStudentIndicators(updated);
      const overallPriority = calculateOverallPriority(indicators);

      // Recalculate completion percentage
      let filledScore = 0;
      const totalScore = 9;
      if (updated.basicInfoConfirmed) filledScore++;
      if (updated.hasChronicCondition !== "unknown") filledScore++;
      if (updated.takesRegularMedication !== "unknown") filledScore++;
      if (updated.hasAllergies !== "unknown") filledScore++;
      if (Object.values(updated.emotionalObservations || {}).some(v => v !== "unknown")) filledScore++;
      if (Object.values(updated.behaviorDifficulties || {}).some(v => v !== "unknown")) filledScore++;
      if ((updated.learningDifficulties || []).length > 0 || (updated.helpfulLearningStrategies || []).length > 0) filledScore++;
      if (updated.hasFamilyCircumstances !== "unknown") filledScore++;
      if (updated.peerRelationshipQuality !== "unknown") filledScore++;

      const completionPercentage = Math.round((filledScore / totalScore) * 100);

      const res: StudentSupportProfile = {
        ...updated,
        indicators,
        overallPriority,
        completionPercentage,
        status: completionPercentage >= 90 ? "completed" : "in_progress",
      };

      // Save draft locally
      try {
        localStorage.setItem(`abna_draft_profile_${token}`, JSON.stringify(res));
      } catch (e) {}

      return res;
    });
  };

  // Save draft to server
  const handleSaveDraft = async () => {
    if (!profile) return;
    setSavingDraft(true);
    setSaveSuccessMessage(null);
    try {
      const ok = await onSaveProfile(profile);
      if (ok) {
        setSaveSuccessMessage("تم حفظ مسودة الإجابات بنجاح");
        setTimeout(() => setSaveSuccessMessage(null), 3500);
      }
    } catch (err) {
      alert("تعذر حفظ المسودة مؤقتاً");
    } finally {
      setSavingDraft(false);
    }
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    if (!profile) return;
    if (!profile.privacyConsentAccepted) {
      alert("نأمل منكم الموافقة على إقرار الخصوصية للمتابعة");
      return;
    }

    setSubmitting(true);
    try {
      const finalProfile: StudentSupportProfile = {
        ...profile,
        lastUpdatedAt: new Date().toISOString(),
        status: "completed",
        privacyConsentAcceptedAt: new Date().toISOString(),
        timeline: [
          ...(profile.timeline || []),
          {
            id: `time_${Date.now()}`,
            date: new Date().toISOString(),
            author: "ولي الأمر",
            summary: "تم تحديث واعتماد استمارة دعم الطالب ورعايته الصحية",
            changedSections: Object.keys(sectionsChanged),
          },
        ],
      };

      const ok = await onSaveProfile(finalProfile);
      if (ok) {
        setProfile(finalProfile);
        setViewMode("submitted");
      }
    } catch (err) {
      alert("حدث خطأ أثناء إرسال الاستمارة، يرجى المحاولة مجدداً");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-4 animate-spin text-teal-600">
            <HeartPulse className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">جاري تحميل استمارة دعم الطالب...</h3>
          <p className="text-sm text-slate-500 mt-1">يرجى الانتظار لحظات</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl p-8 border border-rose-200 shadow-sm max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">تعذر فتح الاستمارة</h3>
          <p className="text-sm text-rose-600 mt-2">{error || "رابط الاستمارة غير متوفر"}</p>
          <p className="text-xs text-slate-500 mt-4">
            يرجى التأكد من استخدام الرابط المرسل عبر واتساب أو التواصل مع إدارة ثانوية الأبناء الأولى - التوجيه الطلابي.
          </p>
        </div>
      </div>
    );
  }

  // 1. Phone Lock & Security Gate
  if (!isPhoneVerified) {
    const isFirstTime = !profile.isActivated || !profile.activatedPhone;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-3 text-teal-700 shadow-xs">
              <HeartPulse className="w-7 h-7" />
            </div>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
              ثانوية الأبناء الأولى — التوجيه الطلابي
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-3">ملف دعم الطالب والمتابعة الصحية</h2>
            <p className="text-sm text-slate-600 mt-1">
              مرحباً بكم ولي أمر الطالب: <span className="font-bold text-slate-800">{profile.studentName}</span>
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-right">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  {isFirstTime ? "تفعيل الرابط وتوثيق الأمان" : "التحقق من هوية ولي الأمر"}
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {isFirstTime
                    ? "حرصاً على سرية معلومات الطالب، سيتم ربط هذا الرابط برقم الجوال الذي تقوم بإدخاله الآن لأول مرة، ولن يُقبل أي تحديث لاحق إلا من نفس الرقم."
                    : "هذا الرابط موثق ومقفل على رقم جوال ولي الأمر المعتمد. يرجى إدخال رقم الجوال للمتابعة."}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleVerifyPhone} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 text-right">
                رقم جوال ولي الأمر المسجل في المدرسة
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 text-center font-mono text-base tracking-wider outline-hidden transition-all"
                  required
                />
                <Phone className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
              </div>
              {phoneError && (
                <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {phoneError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={verifyingPhone}
              className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md shadow-teal-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {verifyingPhone ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحقق والتفعيل...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{isFirstTime ? "تأكيد وتفعيل الاستمارة" : "دخول إلى ملف الطالب"}</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            بيانات الطالب مشفرة ومحفوظة وفق أعلى معايير الخصوصية المدرسية.
          </p>
        </div>
      </div>
    );
  }

  // 2. Submitted Success Screen
  if (viewMode === "submitted") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-md max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">تم إرسال وحفظ استمارة الدعم بنجاح</h2>
          <p className="text-slate-600 text-sm mt-2 leading-relaxed">
            شكراً لتعاونكم واهتمامكم. تم تحويل ملاحظاتكم القيمة إلى فريق التوجيه الطلابي والإرشاد الصحي لتقديم أفضل دعم ممكن لابنكم.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 my-6 text-right text-xs text-slate-600 space-y-2">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-400">الطالب:</span>
              <span className="font-bold text-slate-800">{profile.studentName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-400">تاريخ التحديث:</span>
              <span className="font-bold text-slate-800">
                {profile.lastUpdatedAt ? new Date(profile.lastUpdatedAt).toLocaleDateString("ar-SA") : "الآن"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ملاحظة مهمة:</span>
              <span className="text-teal-700 font-medium">يمكنكم العودة وتحديث البيانات في أي وقت يطرأ فيه جديد عبر نفس الرابط.</span>
            </div>
          </div>

          <button
            onClick={() => setViewMode("home")}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>العودة لصفحة ملف الطالب</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Parent Home Dashboard View
  if (viewMode === "home") {
    const isCompleted = profile.status === "completed";
    const lastUpdateStr = profile.lastUpdatedAt
      ? new Date(profile.lastUpdatedAt).toLocaleDateString("ar-SA")
      : "لم يتم التحديث بعد";

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold border border-teal-100">
                  <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                  ثانوية الأبناء الأولى — بوابة ولي الأمر
                </span>
                <h1 className="text-2xl font-black text-slate-900 mt-2">منصة دعم ورعاية الطالب</h1>
                <p className="text-sm text-slate-600 mt-1">
                  أهلاً بك يا سيد <span className="font-bold text-slate-800">{profile.guardianName || "ولي الأمر"}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200">
                  جوال التفعيل: <span className="font-mono font-bold">{profile.activatedPhone || profile.guardianPhone}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Privacy Notice Card */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-900 leading-relaxed flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <p>
              المعلومات التي تقدمها ستستخدم لمساعدة المدرسة على توفير الدعم المناسب للطالب. سيتم الوصول إلى المعلومات وفق الصلاحيات المعتمدة، وقد تتم مشاركة المعلومات الضرورية فقط مع الموظفين المعنيين بسلامة الطالب ودعمه داخل الصف.
            </p>
          </div>

          {/* Student Card Overview */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <span className="text-xs text-slate-400">الطالب المسجل</span>
                <h2 className="text-xl font-bold text-slate-900">{profile.studentName}</h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span>الصف: <strong className="text-slate-700">{profile.grade || "الأول الثانوي"}</strong></span>
                  <span>•</span>
                  <span>الفصل: <strong className="text-slate-700">{profile.className || "1"}</strong></span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-400 block mb-1">حالة الملف</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isCompleted ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {isCompleted ? "الملف مكتمل" : "قيد الاستكمال"}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                <span>نسبة اكتمال ملف الطالب</span>
                <span className="font-bold text-teal-700">{profile.completionPercentage}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, profile.completionPercentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>آخر تحديث: {lastUpdateStr}</span>
                {profile.completionPercentage < 100 && (
                  <span className="text-amber-600 font-medium">باقي خطوات لاستكمال الملف كاملاً</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setViewMode("form");
                  setCurrentStep(1);
                }}
                className="flex-1 py-3.5 px-5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-5 h-5" />
                <span>{isCompleted ? "مراجعة وتحديث المعلومات" : "استكمال ملف الطالب الآن"}</span>
              </button>
            </div>
          </div>

          {/* Quick Summary of Existing Info */}
          {isCompleted && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                ملخص المعلومات المسجلة حالياً
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">الحالة الصحية المستمرة</span>
                  <span className="font-bold text-slate-700">
                    {profile.hasChronicCondition === "yes" ? (profile.conditionTypes || []).join("، ") || "نعم" : "لا توجد"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">الأدوية والحساسيات</span>
                  <span className="font-bold text-slate-700">
                    {profile.hasAllergies === "yes" ? `حساسية (${profile.allergyDetails?.types?.join("، ") || "مسجلة"})` : "لا توجد حساسية"}
                    {profile.takesRegularMedication === "yes" ? " • يتناول أدوية" : ""}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">الأساليب التعليمية المعينة</span>
                  <span className="font-bold text-slate-700">
                    {(profile.helpfulLearningStrategies || []).slice(0, 2).join("، ") || "لم تسجل أساليب خاصة"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">التفاعل مع الزملاء</span>
                  <span className="font-bold text-slate-700">
                    {profile.peerRelationshipQuality === "very_good" ? "جيد جداً" :
                     profile.peerRelationshipQuality === "good" ? "جيد" :
                     profile.peerRelationshipQuality === "needs_support" ? "يحتاج دعماً" : "طبيعي"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Dynamic Multi-Step Form View (10 Stages + Review)
  const TOTAL_STEPS = 11;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Form Header & Progress Bar */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMode("home")}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer py-1 px-2.5 rounded-lg hover:bg-slate-100"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لصفحة الطالب</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingDraft ? "جاري الحفظ..." : "حفظ مسودة"}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
              <span>المرحلة {currentStep} من {TOTAL_STEPS}</span>
              <span className="text-teal-700">
                {currentStep === 1 && "البيانات الأساسية للطالب"}
                {currentStep === 2 && "الصحة الجسدية"}
                {currentStep === 3 && "الأدوية والحساسيات والطوارئ"}
                {currentStep === 4 && "الصحة النفسية والانفعالية"}
                {currentStep === 5 && "السلوك والملاحظات"}
                {currentStep === 6 && "التعلم والاحتياجات التعليمية"}
                {currentStep === 7 && "الوضع الاجتماعي والأسري"}
                {currentStep === 8 && "المعلومات الخاصة بالمرشد"}
                {currentStep === 9 && "العلاقات الاجتماعية والزملاء"}
                {currentStep === 10 && "ما الذي يساعد الطالب؟"}
                {currentStep === 11 && "المراجعة والإرسال النهائي"}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>

          {saveSuccessMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* STEP CONTENT */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
          {/* STEP 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 1
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">بيانات الطالب الأساسية</h3>
                <p className="text-xs text-slate-500 mt-1">
                  تم استيراد هذه البيانات تلقائياً من نظام المدرسة لتسهيل الأمر عليكم دون إعادة كتابتها.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                <div>
                  <span className="text-xs text-slate-400 block">اسم الطالب</span>
                  <strong className="text-sm text-slate-800">{profile.studentName}</strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">رقم الهوية / السجل</span>
                  <strong className="text-sm font-mono text-slate-800">{profile.nationalId || profile.studentId || "مسجل"}</strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">الصف الدراسي</span>
                  <strong className="text-sm text-slate-800">{profile.grade || "المرحلة الثانوية"}</strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">الفصل / الشعبة</span>
                  <strong className="text-sm text-slate-800">{profile.className || "1"}</strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">اسم ولي الأمر</span>
                  <strong className="text-sm text-slate-800">{profile.guardianName || "ولي الأمر"}</strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">رقم التواصل المعتمد</span>
                  <strong className="text-sm font-mono text-slate-800">{profile.activatedPhone || profile.guardianPhone}</strong>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.basicInfoConfirmed}
                    onChange={(e) => updateField(p => ({ ...p, basicInfoConfirmed: e.target.checked }))}
                    className="w-4 h-4 text-teal-600 rounded-sm border-slate-300 focus:ring-teal-500"
                  />
                  <span>أؤكد صحة البيانات الأساسية الموضحة أعلاه</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Physical Health (Dynamic Branching) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 2
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">الصحة الجسدية</h3>
                <p className="text-xs text-slate-500 mt-1">
                  نطلب هذه المعلومات لمساعدة المدرسة على توفير بيئة صفية آمنة ومراعية لاحتياجات الطالب.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-800">
                  هل لدى الطالب حالة صحية مستمرة أو مزمنة تحتاج المدرسة إلى معرفتها؟
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "no", label: "لا" },
                    { id: "yes", label: "نعم" },
                    { id: "unknown", label: "لا أعلم" },
                    { id: "prefer_not_to_answer", label: "أفضل عدم الإجابة" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField(p => ({ ...p, hasChronicCondition: opt.id as GeneralResponseChoice }))}
                      className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profile.hasChronicCondition === opt.id
                          ? "bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Branch: Only if 'yes' */}
              {profile.hasChronicCondition === "yes" && (
                <div className="space-y-5 p-5 bg-teal-50/50 border border-teal-200/80 rounded-2xl animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-teal-950 mb-2">
                      ما نوع الحالة الصحية؟ (يمكن تحديد أكثر من خيار)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        "الربو",
                        "السكري",
                        "الحساسية",
                        "الصرع",
                        "أمراض القلب",
                        "مشاكل التنفس",
                        "مشاكل النظر",
                        "مشاكل السمع",
                        "حالة صحية مؤقتة",
                        "حالة أخرى",
                      ].map((item) => {
                        const isSelected = (profile.conditionTypes || []).includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              updateField(p => {
                                const current = p.conditionTypes || [];
                                return {
                                  ...p,
                                  conditionTypes: isSelected ? current.filter(c => c !== item) : [...current, item],
                                };
                              });
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-medium text-right border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-teal-50/60"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-950 mb-2">
                      هل تؤثر الحالة الصحية على الطالب داخل المدرسة؟
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        "النشاط البدني",
                        "التركيز",
                        "الحضور",
                        "المشاركة في الأنشطة",
                        "تناول الطعام",
                        "الجلوس لفترات طويلة",
                        "الاختبارات",
                        "لا تؤثر حالياً",
                        "أخرى",
                      ].map((item) => {
                        const isSelected = (profile.schoolImpacts || []).includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              updateField(p => {
                                const current = p.schoolImpacts || [];
                                return {
                                  ...p,
                                  schoolImpacts: isSelected ? current.filter(c => c !== item) : [...current, item],
                                };
                              });
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-medium text-right border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-teal-50/60"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-950 mb-1.5">
                      ما الذي ينبغي على المدرسة مراعاته؟
                    </label>
                    <textarea
                      rows={3}
                      value={profile.schoolHealthNotes || ""}
                      onChange={(e) => updateField(p => ({ ...p, schoolHealthNotes: e.target.value }))}
                      placeholder="اذكر أي توجيهات محددة ترغب بإحاطة المعلمين أو الإرشاد الصحي بها..."
                      className="w-full p-3 bg-white border border-teal-200 rounded-xl text-xs text-slate-800 outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Medications, Allergies & Emergency Flag */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 3
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">الأدوية والحساسيات والطوارئ</h3>
                <p className="text-xs text-slate-500 mt-1">
                  تساعد هذه المعلومات فريق الإرشاد الصحي في التعامل السريع والدقيق في حالات الطوارئ.
                </p>
              </div>

              {/* Medications Question */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <label className="block text-sm font-bold text-slate-800">
                  هل يتناول الطالب أدوية بشكل منتظم؟
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "no", label: "لا" },
                    { id: "yes", label: "نعم" },
                    { id: "unknown", label: "لا أعلم" },
                    { id: "prefer_not_to_answer", label: "أفضل عدم الإجابة" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField(p => ({ ...p, takesRegularMedication: opt.id as GeneralResponseChoice }))}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profile.takesRegularMedication === opt.id
                          ? "bg-teal-50 border-teal-500 text-teal-900"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {profile.takesRegularMedication === "yes" && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mt-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 mb-1">اسم الدواء</label>
                        <input
                          type="text"
                          value={profile.medicationDetails?.name || ""}
                          onChange={(e) => updateField(p => ({
                            ...p,
                            medicationDetails: { ...(p.medicationDetails || {} as any), name: e.target.value }
                          }))}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                          placeholder="مثال: بخاخ فينتولين"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">سبب الاستخدام</label>
                        <input
                          type="text"
                          value={profile.medicationDetails?.reason || ""}
                          onChange={(e) => updateField(p => ({
                            ...p,
                            medicationDetails: { ...(p.medicationDetails || {} as any), reason: e.target.value }
                          }))}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                          placeholder="مثال: حساسية الصدر والربو"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-1">
                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.medicationDetails?.neededDuringSchool === "yes"}
                          onChange={(e) => updateField(p => ({
                            ...p,
                            medicationDetails: { ...(p.medicationDetails || {} as any), neededDuringSchool: e.target.checked ? "yes" : "no" }
                          }))}
                          className="rounded text-teal-600"
                        />
                        <span>يحتاج الطالب إلى الدواء أثناء الدوام المدرسي</span>
                      </label>

                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.medicationDetails?.hasEmergencyMedication === "yes"}
                          onChange={(e) => updateField(p => ({
                            ...p,
                            medicationDetails: { ...(p.medicationDetails || {} as any), hasEmergencyMedication: e.target.checked ? "yes" : "no" }
                          }))}
                          className="rounded text-teal-600"
                        />
                        <span>يوجد دواء طوارئ بحوزة الطالب أو في العيادة</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Allergies Question */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <label className="block text-sm font-bold text-slate-800">
                  هل لدى الطالب حساسية معروفة؟
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "no", label: "لا" },
                    { id: "yes", label: "نعم" },
                    { id: "unknown", label: "لا أعلم" },
                    { id: "prefer_not_to_answer", label: "أفضل عدم الإجابة" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField(p => ({ ...p, hasAllergies: opt.id as GeneralResponseChoice }))}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profile.hasAllergies === opt.id
                          ? "bg-teal-50 border-teal-500 text-teal-900"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {profile.hasAllergies === "yes" && (
                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-amber-950 mb-1.5">نوع الحساسية:</label>
                      <div className="flex flex-wrap gap-2">
                        {["غذائية", "دوائية", "حشرات", "بيئية", "جلدية", "أخرى"].map((t) => {
                          const isSel = (profile.allergyDetails?.types || []).includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateField(p => {
                                const cur = p.allergyDetails?.types || [];
                                return {
                                  ...p,
                                  allergyDetails: {
                                    ...(p.allergyDetails || {} as any),
                                    types: isSel ? cur.filter(x => x !== t) : [...cur, t]
                                  }
                                };
                              })}
                              className={`px-3 py-1.5 rounded-lg border font-medium ${
                                isSel ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-700 border-amber-200"
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-amber-950 mb-1 font-bold">شدة التفاعل السابق:</label>
                        <select
                          value={profile.allergyDetails?.severity || "mild"}
                          onChange={(e) => updateField(p => ({
                            ...p,
                            allergyDetails: { ...(p.allergyDetails || {} as any), severity: e.target.value as any }
                          }))}
                          className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                        >
                          <option value="mild">بسيطة</option>
                          <option value="moderate">متوسطة</option>
                          <option value="severe_emergency">شديدة / طارئة</option>
                          <option value="unknown">غير معروف</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-amber-950 mb-1 font-bold">ما الذي يجب على المدرسة فعله عند حدوثها؟</label>
                        <input
                          type="text"
                          value={profile.allergyDetails?.schoolAction || ""}
                          onChange={(e) => updateField(p => ({
                            ...p,
                            allergyDetails: { ...(p.allergyDetails || {} as any), schoolAction: e.target.value }
                          }))}
                          placeholder="مثال: إعطاء البخاخ والاتصال بولي الأمر"
                          className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    {/* Clear Emergency Flag Option */}
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                      <label className="flex items-center gap-2.5 text-rose-900 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!profile.allergyDetails?.isEmergencyNotice}
                          onChange={(e) => updateField(p => ({
                            ...p,
                            allergyDetails: { ...(p.allergyDetails || {} as any), isEmergencyNotice: e.target.checked }
                          }))}
                          className="w-4 h-4 text-rose-600 rounded"
                        />
                        <span>هذه المعلومة مهمة جداً للطوارئ (تفعيل تنبيه الخطر المباشر Emergency Flag)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* EMERGENCY SECTION - VISUALLY DISTINCT */}
              <div className="p-5 bg-gradient-to-br from-rose-50 to-orange-50 border-2 border-rose-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>قسم الطوارئ — معلومات وتدخلات عاجلة</span>
                </div>

                <p className="text-xs text-rose-900/80 leading-relaxed">
                  تظهر هذه البيانات فقط للمرشد الصحي والمسؤولين المخولين لضمان سلامة الطالب الفورية.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-rose-950 font-bold mb-1">جهة الاتصال الأولى في الطوارئ:</label>
                    <input
                      type="text"
                      value={profile.emergencyInfo?.primaryContact?.name || profile.guardianName || ""}
                      onChange={(e) => updateField(p => ({
                        ...p,
                        emergencyInfo: {
                          ...(p.emergencyInfo || {} as any),
                          primaryContact: { ...(p.emergencyInfo?.primaryContact || {} as any), name: e.target.value }
                        }
                      }))}
                      placeholder="الاسم والقرابة (مثال: الأب)"
                      className="w-full p-2 bg-white border border-rose-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-rose-950 font-bold mb-1">رقم الهاتف الأول:</label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={profile.emergencyInfo?.primaryContact?.phone || profile.activatedPhone || profile.guardianPhone || ""}
                      onChange={(e) => updateField(p => ({
                        ...p,
                        emergencyInfo: {
                          ...(p.emergencyInfo || {} as any),
                          primaryContact: { ...(p.emergencyInfo?.primaryContact || {} as any), phone: e.target.value }
                        }
                      }))}
                      placeholder="05xxxxxxxx"
                      className="w-full p-2 bg-white border border-rose-200 rounded-lg text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-rose-950 font-bold mb-1">جهة اتصال بديلة (اختياري):</label>
                    <input
                      type="text"
                      value={profile.emergencyInfo?.secondaryContact?.name || ""}
                      onChange={(e) => updateField(p => ({
                        ...p,
                        emergencyInfo: {
                          ...(p.emergencyInfo || {} as any),
                          secondaryContact: { ...(p.emergencyInfo?.secondaryContact || {} as any), name: e.target.value }
                        }
                      }))}
                      placeholder="الاسم والقرابة (مثال: العم / الأخ)"
                      className="w-full p-2 bg-white border border-rose-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-rose-950 font-bold mb-1">هاتف الجهة البديلة:</label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={profile.emergencyInfo?.secondaryContact?.phone || ""}
                      onChange={(e) => updateField(p => ({
                        ...p,
                        emergencyInfo: {
                          ...(p.emergencyInfo || {} as any),
                          secondaryContact: { ...(p.emergencyInfo?.secondaryContact || {} as any), phone: e.target.value }
                        }
                      }))}
                      placeholder="05xxxxxxxx"
                      className="w-full p-2 bg-white border border-rose-200 rounded-lg text-xs font-mono text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-950 mb-1">
                    ما العلامات التي يجب الانتباه إليها والإجراء الأولي المطلوب؟
                  </label>
                  <input
                    type="text"
                    value={profile.emergencyInfo?.warningSigns || ""}
                    onChange={(e) => updateField(p => ({
                      ...p,
                      emergencyInfo: { ...(p.emergencyInfo || {} as any), warningSigns: e.target.value }
                    }))}
                    placeholder="مثال: ضيق في التنفس أو شحوب، إعطاؤه البخاخ فوراً ونقله للعيادة"
                    className="w-full p-2.5 bg-white border border-rose-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Emotional & Wellbeing (Observable, Non-diagnostic) */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 4
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">الصحة النفسية والانفعالية</h3>
                <p className="text-xs text-slate-500 mt-1">
                  أسئلة مبنية على الملاحظة اليومية البسيطة. لا يقدم النظام أي تشخيص طبي أو نفسي آلي، وإنما يساعد في المتابعة الوقائية.
                </p>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                خلال الأشهر الأخيرة، هل لاحظتم تغيراً في الأمور التالية؟
              </div>

              <div className="space-y-3">
                {[
                  { key: "isolation", label: "الانعزال أو تجنب الجلوس مع الأسرة/الأقران" },
                  { key: "anxiety", label: "القلق المفرط أو التوتر قبل الدوام/الاختبارات" },
                  { key: "irritability", label: "سرعة الانفعال أو الغضب السريع" },
                  { key: "sleepDisturbance", label: "اضطراب في النوم (صعوبة النوم أو كثرته)" },
                  { key: "appetiteChange", label: "تغير ملحوظ في الشهية أو تناول الطعام" },
                  { key: "concentrationDifficulty", label: "صعوبة في التركيز أو التشتت السريع" },
                  { key: "lowMotivation", label: "انخفاض الدافعية للذهاب إلى المدرسة أو أداء الواجبات" },
                  { key: "lossOfInterest", label: "فقدان الاهتمام بالهوايات أو الأنشطة المحببة لديه" },
                  { key: "fatigueComplaints", label: "كثرة الشكوى من التعب أو الصداع دون سبب عضوي واضح" },
                ].map((item) => {
                  const currentValue = (profile.emotionalObservations as any)?.[item.key] || "unknown";
                  return (
                    <div key={item.key} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-800">{item.label}</div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {[
                          { id: "none", label: "لم نلاحظ" },
                          { id: "sometimes", label: "أحياناً" },
                          { id: "frequent", label: "متكرر" },
                          { id: "unknown", label: "لا أعلم" },
                          { id: "prefer_not_to_answer", label: "أفضل عدم الإجابة" },
                        ].map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => updateField(p => ({
                              ...p,
                              emotionalObservations: {
                                ...(p.emotionalObservations || {} as any),
                                [item.key]: choice.id as FrequencyChoice,
                              }
                            }))}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                              currentValue === choice.id
                                ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: Behavior */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 5
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">السلوك والتنظيم الذاتي</h3>
                <p className="text-xs text-slate-500 mt-1">
                  ما الصعوبات التي قد تلاحظونها في تعامل الطالب وسلوكه اليومي؟
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { key: "followingInstructions", label: "الالتزام بالتعليمات والإرشادات المدرسية" },
                  { key: "emotionalRegulation", label: "ضبط الانفعال عند مواجهة المواقف الصعبة" },
                  { key: "peerInteraction", label: "التعامل بإيجابية واحترام مع الزملاء" },
                  { key: "waitingTurn", label: "الصبر وانتظار الدور في الأنشطة" },
                  { key: "focus", label: "المحافظة على التركيز أثناء الشرح أو إتمام الواجبات" },
                  { key: "completingTasks", label: "إكمال المهام الموكلة إليه حتى النهاية" },
                  { key: "activityTransitions", label: "الانتقال السلس بين حصة وأخرى أو نشاط وآخر" },
                  { key: "expressingNeeds", label: "التعبير عن مشاعره واحتياجاته بوضوح" },
                  { key: "handlingCriticism", label: "تقبل التوجيه والنصح دون تحسس مفرط" },
                  { key: "handlingChange", label: "التعامل مع التغيير المفاجئ في الجدول أو المكان" },
                ].map((item) => {
                  const val = (profile.behaviorDifficulties as any)?.[item.key] || "unknown";
                  return (
                    <div key={item.key} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-800">{item.label}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {[
                          { id: "none", label: "لا توجد مشكلة" },
                          { id: "sometimes", label: "أحياناً" },
                          { id: "frequent", label: "متكرر" },
                          { id: "affects_study", label: "يؤثر على الدراسة" },
                          { id: "unknown", label: "لا أعلم" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateField(p => ({
                              ...p,
                              behaviorDifficulties: {
                                ...(p.behaviorDifficulties || {} as any),
                                [item.key]: opt.id as BehaviorChoice,
                              }
                            }))}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                              val === opt.id
                                ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: Learning Needs & Strategies for Teacher */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 6
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">التعلم والاحتياجات التعليمية</h3>
                <p className="text-xs text-slate-500 mt-1">
                  تساعد هذه الإجابات في إعداد "بطاقة دعم الطالب للمعلم" داخل الصف لمراعاة أسلوب تعلمه الأنسب.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  هل يواجه الطالب صعوبات في أي من المجالات التالية؟ (اختر ما ينطبق)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "القراءة",
                    "الكتابة",
                    "الحساب والرياضيات",
                    "التركيز أثناء الدرس",
                    "الحفظ والاسترجاع",
                    "فهم التعليمات المركبة",
                    "تنظيم الوقت والدفاتر",
                    "حل الواجبات المنزلية",
                    "الاختبارات والقلق منها",
                  ].map((diff) => {
                    const isSel = (profile.learningDifficulties || []).includes(diff);
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => updateField(p => {
                          const cur = p.learningDifficulties || [];
                          return {
                            ...p,
                            learningDifficulties: isSel ? cur.filter(x => x !== diff) : [...cur, diff],
                          };
                        })}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium text-right transition-all cursor-pointer ${
                          isSel ? "bg-teal-600 text-white border-teal-600" : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {diff}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  ما البيئة أو الأساليب التي تساعد الطالب على التعلم بشكل أفضل؟ (مهمة لبطاقة المعلم)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "الهدوء وتقليل المشتتات",
                    "تعليمات قصيرة ومباشرة",
                    "التكرار والتأكيد",
                    "الصور والأمثلة العملية",
                    "وقت إضافي في المهام",
                    "تقسيم المهمة إلى خطوات",
                    "الجلوس بالقرب من المعلم",
                    "العمل الفردي",
                    "العمل الجماعي مع أقران",
                    "التعزيز الإيجابي والتشجيع",
                    "أخرى",
                  ].map((strat) => {
                    const isSel = (profile.helpfulLearningStrategies || []).includes(strat);
                    return (
                      <button
                        key={strat}
                        type="button"
                        onClick={() => updateField(p => {
                          const cur = p.helpfulLearningStrategies || [];
                          return {
                            ...p,
                            helpfulLearningStrategies: isSel ? cur.filter(x => x !== strat) : [...cur, strat],
                          };
                        })}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium text-right transition-all cursor-pointer ${
                          isSel ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {strat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Family & Social Circumstances (Sensitive) */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 7
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">الوضع الاجتماعي والأسري</h3>
                <p className="text-xs text-slate-500 mt-1">
                  نقدر عالياً خصوصيتكم. يتم التعامل مع هذا القسم بحساسية وسرية تامة لمراعاة أي ظروف طارئة تؤثر على الطالب.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-800">
                  هل توجد ظروف حالية قد تؤثر على حضور الطالب أو تركيزه أو حالته النفسية أو تفاعله داخل المدرسة؟
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "no", label: "لا" },
                    { id: "yes", label: "نعم" },
                    { id: "unknown", label: "لا أعلم" },
                    { id: "prefer_counselor_private", label: "أفضل التواصل مع المختص بشكل خاص" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField(p => ({ ...p, hasFamilyCircumstances: opt.id as any }))}
                      className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profile.hasFamilyCircumstances === opt.id
                          ? "bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {profile.hasFamilyCircumstances === "yes" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
                  <label className="block font-bold text-slate-800">طبيعة الظرف (اختر ما ينطبق):</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      "تغير في السكن أو الانتقال",
                      "تغير في ظروف الأسرة",
                      "فقد شخص قريب",
                      "تغير في الرعاية أو السفر",
                      "مسؤوليات أسرية إضافية",
                      "ظروف اجتماعية أو مالية",
                      "مشكلة اجتماعية",
                      "أخرى",
                    ].map((item) => {
                      const isSel = (profile.circumstanceTypes || []).includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => updateField(p => {
                            const cur = p.circumstanceTypes || [];
                            return {
                              ...p,
                              circumstanceTypes: isSel ? cur.filter(x => x !== item) : [...cur, item],
                            };
                          })}
                          className={`py-2 px-3 rounded-lg border text-xs text-right ${
                            isSel ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <label className="block font-bold text-slate-800 mb-1">تفاصيل إضافية (اختياري):</label>
                    <textarea
                      rows={2}
                      value={profile.circumstanceDetails || ""}
                      onChange={(e) => updateField(p => ({ ...p, circumstanceDetails: e.target.value }))}
                      placeholder="يمكنك كتابة ما تود توضيحه للمرشد الطلابي لمساندة الطالب..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 8: Confidential Note (COUNSELOR ONLY) */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 8
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">معلومات سرية للتوجيه الطلابي فقط</h3>
                <p className="text-xs text-slate-500 mt-1">
                  هذه الصفحة مخصصة للمعلومات الخاصة التي ترغب بأن تظل محصورة لدى المرشد الطلابي والإدارة فقط دون مشاركتها مع المعلمين.
                </p>
              </div>

              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-start gap-3">
                <EyeOff className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900 leading-relaxed">
                  <strong className="block mb-1">مستوى السرية: المرشد الطلابي فقط (COUNSELOR_ONLY)</strong>
                  نضمن لك عدم ظهور أي نص يكتب في هذا القسم في بطاقة المعلم أو إتاحتها لغير المختصين بالتوجيه الطلابي.
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-800">
                  هل هناك أمر شخصي تفضل أن يعرفه المختص في المدرسة دون مشاركته مع المعلمين؟
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  {[
                    { id: "no", label: "لا يوجد شيء إضافي" },
                    { id: "yes", label: "نعم، أود تدوين ملاحظة خاصة" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField(p => ({ ...p, hasConfidentialNote: opt.id as any }))}
                      className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profile.hasConfidentialNote === opt.id
                          ? "bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {profile.hasConfidentialNote === "yes" && (
                  <div className="pt-2 animate-fadeIn">
                    <textarea
                      rows={4}
                      value={profile.confidentialNote || ""}
                      onChange={(e) => updateField(p => ({ ...p, confidentialNote: e.target.value }))}
                      placeholder="اكتب هنا ما تود إحاطة المرشد الطلابي به بشكل خاص..."
                      className="w-full p-3.5 bg-white border border-purple-300 rounded-2xl text-xs text-slate-800 outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 9: Social Relations & Peer Experiences */}
          {currentStep === 9 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 9
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">العلاقات الاجتماعية والتفاعل مع الأقران</h3>
                <p className="text-xs text-slate-500 mt-1">
                  يهدف هذا القسم للتعرف على جودة اندماج الطالب في البيئة المدرسية لحمايته وتعزيز علاقاته الإيجابية.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-800">
                  كيف يتعامل الطالب عادةً مع زملائه في المدرسة؟
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "very_good", label: "جيد جداً ويندمج بسهولة" },
                    { id: "good", label: "جيد ولديه أصدقاء" },
                    { id: "needs_support", label: "يحتاج دعماً وتشجيعاً" },
                    { id: "struggles", label: "يواجه صعوبة في تكوين علاقات" },
                    { id: "unknown", label: "لا أعلم" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField(p => ({ ...p, peerRelationshipQuality: opt.id as any }))}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-medium text-right transition-all cursor-pointer ${
                        profile.peerRelationshipQuality === opt.id
                          ? "bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20 font-bold"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <label className="block text-sm font-bold text-slate-800">
                  هل سبق أن ذكر الطالب تعرضه لأي من الأمور التالية في المدرسة؟
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "تنمر أو مضايقات كلامية",
                    "عزلة اجتماعية وتجنب الزملاء له",
                    "خلافات متكررة مع أقرانه",
                    "مضايقات إلكترونية",
                    "لا شيء والحمد لله",
                    "لا أعلم",
                    "أفضل عدم الإجابة",
                  ].map((exp) => {
                    const isSel = (profile.negativeExperiences || []).includes(exp);
                    return (
                      <button
                        key={exp}
                        type="button"
                        onClick={() => updateField(p => {
                          const cur = p.negativeExperiences || [];
                          return {
                            ...p,
                            negativeExperiences: isSel ? cur.filter(x => x !== exp) : [...cur, exp],
                          };
                        })}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-medium text-right transition-all cursor-pointer ${
                          isSel ? "bg-teal-600 text-white border-teal-600" : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {exp}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 10: What Helps & The Main Open Question */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 10
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">ما الذي يساعد الطالب؟</h3>
                <p className="text-xs text-slate-500 mt-1">
                  رأيكم كولي أمر هو الركيزة الأساسية لفهم الطريقة المثلى للتعامل مع ابنكم وإشعاره بالأمان والنجاح.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  ما الأمور التي تساعد ابنك على الشعور بالأمان والتعلم بشكل أفضل؟ (اختر ما تراه مناسباً)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    "تعليمات واضحة ومختصرة",
                    "وقت إضافي لإنجاز المهام",
                    "التنبيه قبل تغيير الروتين أو الأنشطة",
                    "بيئة هادئة وتجنب الأصوات العالية",
                    "إتاحة فترات راحة قصيرة",
                    "التشجيع والتعزيز الإيجابي المستمر",
                    "الدعم في تكوين العلاقات مع الزملاء",
                    "عدم التحدث أمامه أو توجيه السؤال له بشكل مفاجئ",
                    "أخرى",
                  ].map((pref) => {
                    const isSel = (profile.supportPreferences || []).includes(pref);
                    return (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => updateField(p => {
                          const cur = p.supportPreferences || [];
                          return {
                            ...p,
                            supportPreferences: isSel ? cur.filter(x => x !== pref) : [...cur, pref],
                          };
                        })}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-medium text-right transition-all cursor-pointer ${
                          isSel ? "bg-teal-600 text-white border-teal-600 font-bold" : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {pref}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* The Main Open-Ended Question */}
              <div className="pt-2 p-5 bg-teal-50/60 border border-teal-200/80 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-teal-950">
                  لو كان بإمكان المدرسة معرفة شيء واحد عن ابنك يساعدنا على دعمه ورعايته بشكل أفضل، ماذا تتمنى أن نعرف؟
                </label>
                <textarea
                  rows={3}
                  value={profile.oneThingSchoolShouldKnow || ""}
                  onChange={(e) => updateField(p => ({ ...p, oneThingSchoolShouldKnow: e.target.value }))}
                  placeholder="اكتب هنا أي شيء تود أن يعرفه فريق التوجيه والمعلمون..."
                  className="w-full p-3 bg-white border border-teal-300 rounded-xl text-xs text-slate-800 outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          {/* STEP 11: Review, Consent & Submission */}
          {currentStep === 11 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  المرحلة 11
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">المراجعة والإرسال النهائي</h3>
                <p className="text-xs text-slate-500 mt-1">
                  يرجى مراجعة ملخص الإجابات قبل التأكيد النهائي. يمكنكم دائماً العودة وتحديث أي قسم متى أردتم.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="space-y-3 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-1">
                    ملخص ملف دعم الطالب ({profile.studentName})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-400 block">الصحة الجسدية:</span>
                      <strong className="text-slate-700">
                        {profile.hasChronicCondition === "yes" ? (profile.conditionTypes || []).join("، ") || "مسجلة" : "لا توجد حالة مستمرة"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">الأدوية والحساسية:</span>
                      <strong className="text-slate-700">
                        {profile.hasAllergies === "yes" ? "توجد حساسية" : "لا توجد حساسية"} • {profile.takesRegularMedication === "yes" ? "يتناول دواء" : "لا يتناول دواء"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">الأساليب المساعدة:</span>
                      <strong className="text-slate-700">
                        {(profile.helpfulLearningStrategies || []).join("، ") || "عادية"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">العلاقة بالزملاء:</span>
                      <strong className="text-slate-700">
                        {profile.peerRelationshipQuality || "طبيعي"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-3">
                  <label className="flex items-start gap-2.5 text-xs text-teal-950 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.privacyConsentAccepted}
                      onChange={(e) => updateField(p => ({ ...p, privacyConsentAccepted: e.target.checked }))}
                      className="w-4 h-4 text-teal-600 rounded mt-0.5"
                    />
                    <span className="leading-relaxed">
                      أقر بأن المعلومات المدونة أعلاه صحيحة ودقيقة، وأوافق على استخدامها من قِبل إدارة المدرسة والتوجيه الطلابي والإرشاد الصحي لغرض تقديم الرعاية والدعم المناسب لابني.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-100 mt-6">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>الخطوة السابقة</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="py-2.5 px-6 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>الخطوة التالية</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="py-3 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري الاعتماد والإرسال...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد وإرسال الاستمارة</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
