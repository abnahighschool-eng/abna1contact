import React, { useState } from "react";
import { 
  X, 
  Printer, 
  FileText, 
  Sparkles, 
  School, 
  CheckCircle2, 
  AlertTriangle, 
  Send,
  Edit3,
  Calendar,
  UserCheck,
  ShieldAlert,
  Download
} from "lucide-react";
import { SchoolSignatories, NoorStudentAbsence } from "../types";

export type GuidanceDocType = 
  | "learning_plan" 
  | "case_study" 
  | "committee_minutes" 
  | "principal_referral" 
  | "actions_history";

interface GuidanceDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: GuidanceDocType;
  student: NoorStudentAbsence;
  signatories: SchoolSignatories;
  absenceCategory: "excused" | "unexcused";
  thresholdDays: 3 | 5 | 10;
  onSaveAction?: (actionData: any) => void;
  onSendWhatsApp?: (message: string) => void;
}

export default function GuidanceDocumentModal({
  isOpen,
  onClose,
  docType,
  student,
  signatories,
  absenceCategory,
  thresholdDays,
  onSaveAction,
  onSendWhatsApp,
}: GuidanceDocumentModalProps) {
  if (!isOpen) return null;

  const todayGregorian = new Date().toISOString().split("T")[0];
  const todayHijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(new Date());

  const daysCount = absenceCategory === "excused" ? student.excusedDaysCount : student.unexcusedDaysCount;
  const datesList = absenceCategory === "excused" ? student.excusedDates : student.unexcusedDates;
  const formattedDates = datesList.length > 0 ? datesList.join(" ، ") : "اليوم وتواريخ سابقة مسجلة بنظام نور";

  // Template initial state generator
  const getInitialContent = () => {
    if (docType === "learning_plan") {
      return {
        title: "خطة التعلم والمهام التربوية أثناء أيام الغياب",
        goals: "تمكين الطالب من استدراك الفاقد التعليمي ومتابعة الدروس والواجبات والأنشطة المدرسية عبر منصة مدرستي والقنوات التعليمية المعتمدة.",
        responsibilities: "1. متابعة ولي الأمر لجدول الحصص والواجبات اليومية.\n2. تكليف المعلمين بتحديد المهارات الأساسية وتزويد الطالب بها.\n3. أداء الاختبارات القصيرة والتطبيقات الصفية البديلة فور العودة.\n4. التواصل المستمر مع الموجه الطلابي وإدارة المدرسة.",
        schedule: "متابعة يومية عبر منصة مدرستي + تسليم المهام الأسبوعية للموجه الطلابي.",
        recommendations: "التزام ولي الأمر بتنفيذ الخطة التربوية لضمان عدم تأثر التحصيل الدراسي للطالب."
      };
    }

    if (docType === "case_study") {
      return {
        title: `تقرير دراسة حالة غياب طالب (${absenceCategory === "excused" ? "بعذر مقبول" : "بدون عذر"})`,
        problemDefinition: `تكرار غياب الطالب (${student.studentName}) بمجموع (${daysCount}) أيام (${absenceCategory === "excused" ? "بعذر" : "بدون عذر"})، بالتواريخ: [${formattedDates}].`,
        initialDiagnosis: absenceCategory === "excused" 
          ? "غياب متكرر بسبب ظروف صحية/أسرية مبررة مع الحاجة لتقييم أثر الغياب على الانضباط والتحصيل الدراسي وتقديم الدعم النفسي والتربوي." 
          : "غياب غير مبرر يهدد المستوى الدراسي والانضباط السلوكي، مع وجود فجوة في المتابعة الأسرية تستدعي التدخل الإرشادي العاجل.",
        factors: "• العوامل الذاتية: الرغبة في تحسين الدافعية للتعلم والانضباط الصباحي.\n• العوامل المدرسية: تكثيف المتابعة التربوية وتشجيع الطالب.\n• العوامل الأسرية: تعزيز شراكة الأسرة مع المدرسة ومتابعة الحضور اليومي.",
        interventionPlan: "1. عقد جلسة إرشادية فردية مع الطالب لتحديد دوافع الغياب وتعزيز السلوك الإيجابي.\n2. التواصل المستمر مع ولي الأمر وتزويده بالتقارير الدورية.\n3. إشراك معلمي المواد في خطة الدعم والتعويض التعليمي.\n4. إحالة الحالة للجنة التوجيه الطلابي في حال تكرار الغياب وتجاوز 5 أيام.",
        recommendations: "تطبيق قواعد السلوك والمواظبة، تقديم خطة الدعم الأكاديمي، ومتابعة الحالة بانتظام من قبل الموجه الطلابي."
      };
    }

    if (docType === "committee_minutes") {
      return {
        title: "محضر اجتماع لجنة التوجيه والإرشاد الطلابي حيال غياب الطالب",
        meetingNumber: "محضر رقم ( " + Math.floor(Math.random() * 80 + 10) + " ) للعام الدراسي 1447هـ",
        meetingTopic: `مراجعة وتحديث الخطة التربوية والعلاجية للطالب (${student.studentName}) بعد بلوغ غيابه (${daysCount}) أيام (${absenceCategory === "excused" ? "بعذر" : "بدون عذر"}) ومناقشة مدى التزام ولي الأمر بالخطة.`,
        membersList: [
          { role: "مدير المدرسة (رئيس اللجنة)", name: signatories.principalName || "مدير المدرسة" },
          { role: "وكيل شؤون الطلاب (نائب الرئيس)", name: signatories.vicePrincipalName || "وكيل شؤون الطلاب" },
          { role: "الموجه الطلابي (مقرر اللجنة)", name: signatories.counselorName || "الموجه الطلابي" },
          { role: "معلم متميز / رائد الفصل", name: "معلم الصف / رائد الفصل" },
        ],
        meetingDiscussions: "عقدت لجنة التوجيه والإرشاد اجتماعها لدراسة وضع الطالب بعد تكرار الغياب، حيث تمت مراجعة الإجراءات السابقة (دراسة الحالة، الرسائل السابقة لولي الأمر، خطة التعلم)، ولوحظ استمرار الغياب بالتواريخ المدونة في نظام نور.",
        decisions: "1. تنظيم جلسة توعوية عاجلة مع ولي الأمر للتأكيد على أهمية الخطط التربوية العلاجية وأثر الغياب.\n2. تحديث الخطة التربوية والعلاجية للطالب ومتابعة تنفيذها أسبوعياً.\n3. التنبيه على ولي الأمر بالتبعات النظامية في حال استمرار الغياب وبلوغه 10 أيام.\n4. استدعاء ولي الأمر وتوثيق المحضر رسمياً."
      };
    }

    if (docType === "principal_referral") {
      return {
        title: "إشعار واستمارة إحالة لمدير المدرسة للرفع لإدارة التعليم (حماية الطفل والإيذاء)",
        subject: `إحالة حالة الطالب (${student.studentName}) لتكرار الغياب (${daysCount}) أيام واشتباه تعرضه للإهمال`,
        legalReference: "بناءً على ما ورد في نظام حماية الطفل الصادر بالمرسوم الملكي رقم (م/14) ولائحته التنفيذية، ونظام الحماية من الإيذاء، والتعاميم المنظمة لمتابعة الانضباط المدرسي وقواعد السلوك والمواظبة.",
        summaryOfPastActions: `1. تم رصد غياب الطالب لعدد (${daysCount}) أيام بالتواريخ: [${formattedDates}].\n2. تم إعداد دراسة حالة شاملة للطالب وتقديم خطة التعلم.\n3. تم إشعار واستدعاء ولي الأمر عبر رسائل الواتساب والاتصال الهاتفي.\n4. تم عقد اجتماع لجنة التوجيه والإرشاد الطلابي وتنظيم جلسة توعوية.\n5. لوحظ استمرار انقطاع الطالب وغيابه مما يشكل شبهة إهمال أسري مفرط لحقه في التعليم.`,
        committeeOpinion: "توصي لجنة التوجيه والإرشاد بإحالة ملف الطالب لسعادتكم للتكرم بالتوجيه بالرفع لإدارة التعليم والجهات ذات العلاقة (وحدة الحماية الأسرية / خط مساندة الطفل 116111) لتطبيق الأنظمة واللوائح المعتمدة.",
        principalDirective: "يُعتمد الرفع الفوري لإدارة التعليم (قسم التوجيه الطلابي / وحدة الحماية) لمخاطبة الجهات المختصة ومتابعة الحالة بصفة عاجلة."
      };
    }

    return {
      title: `سجل الإجراءات المتدرجة لغياب الطالب (${student.studentName})`,
      content: `سجل شامل لتوثيق كافة الإجراءات النظامية المنفذة مع الطالب لعدد (${daysCount}) أيام غياب.`
    };
  };

  const [formData, setFormData] = useState<any>(getInitialContent());
  const [isEditing, setIsEditing] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full my-auto shadow-2xl border border-slate-200 text-right space-y-4 max-h-[92vh] flex flex-col animate-scaleUp">
        
        {/* Modal Top Bar (Controls - No Print) */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 no-print bg-slate-50 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${
              docType === "principal_referral" ? "bg-red-600" : docType === "committee_minutes" ? "bg-indigo-600" : "bg-emerald-600"
            }`}>
              {docType === "principal_referral" ? <ShieldAlert className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">{formData.title || "الوثيقة الإرشادية الرسمية"}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-800">
                  {absenceCategory === "excused" ? `بعذر (${daysCount} أيام)` : `بدون عذر (${daysCount} أيام)`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                الطالب: <strong className="text-slate-800">{student.studentName}</strong> | الصف: {student.grade || "-"} - فصل ({student.className || "-"})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isEditing ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? "معاينة الوثيقة" : "تعديل النصوص"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>طباعة A4 رسمية</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Document Area */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-slate-800">
          
          {/* Printable Official Sheet */}
          <div className="bg-white border border-slate-300 rounded-2xl p-8 sm:p-10 shadow-xs print:border-none print:shadow-none print:p-0 max-w-3xl mx-auto space-y-6" id="guidance-official-document">
            
            {/* 1. Official Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between text-slate-900">
              <div className="text-right space-y-0.5 text-xs font-bold">
                <p className="font-extrabold">{signatories.countryName || "المملكة العربية السعودية"}</p>
                <p>{signatories.ministryName || "وزارة التعليم"}</p>
                <p>{signatories.administrationName || "الإدارة العامة للتعليم"}</p>
                <p className="text-emerald-800 font-extrabold">{signatories.schoolName || "ثانوية الأبناء الأولى"}</p>
                <p className="text-[11px] text-slate-600 font-semibold">قسم التوجيه الطلابي ولجنة التوجيه والإرشاد</p>
              </div>

              <div className="text-center space-y-1">
                <h2 className="text-base font-black tracking-wide">
                  {formData.title}
                </h2>
                <span className="text-xs font-bold text-slate-600 block">
                  وفق الدليل الإجرائي وقواعد السلوك والمواظبة
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  التاريخ: {todayHijri} هـ ({todayGregorian} م)
                </span>
              </div>

              <div className="text-left space-y-1">
                {signatories.logoUrl ? (
                  <img src={signatories.logoUrl} alt="Logo" className="h-14 w-auto object-contain ml-auto" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs ml-auto">
                    <School className="w-6 h-6 text-emerald-400" />
                  </div>
                )}
                <span className="text-[10px] text-slate-500 font-mono block">سري وخاص بالإرشاد</span>
              </div>
            </div>

            {/* 2. Student Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block text-[11px]">اسم الطالب:</span>
                <strong className="text-slate-900">{student.studentName}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[11px]">السجل المدني / الهوية:</span>
                <strong className="text-slate-900 font-mono">{student.nationalId || student.id || "-"}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[11px]">الصف والفصل:</span>
                <strong className="text-slate-900">{student.grade || "-"} / ({student.className || "-"})</strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[11px]">رصيد الغياب المسجل:</span>
                <strong className={`font-bold ${absenceCategory === "unexcused" ? "text-red-700" : "text-blue-700"}`}>
                  {daysCount} أيام ({absenceCategory === "excused" ? "بعذر" : "بدون عذر"})
                </strong>
              </div>
            </div>

            {/* 3. Absence Dates Log Bar */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs">
              <span className="font-bold text-amber-950 block mb-1">
                📅 تواريخ الغياب المسجلة والمدونة بنظام نور ({datesList.length > 0 ? datesList.length : daysCount} تاريخ):
              </span>
              <p className="text-amber-900 font-mono text-[11px] leading-relaxed">
                {formattedDates}
              </p>
            </div>

            {/* 4. Document Specific Content */}
            
            {/* Type A: Learning Plan */}
            {docType === "learning_plan" && (
              <div className="space-y-4 text-xs">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">أولاً: أهداف خطة التعلم أثناء الغياب:</h4>
                  {isEditing ? (
                    <textarea 
                      rows={2} 
                      value={formData.goals} 
                      onChange={(e) => setFormData({ ...formData, goals: e.target.value })} 
                      className="w-full border p-2 rounded text-xs" 
                    />
                  ) : (
                    <p className="text-slate-700 leading-relaxed">{formData.goals}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">ثانياً: المهام والواجبات المطلوبة من الطالب وولي أمره:</h4>
                  {isEditing ? (
                    <textarea 
                      rows={4} 
                      value={formData.responsibilities} 
                      onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })} 
                      className="w-full border p-2 rounded text-xs" 
                    />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">{formData.responsibilities}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">ثالثاً: آلية المتابعة والتنفيذ:</h4>
                  {isEditing ? (
                    <textarea 
                      rows={2} 
                      value={formData.schedule} 
                      onChange={(e) => setFormData({ ...formData, schedule: e.target.value })} 
                      className="w-full border p-2 rounded text-xs" 
                    />
                  ) : (
                    <p className="text-slate-700 leading-relaxed">{formData.schedule}</p>
                  )}
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1">
                  <h4 className="font-extrabold text-emerald-950">توصية الموجه الطلابي:</h4>
                  <p className="text-emerald-900">{formData.recommendations}</p>
                </div>
              </div>
            )}

            {/* Type B: Case Study */}
            {docType === "case_study" && (
              <div className="space-y-4 text-xs">
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">1. مظهر المشكلة وتحديدها:</h4>
                  {isEditing ? (
                    <textarea rows={2} value={formData.problemDefinition} onChange={(e) => setFormData({ ...formData, problemDefinition: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-700 leading-relaxed">{formData.problemDefinition}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">2. التشخيص الأولي للموجه الطلابي:</h4>
                  {isEditing ? (
                    <textarea rows={3} value={formData.initialDiagnosis} onChange={(e) => setFormData({ ...formData, initialDiagnosis: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-700 leading-relaxed">{formData.initialDiagnosis}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">3. العوامل المسببة للغياب (الذاتية / المدرسية / الأسرية):</h4>
                  {isEditing ? (
                    <textarea rows={4} value={formData.factors} onChange={(e) => setFormData({ ...formData, factors: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">{formData.factors}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">4. الخطة الإرشادية والتدخلات العلاجية:</h4>
                  {isEditing ? (
                    <textarea rows={4} value={formData.interventionPlan} onChange={(e) => setFormData({ ...formData, interventionPlan: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">{formData.interventionPlan}</p>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <h4 className="font-extrabold text-slate-900">5. التوصيات والمتابعة اللاحقة:</h4>
                  <p className="text-slate-700">{formData.recommendations}</p>
                </div>
              </div>
            )}

            {/* Type C: Committee Meeting Minutes */}
            {docType === "committee_minutes" && (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-100 p-2.5 rounded-lg text-center font-bold text-slate-800">
                  {formData.meetingNumber}
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">موضوع الاجتماع:</h4>
                  <p className="text-slate-700 leading-relaxed">{formData.meetingTopic}</p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">وقائع ومداولات الاجتماع:</h4>
                  {isEditing ? (
                    <textarea rows={3} value={formData.meetingDiscussions} onChange={(e) => setFormData({ ...formData, meetingDiscussions: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-700 leading-relaxed">{formData.meetingDiscussions}</p>
                  )}
                </div>

                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-indigo-950">القرارات والتوصيات الصادرة عن اللجنة:</h4>
                  {isEditing ? (
                    <textarea rows={4} value={formData.decisions} onChange={(e) => setFormData({ ...formData, decisions: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-indigo-900 whitespace-pre-line leading-relaxed">{formData.decisions}</p>
                  )}
                </div>

                {/* Committee members list table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-12 text-center">م</th>
                        <th className="p-2">صفة العضو في اللجنة</th>
                        <th className="p-2">الاسم</th>
                        <th className="p-2 w-32 text-center">التوقيع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(formData.membersList || []).map((m: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2 text-center font-bold">{i + 1}</td>
                          <td className="p-2 font-bold text-slate-800">{m.role}</td>
                          <td className="p-2 font-semibold text-slate-700">{m.name}</td>
                          <td className="p-2 text-center font-mono text-slate-400">...................</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Type D: Child Protection & Abuse Escalation Referral */}
            {docType === "principal_referral" && (
              <div className="space-y-4 text-xs">
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3.5 text-red-950 space-y-1">
                  <div className="flex items-center gap-2 font-black text-red-900">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>الموضوع: {formData.subject}</span>
                  </div>
                  <p className="text-[11px] text-red-800">{formData.legalReference}</p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-extrabold text-slate-900">أولاً: ملخص الإجراءات المتدرجة المنفذة بالمدرسة:</h4>
                  {isEditing ? (
                    <textarea rows={5} value={formData.summaryOfPastActions} onChange={(e) => setFormData({ ...formData, summaryOfPastActions: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">{formData.summaryOfPastActions}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 space-y-1.5 bg-slate-50">
                  <h4 className="font-extrabold text-slate-900">ثانياً: مرئيات وتوصية لجنة التوجيه والإرشاد:</h4>
                  {isEditing ? (
                    <textarea rows={3} value={formData.committeeOpinion} onChange={(e) => setFormData({ ...formData, committeeOpinion: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-800 leading-relaxed font-semibold">{formData.committeeOpinion}</p>
                  )}
                </div>

                <div className="border-2 border-slate-900 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-black text-slate-950">ثالثاً: توجيه واعتماد مدير المدرسة للرفع لإدارة التعليم:</h4>
                  {isEditing ? (
                    <textarea rows={2} value={formData.principalDirective} onChange={(e) => setFormData({ ...formData, principalDirective: e.target.value })} className="w-full border p-2 rounded text-xs" />
                  ) : (
                    <p className="text-slate-900 font-bold leading-relaxed">{formData.principalDirective}</p>
                  )}
                </div>
              </div>
            )}

            {/* Type E: Comprehensive Actions History */}
            {docType === "actions_history" && (
              <div className="space-y-4 text-xs">
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-extrabold text-slate-900">سجل الإجراءات النظامية المتدرجة المنفذة مع الطالب:</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-emerald-950 block">مرحلة الغياب (3 أيام):</strong>
                        <p className="text-emerald-900 text-[11px]">تم إعداد خطة التعلم أثناء الغياب، دراسة حالة الطالب، وإشعار ولي الأمر برسالة عبر الواتساب باسم الطالب والتواريخ.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-950 block">مرحلة الغياب (5 أيام):</strong>
                        <p className="text-amber-900 text-[11px]">إحالة الطالب للجنة التوجيه الطلابي، تنظيم جلسة توعوية مع ولي الأمر، وإرسال رسالة استدعاء ومحضر الاجتماع.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-red-50 p-2.5 rounded-lg border border-red-200">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-red-950 block">مرحلة الغياب (10 أيام فأكثر):</strong>
                        <p className="text-red-900 text-[11px]">مخاطبة الجهات ذات الاختصاص وإعداد استمارة الإحالة لمدير المدرسة للرفع لإدارة التعليم حيال نظام حماية الطفل ولائحته التنفيذية.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Official Signatures Section */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t-2 border-slate-300 text-center text-xs font-bold text-slate-800">
              <div className="space-y-8">
                <span>الموجه الطلابي</span>
                <p className="text-slate-900 font-extrabold">{signatories.counselorName || "............................"}</p>
              </div>

              <div className="space-y-8">
                <span>وكيل شؤون الطلاب</span>
                <p className="text-slate-900 font-extrabold">{signatories.vicePrincipalName || "............................"}</p>
              </div>

              <div className="space-y-8">
                <span>مدير المدرسة</span>
                <p className="text-slate-900 font-extrabold">{signatories.principalName || "............................"}</p>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Bottom Bar */}
        <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print bg-slate-50 rounded-b-3xl shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>تم توليد الوثيقة تلقائياً باسم الطالب وبياناته المسجلة بنظام نور.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة المستند الرسمي (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-all"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
