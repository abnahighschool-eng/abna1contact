import React, { useState } from "react";
import {
  Printer,
  ArrowRight,
  ShieldCheck,
  Award,
  PenLine,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  FileCheck,
} from "lucide-react";
import {
  ParentCouncilApplication,
  ParentCouncilConfig,
  ParentCouncilInvite,
  SchoolSignatories,
} from "../../types";

// ==========================================
// 1. ParentCouncilPrintSheet (استمارة طلب العضوية الفردية)
// ==========================================

export interface ParentCouncilPrintSheetProps {
  application: ParentCouncilApplication;
  signatories: SchoolSignatories;
  onClose?: () => void;
}

export function ParentCouncilPrintSheet({
  application,
  signatories,
  onClose,
}: ParentCouncilPrintSheetProps) {
  const handlePrint = () => {
    window.print();
  };

  const skillsList = [
    {
      key: "organizationalManagement" as const,
      label: "مهارات تنظيمية وإدارية",
      details: application.skills?.organizationalDetails,
    },
    {
      key: "volunteerExperience" as const,
      label: "خبرة في العمل التطوعي أو المجتمعي",
      details: application.skills?.volunteerDetails,
    },
    {
      key: "reportingAndDoc" as const,
      label: "إعداد التقارير والتوثيق وصياغة المحاضر",
      details: application.skills?.reportingDetails,
    },
    {
      key: "digitalPlatforms" as const,
      label: "استخدام المنصات الرقمية والتقنيات التعليمية",
      details: application.skills?.digitalPlatformsDetails,
    },
    {
      key: "previousCommittees" as const,
      label: "مشاركات سابقة في لجان مدرسية أو مجتمعية",
      details: application.skills?.committeeDetails,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 text-slate-900 font-sans" dir="rtl">
      {/* Top Action Bar - Hidden on Print */}
      <div className="max-w-4xl mx-auto mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للوحة التحكم</span>
            </button>
          )}
          <div className="h-6 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-600">
            معاينة استمارة الترشيح الرسمية (نسخة موفرة للحبر):{" "}
            <span className="text-slate-900 font-extrabold">{application.fullName}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
            id="btn-print-parent-council-form"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الاستمارة الرسمية (A4)</span>
          </button>
        </div>
      </div>

      {/* Official A4 Document Canvas - Ultra Ink-Saving Design */}
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 shadow-lg border border-slate-300 rounded-sm print:m-0 print:p-6 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Document Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-5">
          <div className="text-right leading-tight">
            <div className="text-[11px] font-bold text-slate-700">{signatories.countryName || "المملكة العربية السعودية"}</div>
            <div className="text-xs font-black text-slate-900 mt-0.5">{signatories.ministryName || "وزارة التعليم"}</div>
            <div className="text-[11px] text-slate-700">{signatories.administrationName || "الإدارة العامة للتعليم"}</div>
            <div className="text-[11px] font-extrabold text-teal-900 mt-0.5">{signatories.schoolName || "ثانوية الأبناء الأولى"}</div>
          </div>

          <div className="text-center pt-1">
            <div className="text-lg sm:text-xl font-black text-slate-900 tracking-wide border-b border-slate-800 pb-1 inline-block px-4">
              طلب عضوية مجلس أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600 mt-1">
              العام الدراسي 1447 - 1448هـ (2026 - 2027م)
            </div>
          </div>

          <div className="text-left flex flex-col items-end leading-tight">
            <div className="text-xs font-black text-slate-900">مجالس أولياء الأمور</div>
            <div className="text-[11px] font-bold text-slate-600">في التعليم العام</div>
            {signatories.logoUrl ? (
              <img
                src={signatories.logoUrl}
                alt="شعار المدرسة"
                className="w-10 h-10 object-contain mt-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-[9px] font-mono font-bold text-slate-500 border border-slate-300 px-1.5 py-0.5 rounded mt-1">
                كود: {application.activationCode || "PCA-1447"}
              </div>
            )}
          </div>
        </div>

        {/* Section 1: بيانات ولي الأمر */}
        <div className="mb-4">
          <div className="text-xs font-black text-slate-900 mb-1.5 flex items-center justify-between">
            <span>أولاً: بيانات ولي الأمر ومقدم الطلب:</span>
            {application.relationLabel && (
              <span className="text-[11px] font-bold text-teal-900 border border-teal-600 px-2 py-0.5 rounded">
                صفة مقدم الطلب: {application.relationLabel}
              </span>
            )}
          </div>
          
          <table className="w-full border-collapse border border-slate-800 text-xs">
            <tbody>
              <tr className="border-b border-slate-700">
                <td className="w-36 font-extrabold p-2 border-l border-slate-700 text-slate-900 bg-white">
                  الاسم الرباعي:
                </td>
                <td className="p-2 font-black text-slate-900 text-sm">
                  {application.fullName}
                  {application.relationLabel && application.relationLabel !== "الأب" && (
                    <span className="text-xs font-bold text-slate-600 mr-2">
                      ({application.relationLabel})
                    </span>
                  )}
                </td>
                <td className="w-28 font-extrabold p-2 border-l border-r border-slate-700 text-slate-900 bg-white">
                  رقم الهوية:
                </td>
                <td className="p-2 font-mono font-bold text-slate-900" dir="ltr">
                  {application.nationalId}
                </td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="w-36 font-extrabold p-2 border-l border-slate-700 text-slate-900 bg-white">
                  رقم الجوال:
                </td>
                <td className="p-2 font-mono font-bold text-slate-900" dir="ltr">
                  {application.phone}
                </td>
                <td className="w-28 font-extrabold p-2 border-l border-r border-slate-700 text-slate-900 bg-white">
                  البريد الإلكتروني:
                </td>
                <td className="p-2 font-mono text-slate-800" dir="ltr">
                  {application.email || "—"}
                </td>
              </tr>
              <tr>
                <td className="w-36 font-extrabold p-2 border-l border-slate-700 text-slate-900 bg-white">
                  اسم الطالب / الأبناء:
                </td>
                <td className="p-2 font-bold text-slate-900" colSpan={3}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div>
                      <span className="font-black text-slate-900">{application.studentName}</span>
                      <span className="text-slate-600 text-[11px] mr-1">
                        ({application.studentGrade}{application.studentClass ? ` - شعبة ${application.studentClass}` : ""})
                      </span>
                    </div>
                    {application.additionalStudents && application.additionalStudents.length > 0 && (
                      <div className="text-[11px] text-teal-900 border-r border-slate-300 pr-3 font-semibold">
                        أبناء آخرون بالمدرسة:{" "}
                        {application.additionalStudents.map((s, idx) => (
                          <span key={idx} className="mr-1">
                            {s.name} ({s.grade}{s.className ? ` - ${s.className}` : ""})
                            {idx < (application.additionalStudents?.length || 0) - 1 ? "، " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: الخبرات والمهارات ذات العلاقة */}
        <div className="mb-4">
          <div className="text-xs font-black text-slate-900 mb-1.5">
            ثانياً: الخبرات والمهارات ذات العلاقة المنصوص عليها في لائحة المجالس:
          </div>
          <table className="w-full border-collapse border border-slate-800 text-xs">
            <tbody>
              {skillsList.map((skill, index) => {
                const isChecked = application.skills?.[skill.key];
                return (
                  <tr key={index} className="border-b border-slate-700 last:border-b-0">
                    <td className="w-12 text-center p-1.5 border-l border-slate-700 font-extrabold">
                      {isChecked ? (
                        <span className="inline-block font-black text-sm text-slate-900">✓</span>
                      ) : (
                        <span className="inline-block w-3.5 h-3.5 border border-slate-400 rounded-xs" />
                      )}
                    </td>
                    <td className="p-1.5 text-slate-900 font-bold">
                      <div className="flex items-center justify-between gap-2">
                        <span>{skill.label}</span>
                        {isChecked && skill.details && (
                          <span className="text-[10px] font-normal text-slate-700 border border-slate-300 px-2 py-0.5 rounded">
                            البيان: {skill.details}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Section 3: أهدافي من الانضمام للمجلس */}
        <div className="mb-4">
          <div className="text-xs font-black text-slate-900 mb-1.5">
            ثالثاً: أهدافي وتطلعاتي من الانضمام لمجلس أولياء الأمور:
          </div>
          <div className="space-y-1.5 border border-slate-700 p-2.5 rounded-sm bg-white text-xs">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="font-extrabold text-slate-900">.{i + 1}</span>
                <div className="flex-1 border-b border-dotted border-slate-500 pb-0.5 font-bold text-slate-900 min-h-[22px]">
                  {application.goals?.[i] ? (
                    application.goals[i]
                  ) : (
                    <span className="text-slate-300 font-normal select-none">....................................................................................................................................................</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: التعهد والتوقيع */}
        <div className="mb-5 pt-1">
          <p className="text-xs font-bold text-slate-900 leading-relaxed">
            <span className="font-black">تعهد المرشح:</span> أتعهد بالالتزام بحضور الاجتماعات والمشاركة الفاعلة والإيجابية، والتقيد بالمهام والضوابط المنظمة لمجالس أولياء الأمور وفق اللائحة الوزارية.
          </p>

          <div className="grid grid-cols-3 gap-4 items-center mt-3 text-xs">
            <div>
              <span className="font-extrabold text-slate-900">الاسم الكامل: </span>
              <span className="font-black text-slate-900 border-b border-slate-400 pb-0.5 inline-block mr-1">
                {application.fullName}
              </span>
            </div>
            <div className="text-center">
              <span className="font-extrabold text-slate-900">التوقيع: </span>
              <span className="font-serif italic font-bold border-b border-slate-400 pb-0.5 inline-block text-slate-900 mr-1 min-w-[90px]">
                {application.signature || application.fullName}
              </span>
            </div>
            <div className="text-left">
              <span className="font-extrabold text-slate-900">التاريخ: </span>
              <span className="font-mono font-bold border-b border-slate-400 pb-0.5 inline-block mr-1" dir="ltr">
                {application.submissionDateHijri || "1447/ / هـ"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: الاعتماد والتذييل الرسمي */}
        <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="flex flex-col items-center">
            <div className="font-black text-slate-900 text-sm">لجنة التوجيه الطلابي</div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي وأعضاء اللجنة"}
            </div>
            <div className="mt-7 flex flex-col items-center">
              <div className="w-36 border-b border-dotted border-slate-600 pb-0.5 text-[11px] text-slate-400 font-bold">
                التوقيع والاعتماد
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-black text-slate-900 text-sm">مدير المدرسة</div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
            </div>
            <div className="mt-7 flex flex-col items-center">
              <div className="w-36 border-b border-dotted border-slate-600 pb-0.5 text-[11px] text-slate-400 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-16 h-16 border border-dashed border-slate-400 rounded-full mt-2 flex items-center justify-center text-[9px] text-slate-400">
                الختم الرسمي
              </div>
            </div>
          </div>
        </div>

        {/* Footer Badge */}
        <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
          <span>رمز التحقق للمرشح: <span className="font-mono font-bold text-slate-700">{application.activationCode}</span></span>
          <span className="flex items-center gap-1 text-slate-700 font-bold">
            <ShieldCheck className="w-3 h-3 text-teal-700" />
            استمارة ترشيح رسمية معتمدة عبر نظام {signatories.schoolName || "المدرسة"}
          </span>
          <span>تاريخ التقديم: {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("ar-SA") : "—"}</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. CouncilFormationPrintSheet (محضر التشكيل والاعتماد النهائي)
// ==========================================

export interface CouncilFormationPrintSheetProps {
  config: ParentCouncilConfig;
  applications: Record<string, ParentCouncilApplication>;
  signatories: SchoolSignatories;
  onClose?: () => void;
  onUpdateRole?: (appId: string, role: string) => void;
}

export function CouncilFormationPrintSheet({
  config,
  applications,
  signatories,
  onClose,
  onUpdateRole,
}: CouncilFormationPrintSheetProps) {
  const selectedMembers = config.selectedMemberIds
    .map((id) => applications[id])
    .filter(Boolean);

  const reserveMembers = config.reserveMemberIds
    .map((id) => applications[id])
    .filter(Boolean);

  const [localRoles, setLocalRoles] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    config.selectedMemberIds.forEach((id) => {
      const app = applications[id];
      if (app && app.assignedRole !== undefined) {
        init[id] = app.assignedRole;
      }
    });
    return init;
  });

  const handleRoleChange = (id: string, newRole: string) => {
    setLocalRoles((prev) => ({ ...prev, [id]: newRole }));
    if (onUpdateRole) {
      onUpdateRole(id, newRole);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 text-slate-900 font-sans" dir="rtl">
      {/* Top Action Bar */}
      <div className="max-w-4xl mx-auto mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للوحة التحكم</span>
            </button>
          )}
          <div className="h-6 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-700">
            معاينة محضر الاعتماد النهائي لمجلس أولياء الأمور (نسخة موفرة للحبر)
          </span>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
          id="btn-print-council-formation"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة محضر الاعتماد النهائي (A4)</span>
        </button>
      </div>

      {/* Manual Role Entry Guide Banner (no-print) */}
      <div className="max-w-4xl mx-auto mb-4 bg-teal-50/90 border border-teal-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-teal-900 no-print">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 text-sm font-bold shadow-xs">
            <PenLine className="w-4 h-4 text-teal-100" />
          </div>
          <div>
            <div className="font-black text-teal-950">إدخال الصفة في المجلس يدوياً للأعضاء المختارين أو تركها فارغة:</div>
            <div className="text-teal-800 text-[11px] mt-0.5">
              وفقاً للتنظيم، يتم إدخال صفة كل عضو يدوياً أو تركها فارغة بحسب رغبة إدارة المدرسة، ثم طباعة محضر الاعتماد النهائي.
            </div>
          </div>
        </div>
      </div>

      {/* Official Minutes Canvas */}
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 shadow-lg border border-slate-300 rounded-sm print:m-0 print:p-6 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-4">
          <div className="text-right leading-tight">
            <div className="text-[11px] font-bold text-slate-700">{signatories.countryName || "المملكة العربية السعودية"}</div>
            <div className="text-xs font-black text-slate-900 mt-0.5">{signatories.ministryName || "وزارة التعليم"}</div>
            <div className="text-[11px] text-slate-700">{signatories.administrationName || "الإدارة العامة للتعليم"}</div>
            <div className="text-[11px] font-extrabold text-teal-900 mt-0.5">{signatories.schoolName || "ثانوية الأبناء الأولى"}</div>
          </div>

          <div className="text-center pt-1">
            <div className="text-base sm:text-lg font-black text-slate-900 tracking-wide border-b border-slate-800 pb-1 inline-block px-4">
              محضر تشكيل واعتماد مجلس أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600 mt-1">
              للعام الدراسي 1447 - 1448هـ (2026 - 2027م)
            </div>
          </div>

          <div className="text-left flex flex-col items-end leading-tight">
            <div className="text-xs font-black text-slate-900">مجالس أولياء الأمور</div>
            <div className="text-[11px] font-bold text-slate-600">في التعليم العام</div>
            {signatories.logoUrl ? (
              <img
                src={signatories.logoUrl}
                alt="شعار المدرسة"
                className="w-10 h-10 object-contain mt-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-[9px] font-mono font-bold text-slate-500 border border-slate-300 px-1.5 py-0.5 rounded mt-1">
                رقم المحضر: {config.academicYear || "1447"}/مجلس
              </div>
            )}
          </div>
        </div>

        {/* Minutes Introductory Text */}
        <div className="mb-4 text-xs font-medium text-slate-900 leading-relaxed text-justify border border-slate-300 p-2.5 rounded-sm bg-white">
          <p>
            بناءً على التوجيهات واللوائح المنظمة لمجالس أولياء الأمور في التعليم العام، وإشارةً إلى إجراءات الترشح والمفاضلة الإلكترونية التي تمت عبر بوابة المدرسة الإلكترونية لاختيار أعضاء مجلس أولياء الأمور للعام الدراسي{" "}
            <strong>{config.academicYear || "1447 - 1448هـ"}</strong>، اجتمعت لجنة التوجيه الطلابي وإدارة المدرسة لفرز طلبات الترشح، وقد أقرّت اللجنة اعتماد التشكيل النهائي للمجلس على النحو التالي:
          </p>
        </div>

        {/* Primary Council Members Table */}
        <div className="mb-4">
          <div className="text-xs font-black text-slate-900 mb-1.5 flex items-center justify-between">
            <span>أولاً: الأعضاء الأساسيون لمجلس أولياء الأمور (العدد: {selectedMembers.length} عضواً):</span>
            <span className="text-[10px] text-slate-500 font-bold print:hidden">
              * يمكنك تعديل الصفة مباشرة قبل الطباعة
            </span>
          </div>

          <table className="w-full border-collapse border border-slate-800 text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-white">
                <th className="border-l border-slate-800 p-1.5 w-10 text-center font-black text-slate-900">م</th>
                <th className="border-l border-slate-800 p-1.5 text-right font-black text-slate-900">الاسم الرباعي</th>
                <th className="border-l border-slate-800 p-1.5 w-28 text-center font-black text-slate-900">الصفة في المجلس</th>
                <th className="border-l border-slate-800 p-1.5 text-right font-black text-slate-900">اسم الطالب والصف</th>
                <th className="border-l border-slate-800 p-1.5 w-28 text-center font-black text-slate-900">رقم الجوال</th>
                <th className="p-1.5 w-24 text-center font-black text-slate-900">التوقيع</th>
              </tr>
            </thead>
            <tbody>
              {selectedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-4 text-slate-500 font-bold">
                    لم يتم اعتماد أي أعضاء أساسيين بعد.
                  </td>
                </tr>
              ) : (
                selectedMembers.map((member, index) => (
                  <tr key={member.id} className="border-b border-slate-700 last:border-b-0">
                    <td className="border-l border-slate-700 p-1.5 text-center font-mono font-bold text-slate-900">
                      {index + 1}
                    </td>
                    <td className="border-l border-slate-700 p-1.5 font-black text-slate-900">
                      {member.fullName}
                    </td>
                    <td className="border-l border-slate-700 p-1 text-center font-bold text-teal-950">
                      <input
                        type="text"
                        value={localRoles[member.id] !== undefined ? localRoles[member.id] : (member.assignedRole || "عضو مجلس")}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        placeholder="الصفة بالمجلس..."
                        className="w-full text-center text-xs font-bold text-teal-950 bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-600 focus:bg-white rounded px-1 py-0.5 outline-none print:border-none print:p-0"
                      />
                    </td>
                    <td className="border-l border-slate-700 p-1.5 text-slate-900">
                      <div className="font-bold">{member.studentName}</div>
                      <div className="text-[10px] text-slate-600">
                        {member.studentGrade}{member.studentClass ? ` - شعبة ${member.studentClass}` : ""}
                      </div>
                    </td>
                    <td className="border-l border-slate-700 p-1.5 text-center font-mono font-bold text-slate-900" dir="ltr">
                      {member.phone}
                    </td>
                    <td className="p-1.5 text-center font-serif italic text-slate-400 text-[11px]">
                      ...................
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Reserve Members Table */}
        {reserveMembers.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-black text-slate-900 mb-1.5">
              ثانياً: الأعضاء الاحتياط لمجلس أولياء الأمور (العدد: {reserveMembers.length} عضواً):
            </div>
            <table className="w-full border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-white">
                  <th className="border-l border-slate-800 p-1.5 w-10 text-center font-black text-slate-900">م</th>
                  <th className="border-l border-slate-800 p-1.5 text-right font-black text-slate-900">الاسم الرباعي</th>
                  <th className="border-l border-slate-800 p-1.5 text-right font-black text-slate-900">اسم الطالب والصف</th>
                  <th className="border-l border-slate-800 p-1.5 w-28 text-center font-black text-slate-900">رقم الجوال</th>
                  <th className="p-1.5 w-24 text-center font-black text-slate-900">التوقيع</th>
                </tr>
              </thead>
              <tbody>
                {reserveMembers.map((member, index) => (
                  <tr key={member.id} className="border-b border-slate-700 last:border-b-0">
                    <td className="border-l border-slate-700 p-1.5 text-center font-mono font-bold text-slate-900">
                      {index + 1}
                    </td>
                    <td className="border-l border-slate-700 p-1.5 font-black text-slate-900">
                      {member.fullName}
                      <span className="text-[10px] text-slate-600 font-bold mr-2">(عضو احتياط)</span>
                    </td>
                    <td className="border-l border-slate-700 p-1.5 text-slate-900">
                      <div className="font-bold">{member.studentName}</div>
                      <div className="text-[10px] text-slate-600">
                        {member.studentGrade}{member.studentClass ? ` - شعبة ${member.studentClass}` : ""}
                      </div>
                    </td>
                    <td className="border-l border-slate-700 p-1.5 text-center font-mono font-bold text-slate-900" dir="ltr">
                      {member.phone}
                    </td>
                    <td className="p-1.5 text-center font-serif italic text-slate-400 text-[11px]">
                      ...................
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section: لجنة الفرز والاعتماد المدرسي */}
        <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="flex flex-col items-center">
            <div className="font-black text-slate-900 text-sm">لجنة التوجيه الطلابي ومقرر المجلس</div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي"}
            </div>
            <div className="mt-7 flex flex-col items-center">
              <div className="w-36 border-b border-dotted border-slate-600 pb-0.5 text-[11px] text-slate-400 font-bold">
                التوقيع والاعتماد
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-black text-slate-900 text-sm">مدير المدرسة / رئيس المجلس</div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
            </div>
            <div className="mt-7 flex flex-col items-center">
              <div className="w-36 border-b border-dotted border-slate-600 pb-0.5 text-[11px] text-slate-400 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-16 h-16 border border-dashed border-slate-400 rounded-full mt-2 flex items-center justify-center text-[9px] text-slate-400">
                الختم الرسمي
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
          <span>توثيق رسمي صادر عبر نظام إدارة المدرسة</span>
          <span className="flex items-center gap-1 text-slate-700 font-bold">
            <ShieldCheck className="w-3 h-3 text-teal-700" />
            محضر تشكيل مجلس أولياء الأمور المعتمد
          </span>
          <span>تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. SentMessagesReportPrintSheet (تقرير متابعة الدعوات والرسائل المرسلة)
// ==========================================

export interface SentMessagesReportPrintSheetProps {
  invitesList: ParentCouncilInvite[];
  applications: Record<string, ParentCouncilApplication>;
  signatories: SchoolSignatories;
  academicYear?: string;
  councilTerm?: string;
  onClose?: () => void;
}

export function SentMessagesReportPrintSheet({
  invitesList,
  applications,
  signatories,
  academicYear = "1447 - 1448 هـ",
  councilTerm = "العام الدراسي 2026 - 2027",
  onClose,
}: SentMessagesReportPrintSheetProps) {
  const totalSent = invitesList.length;
  const totalOpened = invitesList.filter((inv) => inv.hasOpened || inv.isSubmitted).length;
  const totalSubmitted = invitesList.filter(
    (inv) => inv.isSubmitted || (inv.studentId && applications[inv.studentId])
  ).length;

  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const submitRate = totalSent > 0 ? Math.round((totalSubmitted / totalSent) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  const todayDate = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const printTime = new Date().toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 text-slate-900 font-sans" dir="rtl">
      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-5xl mx-auto mb-5 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للوحة التحكم</span>
            </button>
          )}
          <div className="h-6 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-700">
            معاينة التقرير الرسمي لمتابعة الدعوات والرسائل المرسلة (A4)
          </span>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
          id="btn-print-sent-messages-report"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة التقرير الرسمي (A4)</span>
        </button>
      </div>

      {/* Official Canvas */}
      <div className="max-w-5xl mx-auto bg-white p-6 sm:p-10 shadow-lg border border-slate-300 rounded-sm print:m-0 print:p-6 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-4">
          <div className="text-right leading-tight">
            <div className="text-[11px] font-bold text-slate-700">{signatories.countryName || "المملكة العربية السعودية"}</div>
            <div className="text-xs font-black text-slate-900 mt-0.5">{signatories.ministryName || "وزارة التعليم"}</div>
            <div className="text-[11px] text-slate-700">{signatories.administrationName || "الإدارة العامة للتعليم"}</div>
            <div className="text-[11px] font-extrabold text-teal-900 mt-0.5">{signatories.schoolName || "ثانوية الأبناء الأولى"}</div>
          </div>

          <div className="text-center pt-1">
            <div className="text-base sm:text-lg font-black text-slate-900 tracking-wide border-b border-slate-800 pb-1 inline-block px-4">
              تقرير متابعة الدعوات والرسائل وتفاعل أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600 mt-1">
              استبيان الترشح لمجلس أولياء الأمور — العام الدراسي {academicYear}
            </div>
          </div>

          <div className="text-left flex flex-col items-end leading-tight">
            <div className="text-xs font-black text-slate-900">مجالس أولياء الأمور</div>
            <div className="text-[11px] font-bold text-slate-600">في التعليم العام</div>
            {signatories.logoUrl ? (
              <img
                src={signatories.logoUrl}
                alt="شعار المدرسة"
                className="w-10 h-10 object-contain mt-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-[9px] font-mono font-bold text-slate-500 border border-slate-300 px-1.5 py-0.5 rounded mt-1">
                تاريخ: {todayDate}
              </div>
            )}
          </div>
        </div>

        {/* Statistical Summary Boxes */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="border border-slate-800 p-2.5 text-center">
            <div className="text-[11px] font-bold text-slate-600">إجمالي الرسائل المرسلة</div>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{totalSent}</div>
          </div>
          <div className="border border-slate-800 p-2.5 text-center">
            <div className="text-[11px] font-bold text-slate-600">الروابط التي تم فتحها</div>
            <div className="text-xl font-black text-teal-900 font-mono mt-0.5">
              {totalOpened} <span className="text-xs font-bold text-slate-600">({openRate}%)</span>
            </div>
          </div>
          <div className="border border-slate-800 p-2.5 text-center">
            <div className="text-[11px] font-bold text-slate-600">الطلبات المكتملة والمقدمة</div>
            <div className="text-xl font-black text-emerald-900 font-mono mt-0.5">
              {totalSubmitted} <span className="text-xs font-bold text-slate-600">({submitRate}%)</span>
            </div>
          </div>
          <div className="border border-slate-800 p-2.5 text-center">
            <div className="text-[11px] font-bold text-slate-600">تاريخ وتوقيت التقرير</div>
            <div className="text-xs font-bold text-slate-900 mt-1.5">{todayDate}</div>
            <div className="text-[10px] text-slate-500 font-mono">{printTime}</div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="mb-5">
          <div className="text-xs font-black text-slate-900 mb-2">
            سجل الطلاب وأولياء الأمور وحالة التفاعل:
          </div>
          <table className="w-full border-collapse border border-slate-800 text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-white">
                <th className="border-l border-slate-800 p-1.5 w-10 text-center font-black text-slate-900">م</th>
                <th className="border-l border-slate-800 p-1.5 text-right font-black text-slate-900">اسم الطالب</th>
                <th className="border-l border-slate-800 p-1.5 text-right font-black text-slate-900">الصف والشعبة</th>
                <th className="border-l border-slate-800 p-1.5 text-right font-black text-slate-900">ولي الأمر</th>
                <th className="border-l border-slate-800 p-1.5 w-28 text-center font-black text-slate-900">رقم الجوال</th>
                <th className="border-l border-slate-800 p-1.5 w-20 text-center font-black text-slate-900">حالة الفتح</th>
                <th className="p-1.5 w-24 text-center font-black text-slate-900">حالة التقديم</th>
              </tr>
            </thead>
            <tbody>
              {invitesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-4 text-slate-500 font-bold">
                    لا توجد رسائل مرسلة مسجلة في هذا التقرير.
                  </td>
                </tr>
              ) : (
                invitesList.map((inv, index) => {
                  const hasOpened = inv.hasOpened || inv.isSubmitted;
                  const isSubmitted = inv.isSubmitted || (inv.studentId && applications[inv.studentId]);
                  return (
                    <tr key={inv.studentId || index} className="border-b border-slate-700 last:border-b-0">
                      <td className="border-l border-slate-700 p-1.5 text-center font-mono font-bold text-slate-900">
                        {index + 1}
                      </td>
                      <td className="border-l border-slate-700 p-1.5 font-bold text-slate-900">
                        {inv.studentName}
                      </td>
                      <td className="border-l border-slate-700 p-1.5 text-slate-800">
                        {inv.studentGrade} {inv.studentClass ? `- شعبة ${inv.studentClass}` : ""}
                      </td>
                      <td className="border-l border-slate-700 p-1.5 text-slate-800">
                        {inv.guardianName || "ولي الأمر"}
                      </td>
                      <td className="border-l border-slate-700 p-1.5 text-center font-mono font-bold text-slate-900" dir="ltr">
                        {inv.guardianPhone}
                      </td>
                      <td className="border-l border-slate-700 p-1.5 text-center font-bold">
                        {hasOpened ? (
                          <span className="text-teal-900">تم الفتح ✓</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-1.5 text-center font-black">
                        {isSubmitted ? (
                          <span className="text-emerald-900 font-black">تم التقديم ✓</span>
                        ) : (
                          <span className="text-slate-400 font-normal">لم يقدم</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Official Signatures */}
        <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="flex flex-col items-center">
            <div className="font-black text-slate-900 text-sm">معد التقرير / الموجه الطلابي</div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي"}
            </div>
            <div className="mt-7 flex flex-col items-center">
              <div className="w-36 border-b border-dotted border-slate-600 pb-0.5 text-[11px] text-slate-400 font-bold">
                التوقيع
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-black text-slate-900 text-sm">مدير المدرسة</div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
            </div>
            <div className="mt-7 flex flex-col items-center">
              <div className="w-36 border-b border-dotted border-slate-600 pb-0.5 text-[11px] text-slate-400 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-16 h-16 border border-dashed border-slate-400 rounded-full mt-2 flex items-center justify-center text-[9px] text-slate-400">
                الختم الرسمي
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
          <span>تقرير إحصائي صادر إلكترونياً عبر منظومة إدارة المدرسة</span>
          <span className="flex items-center gap-1 text-slate-700 font-bold">
            <ShieldCheck className="w-3 h-3 text-teal-700" />
            توثيق إرسال ومتابعة مجالس أولياء الأمور
          </span>
          <span>تاريخ الطباعة: {todayDate}</span>
        </div>
      </div>
    </div>
  );
}

export default ParentCouncilPrintSheet;
