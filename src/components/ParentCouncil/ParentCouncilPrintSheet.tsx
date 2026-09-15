import React from "react";
import { Printer, ArrowRight, ShieldCheck } from "lucide-react";
import { ParentCouncilApplication } from "../../types/parentCouncil";
import { SchoolSignatories } from "../../types";
import { formatHijriDisplayDate } from "../../utils/parentCouncilUtils";

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
    <div
      className="parent-council-print-page min-h-screen bg-slate-100 p-4 sm:p-8 text-slate-950 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0"
      dir="rtl"
    >
      {/* Dynamic Print CSS for Standard A4 (2cm margin) & Ink-Saving */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 2cm;
        }
        @media print {
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
          }
          .no-print, header, nav, footer, #main-header, #main-footer {
            display: none !important;
          }
          .parent-council-print-page {
            background: #ffffff !important;
            background-color: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            width: 100% !important;
          }
          .parent-council-sheet-canvas {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            font-family: '(AH) Manal Medium', 'AH Manal Medium', 'AH Manal', 'Cairo', sans-serif !important;
          }
          .parent-council-sheet-canvas * {
            font-family: '(AH) Manal Medium', 'AH Manal Medium', 'AH Manal', 'Cairo', sans-serif !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

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
            معاينة استمارة الترشيح الرسمية:{" "}
            <span className="text-slate-900 font-extrabold">{application.fullName}</span>
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold rounded-lg">
            <span>الخط:</span>
            <span className="font-extrabold text-teal-950 font-ah-manal">(AH) Manal Medium</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold rounded-lg">
            <span>الهوامش:</span>
            <span className="font-extrabold text-amber-950">2 سم من جميع الجهات</span>
          </div>
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

      {/* Official A4 Document Canvas - 2cm Margins & Enlarged Font */}
      <div 
        className="parent-council-sheet-canvas font-ah-manal max-w-4xl mx-auto bg-white shadow-lg border border-slate-300 rounded-sm print:p-0 print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none print-avoid-break"
        style={{ 
          fontFamily: "'(AH) Manal Medium', 'AH Manal Medium', 'AH Manal', 'Cairo', sans-serif",
          padding: "2cm",
        }}
      >
        
        {/* Document Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3.5 mb-4.5">
          <div className="text-right leading-tight">
            <div className="text-base sm:text-lg font-bold text-slate-800">{signatories.countryName || "المملكة العربية السعودية"}</div>
            <div className="text-lg sm:text-xl font-black text-slate-950 mt-0.5">{signatories.ministryName || "وزارة التعليم"}</div>
            <div className="text-base sm:text-lg font-bold text-slate-700">{signatories.administrationName || "الإدارة العامة للتعليم"}</div>
            <div className="text-lg sm:text-xl font-black text-slate-950 mt-0.5">{signatories.schoolName || "ثانوية الأبناء الأولى"}</div>
          </div>

          <div className="text-center pt-0.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-wide border-b-2 border-slate-900 pb-1.5 inline-block px-6">
              طلب عضوية مجلس أولياء الأمور
            </div>
            <div className="text-base sm:text-lg font-black text-slate-800 mt-2">
              العام الدراسي 1447 - 1448هـ (2026 - 2027م)
            </div>
          </div>

          <div className="text-left flex flex-col items-end leading-tight">
            <div className="text-lg sm:text-xl font-black text-slate-950">مجالس أولياء الأمور</div>
            <div className="text-base sm:text-lg font-bold text-slate-700">في التعليم العام</div>
            {signatories.logoUrl ? (
              <img
                src={signatories.logoUrl}
                alt="شعار المدرسة"
                className="w-16 h-16 object-contain mt-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-sm font-mono font-black text-slate-800 border-2 border-slate-800 px-2.5 py-0.5 rounded mt-1 bg-white">
                كود: {application.activationCode || "PCA-1447"}
              </div>
            )}
          </div>
        </div>

        {/* Section 1: بيانات ولي الأمر ومقدم الطلب */}
        <div className="mb-4">
          <div className="text-lg sm:text-xl font-black text-slate-950 mb-2.5 flex items-center justify-between">
            <span>أولاً: بيانات ولي الأمر ومقدم الطلب:</span>
            {application.relationLabel && (
              <span className="text-base font-black text-slate-950 border-2 border-slate-900 px-3.5 py-0.5 rounded bg-white">
                صفة مقدم الطلب: {application.relationLabel}
              </span>
            )}
          </div>
          
          <table className="w-full border-collapse border-2 border-slate-900 text-base sm:text-lg">
            <tbody>
              <tr className="border-b-2 border-slate-900">
                <td className="w-44 sm:w-52 font-black py-3 px-4 border-l-2 border-slate-900 text-slate-950 bg-slate-50/80 text-base sm:text-lg">
                  الاسم الرباعي:
                </td>
                <td className="py-3 px-4 font-black text-slate-950 text-xl sm:text-2xl">
                  {application.fullName}
                  {application.relationLabel && application.relationLabel !== "الأب" && (
                    <span className="text-base font-bold text-slate-700 mr-2">
                      ({application.relationLabel})
                    </span>
                  )}
                </td>
                <td className="w-36 sm:w-40 font-black py-3 px-4 border-l-2 border-r-2 border-slate-900 text-slate-950 bg-slate-50/80 text-base sm:text-lg">
                  رقم الهوية:
                </td>
                <td className="py-3 px-4 font-mono font-black text-slate-950 text-xl tracking-wider" dir="ltr">
                  {application.nationalId}
                </td>
              </tr>
              <tr className="border-b-2 border-slate-900">
                <td className="w-44 sm:w-52 font-black py-3 px-4 border-l-2 border-slate-900 text-slate-950 bg-slate-50/80 text-base sm:text-lg">
                  رقم الجوال:
                </td>
                <td className="py-3 px-4 font-mono font-black text-slate-950 text-lg sm:text-xl" dir="ltr">
                  {application.phone}
                </td>
                <td className="w-36 sm:w-40 font-black py-3 px-4 border-l-2 border-r-2 border-slate-900 text-slate-950 bg-slate-50/80 text-base sm:text-lg">
                  البريد الإلكتروني:
                </td>
                <td className="py-3 px-4 font-mono font-bold text-slate-950 text-base sm:text-lg" dir="ltr">
                  {application.email || "—"}
                </td>
              </tr>
              <tr>
                <td className="w-44 sm:w-52 font-black py-3 px-4 border-l-2 border-slate-900 text-slate-950 bg-slate-50/80 text-base sm:text-lg">
                  اسم الطالب / الأبناء:
                </td>
                <td className="py-3 px-4 font-bold text-slate-950" colSpan={3}>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-x-4 gap-y-1.5">
                    <div>
                      <span className="font-black text-slate-950 text-lg sm:text-xl">{application.studentName}</span>
                      <span className="text-slate-800 text-base font-bold mr-2">
                        (الصف: {application.studentGrade}{application.studentClass ? ` - شعبة ${application.studentClass}` : ""})
                      </span>
                    </div>
                    {application.additionalStudents && application.additionalStudents.length > 0 && (
                      <div className="text-base text-slate-900 border-r-2 border-slate-400 pr-3 font-bold">
                        أبناء آخرون بالمدرسة:{" "}
                        {application.additionalStudents.map((s, idx) => (
                          <span key={idx} className="mr-1">
                            {s.name} ({s.grade}{s.className ? ` - شعبة ${s.className}` : ""})
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
          <div className="text-lg sm:text-xl font-black text-slate-950 mb-2.5 mt-3">
            ثانياً: الخبرات والمهارات ذات العلاقة المنصوص عليها في لائحة المجالس:
          </div>
          <table className="w-full border-collapse border-2 border-slate-900 text-base sm:text-lg">
            <tbody>
              {skillsList.map((skill, index) => {
                const isChecked = application.skills?.[skill.key];
                return (
                  <tr key={index} className="border-b border-slate-800 last:border-b-0">
                    <td className="w-16 text-center py-2.5 px-3 border-l-2 border-slate-900 font-extrabold">
                      {isChecked ? (
                        <span className="inline-block font-black text-2xl text-slate-950 leading-none">✓</span>
                      ) : (
                        <span className="inline-block w-6 h-6 border-2 border-slate-800 rounded-xs bg-white" />
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-950 font-bold">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-base sm:text-lg">{skill.label}</span>
                        {isChecked && skill.details && (
                          <span className="text-sm sm:text-base font-bold text-slate-800 border border-slate-400 px-3 py-0.5 rounded bg-white">
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
          <div className="text-lg sm:text-xl font-black text-slate-950 mb-2.5 mt-3">
            ثالثاً: أهدافي وتطلعاتي من الانضمام لمجلس أولياء الأمور:
          </div>
          <div className="space-y-2.5 border-2 border-slate-900 p-4 rounded-xs bg-white text-base sm:text-lg">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-baseline gap-2.5">
                <span className="font-black text-slate-950 text-lg">.{i + 1}</span>
                <div className="flex-1 border-b border-dotted border-slate-700 pb-1 font-bold text-slate-950 min-h-[28px] text-base sm:text-lg">
                  {application.goals?.[i] ? (
                    application.goals[i]
                  ) : (
                    <span className="text-slate-400 font-normal select-none">....................................................................................................................................................</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: التعهد والتوقيع */}
        <div className="mb-4 pt-1">
          <p className="text-base sm:text-lg font-bold text-slate-950 leading-relaxed">
            <span className="font-black">تعهد المرشح:</span> أتعهد بالالتزام بحضور الاجتماعات والمشاركة الفاعلة والإيجابية، والتقيد بالمهام والضوابط المنظمة لمجالس أولياء الأمور وفق اللائحة الوزارية.
          </p>

          <div className="grid grid-cols-3 gap-4 items-center mt-3 text-base sm:text-lg">
            <div>
              <span className="font-extrabold text-slate-950">الاسم الكامل: </span>
              <span className="font-black text-slate-950 text-lg sm:text-xl border-b-2 border-slate-800 pb-0.5 inline-block mr-1">
                {application.fullName}
              </span>
            </div>
            <div className="text-center">
              <span className="font-extrabold text-slate-950">التوقيع: </span>
              <span className="font-serif italic font-black text-lg sm:text-xl border-b-2 border-slate-800 pb-0.5 inline-block text-slate-950 mr-1 min-w-[130px]">
                {application.signature || application.fullName}
              </span>
            </div>
            <div className="text-left">
              <span className="font-extrabold text-slate-950">التاريخ: </span>
              <span className="font-black text-base sm:text-lg border-b-2 border-slate-800 pb-0.5 inline-block mr-1 text-slate-950" dir="rtl">
                {formatHijriDisplayDate(application.submissionDateHijri)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: الاعتماد والتذييل الرسمي */}
        <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center text-base sm:text-lg">
          <div className="flex flex-col items-center">
            <div className="font-black text-slate-950 text-xl sm:text-2xl">لجنة التوجيه الطلابي</div>
            <div className="mt-8 flex flex-col items-center">
              <div className="w-52 border-b border-dotted border-slate-800 pb-1 text-sm sm:text-base text-slate-600 font-bold">
                التوقيع والاعتماد
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-black text-slate-950 text-xl sm:text-2xl">مدير المدرسة</div>
            <div className="text-base sm:text-lg font-bold text-slate-800 mt-1">
              {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
            </div>
            <div className="mt-6 flex flex-col items-center">
              <div className="w-52 border-b border-dotted border-slate-800 pb-1 text-sm sm:text-base text-slate-600 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-22 h-22 border-2 border-dashed border-slate-600 rounded-full mt-2 flex items-center justify-center text-xs text-slate-600 font-bold">
                الختم الرسمي
              </div>
            </div>
          </div>
        </div>

        {/* Footer Badge */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-300 text-xs sm:text-sm text-slate-700 font-bold flex items-center justify-between">
          <span>رمز التحقق للمرشح: <span className="font-mono font-black text-slate-950">{application.activationCode}</span></span>
          <span className="flex items-center gap-1 text-slate-900 font-extrabold">
            <ShieldCheck className="w-4 h-4 text-teal-800" />
            استمارة ترشيح رسمية معتمدة عبر نظام {signatories.schoolName || "المدرسة"}
          </span>
          <span>تاريخ التقديم: {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("ar-SA") : "—"}</span>
        </div>
      </div>
    </div>
  );
}
