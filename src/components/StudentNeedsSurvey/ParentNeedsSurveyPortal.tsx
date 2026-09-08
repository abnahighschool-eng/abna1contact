import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Send,
  HelpCircle,
  FileCheck2,
  RotateCcw,
  Sparkles,
  School,
  Lock,
  User,
  Heart,
  BookOpen,
  Users,
  Eye,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import {
  StudentNeedsProfile,
  SurveyResponses,
} from "../../types";

interface ParentNeedsSurveyPortalProps {
  token: string;
  onExit?: () => void;
}

export default function ParentNeedsSurveyPortal({
  token,
  onExit,
}: ParentNeedsSurveyPortalProps) {
  const [profile, setProfile] = useState<StudentNeedsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication by 6-digit PIN
  const [activationCodeInput, setActivationCodeInput] = useState("");
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Form State
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // Default responses state
  const [responses, setResponses] = useState<SurveyResponses>({
    generalStatus: "stable",
    recentChanges: ["لا يوجد تغير ملحوظ"],
    academicDifficulties: "none",
    academicNeeds: ["لا توجد حاجة محددة"],
    academicNeedsOther: "",
    socialRelationships: "good",
    recentImpactingEvent: "no",
    impactingEventNeedsContact: "no",
    behaviorsToMonitor: "no",
    hasHealthInfo: "no",
    healthNeedType: [],
    healthNeedTypeOther: "",
    healthInstructions: "",
    schoolSupportExpected: ["متابعة الطالب"],
    schoolSupportOther: "",
    additionalNotes: "",
  });

  // Load Profile from server
  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/student-needs-survey/token/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "تعذر العثور على رابط الاستبيان أو انتهت صلاحيته");
        }
        const data = await res.json();
        setProfile(data.profile);

        // Pre-fill existing responses if student has submitted before
        if (data.profile?.responses) {
          setResponses((prev) => ({
            ...prev,
            ...data.profile.responses,
          }));
        }

        // Check if code was already verified in this session
        const sessionCode = sessionStorage.getItem(`survey_verified_${token}`);
        if (sessionCode && sessionCode === data.profile?.activationCode) {
          setIsCodeVerified(true);
          setActivationCodeInput(sessionCode);
        }
      } catch (err: any) {
        setError(err.message || "حدث خطأ أثناء تحميل الاستبيان");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadProfile();
    }
  }, [token]);

  // Handle Verify Code
  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activationCodeInput.trim()) {
      setCodeError("يرجى كتابة رمز التفعيل المكون من 6 أرقام");
      return;
    }

    try {
      setVerifyingCode(true);
      setCodeError(null);
      const res = await fetch("/api/student-needs-survey/token/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          code: activationCodeInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "رمز التفعيل غير صحيح، يرجى التأكد من الرمز المرسل إلى جوالكم");
      }

      setIsCodeVerified(true);
      setProfile(data.profile);
      sessionStorage.setItem(`survey_verified_${token}`, activationCodeInput.trim());
      if (data.profile?.responses) {
        setResponses((prev) => ({ ...prev, ...data.profile.responses }));
      }
    } catch (err: any) {
      setCodeError(err.message || "رمز التفعيل غير صحيح");
    } finally {
      setVerifyingCode(false);
    }
  };

  // Handle Submit / Update
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch("/api/student-needs-survey/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          code: activationCodeInput.trim(),
          responses,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "حدث خطأ أثناء حفظ الاستبيان");
      }

      setProfile(data.profile);
      setIsSubmittedSuccess(true);
    } catch (err: any) {
      setError(err.message || "فشل إرسال الاستبيان");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper toggle array item
  const toggleArrayItem = (key: keyof SurveyResponses, item: string) => {
    const current = (responses[key] as string[]) || [];
    let updated: string[];

    if (item === "لا يوجد تغير ملحوظ" || item === "لا توجد حاجة محددة" || item === "لا يحتاج إلى إجراء حالياً") {
      updated = [item];
    } else {
      const filtered = current.filter(
        (x) => x !== "لا يوجد تغير ملحوظ" && x !== "لا توجد حاجة محددة" && x !== "لا يحتاج إلى إجراء حالياً"
      );
      if (filtered.includes(item)) {
        updated = filtered.filter((x) => x !== item);
      } else {
        updated = [...filtered, item];
      }
      if (updated.length === 0) {
        if (key === "recentChanges") updated = ["لا يوجد تغير ملحوظ"];
        if (key === "academicNeeds") updated = ["لا توجد حاجة محددة"];
        if (key === "schoolSupportExpected") updated = ["متابعة الطالب"];
      }
    }

    setResponses((prev) => ({
      ...prev,
      [key]: updated,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 text-center space-y-4">
          <div className="w-14 h-14 bg-teal-50 border border-teal-200 text-teal-700 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-7 h-7 animate-spin text-teal-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">جاري تحميل استبيان الطالب...</h2>
          <p className="text-sm text-slate-500">نظام الرصد الذكي لاحتياجات ودعم الطلاب</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-rose-100 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">تعذر فتح الاستبيان</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
          <div className="pt-2">
            <p className="text-xs text-slate-400">
              يرجى التأكد من فتح الرابط الصحيح المرسل من إدارة المدرسة عبر الواتساب.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- 1. PIN Code Verification Gate Screen ---
  if (!isCodeVerified) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-100 via-white to-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-teal-700 to-teal-800 p-6 text-white text-center relative">
            <div className="w-12 h-12 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <School className="w-6 h-6 text-teal-200" />
            </div>
            <h1 className="text-lg font-black tracking-tight">ثانوية الأبناء الأولى</h1>
            <p className="text-teal-100 text-xs mt-1">استبيان رصد احتياجات الطلاب ودعم الطالب</p>
          </div>

          {/* Student Info Card */}
          <div className="p-6 space-y-6">
            <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-teal-700 font-medium">استمارة الطالب/ـة</div>
                <div className="text-base font-bold text-slate-900 truncate">
                  {profile?.studentName || "طالب"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {profile?.grade || "المرحلة الثانوية"} {profile?.className ? `— شعبة ${profile.className}` : ""}
                </div>
              </div>
            </div>

            {/* Prompt & Description */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
                <KeyRound className="w-5 h-5 text-teal-600" />
                إدخال رمز التفعيل الرقمي
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                نرجو تعبئة الاستبيان بدقة، تستغرق الإجابة بضع دقائق فقط، وتساعدنا المعلومات في تقديم الدعم المناسب للطالب.
                يرجى إدخال رمز التفعيل المكون من 6 أرقام المرسل لجوالكم مع الرابط.
              </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 text-center">
                  رمز التفعيل الرقمي (6 أرقام)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={activationCodeInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9٠-٩]/g, "");
                      setActivationCodeInput(val);
                      setCodeError(null);
                    }}
                    placeholder="مثال: 123456"
                    className="w-full text-center text-2xl sm:text-3xl tracking-[0.35em] font-black py-3 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-teal-600 focus:bg-white focus:outline-hidden transition-all text-slate-900 placeholder:text-slate-300 placeholder:tracking-normal placeholder:text-base placeholder:font-normal"
                    autoFocus
                  />
                  <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {codeError && (
                  <p className="text-xs text-rose-600 mt-2 text-center flex items-center justify-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {codeError}
                  </p>
                )}
              </div>

              {/* Quick Dial Pad on Mobile */}
              <div className="grid grid-cols-3 gap-2 pt-1 sm:hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "مسح", 0, "متابعة"].map((btn) => (
                  <button
                    key={String(btn)}
                    type="button"
                    onClick={() => {
                      if (btn === "مسح") {
                        setActivationCodeInput((prev) => prev.slice(0, -1));
                      } else if (btn === "متابعة") {
                        handleVerifyCode();
                      } else {
                        if (activationCodeInput.length < 6) {
                          setActivationCodeInput((prev) => prev + String(btn));
                        }
                      }
                    }}
                    className={`py-3 rounded-xl font-bold text-base transition-colors ${
                      btn === "متابعة"
                        ? "bg-teal-600 text-white hover:bg-teal-700 text-sm"
                        : btn === "مسح"
                        ? "bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs"
                        : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    {btn}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={verifyingCode || activationCodeInput.length === 0}
                className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {verifyingCode ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <span>متابعة إلى الاستمارة</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="border-t border-slate-100 pt-4 text-center space-y-1">
              <p className="text-xs text-slate-500 font-medium">
                💡 يحق لولي الأمر تحديث الإجابات في أي وقت بإعادة إدخال هذا الرمز
              </p>
              <p className="text-[11px] text-slate-400">
                المعلومات سرية ومحمية وتستخدم لأغراض الرعاية المدرسية فقط
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. Submitted Confirmation Screen ---
  if (isSubmittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans" dir="rtl">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900">تم حفظ الاستبيان بنجاح</h1>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              نشكركم على تعاونكم مع ثانوية الأبناء الأولى. تم استلام إجاباتكم بأمان وستساعدنا في تقديم الرعاية والمتابعة الأنسب للطالب/ـة.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right space-y-2 text-xs text-slate-700">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">اسم الطالب:</span>
              <span className="font-bold text-slate-900">{profile?.studentName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">تاريخ الحفظ:</span>
              <span className="font-mono text-slate-800">
                {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">رمز التفعيل المعتمد:</span>
              <span className="font-mono font-bold text-teal-700 tracking-wider text-sm bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                {activationCodeInput}
              </span>
            </div>
          </div>

          <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 text-xs text-teal-800 leading-relaxed text-right flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <strong>تحديث البيانات متى ما تطلب ذلك:</strong>
              <br />
              يمكنكم في أي وقت الدخول لنفس الرابط وإعادة إدخال نفس رمز التفعيل لتحديث حالة الطالب ومراجعة الاستمارة متى ما طرأ أي جديد.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setIsSubmittedSuccess(false);
                setStep(1);
              }}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>مراجعة أو تعديل الإجابات</span>
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                إغلاق الاستمارة
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- 3. The 5-Step Smart Progressive Survey ---
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-100 via-slate-50 to-white flex flex-col items-center p-3 sm:p-6 font-sans" dir="rtl">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col">
        {/* Sticky Header */}
        <div className="bg-teal-800 text-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-teal-300" />
                <span className="text-xs font-bold text-teal-200">ثانوية الأبناء الأولى</span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                استبيان احتياجات ودعم الطالب
              </h1>
            </div>
            <div className="text-left bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-xs">
              <span className="text-teal-200 block text-[10px]">الطالب/ـة</span>
              <span className="font-bold text-white truncate max-w-[140px] inline-block">
                {profile?.studentName}
              </span>
            </div>
          </div>

          {/* Progress Bar & Steps indicator */}
          <div className="mt-4 pt-3 border-t border-teal-700/60">
            <div className="flex items-center justify-between text-xs font-bold text-teal-100 mb-2">
              <span>الخطوة {step} من 5</span>
              <span>
                {step === 1 && "الوضع العام للطالب"}
                {step === 2 && "الجانب الدراسي"}
                {step === 3 && "الجانب الاجتماعي والسلوكي"}
                {step === 4 && "الجانب الصحي الوقائي"}
                {step === 5 && "الدعم المطلوب والملاحظات"}
              </span>
            </div>
            <div className="w-full bg-teal-950/40 rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-300 h-full rounded-full transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-5 sm:p-7 space-y-6 flex-1">
          {/* STEP 1: الوضع العام للطالب */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  الوضع العام للطالب خلال الفترة الأخيرة
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  نظرة عامة على استقرار الطالب وتكيفه اليومي
                </p>
              </div>

              {/* Q1 */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-slate-800">
                  1. كيف تصفون الوضع العام للطالب خلال الفترة الأخيرة؟
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: "very_stable", label: "مستقر جداً" },
                    { id: "stable", label: "مستقر" },
                    { id: "some_changes", label: "توجد بعض التغيرات" },
                    { id: "noticeable_changes", label: "توجد تغيرات ملحوظة" },
                    { id: "needs_attention", label: "يحتاج إلى اهتمام" },
                  ].map((opt) => {
                    const selected = responses.generalStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setResponses((prev) => ({
                            ...prev,
                            generalStatus: opt.id as any,
                          }))
                        }
                        className={`p-3 rounded-2xl text-right font-medium text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                          selected
                            ? "bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2 */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-800">
                  2. هل لاحظتم تغيراً مؤخراً في أي من الجوانب التالية؟{" "}
                  <span className="text-xs font-normal text-slate-500">(يمكن اختيار أكثر من إجابة)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "التحصيل الدراسي",
                    "النوم",
                    "الشهية",
                    "المزاج",
                    "الحضور",
                    "العلاقات الاجتماعية",
                    "السلوك",
                    "لا يوجد تغير ملحوظ",
                  ].map((item) => {
                    const isSelected = responses.recentChanges.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleArrayItem("recentChanges", item)}
                        className={`p-3 rounded-2xl text-center text-xs font-medium border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-teal-600 border-teal-600 text-white font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: الجانب الدراسي */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  الجانب الدراسي والتعليمي
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  رصد التحديات الأكاديمية والاحتياجات التعليمية للطالب
                </p>
              </div>

              {/* Q1 */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-slate-800">
                  1. هل توجد صعوبات تؤثر حالياً في تعلم الطالب؟
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "none", label: "لا توجد صعوبات" },
                    { id: "simple", label: "بسيطة" },
                    { id: "moderate", label: "متوسطة" },
                    { id: "significant", label: "كبيرة" },
                  ].map((opt) => {
                    const selected = responses.academicDifficulties === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setResponses((prev) => ({
                            ...prev,
                            academicDifficulties: opt.id as any,
                          }))
                        }
                        className={`p-3 rounded-2xl text-center font-medium text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                          selected
                            ? "bg-teal-600 border-teal-600 text-white font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2 */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-800">
                  2. أكثر ما يحتاج إليه الطالب حالياً:{" "}
                  <span className="text-xs font-normal text-slate-500">(يمكن اختيار أكثر من خيار)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "تشجيع وتحفيز",
                    "تنظيم الوقت",
                    "متابعة دراسية",
                    "دعم في مادة معينة",
                    "تحسين التركيز",
                    "لا توجد حاجة محددة",
                    "أخرى",
                  ].map((item) => {
                    const isSelected = responses.academicNeeds.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleArrayItem("academicNeeds", item)}
                        className={`p-3 rounded-2xl text-center text-xs font-medium border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-teal-600 border-teal-600 text-white font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                {responses.academicNeeds.includes("أخرى") && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={responses.academicNeedsOther || ""}
                      onChange={(e) =>
                        setResponses((prev) => ({
                          ...prev,
                          academicNeedsOther: e.target.value,
                        }))
                      }
                      placeholder="اذكر الاحتياج الدراسي الآخر باختصار..."
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-teal-600 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: الجانب الاجتماعي والسلوكي */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  الجانب الاجتماعي والسلوكي
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  علاقات الطالب مع زملائه وتكيفه البيئي والنفسي
                </p>
              </div>

              {/* Q1 */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-slate-800">
                  1. كيف هي علاقات الطالب الاجتماعية؟
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: "very_good", label: "جيدة جداً" },
                    { id: "good", label: "جيدة" },
                    { id: "acceptable", label: "مقبولة" },
                    { id: "some_difficulties", label: "توجد بعض الصعوبات" },
                    { id: "noticeable_difficulties", label: "توجد صعوبات ملحوظة" },
                  ].map((opt) => {
                    const selected = responses.socialRelationships === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setResponses((prev) => ({
                            ...prev,
                            socialRelationships: opt.id as any,
                          }))
                        }
                        className={`p-3 rounded-2xl text-right font-medium text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                          selected
                            ? "bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2 */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-800">
                  2. هل تعرض الطالب مؤخراً لموقف أثر عليه؟
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "no", label: "لا" },
                    { id: "yes", label: "نعم" },
                    { id: "prefer_not_to_say", label: "أفضل عدم ذكر التفاصيل" },
                  ].map((opt) => {
                    const selected = responses.recentImpactingEvent === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setResponses((prev) => ({
                            ...prev,
                            recentImpactingEvent: opt.id as any,
                          }))
                        }
                        className={`p-3 rounded-2xl text-center font-medium text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                          selected
                            ? "bg-teal-600 border-teal-600 text-white font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Sub-question */}
                {responses.recentImpactingEvent === "yes" && (
                  <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                    <label className="block text-xs font-bold text-amber-900">
                      هل يحتاج الأمر إلى تواصل مع المدرسة؟
                    </label>
                    <div className="flex gap-2">
                      {[
                        { id: "yes", label: "نعم" },
                        { id: "no", label: "لا" },
                        { id: "not_sure", label: "غير متأكد" },
                      ].map((sub) => {
                        const isSubSelected = responses.impactingEventNeedsContact === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() =>
                              setResponses((prev) => ({
                                ...prev,
                                impactingEventNeedsContact: sub.id as any,
                              }))
                            }
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                              isSubSelected
                                ? "bg-amber-600 border-amber-600 text-white"
                                : "bg-white border-amber-300 text-amber-900 hover:bg-amber-100/60"
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Q3 */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-800">
                  3. هل توجد سلوكيات ترغبون من المدرسة مراعاتها أو متابعتها؟
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "no", label: "لا توجد" },
                    { id: "yes_simple", label: "نعم، بشكل بسيط" },
                    { id: "yes_needs_followup", label: "نعم، تحتاج متابعة" },
                  ].map((opt) => {
                    const selected = responses.behaviorsToMonitor === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setResponses((prev) => ({
                            ...prev,
                            behaviorsToMonitor: opt.id as any,
                          }))
                        }
                        className={`p-3 rounded-2xl text-center font-medium text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                          selected
                            ? "bg-teal-600 border-teal-600 text-white font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: الجانب الصحي (خصوصية مشددة وأسئلة تفرعية) */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>خصوصية تامة وسرية مشددة:</strong> يتم التعامل مع هذا القسم بأعلى درجات الخصوصية ولا تظهر تفاصيل الأمراض أو التشخيصات الحساسة للعامة، وإنما تُترجم إلى إرشادات مراعاة واحتياط للمعلمين المعنيين فقط.
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 text-xs font-black flex items-center justify-center">
                    4
                  </span>
                  الجانب الصحي الوقائي
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  معلومات صحية وقائية لضمان سلامة الطالب أثناء اليوم الدراسي
                </p>
              </div>

              {/* Q1 */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-slate-800">
                  1. هل توجد معلومات صحية ينبغي على المدرسة معرفتها لضمان التعامل المناسب مع الطالب؟
                </label>
                <div className="space-y-2">
                  {[
                    { id: "no", label: "لا توجد أي حالة صحية تحتاج لمراعاة" },
                    { id: "yes_counselor_only", label: "نعم، معلومات يمكن مشاركتها مع المختص والموجه فقط" },
                    { id: "yes_general_teachers", label: "نعم، توجد معلومات يحتاج بعض المعلمين إلى معرفتها بشكل عام" },
                  ].map((opt) => {
                    const selected = responses.hasHealthInfo === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setResponses((prev) => ({
                            ...prev,
                            hasHealthInfo: opt.id as any,
                          }))
                        }
                        className={`w-full p-3.5 rounded-2xl text-right font-medium text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                          selected
                            ? "bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Branching when Health Info is YES */}
              {responses.hasHealthInfo !== "no" && (
                <div className="space-y-4 pt-3 border-t border-slate-100 animate-fadeIn">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-800">
                      ما نوع الاحتياج الصحي بشكل عام؟{" "}
                      <span className="font-normal text-slate-500">(يمكن اختيار أكثر من خيار)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        "احتياج متعلق بالحضور أو النشاط",
                        "احتياج متعلق بالتعامل أثناء اليوم الدراسي",
                        "احتياج طارئ يجب مراعاته",
                        "احتياج مؤقت",
                        "أخرى",
                      ].map((item) => {
                        const isChecked = (responses.healthNeedType || []).includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              const current = responses.healthNeedType || [];
                              const updated = current.includes(item)
                                ? current.filter((x) => x !== item)
                                : [...current, item];
                              setResponses((prev) => ({
                                ...prev,
                                healthNeedType: updated,
                              }));
                            }}
                            className={`p-3 rounded-2xl text-right text-xs font-medium border-2 transition-all cursor-pointer ${
                              isChecked
                                ? "bg-teal-600 border-teal-600 text-white font-bold"
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      هل توجد تعليمات مهمة للتعامل مع الطالب في المدرسة؟{" "}
                      <span className="text-slate-400 font-normal">(اختياري)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={responses.healthInstructions || ""}
                      onChange={(e) =>
                        setResponses((prev) => ({
                          ...prev,
                          healthInstructions: e.target.value,
                        }))
                      }
                      placeholder="مثال: يرجى السماح بشرب الماء بشكل متكرر، تجنب الركض الشديد في حصة التربية البدنية، إشعار ولي الأمر عند الشعور بدوار..."
                      className="w-full text-xs p-3.5 rounded-2xl border border-slate-300 focus:border-teal-600 focus:outline-hidden leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: الدعم المطلوب والملاحظات */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 text-xs font-black flex items-center justify-center">
                    5
                  </span>
                  الدعم المطلوب من المدرسة والملاحظات
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  تطلعاتكم من المدرسة لتوفير البيئة التعليمية والتربوية الأفضل للطالب
                </p>
              </div>

              {/* Q1 */}
              <div className="space-y-2.5">
                <label className="block text-sm font-bold text-slate-800">
                  1. ما الذي تتوقعونه من المدرسة لدعم الطالب؟{" "}
                  <span className="text-xs font-normal text-slate-500">(يمكن اختيار أكثر من خيار)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "متابعة الطالب",
                    "دعم تربوي",
                    "متابعة دراسية",
                    "تواصل مع ولي الأمر",
                    "مراعاة ظروف معينة",
                    "لقاء مع الموجه الطلابي",
                    "لا يحتاج إلى إجراء حالياً",
                    "أخرى",
                  ].map((item) => {
                    const isSelected = responses.schoolSupportExpected.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleArrayItem("schoolSupportExpected", item)}
                        className={`p-3 rounded-2xl text-center text-xs font-medium border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-teal-600 border-teal-600 text-white font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Open Note */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-800">
                  هل توجد معلومة مهمة ترون أن معرفتها ستساعد المدرسة على دعم الطالب بشكل أفضل؟{" "}
                  <span className="text-slate-400 font-normal text-xs">(اختياري)</span>
                </label>
                <textarea
                  rows={3}
                  value={responses.additionalNotes || ""}
                  onChange={(e) =>
                    setResponses((prev) => ({
                      ...prev,
                      additionalNotes: e.target.value,
                    }))
                  }
                  placeholder="أدخل أي ملاحظات ترغبون في إيصالها للموجه الطلابي وإدارة المدرسة..."
                  className="w-full text-xs p-3.5 rounded-2xl border border-slate-300 focus:border-teal-600 focus:outline-hidden leading-relaxed"
                />

                {/* Privacy Warning */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 leading-relaxed">
                  🔒 <strong>تنبيه الخصوصية:</strong> يرجى عدم إدخال معلومات لا ترغبون في مشاركتها مع المدرسة. المعلومات ستستخدم حصراً لأغراض متابعة الطالب ودعمه التربوي والصحي وفق الصلاحيات الرسمية المعتمدة.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="py-2.5 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev + 1) as any)}
              className="py-2.5 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>التالي</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري حفظ الاستبيان...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  <span>حفظ وإرسال الاستبيان للمدرسة</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
