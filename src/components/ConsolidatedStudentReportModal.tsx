import React, { useState } from "react";
import {
  Printer,
  X,
  User,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  Edit3,
  Check,
  Building,
  FileText,
  AlertCircle,
  Copy,
  ChevronDown
} from "lucide-react";
import {
  Student,
  TeacherInquiryRequest,
  SchoolSignatories,
  StudentEvaluationItem
} from "../types";

export interface AggregatedStudentEvaluation {
  student: {
    id: string;
    name: string;
    nationalId?: string;
    grade?: string;
    className?: string;
  };
  totalInquiriesCount: number;
  completedEvaluationsCount: number;
  teachersEvaluations: {
    inquiryId: string;
    teacherName: string;
    teacherPhone?: string;
    subject: string;
    section: string;
    grade?: string;
    status: "pending" | "opened" | "completed" | "failed";
    isVerified: boolean;
    sentAt: string;
    completedAt?: string;
    evaluation?: StudentEvaluationItem;
  }[];
}

interface ConsolidatedStudentReportModalProps {
  studentEval: AggregatedStudentEvaluation;
  schoolSignatories: SchoolSignatories;
  allAggregatedStudents?: AggregatedStudentEvaluation[];
  onClose: () => void;
  onSelectAnotherStudent?: (studentEval: AggregatedStudentEvaluation) => void;
}

