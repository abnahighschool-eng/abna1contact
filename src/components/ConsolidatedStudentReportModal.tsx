import React, { useState, useMemo } from "react";
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
  ChevronDown,
  Eye,
  Filter,
  Layers,
  Sparkles,
  School,
  Share2,
  CheckSquare
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
    [key: string]: any;
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
  initialFilter?: "all" | "completed" | "opened" | "pending";
}

export default function ConsolidatedStudentReportModal({
  studentEval,
  schoolSignatories,
  allAggregatedStudents = [],
  onClose,
  onSelectAnotherStudent,
  initialFilter = "all",
}: ConsolidatedStudentReportModalProps) {
  // Filter options: "all" | "completed" (من قيموا) | "opened" (من فتحوا الرابط) | "pending" (بانتظار الإفادة)
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "opened" | "pending">(initialFilter);
  const [counselorNotes, setCounselorNotes] = useState<string>("");
  const [isEditingCounselorNotes, setIsEditingCounselorNotes] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("1447 / 1448 هـ");
  const [selectedTerm, setSelectedTerm] = useState("الفصل الدراسي الثالث");
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [printMode, setPrintMode] = useState<"single" | "all">("single");
  const [fontSizeMode, setFontSizeMode] = useState<"normal" | "large">("normal");
  const [showSignatures, setShowSignatures] = useState(true);
  const [showCounselorBox, setShowCounselorBox] = useState(true);

  const { student, teachersEvaluations, completedEvaluationsCount, totalInquiriesCount } = studentEval;

  // Compute status counts for the current student
  const counts = useMemo(() => {
    let completed = 0;
    let opened = 0;
    let pending = 0;

    teachersEvaluations.forEach((t) => {
      if (t.status === "completed" || !!t.evaluation) {
        completed++;
      } else if (t.status === "opened") {
        opened++;
      } else {
        pending++;
      }
    });

    return {
      all: teachersEvaluations.length,
      completed,
      opened,
      pending,
    };
  }, [teachersEvaluations]);

  // Filter teacher evaluations based on active filter
  const filteredTeacherEvaluations = useMemo(() => {
    if (filterStatus === "all") return teachersEvaluations;
    if (filterStatus === "completed") {
      return teachersEvaluations.filter((t) => t.status === "completed" || !!t.evaluation);
    }
    if (filterStatus === "opened") {
      return teachersEvaluations.filter((t) => t.status === "opened" && !t.evaluation);
    }
    if (filterStatus === "pending") {
      return teachersEvaluations.filter((t) => (t.status === "pending" || t.status === "failed") && !t.evaluation);
    }
    return teachersEvaluations;
  }, [teachersEvaluations, filterStatus]);

  // Overall Averages for completed items
  const completedList = useMemo(() => {
    return teachersEvaluations.filter((t) => t.evaluation && (t.status === "completed" || t.evaluation.academicLevel || t.evaluation.academicAchievement));
  }, [teachersEvaluations]);

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
      case "متميز":
      case "ممتاز": return 4;
      case "ملتزم":
      case "جيد جداً": return 3;
      case "يحتاج توجيه":
      case "جيد": return 2;
      case "غير منضبط":
      case "ضعيف": return 1;
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
    if (score >= 3.5) return { label: "ممتاز (متميز)", color: "text-emerald-800 bg-emerald-50 border-emerald-300" };
    if (score >= 2.5) return { label: "جيد جداً (مرتفع)", color: "text-blue-800 bg-blue-50 border-blue-300" };
    if (score >= 1.5) return { label: "جيد (متوسط)", color: "text-amber-800 bg-amber-50 border-amber-300" };
    return { label: "يحتاج إلى متابعة ودعم", color: "text-rose-800 bg-rose-50 border-rose-300" };
  };

  const handlePrint = (mode: "single" | "all" = "single") => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCopySummary = () => {
    const summaryText = `*تقرير استعلام وتقييم المعلمين عن الطالب: ${student.name}*
الصف/الشعبة: ${student.grade || ""} / ${student.className || ""}
رقم الطالب: ${student.id || student["رقم الطالب"] || student.nationalId || "—"}
المدرسة: ${schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}
نطاق التقرير: ${
  filterStatus === "completed"
    ? "من قيّموا فقط"
    : filterStatus === "opened"
    ? "من فتحوا الرابط فقط"
    : filterStatus === "pending"
    ? "بانتظار الإفادة فقط"
    : "كافة المعلمين"
}

*إفادات وتقييمات المعلمين المشمولة (${filteredTeacherEvaluations.length} معلماً):*
${filteredTeacherEvaluations
  .map((t, idx) => {
    if (t.evaluation && (t.status === "completed" || t.evaluation.academicLevel)) {
      return `[معلم ${idx + 1}] ${t.teacherName} (مادة ${t.subject})
- التحصيل الدراسي: ${t.evaluation.academicLevel || t.evaluation.academicAchievement || "—"}
- الانضباط الصفي: ${t.evaluation.disciplineLevel || t.evaluation.disciplineAndCommitment || "—"}
- السلوك والمواظبة: ${t.evaluation.behaviorLevel || t.evaluation.behaviorAndEthics || "—"}
- المشاركة والتفاعل: ${t.evaluation.participationLevel || t.evaluation.participationAndInteraction || "—"}
- ملاحظات وتوصيات المعلم: ${t.evaluation.teacherNotes || t.evaluation.generalRecommendation || "لا توجد ملاحظات إضافية"}`;
    } else if (t.status === "opened") {
      return `[معلم ${idx + 1}] ${t.teacherName} (مادة ${t.subject}) - فتح الرابط واطلع عليه (قيد الرصد)`;
    } else {
      return `[معلم ${idx + 1}] ${t.teacherName} (مادة ${t.subject}) - بانتظار الإفادة`;
    }
  })
  .join("\n\n")}

${counselorNotes ? `*مرئيات وتوصيات التوجيه الطلابي:*\n${counselorNotes}\n` : ""}
- الموجه الطلابي: ${schoolSignatories.counselorName || "—"}
- وكيل شؤون الطلاب: ${schoolSignatories.vicePrincipalName || "—"}
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

  const studentIdentifier =
    student.id ||
    student["رقم الطالب"] ||
    student.nationalId ||
    student["السجل المدني"] ||
    "—";

  // Filter description for tarwisa subtitle
  const getFilterSubtitle = () => {
    switch (filterStatus) {
      case "completed":
        return "تقرير إفادات وتقييمات المعلمين المكتملة والمعتمدة رسمياً";
      case "opened":
        return "تقرير متابعة المعلمين الذين اطلعوا على الرابط وقيد تدوين التقييم";
      case "pending":
        return "تقرير المعلمين الذين لم يستكملوا إفاداتهم بعد (بانتظار الرصد)";
      default:
        return "تقرير استعلام وتقييم شامل لكافة معلمي المقررات الدراسية";
    }
  };

  // Helper to render individual teacher evaluation card (Ink-Saving & Beautiful)
  const renderTeacherCard = (
    tEval: AggregatedStudentEvaluation["teachersEvaluations"][0],
    index: number
  ) => {
    const ev = tEval.evaluation;
    const isDone = (tEval.status === "completed" || !!ev) && !!(ev?.academicLevel || ev?.academicAchievement);
    const isOpened = tEval.status === "opened" && !isDone;
    const isPending = !isDone && !isOpened;

    // Teacher notes text (from general notes, recommendation or specific notes)
    const teacherNotesText =
      ev?.teacherNotes ||
      ev?.generalRecommendation ||
      ev?.academicNotes ||
      ev?.behaviorNotes ||
      ev?.disciplineNotes ||
      "";

    return (
      <div
        key={tEval.inquiryId || index}
        className="border-2 border-slate-300 rounded-xl p-4 sm:p-5 bg-white print-avoid-break space-y-3.5 shadow-2xs"
      >
        {/* Top Header of Teacher Card: Number, Name, Subject, Section, and Status Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
              {index + 1}
            </span>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-slate-950 text-sm sm:text-base tracking-tight">
                  {tEval.teacherName}
                </h4>
                <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-0.5 rounded-md font-extrabold border border-slate-300">
                  مادة: {tEval.subject}
                </span>
                {tEval.section && (
                  <span className="bg-slate-50 text-slate-600 text-xs px-2 py-0.5 rounded-md font-semibold border border-slate-200">
                    شعبة {tEval.section}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Teacher Status Badge */}
          <div className="shrink-0 flex items-center gap-2">
            {isDone ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>تم التقييم والاعتماد رسميـاً</span>
              </span>
            ) : isOpened ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-300 text-xs font-bold">
                <Eye className="w-4 h-4 text-blue-700" />
                <span>اطلع المعلم على الرابط (قيد الرصد)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>بانتظار إفادة المعلم</span>
              </span>
            )}
          </div>
        </div>

        {/* If teacher completed evaluation: Show 4 structured criteria in large readable chips */}
        {isDone && ev ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {/* 1. Academic Achievement */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-600 block">1. التحصيل الدراسي:</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs sm:text-sm border ${
                    (ev.academicLevel || ev.academicAchievement) === "ممتاز"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : (ev.academicLevel || ev.academicAchievement) === "جيد جداً"
                      ? "bg-blue-50 text-blue-900 border-blue-300"
                      : (ev.academicLevel || ev.academicAchievement) === "جيد"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-rose-50 text-rose-900 border-rose-300"
                  }`}
                >
                  {ev.academicLevel || ev.academicAchievement || "ممتاز"}
                </span>
              </div>

              {/* 2. Discipline & Commitment */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-600 block">2. الانضباط والالتزام الصفي:</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs sm:text-sm border ${
                    (ev.disciplineLevel || ev.disciplineAndCommitment) === "ممتاز"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : (ev.disciplineLevel || ev.disciplineAndCommitment) === "جيد جداً"
                      ? "bg-blue-50 text-blue-900 border-blue-300"
                      : (ev.disciplineLevel || ev.disciplineAndCommitment) === "جيد"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-rose-50 text-rose-900 border-rose-300"
                  }`}
                >
                  {ev.disciplineLevel || ev.disciplineAndCommitment || "ممتاز"}
                </span>
              </div>

              {/* 3. Behavior & Ethics */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-600 block">3. السلوك والمواظبة:</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs sm:text-sm border ${
                    String(ev.behaviorLevel || ev.behaviorAndEthics) === "متميز" || (ev.behaviorLevel || ev.behaviorAndEthics) === "ممتاز"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : String(ev.behaviorLevel || ev.behaviorAndEthics) === "ملتزم" || (ev.behaviorLevel || ev.behaviorAndEthics) === "جيد جداً"
                      ? "bg-blue-50 text-blue-900 border-blue-300"
                      : String(ev.behaviorLevel || ev.behaviorAndEthics) === "يحتاج توجيه" || (ev.behaviorLevel || ev.behaviorAndEthics) === "جيد"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-rose-50 text-rose-900 border-rose-300"
                  }`}
                >
                  {ev.behaviorLevel || ev.behaviorAndEthics || "ممتاز"}
                </span>
              </div>

              {/* 4. Participation & Interaction */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 space-y-1">
                <span className="text-[11px] font-bold text-slate-600 block">4. المشاركة والتفاعل:</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs sm:text-sm border ${
                    String(ev.participationLevel || ev.participationAndInteraction) === "متفاعل دائماً" || (ev.participationLevel || ev.participationAndInteraction) === "ممتاز"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : (ev.participationLevel || ev.participationAndInteraction) === "جيد جداً"
                      ? "bg-blue-50 text-blue-900 border-blue-300"
                      : String(ev.participationLevel || ev.participationAndInteraction) === "متوسط" || (ev.participationLevel || ev.participationAndInteraction) === "جيد"
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-rose-50 text-rose-900 border-rose-300"
                  }`}
                >
                  {ev.participationLevel || ev.participationAndInteraction || "ممتاز"}
                </span>
              </div>
            </div>

            {/* MANDATORY RECTANGLE: Teacher's Written Notes Below Name & Evaluations */}
            <div className="border border-slate-300 bg-slate-50/80 rounded-xl p-3 sm:p-4 space-y-1.5 text-right">
              <div className="flex items-center justify-between text-xs font-black text-slate-900 border-b border-slate-200 pb-1">
                <span className="flex items-center gap-1.5 text-emerald-900">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ملاحظات وتوصيات المعلم لمتابعة الطالب:</span>
                </span>
                {tEval.completedAt && (
                  <span className="text-[10px] text-slate-500 font-mono font-medium">
                    تاريخ الرصد: {tEval.completedAt}
                  </span>
                )}
              </div>

              {teacherNotesText ? (
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-slate-900 font-semibold text-xs sm:text-sm leading-relaxed whitespace-pre-line select-text">
                  {teacherNotesText}
                </div>
              ) : (
                <div className="bg-white border border-slate-200/90 rounded-lg p-2.5 text-slate-400 italic text-xs">
                  لا توجد ملاحظات كتابية إضافية مدونة من قِبل المعلم (اكتفى برصد معايير التقييم أعلاه).
                </div>
              )}
            </div>
          </div>
        ) : isOpened ? (
          /* Notice for opened status */
          <div className="border border-blue-200 bg-blue-50/60 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between gap-2">
            <span className="font-semibold flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                قام المعلم بفتح رابط الاستمارة الإلكتروني، وهو بانتظار استكمال رصد التقييمات وتدوين الملاحظات.
              </span>
            </span>
            <span className="text-[10px] text-blue-700 font-mono shrink-0">
              تاريخ الإرسال: {tEval.sentAt || "اليوم"}
            </span>
          </div>
        ) : (
          /* Notice for pending status */
          <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between gap-2">
            <span className="font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                تم إرسال رابط الاستعلام الإلكتروني للمعلم، وبانتظار تدوين التقييم والملاحظات الرسمية.
              </span>
            </span>
            <span className="text-[10px] text-amber-700 font-mono shrink-0">
              تاريخ الإرسال: {tEval.sentAt || "اليوم"}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Helper to render entire single student report (Used for single view and batch loop)
  const renderStudentFullReportContent = (
    currentStudentEval: AggregatedStudentEvaluation,
    isBatch = false
  ) => {
    const curStudent = currentStudentEval.student;
    const curTeacherList =
      filterStatus === "all"
        ? currentStudentEval.teachersEvaluations
        : filterStatus === "completed"
        ? currentStudentEval.teachersEvaluations.filter((t) => t.status === "completed" || !!t.evaluation)
        : filterStatus === "opened"
        ? currentStudentEval.teachersEvaluations.filter((t) => t.status === "opened" && !t.evaluation)
        : currentStudentEval.teachersEvaluations.filter((t) => (t.status === "pending" || t.status === "failed") && !t.evaluation);

    const curCompletedList = currentStudentEval.teachersEvaluations.filter(
      (t) => t.evaluation && (t.status === "completed" || t.evaluation.academicLevel || t.evaluation.academicAchievement)
    );

    const curIdentifier =
      curStudent.id ||
      curStudent["رقم الطالب"] ||
      curStudent.nationalId ||
      curStudent["السجل المدني"] ||
      "—";

    const curAvgAcademicScore =
      curCompletedList.length > 0
        ? curCompletedList.reduce(
            (acc, curr) => acc + getAcademicScore(curr.evaluation?.academicLevel || curr.evaluation?.academicAchievement),
            0
          ) / curCompletedList.length
        : 0;

    const curAvgDisciplineScore =
      curCompletedList.length > 0
        ? curCompletedList.reduce(
            (acc, curr) => acc + getDisciplineScore(curr.evaluation?.disciplineLevel || curr.evaluation?.disciplineAndCommitment),
            0
          ) / curCompletedList.length
        : 0;

    const curAvgBehaviorScore =
      curCompletedList.length > 0
        ? curCompletedList.reduce(
            (acc, curr) => acc + getBehaviorScore(curr.evaluation?.behaviorLevel || curr.evaluation?.behaviorAndEthics),
            0
          ) / curCompletedList.length
        : 0;

    const randomRef = curIdentifier.replace(/\D/g, "").slice(-4) || "2048";

    return (
      <div
        className={`w-full max-w-[210mm] mx-auto bg-white border border-slate-300 shadow-xl rounded-2xl print:rounded-none print:shadow-none print:border-none p-6 sm:p-8 print:p-0 flex flex-col gap-4 text-slate-900 transition-all ${
          isBatch ? "print:mb-12" : ""
        }`}
        style={{ minHeight: "297mm", pageBreakAfter: isBatch ? "always" : "auto" }}
      >
        {/* ========================================================================= */}
        {/* 1. OFFICIAL INSTITUTIONAL TARWISA (Identical to Attendance Reports) */}
        {/* ========================================================================= */}
        <div className="border-b-2 border-slate-900 pb-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-4">
            {/* Right: State, Ministry, Administration & School Details */}
            <div className="text-right flex flex-col text-xs leading-snug text-slate-800 flex-1">
              <span className="font-extrabold text-xs sm:text-sm text-slate-950 tracking-wide">
                {schoolSignatories.countryName || "المملكة العربية السعودية"}
              </span>
              <span className="font-bold text-xs text-slate-900 mt-0.5">
                {schoolSignatories.ministryName || "وزارة التعليم"}
              </span>
              <span className="font-semibold text-slate-700 text-[11px] mt-0.5">
                {schoolSignatories.administrationName || "الإدارة العامة للتعليم"}
              </span>
              <span className="font-extrabold text-xs text-emerald-900 mt-0.5">
                {schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}
              </span>
              <span className="text-[10px] text-slate-600 font-medium">
                قسم التوجيه الطلابي والإرشاد
              </span>
            </div>

            {/* Center: Customizable Logo & Official Title */}
            <div className="flex flex-col items-center justify-center text-center shrink-0 px-2">
              {schoolSignatories.logoUrl ? (
                <div className="mb-1 flex items-center justify-center">
                  <img
                    src={schoolSignatories.logoUrl}
                    alt="شعار المدرسة"
                    referrerPolicy="no-referrer"
                    style={{
                      width: `${schoolSignatories.logoWidth || 65}px`,
                      height: `${schoolSignatories.logoHeight || 65}px`,
                      objectFit: "contain",
                    }}
                    className="rounded-md"
                  />
                </div>
              ) : (
                <div className="mb-1 flex items-center justify-center text-emerald-800">
                  <div className="w-10 h-10 rounded-xl border border-emerald-700 flex items-center justify-center bg-emerald-50/50">
                    <School className="w-5 h-5 text-emerald-800" />
                  </div>
                </div>
              )}

              <h1 className="text-sm sm:text-base font-black text-slate-950 tracking-tight leading-snug">
                تقرير استعلام وتقييم المعلمين الشامل عن الطالب
              </h1>
              <span className="text-[10.5px] font-bold text-emerald-800">
                ({getFilterSubtitle()})
              </span>
            </div>

            {/* Left: Metadata & Timestamps */}
            <div className="text-left flex flex-col text-[11px] leading-tight text-slate-800 font-mono flex-1">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-sans font-bold text-slate-900">تاريخ التقرير:</span>
                <span className="font-bold">{new Date().toLocaleDateString("ar-SA")}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="font-sans font-medium text-slate-600">العام الدراسي:</span>
                <span>{selectedAcademicYear}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="font-sans font-medium text-slate-600">الفصل الدراسي:</span>
                <span>{selectedTerm}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                <span className="font-sans font-medium text-slate-600">الرقم المرجعي:</span>
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-800 border border-slate-200">
                  INQ-{new Date().getFullYear()}-{randomRef}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. STUDENT OFFICIAL IDENTIFICATION CARD (Large, Accessible, Ink-Saving) */}
        {/* ========================================================================= */}
        <div className="bg-slate-50/80 border border-slate-300 rounded-xl p-3.5 space-y-2.5 print-avoid-break">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
              <span className="text-[10px] text-slate-500 font-bold block">اسم الطالب الرباعي:</span>
              <strong className="text-slate-950 font-black text-sm sm:text-base block truncate">
                {curStudent.name}
              </strong>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
              <span className="text-[10px] text-slate-500 font-bold block">رقم الطالب / الهوية:</span>
              <strong className="text-slate-900 font-mono font-black text-xs sm:text-sm block">
                {curIdentifier}
              </strong>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
              <span className="text-[10px] text-slate-500 font-bold block">الصف الدراسي:</span>
              <strong className="text-slate-900 font-bold text-xs sm:text-sm block">
                {curStudent.grade || "المرحلة الثانوية"}
              </strong>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
              <span className="text-[10px] text-slate-500 font-bold block">الشعبة / الفصل:</span>
              <strong className="text-slate-900 font-bold text-xs sm:text-sm block">
                {curStudent.className ? `شعبة ${curStudent.className}` : "الشعبة المقررة"}
              </strong>
            </div>
          </div>

          {/* Statistical Scope Row */}
          <div className="flex items-center justify-between text-[11px] pt-0.5 px-1 border-t border-slate-200 text-slate-700">
            <div className="flex items-center gap-3 flex-wrap">
              <span>
                إجمالي المعلمين المستطلعين: <strong>{currentStudentEval.totalInquiriesCount} معلماً</strong>
              </span>
              <span>•</span>
              <span className="text-emerald-800">
                المعتمد تقييمهم: <strong>{currentStudentEval.completedEvaluationsCount} من المعلمين</strong>
              </span>
              <span>•</span>
              <span>
                المعروض في هذا التقرير: <strong>{curTeacherList.length} تقريراً</strong>
              </span>
            </div>
            <div className="font-bold text-slate-900 hidden sm:block">
              {filterStatus === "completed" ? "نطاق العرض: المعلمون المقيّمون فقط" : "نظام الاستعلام والمتابعة المدرسية"}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. OVERALL ANALYTICS & KPIS SUMMARY (Ink-Saving) */}
        {/* ========================================================================= */}
        {curCompletedList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs print-avoid-break">
            <div className="bg-white border border-slate-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">التحصيل الدراسي العام:</span>
                <span className="font-black text-slate-900 text-xs sm:text-sm block">
                  {getGeneralRatingLabel(curAvgAcademicScore).label}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                {curCompletedList.length} معلمين
              </span>
            </div>

            <div className="bg-white border border-slate-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">الانضباط الصفي العام:</span>
                <span className="font-black text-slate-900 text-xs sm:text-sm block">
                  {getGeneralRatingLabel(curAvgDisciplineScore).label}
                </span>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                التزام مدرسي
              </span>
            </div>

            <div className="bg-white border border-slate-300 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">السلوك والمواظبة العامة:</span>
                <span className="font-black text-slate-900 text-xs sm:text-sm block">
                  {getGeneralRatingLabel(curAvgBehaviorScore).label}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                تفاعل إيجابي
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. SEPARATE TEACHER EVALUATION CARDS WITH NOTES RECTANGLE */}
        {/* ========================================================================= */}
        <div className="space-y-3.5 flex-1">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 text-xs font-black text-slate-900">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              <span>إفادات وتقييمات المعلمين التفصيلية ({curTeacherList.length} معلماً):</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              كل تقرير معلم مستقل بصرياً لضمان دقة القراءة والتوثيق
            </span>
          </div>

          {curTeacherList.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-700">لا توجد تقارير مطابقة لنطاق العرض المحدد</div>
              <p className="text-[11px] text-slate-400">
                {filterStatus === "completed"
                  ? "لم يقم أي معلم برصد تقييمه بعد، يمكنك اختيار (الكل) لمعاينة قائمة المعلمين المستطلعين."
                  : filterStatus === "opened"
                  ? "لا يوجد معلمون في حالة (فتح الرابط) حالياً."
                  : "كافة المعلمين قاموا بالرد وتعبئة التقييمات بنجاح."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {curTeacherList.map((tEval, idx) => renderTeacherCard(tEval, idx))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 5. COUNSELOR GUIDANCE & ACTION PLAN RECTANGLE */}
        {/* ========================================================================= */}
        {showCounselorBox && (
          <div className="bg-slate-50/80 border border-slate-300 rounded-xl p-3.5 space-y-1.5 text-right print-avoid-break">
            <div className="flex items-center justify-between text-xs font-black text-slate-900 border-b border-slate-200 pb-1">
              <span className="flex items-center gap-1.5 text-slate-900">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>مرئيات وخطة التوجيه الطلابي الموصى بها لولي الأمر:</span>
              </span>

              {!isBatch && (
                <button
                  type="button"
                  onClick={() => setIsEditingCounselorNotes(!isEditingCounselorNotes)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer no-print"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditingCounselorNotes ? "اعتماد النص" : "كتابة / تعديل التوصيات"}</span>
                </button>
              )}
            </div>

            {isEditingCounselorNotes && !isBatch ? (
              <textarea
                value={counselorNotes}
                onChange={(e) => setCounselorNotes(e.target.value)}
                placeholder="اكتب هنا مرئيات وتوصيات الموجه الطلابي، خطة المتابعة المنزلية، والإجراءات الإرشادية لتعزيز مستوى الطالب..."
                rows={3}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed font-sans"
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-900 font-semibold leading-relaxed">
                {counselorNotes ? (
                  <p className="whitespace-pre-line">{counselorNotes}</p>
                ) : (
                  <p className="text-slate-600">
                    تمت مراجعة ومطابقة إفادات المعلمين من قِبل التوجيه الطلابي بالمدرسة. يُوصى ولي الأمر
                    بالتواصل المستمر مع المدرسة ومتابعة التحصيل الدراسي وأداء الواجبات بانتظام.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. OFFICIAL SIGNATORIES FOOTER (Identical to Attendance Reports) */}
        {/* ========================================================================= */}
        {showSignatures && (
          <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs print-avoid-break mt-auto">
            {/* 1. Counselor */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-600 font-bold block">الموجه الطلابي:</span>
              <div className="h-7 flex items-center justify-center">
                <strong className="text-slate-950 font-black text-xs block">
                  {schoolSignatories.counselorName || "أ. فهد التوجيه"}
                </strong>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-1 text-[10px] text-slate-400 font-medium">
                التوقيع: ................................
              </div>
            </div>

            {/* 2. Vice Principal */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-600 font-bold block">وكيل شؤون الطلاب:</span>
              <div className="h-7 flex items-center justify-center">
                <strong className="text-slate-950 font-black text-xs block">
                  {schoolSignatories.vicePrincipalName || "أ. وكيل المدرسة"}
                </strong>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-1 text-[10px] text-slate-400 font-medium">
                التوقيع: ................................
              </div>
            </div>

            {/* 3. Principal & Stamp */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-600 font-bold block">مدير المدرسة:</span>
              <div className="h-7 flex items-center justify-center">
                <strong className="text-slate-950 font-black text-xs block">
                  {schoolSignatories.principalName || "أ. مدير المدرسة"}
                </strong>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-1 text-[10px] text-slate-400 font-medium">
                الختم والتوقيع الرسمي
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      dir="rtl"
      id="consolidated-report-modal-overlay"
    >
      {/* Strict Standard A4 Print CSS with 1.5cm margins */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #main-header, #main-footer, #wizard-navigation-tabs, .no-print, #consolidated-report-modal-overlay {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-single-student-report, .printable-a4-document {
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Dialog Box */}
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* ========================================================================= */}
        {/* TOP TOOLBAR: Actions, Switching & Print Controls (Hidden in Print) */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 shrink-0 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2 flex-wrap">
                  <span>تقرير استعلام وتقييم المعلمين المعتمد</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold">
                    {completedEvaluationsCount} من {totalInquiriesCount} معلماً أكملوا التقييم
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  تصميم رسمي احترافي موفر للحبر متوافق مع معايير A4 بهوامش 1.5 سم
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
              {/* Student Switcher Dropdown */}
              {allAggregatedStudents.length > 1 && onSelectAnotherStudent && (
                <div className="relative inline-block text-xs">
                  <select
                    value={student.id}
                    onChange={(e) => {
                      const target = allAggregatedStudents.find((s) => s.student.id === e.target.value);
                      if (target) onSelectAnotherStudent(target);
                    }}
                    className="py-2 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer text-xs shadow-2xs"
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
                className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="نسخ التقرير لمشاركته عبر واتساب"
              >
                {copiedNotification ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-black">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ النص</span>
                  </>
                )}
              </button>

              {/* Single Print Button */}
              <button
                type="button"
                onClick={() => handlePrint("single")}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير (A4)</span>
              </button>

              {/* Batch Print All Students if available */}
              {allAggregatedStudents.length > 1 && (
                <button
                  type="button"
                  onClick={() => handlePrint("all")}
                  className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hidden md:flex"
                  title="طباعة تقارير كافة الطلاب دفعة واحدة بنفس الفلتر المختار"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>طباعة جماعية ({allAggregatedStudents.length} طلاب)</span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title="إغلاق المعاينة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* USER SPECIFICATION: FILTERING CHIPS (All, Evaluated, Opened, Pending) */}
          {/* ========================================================================= */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-slate-800 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-emerald-700" />
                <span>خيارات استعراض وتصفية التقرير:</span>
              </span>

              {/* 1. All */}
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>الكل</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    filterStatus === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {counts.all}
                </span>
              </button>

              {/* 2. Evaluated Only */}
              <button
                type="button"
                onClick={() => setFilterStatus("completed")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "completed"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>من قيّموا فقط</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    filterStatus === "completed" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {counts.completed}
                </span>
              </button>

              {/* 3. Opened Link Only */}
              <button
                type="button"
                onClick={() => setFilterStatus("opened")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "opened"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-blue-500" />
                <span>من فتحوا الرابط</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    filterStatus === "opened" ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-800"
                  }`}
                >
                  {counts.opened}
                </span>
              </button>

              {/* 4. Pending Only */}
              <button
                type="button"
                onClick={() => setFilterStatus("pending")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === "pending"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>بانتظار الإفادة</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    filterStatus === "pending" ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {counts.pending}
                </span>
              </button>
            </div>

            {/* Print Customization Toggles */}
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCounselorBox}
                  onChange={(e) => setShowCounselorBox(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-600 rounded"
                />
                <span>توصيات التوجيه</span>
              </label>

              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-600 rounded"
                />
                <span>التوقيعات الرسمية</span>
              </label>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SCROLLABLE DOCUMENT PREVIEW BODY */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-200/50 print:bg-white print:p-0">
          {/* SINGLE REPORT PREVIEW */}
          <div className={`${printMode === "all" ? "print:hidden" : ""}`}>
            {renderStudentFullReportContent(studentEval, false)}
          </div>

          {/* BATCH ALL STUDENTS PRINT VIEW */}
          {printMode === "all" && allAggregatedStudents.length > 0 && (
            <div className="hidden print:block space-y-12">
              {allAggregatedStudents.map((aggItem) => renderStudentFullReportContent(aggItem, true))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER (Hidden in Print) */}
        {/* ========================================================================= */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0 no-print">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            <span className="font-bold text-slate-700">ملاحظة:</span> يمكنك طباعة التقرير أو حفظه بصيغة PDF بالضغط على زر الطباعة. التقرير منظم وموفر للحبر تماماً.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrint("single")}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة هذا التقرير الآن</span>
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
