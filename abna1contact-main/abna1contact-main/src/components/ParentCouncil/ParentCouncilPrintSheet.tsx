import React from "react";
import { Printer, ArrowRight, ShieldCheck } from "lucide-react";
import { ParentCouncilApplication } from "../../types/parentCouncil";
import { SchoolSignatories } from "../../types";

interface ParentCouncilPrintSheetProps {
  application: ParentCouncilApplication;
  signatories: SchoolSignatories;
  onClose?: () => void;
}

export default function ParentCouncilPrintSheet({
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
          {/* Right Header Side: Ministry Info */}
          <div className="text-right leading-tight">
            <div className="text-[11px] font-bold text-slate-700">{signatories.countryName || "المملكة العربية السعودية"}</div>
            <div className="text-xs font-black text-slate-900 mt-0.5">{signatories.ministryName || "وزارة التعليم"}</div>
            <div className="text-[11px] text-slate-700">{signatories.administrationName || "الإدارة العامة للتعليم"}</div>
            <div className="text-[11px] font-extrabold text-teal-900 mt-0.5">{signatories.schoolName || "ثانوية الأبناء الأولى"}</div>
          </div>

          {/* Center Title */}
          <div className="text-center pt-1">
            <div className="text-lg sm:text-xl font-black text-slate-900 tracking-wide border-b border-slate-800 pb-1 inline-block px-4">
              طلب عضوية مجلس أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600 mt-1">
              العام الدراسي 1447 - 1448هـ (2026 - 2027م)
            </div>
          </div>

          {/* Left Header Side: Emblem & Subtitle */}
          <div className="text-left flex flex-col items-end leading-tight">
            <div className="text-xs font-black text-slate-900">
              مجالس أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600">
              في التعليم العام
            </div>
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

        {/* Section 1: بيانات ولي الأمر (تصميم أبيض نظيف وموفر للحبر) */}
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
                    {/* Additional siblings in school */}
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

        {/* Section 2: الخبرات والمهارات ذات العلاقة (موفرة للحبر - حدود رقيقة دون تعبئة داكنة) */}
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

        {/* Section 3: أهدافي من الانضمام للمجلس (خطوط نقطية نظيفة وأنيقة) */}
        <div className="mb-4">
          <div className="text-xs font-black text-slate-900 mb-1.5">
            ثالثاً: أهدافي وتطلعاتي من الانضمام لمجلس أولياء الأمور:
          </div>
          <div className="space-y-1.5 border border-slate-700 p-2.5 rounded-sm bg-white text-xs">
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-slate-900">.١</span>
              <div className="flex-1 border-b border-dotted border-slate-500 pb-0.5 font-bold text-slate-900 min-h-[22px]">
                {application.goals?.[0] ? (
                  application.goals[0]
                ) : (
                  <span className="text-slate-300 font-normal select-none">....................................................................................................................................................</span>
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-slate-900">.٢</span>
              <div className="flex-1 border-b border-dotted border-slate-500 pb-0.5 font-bold text-slate-900 min-h-[22px]">
                {application.goals?.[1] ? (
                  application.goals[1]
                ) : (
                  <span className="text-slate-300 font-normal select-none">....................................................................................................................................................</span>
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-slate-900">.٣</span>
              <div className="flex-1 border-b border-dotted border-slate-500 pb-0.5 font-bold text-slate-900 min-h-[22px]">
                {application.goals?.[2] ? (
                  application.goals[2]
                ) : (
                  <span className="text-slate-300 font-normal select-none">....................................................................................................................................................</span>
                )}
              </div>
            </div>
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

        {/* Section 5: الاعتماد والتذييل الرسمي (لجنة التوجيه الطلابي ومدير المدرسة) */}
        <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          
          {/* Right Side: لجنة التوجيه الطلابي */}
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

          {/* Left Side: مدير المدرسة */}
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

        {/* Ink-Efficient Footer Badge */}
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