export default function ConsolidatedStudentReportModal({
  studentEval,
  schoolSignatories,
  allAggregatedStudents = [],
  onClose,
  onSelectAnotherStudent,
}: ConsolidatedStudentReportModalProps) {
  const [counselorNotes, setCounselorNotes] = useState<string>("");
  const [isEditingCounselorNotes, setIsEditingCounselorNotes] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("1447 / 1448 هـ");
  const [selectedTerm, setSelectedTerm] = useState("الفصل الدراسي الثالث");
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [printMode, setPrintMode] = useState<"single" | "all">("single");

  const { student, teachersEvaluations, completedEvaluationsCount, totalInquiriesCount } = studentEval;

  // Calculate Overall Averages and Ratings
  const completedList = teachersEvaluations.filter((t) => t.evaluation && t.status === "completed");

  const getAcademicScore = (level?: string) => {
    switch (level) {
      case "ممتاز": return 4;
      case "جيد جداً": return 3;
      case "جيد": return 2;
      case "مقبول": return 1;
      case "ضعيف": return 0;
      default: return 3;
    }
  };

  const getDisciplineScore = (level?: string) => {
    switch (level) {
      case "ممتاز": return 4;
      case "جيد جداً": return 3;
      case "جيد": return 2;
      case "ضعيف": return 1;
      default: return 3;
    }
  };

  const getBehaviorScore = (level?: string) => {
    switch (level) {
      case "متميز": return 4;
      case "ملتزم": return 3;
      case "يحتاج توجيه": return 2;
      case "غير منضبط": return 1;
      default: return 3;
    }
  };

  const avgAcademicScore = completedList.length > 0
    ? completedList.reduce((acc, curr) => acc + getAcademicScore(curr.evaluation?.academicLevel || curr.evaluation?.academicAchievement), 0) / completedList.length
    : 0;

  const avgDisciplineScore = completedList.length > 0
    ? completedList.reduce((acc, curr) => acc + getDisciplineScore(curr.evaluation?.disciplineLevel || curr.evaluation?.disciplineAndCommitment), 0) / completedList.length
    : 0;

  const avgBehaviorScore = completedList.length > 0
    ? completedList.reduce((acc, curr) => acc + getBehaviorScore(curr.evaluation?.behaviorLevel || curr.evaluation?.behaviorAndEthics), 0) / completedList.length
    : 0;

  const getGeneralRatingLabel = (score: number) => {
    if (score >= 3.5) return { label: "ممتاز (متميز)", color: "text-emerald-700 bg-emerald-50 border-emerald-300" };
    if (score >= 2.5) return { label: "جيد جداً (مرتفع)", color: "text-blue-700 bg-blue-50 border-blue-300" };
    if (score >= 1.5) return { label: "جيد (متوسط)", color: "text-amber-700 bg-amber-50 border-amber-300" };
    return { label: "يحتاج إلى متابعة ودعم", color: "text-red-700 bg-red-50 border-red-300" };
  };

  const handlePrint = (mode: "single" | "all" = "single") => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCopySummary = () => {
    const summaryText = `*تقرير تجميعي لاستعلامات المعلمين عن الطالب: ${student.name}*
الصف/الشعبة: ${student.grade || ""} / ${student.className || ""}
السجل المدني: ${student.nationalId || "—"}
المدرسة: ${schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}

*تقييمات المعلمين (${completedEvaluationsCount} من ${totalInquiriesCount} معلماً):*
${teachersEvaluations.map((t, idx) => {
  if (t.evaluation) {
    return `${idx + 1}. المعلم: ${t.teacherName} (مادة ${t.subject})
- التحصيل: ${t.evaluation.academicLevel || t.evaluation.academicAchievement || "—"}
- الانضباط: ${t.evaluation.disciplineLevel || t.evaluation.disciplineAndCommitment || "—"}
- السلوك: ${t.evaluation.behaviorLevel || t.evaluation.behaviorAndEthics || "—"}
- المشاركة: ${t.evaluation.participationLevel || t.evaluation.participationAndInteraction || "—"}
${t.evaluation.teacherNotes ? `- الملاحظات: ${t.evaluation.teacherNotes}` : ""}`;
  } else {
    return `${idx + 1}. المعلم: ${t.teacherName} (مادة ${t.subject}) - بانتظار الاعتماد`;
  }
}).join("\n\n")}

${counselorNotes ? `*مرئيات وتوصيات التوجيه الطلابي:*\n${counselorNotes}\n` : ""}
- الموجه الطلابي: ${schoolSignatories.counselorName || "—"}
- مدير المدرسة: ${schoolSignatories.principalName || "—"}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  const currentDateFormatted = new Date().toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
      
      {/* Modal Dialog Container */}
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* Top Sticky Header (Hidden in Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>التقرير الرسمي التجميعي لتقييمات المعلمين</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                  {completedEvaluationsCount} من {totalInquiriesCount} معلماً
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                تقرير رسمي شامل يجمع إفادات وملاحظات كافة معلمي الطالب في وثيقة رسمية واحدة معدة للطباعة والاعتماد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Student Switcher Dropdown if multiple students exist */}
            {allAggregatedStudents.length > 1 && onSelectAnotherStudent && (
              <div className="relative inline-block text-xs">
                <select
                  value={student.id}
                  onChange={(e) => {
                    const target = allAggregatedStudents.find((s) => s.student.id === e.target.value);
                    if (target) onSelectAnotherStudent(target);
                  }}
                  className="py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer text-xs"
                >
                  {allAggregatedStudents.map((item) => (
                    <option key={item.student.id} value={item.student.id}>
                      الطالب: {item.student.name} ({item.completedEvaluationsCount}/{item.totalInquiriesCount})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Copy Summary */}
            <button
              type="button"
              onClick={handleCopySummary}
              className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="نسخ ملخص التقرير لمشاركته عبر واتساب"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ التقرير</span>
                </>
              )}
            </button>

            {/* Print Single Report Button */}
            <button
              type="button"
              onClick={() => handlePrint("single")}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة تقرير الطالب</span>
            </button>

            {/* Batch Print All Students if available */}
            {allAggregatedStudents.length > 1 && (
              <button
                type="button"
                onClick={() => handlePrint("all")}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hidden md:flex"
                title="طباعة تقارير كافة الطلاب دفعة واحدة"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة تقارير جميع الطلاب ({allAggregatedStudents.length})</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100/60 print:bg-white print:p-0">
          
          {/* ========================================================================= */}
          {/* SINGLE STUDENT REPORT VIEW */}
          {/* ========================================================================= */}
          <div className={`space-y-6 ${printMode === "all" ? "print:hidden" : ""}`}>
            <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 space-y-6 max-w-4xl mx-auto" id="printable-single-student-report">
              
              {/* 1. Official Ministry Header */}
              <div className="border-b-2 border-slate-900 pb-5 space-y-4">
                <div className="grid grid-cols-3 items-center gap-4 text-xs font-bold text-slate-800">
                  
                  {/* Right: State & Directorate */}
                  <div className="space-y-1 text-right">
                    <p>{schoolSignatories.countryName || "المملكة العربية السعودية"}</p>
                    <p>{schoolSignatories.ministryName || "وزارة التعليم"}</p>
                    <p>{schoolSignatories.administrationName || "الإدارة العامة للتعليم"}</p>
                    <p className="text-slate-900 font-extrabold text-sm">{schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}</p>
                    <p className="text-[11px] text-slate-500 font-medium">قسم التوجيه الطلابي والإرشاد الأكاديمي</p>
                  </div>

                  {/* Center: School / Ministry Logo */}
                  <div className="flex flex-col items-center justify-center text-center">
                    {schoolSignatories.logoUrl ? (
                      <img
                        src={schoolSignatories.logoUrl}
                        alt="شعار المدرسة"
                        referrerPolicy="no-referrer"
                        className="object-contain max-h-20 mb-1"
                        style={{
                          width: `${schoolSignatories.logoWidth || 70}px`,
                          height: `${schoolSignatories.logoHeight || 70}px`,
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black mb-1">
                        <Building className="w-8 h-8 text-emerald-700" />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">رؤية المملكة 2030</span>
                  </div>

                  {/* Left: Official Reference & Date */}
                  <div className="space-y-1 text-left font-mono text-[11px] text-slate-700" dir="ltr">
                    <p><strong className="font-sans">التاريخ:</strong> {new Date().toLocaleDateString("ar-SA")}</p>
                    <p><strong className="font-sans">العام الدراسي:</strong> {selectedAcademicYear}</p>
                    <p><strong className="font-sans">الفصل:</strong> {selectedTerm}</p>
                    <p><strong className="font-sans">الرقم المرجعي:</strong> STU-EVAL-{student.id.replace(/\D/g, "").slice(-5) || "1048"}</p>
                  </div>
                </div>

                {/* Formal Title Ribbon */}
                <div className="text-center pt-2">
                  <div className="inline-block px-6 py-2 bg-slate-900 text-white rounded-2xl text-sm sm:text-base font-black tracking-wide shadow-xs print:bg-slate-900 print:text-white">
                    استمارة التقييم التجميعي الشامل للمعلمين عن المستوى الدراسي والسلوكي للطالب
                  </div>
                </div>
              </div>

              {/* 2. Student Official Identity Card */}
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-0.5">
                    <span className="text-[11px] text-slate-400 font-medium block">اسم الطالب الرباعي:</span>
                    <strong className="text-slate-900 font-black text-sm block truncate">{student.name}</strong>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-0.5">
                    <span className="text-[11px] text-slate-400 font-medium block">رقم السجل المدني / الهوية:</span>
                    <strong className="text-slate-900 font-mono font-bold text-xs block">{student.nationalId || "—"}</strong>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-0.5">
                    <span className="text-[11px] text-slate-400 font-medium block">الصف الدراسي:</span>
                    <strong className="text-slate-800 font-bold block">{student.grade || "المرحلة الثانوية"}</strong>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-0.5">
                    <span className="text-[11px] text-slate-400 font-medium block">الشعبة / الفصل:</span>
                    <strong className="text-slate-800 font-bold block">{student.className || "الشعبة المقررة"}</strong>
                  </div>
                </div>

                {/* Status Indicator Banner */}
                <div className="flex items-center justify-between text-xs px-2 pt-1">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-bold">حالة التقرير:</span>
                    {completedEvaluationsCount === totalInquiriesCount && totalInquiriesCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>مكتمل الاعتماد من كافة معلمي المواد المقررة ({completedEvaluationsCount} من {totalInquiriesCount} معلماً)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>معتمد جزئياً ({completedEvaluationsCount} معلماً أكملوا التقييم من أصل {totalInquiriesCount})</span>
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
                    تم استخراج البيانات آلياً من سجلات المعلمين المعتمدة
                  </div>
                </div>
              </div>

              {/* 3. Consolidated Multi-Teacher Evaluations Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                    <span>جدول تقييمات المعلمين التفصيلية للمقررات الدراسية</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    إجمالي المواد المستعلم عنها: {teachersEvaluations.length} مواد
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-right text-xs divide-y divide-slate-200">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold">
                        <th className="p-3 text-center w-8">م</th>
                        <th className="p-3">المادة المقررة</th>
                        <th className="p-3">اسم المعلم</th>
                        <th className="p-3 text-center">التحصيل الدراسي</th>
                        <th className="p-3 text-center">الانضباط الصفي</th>
                        <th className="p-3 text-center">السلوك والمواظبة</th>
                        <th className="p-3 text-center">المشاركة والواجبات</th>
                        <th className="p-3 w-1/3">ملاحظات وتوصيات المعلم</th>
                        <th className="p-3 text-center">حالة التوثيق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                      {teachersEvaluations.map((t, idx) => {
                        const ev = t.evaluation;
                        const isDone = t.status === "completed" && ev;

                        return (
                          <tr key={t.inquiryId || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                            
                            <td className="p-3 font-extrabold text-slate-900 whitespace-nowrap">
                              {t.subject}
                            </td>

                            <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                              {t.teacherName}
                            </td>

                            {isDone ? (
                              <>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                    ev.academicLevel === "ممتاز" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                                    ev.academicLevel === "جيد جداً" ? "bg-blue-50 text-blue-800 border border-blue-200" :
                                    ev.academicLevel === "جيد" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                                    "bg-red-50 text-red-800 border border-red-200"
                                  }`}>
                                    {ev.academicLevel || ev.academicAchievement || "ممتاز"}
                                  </span>
                                </td>

                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                    ev.disciplineLevel === "ممتاز" ? "bg-blue-50 text-blue-800 border border-blue-200" :
                                    ev.disciplineLevel === "جيد جداً" ? "bg-indigo-50 text-indigo-800 border border-indigo-200" :
                                    ev.disciplineLevel === "جيد" ? "bg-slate-100 text-slate-700" :
                                    "bg-red-50 text-red-800 border border-red-200"
                                  }`}>
                                    {ev.disciplineLevel || ev.disciplineAndCommitment || "ممتاز"}
                                  </span>
                                </td>

                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                    (ev.behaviorLevel as string) === "ممتاز" || (ev.behaviorLevel as string) === "متميز" ? "bg-purple-50 text-purple-800 border border-purple-200" :
                                    (ev.behaviorLevel as string) === "جيد جداً" || (ev.behaviorLevel as string) === "ملتزم" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                                    (ev.behaviorLevel as string) === "جيد" ? "bg-blue-50 text-blue-800 border border-blue-200" :
                                    (ev.behaviorLevel as string) === "مقبول" || (ev.behaviorLevel as string) === "يحتاج توجيه" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                                    "bg-red-50 text-red-800 border border-red-200"
                                  }`}>
                                    {ev.behaviorLevel || ev.behaviorAndEthics || "ممتاز"}
                                  </span>
                                </td>

                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                    (ev.participationLevel as string) === "متفاعل دائماً" || (ev.participationLevel as string) === "ممتاز" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                                    (ev.participationLevel as string) === "جيد جداً" ? "bg-indigo-50 text-indigo-800 border border-indigo-200" :
                                    (ev.participationLevel as string) === "متوسط" || (ev.participationLevel as string) === "جيد" ? "bg-blue-50 text-blue-800 border border-blue-200" :
                                    "bg-amber-50 text-amber-800 border border-amber-200"
                                  }`}>
                                    {ev.participationLevel || ev.participationAndInteraction || "ممتاز"}
                                  </span>
                                </td>

                                <td className="p-3 text-xs leading-relaxed">
                                  {ev.teacherNotes ? (
                                    <p className="text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200/60 font-sans">
                                      {ev.teacherNotes}
                                    </p>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">لا توجد ملاحظات إضافية</span>
                                  )}
                                </td>

                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-300 text-[11px] inline-flex items-center gap-1.5 shadow-xs">
                                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</span>
                                    <span>موثق</span>
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td colSpan={6} className="p-3 text-center bg-amber-50/40 text-amber-800">
                                <span className="inline-flex items-center gap-1.5 font-bold text-[11px]">
                                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                  <span>بانتظار إفادة المعلم واعتماد التقييم عبر الرابط المرسل</span>
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Overall Analytics Summary Cards */}
              {completedList.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-800 block">التقدير العام للتحصيل الدراسي:</span>
                    <strong className="text-base font-black text-emerald-950 block">
                      {getGeneralRatingLabel(avgAcademicScore).label}
                    </strong>
                    <span className="text-[10px] text-emerald-700 block">
                      بناءً على تقييم {completedList.length} من معلمي المواد
                    </span>
                  </div>

                  <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 space-y-1">
                    <span className="text-[11px] font-bold text-blue-800 block">مستوى الانضباط الصفي العام:</span>
                    <strong className="text-base font-black text-blue-950 block">
                      {getGeneralRatingLabel(avgDisciplineScore).label}
                    </strong>
                    <span className="text-[10px] text-blue-700 block">
                      التزام بالحصص والتركيز الدراسي
                    </span>
                  </div>

                  <div className="bg-purple-50/80 p-4 rounded-2xl border border-purple-200 space-y-1">
                    <span className="text-[11px] font-bold text-purple-800 block">السلوك والمواظبة العامة:</span>
                    <strong className="text-base font-black text-purple-950 block">
                      {getGeneralRatingLabel(avgBehaviorScore).label}
                    </strong>
                    <span className="text-[10px] text-purple-700 block">
                      التعامل الإيجابي مع المعلمين والزملاء
                    </span>
                  </div>
                </div>
              )}

              {/* 5. Counselor Guidance Section & Action Plan */}
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>مرئيات وخطة التوجيه الطلابي المقترحة:</span>
                  </h4>

                  <button
                    type="button"
                    onClick={() => setIsEditingCounselorNotes(!isEditingCounselorNotes)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer no-print"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingCounselorNotes ? "تم الإدخال" : "كتابة / تعديل التوصية"}</span>
                  </button>
                </div>

                {isEditingCounselorNotes ? (
                  <textarea
                    value={counselorNotes}
                    onChange={(e) => setCounselorNotes(e.target.value)}
                    placeholder="اكتب هنا مرئيات الموجه الطلابي، الخطة العلاجية أو الإثرائية للطالب، والتوجيهات الموصى بها لإدارة المدرسة وولي الأمر..."
                    rows={3}
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed font-sans"
                  />
                ) : (
                  <div className="min-h-12 bg-white p-3 rounded-xl border border-slate-200/90 text-xs text-slate-800 leading-relaxed font-sans">
                    {counselorNotes ? (
                      <p>{counselorNotes}</p>
                    ) : (
                      <p className="text-slate-400 italic">
                        {completedList.length > 0
                          ? "تمت مراجعة تقييمات المعلمين من قِبل التوجيه الطلابي، ويُوصى باستمرار تعزيز نقاط القوة ومتابعة مؤشرات التحصيل والانضباط دورياً."
                          : "بانتظار اكتمال استمارات التقييم لكتابة الخطة الإرشادية والتوصيات الرسمية."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 6. Official Signatories & School Stamp */}
              <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs">
                
                {/* 1. Counselor */}
                <div className="space-y-3">
                  <span className="text-[11px] text-slate-500 font-bold block">الموجه الطلابي:</span>
                  <div className="h-9 flex items-center justify-center">
                    <strong className="text-slate-900 font-black text-xs block">
                      {schoolSignatories.counselorName || "أ. فهد التوجيه"}
                    </strong>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-1 text-[10px] text-slate-400">
                    التوقيع: ................................
                  </div>
                </div>

                {/* 2. Vice Principal */}
                <div className="space-y-3">
                  <span className="text-[11px] text-slate-500 font-bold block">وكيل الشؤون التعليمية:</span>
                  <div className="h-9 flex items-center justify-center">
                    <strong className="text-slate-900 font-black text-xs block">
                      {schoolSignatories.vicePrincipalName || "أ. وكيل المدرسة"}
                    </strong>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-1 text-[10px] text-slate-400">
                    التوقيع: ................................
                  </div>
                </div>

                {/* 3. Principal & Stamp */}
                <div className="space-y-3">
                  <span className="text-[11px] text-slate-500 font-bold block">مدير المدرسة:</span>
                  <div className="h-9 flex items-center justify-center">
                    <strong className="text-slate-900 font-black text-xs block">
                      {schoolSignatories.principalName || "أ. مدير المدرسة"}
                    </strong>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-1 text-[10px] text-slate-400">
                    الختم والتوقيع الرسمي
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* BATCH PRINT ALL STUDENTS (PRINT VIEW ONLY) */}
          {/* ========================================================================= */}
          {printMode === "all" && allAggregatedStudents.length > 0 && (
            <div className="hidden print:block space-y-12">
              {allAggregatedStudents.map((aggItem, aggIdx) => {
                const completedSubList = aggItem.teachersEvaluations.filter((t) => t.evaluation && t.status === "completed");
                
                return (
                  <div
                    key={aggItem.student.id}
                    className="bg-white p-8 space-y-6"
                    style={{ pageBreakAfter: "always" }}
                  >
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-4 space-y-3">
                      <div className="grid grid-cols-3 items-center gap-4 text-xs font-bold text-slate-800">
                        <div className="space-y-1 text-right">
                          <p>{schoolSignatories.countryName || "المملكة العربية السعودية"}</p>
                          <p>{schoolSignatories.ministryName || "وزارة التعليم"}</p>
                          <p>{schoolSignatories.administrationName || "الإدارة العامة للتعليم"}</p>
                          <p className="text-slate-900 font-extrabold text-sm">{schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}</p>
                        </div>
                        <div className="text-center font-black">
                          <div className="text-sm">قسم التوجيه الطلابي</div>
                          <span className="text-[10px] text-slate-400 font-mono">رؤية المملكة 2030</span>
                        </div>
                        <div className="text-left font-mono text-[11px]" dir="ltr">
                          <p>التاريخ: {new Date().toLocaleDateString("ar-SA")}</p>
                          <p>العام: {selectedAcademicYear}</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-black">
                          استمارة التقييم التجميعي الشامل للمعلمين عن الطالب: {aggItem.student.name}
                        </div>
                      </div>
                    </div>

                    {/* Student Info */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-4 gap-2 text-xs">
                      <div><span className="text-slate-400 block text-[10px]">الطالب:</span><strong>{aggItem.student.name}</strong></div>
                      <div><span className="text-slate-400 block text-[10px]">السجل المدني:</span><strong>{aggItem.student.nationalId || "—"}</strong></div>
                      <div><span className="text-slate-400 block text-[10px]">الصف:</span><strong>{aggItem.student.grade || "—"}</strong></div>
                      <div><span className="text-slate-400 block text-[10px]">الشعبة:</span><strong>{aggItem.student.className || "—"}</strong></div>
                    </div>

                    {/* Table */}
                    <table className="w-full text-right text-xs border border-slate-200 divide-y divide-slate-200">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="p-2">المادة</th>
                          <th className="p-2">المعلم</th>
                          <th className="p-2 text-center">التحصيل</th>
                          <th className="p-2 text-center">الانضباط</th>
                          <th className="p-2 text-center">السلوك</th>
                          <th className="p-2 text-center">المشاركة</th>
                          <th className="p-2">الملاحظات</th>
                          <th className="p-2 text-center">التوثيق</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {aggItem.teachersEvaluations.map((t, i) => (
                          <tr key={i}>
                            <td className="p-2 font-bold">{t.subject}</td>
                            <td className="p-2">{t.teacherName}</td>
                            <td className="p-2 text-center">{t.evaluation?.academicLevel || t.evaluation?.academicAchievement || "—"}</td>
                            <td className="p-2 text-center">{t.evaluation?.disciplineLevel || t.evaluation?.disciplineAndCommitment || "—"}</td>
                            <td className="p-2 text-center">{t.evaluation?.behaviorLevel || t.evaluation?.behaviorAndEthics || "—"}</td>
                            <td className="p-2 text-center">{t.evaluation?.participationLevel || t.evaluation?.participationAndInteraction || "—"}</td>
                            <td className="p-2 text-[11px]">{t.evaluation?.teacherNotes || "—"}</td>
                            <td className="p-2 text-center">
                              {t.status === "completed" && t.evaluation ? (
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-300">
                                  موثق ✓
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">بانتظار الإفادة</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Signatures */}
                    <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs">
                      <div>الموجه الطلابي: <strong>{schoolSignatories.counselorName || "أ. فهد التوجيه"}</strong></div>
                      <div>وكيل المدرسة: <strong>{schoolSignatories.vicePrincipalName || "أ. وكيل المدرسة"}</strong></div>
                      <div>مدير المدرسة: <strong>{schoolSignatories.principalName || "أ. مدير المدرسة"}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Bottom Actions Bar (Hidden in Print) */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0 no-print">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            يمكنك تخصيص الملاحظات الإرشادية والتوقيعات قبل تصدير التقرير أو طباعته بصيغة PDF.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrint("single")}
              className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة هذا التقرير</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
