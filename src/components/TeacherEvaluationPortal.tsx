import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Lock,
  GraduationCap,
  Sparkles,
  BookOpen,
  Send,
  Printer,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Award,
  ShieldCheck,
  Clock,
  School,
  FileCheck,
  Check
} from "lucide-react";
import { StudentEvaluationItem, TeacherInquiryRequest } from "../types";

interface TeacherEvaluationPortalProps {
  inquiryId: string;
  onClose?: () => void;
}

export default function TeacherEvaluationPortal({ inquiryId, onClose }: TeacherEvaluationPortalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inquiry, setInquiry] = useState<TeacherInquiryRequest | null>(null);
  
  // Verification state
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Evaluation form state
  const [evaluations, setEvaluations] = useState<Record<string, StudentEvaluationItem>>({});
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fetch inquiry metadata
  useEffect(() => {
    async function loadInquiryData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/inquiries/public/${inquiryId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "تعذر العثور على طلب الاستعلام");
        }
        const data = await res.json();
        setInquiry(data);

        // Pre-fill evaluations if already exists
        const initialEvals: Record<string, StudentEvaluationItem> = {};
        const initialExpanded: Record<string, boolean> = {};

        if (data.students && Array.isArray(data.students)) {
          data.students.forEach((st: any, idx: number) => {
            const existing = data.evaluations?.find((e: any) => e.studentId === st.id);
            const academicVal = existing?.academicAchievement || existing?.academicLevel || "ممتاز";
            const disciplineVal = existing?.disciplineAndCommitment || existing?.disciplineLevel || "ممتاز";
            const behaviorVal = existing?.behaviorAndEthics || existing?.behaviorLevel || "ممتاز";
            const participationVal = existing?.participationAndInteraction || existing?.participationLevel || "ممتاز";
            const notesVal = existing?.teacherNotes || existing?.generalRecommendation || "";

            initialEvals[st.id] = {
              studentId: st.id,
              studentName: st.name,
              academicAchievement: academicVal,
              academicLevel: academicVal,
              disciplineAndCommitment: disciplineVal,
              disciplineLevel: disciplineVal,
              behaviorAndEthics: behaviorVal,
              behaviorLevel: behaviorVal,
              participationAndInteraction: participationVal,
              participationLevel: participationVal,
              generalRecommendation: notesVal,
              teacherNotes: notesVal,
              evaluatedAt: existing?.evaluatedAt,
            };
            // Expand first student by default
            initialExpanded[st.id] = idx === 0 || data.students.length <= 3;
          });
        }

        setEvaluations(initialEvals);
        setExpandedStudents(initialExpanded);

        if (data.status === "completed" && data.isVerified) {
          setIsUnlocked(true);
        }
      } catch (err: any) {
        setError(err.message || "حدث خطأ أثناء تحميل بيانات الاستعلام");
      } finally {
        setLoading(false);
      }
    }

    if (inquiryId) {
      loadInquiryData();
    }
  }, [inquiryId]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCodeInput.trim()) {
      setVerifyError("يرجى إدخال رمز التحقق المكون من 6 أرقام");
      return;
    }

    try {
      setVerifying(true);
      setVerifyError(null);
      const res = await fetch("/api/inquiries/public/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inquiryId, accessCode: accessCodeInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "رمز التحقق غير صحيح");
      }

      setIsUnlocked(true);
      if (data.inquiry) {
        setInquiry(data.inquiry);
        // Pre-fill existing evaluations if available
        if (data.inquiry.evaluations && Array.isArray(data.inquiry.evaluations)) {
          const updatedEvals: Record<string, StudentEvaluationItem> = {};
          data.inquiry.evaluations.forEach((ev: StudentEvaluationItem) => {
            updatedEvals[ev.studentId] = ev;
          });
          setEvaluations((prev) => ({ ...prev, ...updatedEvals }));
        }
      }
    } catch (err: any) {
      setVerifyError(err.message || "فشل التحقق من رمز الدخول");
    } finally {
      setVerifying(false);
    }
  };

  const handleRatingChange = (
    studentId: string,
    field: keyof StudentEvaluationItem,
    value: any
  ) => {
    setEvaluations((prev) => {
      const current = prev[studentId] || {
        studentId,
        studentName: inquiry?.students.find((s) => s.id === studentId)?.name || "",
        academicLevel: "ممتاز",
        disciplineLevel: "ممتاز",
        behaviorLevel: "متميز",
        participationLevel: "متفاعل دائماً",
      };
      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const toggleExpand = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const handleSubmitEvaluations = async () => {
    if (!inquiry) return;
    
    // Ensure all students in inquiry are populated with either custom ratings or defaults
    const evalList: StudentEvaluationItem[] = inquiry.students.map((student) => {
      const existing = evaluations[student.id];
      if (existing) {
        return {
          studentId: student.id,
          studentName: student.name,
          grade: student.grade || inquiry.grade,
          className: student.className || inquiry.section,
          nationalId: student.nationalId,
          academicAchievement: (existing.academicLevel || existing.academicAchievement || "ممتاز") as any,
          academicLevel: (existing.academicLevel || existing.academicAchievement || "ممتاز") as any,
          disciplineAndCommitment: (existing.disciplineLevel || existing.disciplineAndCommitment || "ممتاز") as any,
          disciplineLevel: (existing.disciplineLevel || existing.disciplineAndCommitment || "ممتاز") as any,
          behaviorAndEthics: (existing.behaviorLevel || existing.behaviorAndEthics || "متميز") as any,
          behaviorLevel: (existing.behaviorLevel || existing.behaviorAndEthics || "متميز") as any,
          participationAndInteraction: (existing.participationLevel || existing.participationAndInteraction || "متفاعل دائماً") as any,
          participationLevel: (existing.participationLevel || existing.participationAndInteraction || "متفاعل دائماً") as any,
          teacherNotes: existing.teacherNotes || "",
          evaluatedAt: new Date().toISOString(),
        };
      }
      return {
        studentId: student.id,
        studentName: student.name,
        grade: student.grade || inquiry.grade,
        className: student.className || inquiry.section,
        nationalId: student.nationalId,
        academicAchievement: "ممتاز",
        academicLevel: "ممتاز",
        disciplineAndCommitment: "ممتاز",
        disciplineLevel: "ممتاز",
        behaviorAndEthics: "متميز",
        behaviorLevel: "متميز",
        participationAndInteraction: "متفاعل دائماً",
        participationLevel: "متفاعل دائماً",
        teacherNotes: "",
        evaluatedAt: new Date().toISOString(),
      };
    });

    try {
      setSubmitting(true);
      const res = await fetch("/api/inquiries/public/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inquiryId,
          accessCode: accessCodeInput.trim() || inquiry.accessCode,
          evaluations: evalList,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل اعتماد وحفظ التقييم");
      }

      setSubmitSuccess(true);
      if (data.inquiry) {
        setInquiry(data.inquiry);
      }
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء حفظ التقييم");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">جاري تحميل استمارة الاستعلام...</h2>
          <p className="text-sm text-slate-500">يرجى الانتظار ريثما يتم جلب بيانات الطلاب المطلوبة.</p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">تعذر العثور على استمارة التقييم</h2>
          <p className="text-sm text-slate-500 leading-relaxed">{error || "الرابط المطلوب غير صحيح أو منتهي الصلاحية."}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              العودة للنظام
            </button>
          )}
        </div>
      </div>
    );
  }

  if (inquiry.isExpired && inquiry.status !== "completed") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-3xl border border-amber-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">انتهت صلاحية رابط التقييم</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            تنتهي صلاحية روابط استعلامات المعلمين تلقائياً بعد مرور <strong>3 أيام</strong> من تاريخ إرسالها حفاظاً على أمان السجلات وموارد النظام.
          </p>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 text-right space-y-1">
            <p>• <strong>المعلم:</strong> {inquiry.teacherName}</p>
            <p>• <strong>المادة:</strong> {inquiry.subject}</p>
            <p>• <strong>المدرسة:</strong> {inquiry.schoolName || "ثانوية الأبناء الأولى"}</p>
          </div>
          <p className="text-xs text-emerald-700 font-medium">
            في حال الرغبة بإعادة التقييم، نرجو التواصل مع إدارة المدرسة أو التوجيه الطلابي لتجديد الرابط.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors cursor-pointer"
            >
              العودة للرئيسية
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 py-8 px-4 sm:px-6 lg:px-8 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* School Header Banner */}
        <header className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-2 bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="text-right sm:text-right w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-400 block">المملكة العربية السعودية • وزارة التعليم</span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900">{inquiry.schoolName || "ثانوية الأبناء الأولى"}</h1>
              <span className="text-xs text-emerald-600 font-bold">بوابة تقييم واستعلام المعلمين الرسمية</span>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <School className="w-7 h-7" />
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
              <GraduationCap className="w-4 h-4 text-slate-400" />
              <span>المعلم الفاضل: <strong className="text-slate-900 font-bold">{inquiry.teacherName}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>المادة: <strong className="text-slate-900 font-bold">{inquiry.subject}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
              <span>الشعبة: <strong className="text-slate-900 font-bold">{inquiry.section || "—"}</strong></span>
            </div>
            {inquiry.grade && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                <span>الصف: <strong className="text-slate-900 font-bold">{inquiry.grade}</strong></span>
              </div>
            )}
          </div>
        </header>

        {/* Access Code Verification Lock Screen */}
        {!isUnlocked && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm text-center max-w-md mx-auto space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-slate-900">تأكيد رمز التفعيل والدخول</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                لضمان خصوصية وسرية السجلات، تم إرسال رمز تحقق مكوّن من 6 أرقام إلى واتساب الأستاذ <strong>{inquiry.teacherName}</strong>. يرجى إدخاله للمتابعة.
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value)}
                  placeholder="أدخل رمز الـ 6 أرقام هنا"
                  className="w-full text-center tracking-widest text-2xl font-mono font-bold py-3.5 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  dir="ltr"
                  autoFocus
                />
              </div>

              {verifyError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs text-right font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>فتح وتعبئة الاستمارة</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Unlocked Evaluation Form */}
        {isUnlocked && (
          <div className="space-y-6">
            
            {/* Status notification banner if submitted */}
            {(submitSuccess || inquiry.status === "completed") && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-emerald-900 flex items-start gap-3.5 shadow-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm sm:text-base">تم اعتماد التقييم وإرساله لإدارة المدرسة بنجاح</h3>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    شكراً جزيلاً لتعاونكم أستاذ <strong>{inquiry.teacherName}</strong>. تم تسجيل درجات وملاحظات الطلاب رسمياً في سجلات إدارة المدرسة والتوجيه الطلابي.
                  </p>
                  {inquiry.completedAt && (
                    <span className="text-[11px] text-emerald-600 block mt-1">
                      تاريخ الاعتماد: {new Date(inquiry.completedAt).toLocaleString("ar-SA")}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Instruction Callout */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    قائمة الطلاب المطلوب الاستعلام عنهم ({inquiry.students?.length || 0} طالب)
                  </h2>
                  <p className="text-xs text-slate-500">
                    يرجى تعبئة التقييمات الأربعة لكل طالب وتدوين أي ملاحظات إرشادية أو أكاديمية.
                  </p>
                </div>
              </div>

              {inquiry.status === "completed" && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  <span>معتمد رسمياً</span>
                </span>
              )}
            </div>

            {/* Students List with Evaluation Criteria */}
            <div className="space-y-4">
              {inquiry.students?.map((student, index) => {
                const evalData = evaluations[student.id] || {
                  studentId: student.id,
                  studentName: student.name,
                  academicLevel: "ممتاز",
                  disciplineLevel: "ممتاز",
                  behaviorLevel: "متميز",
                  participationLevel: "متفاعل دائماً",
                  teacherNotes: "",
                };
                const isExpanded = expandedStudents[student.id] !== false;

                return (
                  <div
                    key={student.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Student Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(student.id)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-right bg-slate-50/70 hover:bg-slate-100/80 transition-colors cursor-pointer border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-extrabold text-slate-900 truncate">
                            {student.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>الشعبة: {student.className || inquiry.section || "—"}</span>
                            {student.grade && <span>• الصف: {student.grade}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                          {evalData.academicLevel} • {evalData.behaviorLevel}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>

                    {/* Evaluation Questions Body */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 space-y-6">
                        
                        {/* 1. التحصيل الدراسي */}
                        <div className="space-y-2.5">
                          <label className="block text-xs font-extrabold text-slate-700">
                            ١. مستوى التحصيل الدراسي في مادة ({inquiry.subject}):
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(["ممتاز", "جيد جداً", "جيد", "ضعيف"] as const).map((level) => {
                              const isSelected = evalData.academicLevel === level;
                              return (
                                <button
                                  type="button"
                                  key={level}
                                  onClick={() => handleRatingChange(student.id, "academicLevel", level)}
                                  className={`
                                    py-2.5 px-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border
                                    ${
                                      isSelected
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
                                    }
                                  `}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  <span>{level}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. الانضباط الصفي والتركيز */}
                        <div className="space-y-2.5">
                          <label className="block text-xs font-extrabold text-slate-700">
                            ٢. الانضباط الصفي والتركيز أثناء الحصة:
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(["ممتاز", "جيد جداً", "جيد", "ضعيف"] as const).map((level) => {
                              const isSelected = evalData.disciplineLevel === level;
                              return (
                                <button
                                  type="button"
                                  key={level}
                                  onClick={() => handleRatingChange(student.id, "disciplineLevel", level)}
                                  className={`
                                    py-2.5 px-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border
                                    ${
                                      isSelected
                                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
                                    }
                                  `}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  <span>{level}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. السلوك والمواظبة */}
                        <div className="space-y-2.5">
                          <label className="block text-xs font-extrabold text-slate-700">
                            ٣. السلوك والمواظبة العامة:
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(["متميز", "ملتزم", "يحتاج توجيه", "غير منضبط"] as const).map((level) => {
                              const isSelected = evalData.behaviorLevel === level;
                              return (
                                <button
                                  type="button"
                                  key={level}
                                  onClick={() => handleRatingChange(student.id, "behaviorLevel", level)}
                                  className={`
                                    py-2.5 px-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border
                                    ${
                                      isSelected
                                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
                                    }
                                  `}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  <span>{level}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 4. المشاركة والتفاعل والواجبات */}
                        <div className="space-y-2.5">
                          <label className="block text-xs font-extrabold text-slate-700">
                            ٤. المشاركة الصيفية وحل الواجبات:
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(["متفاعل دائماً", "متفاعل غالباً", "أحياناً", "غير متفاعل"] as const).map((level) => {
                              const isSelected = evalData.participationLevel === level;
                              return (
                                <button
                                  type="button"
                                  key={level}
                                  onClick={() => handleRatingChange(student.id, "participationLevel", level)}
                                  className={`
                                    py-2.5 px-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border
                                    ${
                                      isSelected
                                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
                                    }
                                  `}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  <span>{level}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 5. ملاحظات المعلم وتوصياته */}
                        <div className="space-y-2">
                          <label className="block text-xs font-extrabold text-slate-700">
                            ٥. ملاحظات وتوصيات المعلم الخاصة بالطالب (اختياري):
                          </label>
                          <textarea
                            rows={2}
                            value={evalData.teacherNotes || ""}
                            onChange={(e) => handleRatingChange(student.id, "teacherNotes", e.target.value)}
                            placeholder="اكتب هنا أي ملاحظات إضافية، نقاط قوة، أو نقاط تحتاج إلى متابعة مع ولي الأمر والموجه الطلابي..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                          />
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit Actions Bottom Bar */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-4">
              <div className="text-xs text-slate-500 font-medium text-center sm:text-right">
                <span>سيتم إرسال هذا التقييم إلى السجل الإداري لـ <strong>{inquiry.schoolName}</strong></span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSubmitEvaluations}
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ والاعتماد...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>حفظ واعتماد التقييم رسمياً</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
