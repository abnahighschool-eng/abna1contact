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
  Check,
  UserCheck,
} from "lucide-react";
import {
  ParentCouncilApplication,
  ParentCouncilConfig,
  ParentCouncilInvite,
  SchoolSignatories,
} from "../../types";
import { formatHijriDisplayDate } from "../../utils/parentCouncilUtils";

// =========================================================================
// Global Print Styles Constant for A4 with 1.5cm Margins (15mm)
// =========================================================================
const A4_PRINT_STYLE = `
  @page {
    size: A4 portrait;
    margin: 15mm;
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
      color: #0f172a !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
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
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .single-page-sheet {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .multi-page-table {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    .multi-page-table thead {
      display: table-header-group !important;
    }
    .multi-page-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .print-avoid-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`;

// =========================================================================
// 1. ParentCouncilPrintSheet (استمارة طلب العضوية الفردية - صفحة واحدة A4 بهوامش 1.5 سم)
// =========================================================================

export interface ParentCouncilPrintSheetProps {
  application: ParentCouncilApplication;
  signatories: SchoolSignatories;
  academicYear?: string;
  onClose?: () => void;
}

export function ParentCouncilPrintSheet({
  application,
  signatories,
  academicYear = "1447 - 1448 هـ",
  onClose,
}: ParentCouncilPrintSheetProps) {
  const handlePrint = () => {
    window.print();
  };

  const additionalStudentsDisplay =
    Array.isArray(application.additionalStudents) && application.additionalStudents.length > 0
      ? application.additionalStudents
          .map((s) => `${s.name}${s.grade ? ` (${s.grade})` : ""}`)
          .join("، ")
      : typeof application.additionalStudents === "string" && application.additionalStudents
      ? application.additionalStudents
      : "لا يوجد";

  const skillsList = [
    {
      key: "organizationalManagement" as const,
      label: "مهارات تنظيمية وإدارية",
      details: application.skills?.organizationalDetails,
      checked: !!application.skills?.organizationalManagement,
    },
    {
      key: "volunteerExperience" as const,
      label: "خبرة في العمل التطوعي أو المجتمعي",
      details: application.skills?.volunteerDetails,
      checked: !!application.skills?.volunteerExperience,
    },
    {
      key: "reportingAndDoc" as const,
      label: "إعداد التقارير والتوثيق وصياغة المحاضر",
      details: application.skills?.reportingDetails,
      checked: !!application.skills?.reportingAndDoc,
    },
    {
      key: "digitalPlatforms" as const,
      label: "استخدام المنصات الرقمية والتقنيات التعليمية",
      details: application.skills?.digitalPlatformsDetails,
      checked: !!application.skills?.digitalPlatforms,
    },
    {
      key: "previousCommittees" as const,
      label: "مشاركات سابقة في لجان مدرسية أو مجتمعية",
      details: application.skills?.committeeDetails,
      checked: !!application.skills?.previousCommittees,
    },
  ];

  return (
    <div
      className="parent-council-print-page min-h-screen bg-slate-200/70 p-3 sm:p-6 text-slate-900 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0"
      dir="rtl"
    >
      <style>{A4_PRINT_STYLE}</style>

      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع</span>
            </button>
          )}
          <div className="h-5 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-800">
            معاينة استمارة الترشح الرسمية
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold rounded-lg">
            <span>الورقة:</span>
            <span className="font-extrabold text-teal-950">A4 (صفحة واحدة)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold rounded-lg">
            <span>الهوامش:</span>
            <span className="font-extrabold text-amber-950">1.5 سم من جميع الجهات</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg">
            <span>الخط:</span>
            <span className="font-extrabold">Cairo الحديث المقروء</span>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
          id="btn-print-parent-council-sheet"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة الاستمارة (A4)</span>
        </button>
      </div>

      {/* Official A4 Form Canvas (Exact A4 size: 210mm x 297mm with 15mm padding) */}
      <div
        className="parent-council-sheet-canvas single-page-sheet w-full max-w-[210mm] mx-auto bg-white shadow-2xl border border-slate-300 rounded-xs text-slate-900 leading-snug print:m-0 print:p-0 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none"
        style={{
          fontFamily: "'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "15mm",
          minHeight: "297mm",
          boxSizing: "border-box",
        }}
      >
        {/* ================= Header (المملكة / الوزارة / المدرسة) ================= */}
        <div className="border-b-2 border-slate-900 pb-2 mb-3">
          <div className="flex items-start justify-between">
            {/* Right: Ministerial Information */}
            <div className="text-right leading-tight w-1/3">
              <div className="text-[11px] font-bold text-slate-700">
                {signatories.countryName || "المملكة العربية السعودية"}
              </div>
              <div className="text-sm font-black text-slate-950 mt-0.5">
                {signatories.ministryName || "وزارة التعليم"}
              </div>
              <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                {signatories.administrationName || "الإدارة العامة للتعليم"}
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5">
                {signatories.schoolName || "ثانوية الأبناء الأولى"}
              </div>
            </div>

            {/* Center: Title Ribbon */}
            <div className="text-center w-1/3 pt-0.5">
              <div className="inline-block border-2 border-slate-900 bg-slate-100/90 px-3.5 py-1 rounded-sm shadow-2xs">
                <h1 className="text-base font-black text-slate-950 tracking-normal m-0">
                  استمارة ترشح لعضوية مجلس أولياء الأمور
                </h1>
              </div>
              <div className="text-[11px] font-extrabold text-slate-800 mt-1">
                للعام الدراسي {academicYear}
              </div>
            </div>

            {/* Left: General Administration / Logo / Form Serial */}
            <div className="text-left w-1/3 flex flex-col items-end leading-tight">
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
                <div className="text-[10px] font-mono font-bold text-slate-700 border border-slate-400 px-2 py-0.5 rounded mt-1 bg-slate-50">
                  رقم الطلب: {application.activationCode || "PC-1447"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= Section 1: البيانات العامة لمقدم الطلب (مسطرة ومنظمة) ================= */}
        <div className="mb-2.5">
          <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs flex items-center justify-between">
            <span>أولاً: البيانات الأساسية لولي الأمر والمرشح</span>
            <span className="text-[10px] font-normal text-slate-200">النموذج الرسمي المعتمد</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-xs">
            <tbody>
              <tr className="border-b border-slate-800">
                <td className="w-32 bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  الاسم الرباعي للمرشح:
                </td>
                <td className="p-1.5 font-bold text-slate-950 border-l border-slate-800 text-sm">
                  {application.fullName}
                </td>
                <td className="w-28 bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  رقم الهوية الوطنية:
                </td>
                <td className="w-36 p-1.5 font-mono font-black text-slate-950 text-sm">
                  {application.nationalId || "—"}
                </td>
              </tr>

              <tr className="border-b border-slate-800">
                <td className="bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  رقم الجوال للتواصل:
                </td>
                <td className="p-1.5 font-mono font-black text-slate-950 border-l border-slate-800" dir="ltr">
                  {application.phone}
                </td>
                <td className="bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  صفة مقدم الطلب:
                </td>
                <td className="p-1.5 font-bold text-slate-950">
                  {application.relationLabel || "أب / ولي أمر"}
                </td>
              </tr>

              <tr className="border-b border-slate-800">
                <td className="bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  اسم الطالب التابع بالمدرسة:
                </td>
                <td className="p-1.5 font-bold text-slate-950 border-l border-slate-800">
                  {application.studentName}
                </td>
                <td className="bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  الصف والشعبة:
                </td>
                <td className="p-1.5 font-bold text-slate-950">
                  {application.studentGrade}
                  {application.studentClass ? ` - شعبة ${application.studentClass}` : ""}
                </td>
              </tr>

              <tr>
                <td className="bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  البريد الإلكتروني:
                </td>
                <td className="p-1.5 font-sans font-bold text-slate-800 border-l border-slate-800" dir="ltr">
                  {application.email || "—"}
                </td>
                <td className="bg-slate-100/90 font-black text-slate-900 p-1.5 border-l border-slate-800">
                  أبناء آخرون بالمدرسة:
                </td>
                <td className="p-1.5 font-bold text-slate-950">
                  {additionalStudentsDisplay}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ================= Section 2: الخبرات والمهارات ذات العلاقة (جدول مسطر منظم) ================= */}
        <div className="mb-2.5">
          <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs flex items-center justify-between">
            <span>ثانياً: الخبرات والمهارات ذات العلاقة للمرشح</span>
            <span className="text-[10px] font-normal text-slate-200">الضوابط والمعايير الوزارية</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b-2 border-slate-900 text-slate-950 font-black">
                <th className="border-l border-slate-800 py-1.5 px-2 w-8 text-center">م</th>
                <th className="border-l border-slate-800 py-1.5 px-2 text-right">المهارة / مجال الخبرة والمساهمة</th>
                <th className="border-l border-slate-800 py-1.5 px-2 w-20 text-center">الحالة</th>
                <th className="py-1.5 px-2 text-right">التفاصيل والبيان المسجل</th>
              </tr>
            </thead>
            <tbody>
              {skillsList.map((skill, index) => (
                <tr key={skill.key} className="border-b border-slate-800 last:border-b-0">
                  <td className="border-l border-slate-800 py-1 px-2 text-center font-mono font-bold text-slate-950">
                    {index + 1}
                  </td>
                  <td className="border-l border-slate-800 py-1 px-2 font-bold text-slate-950">
                    {skill.label}
                  </td>
                  <td className="border-l border-slate-800 py-1 px-2 text-center">
                    {skill.checked ? (
                      <span className="inline-flex items-center gap-1 font-black text-emerald-900 bg-emerald-50 border border-emerald-400 px-1.5 py-0.5 rounded text-[10px]">
                        <span>✓</span>
                        <span>متوفر</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px] font-medium">— غير محدد</span>
                    )}
                  </td>
                  <td className="py-1 px-2 text-slate-900">
                    {skill.checked && skill.details ? (
                      <span className="font-bold text-[11px] text-slate-950">
                        {skill.details}
                      </span>
                    ) : skill.checked ? (
                      <span className="text-slate-600 text-[10px]">تمت الإفادة بتوفر المهارة في طلب الترشح</span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">....................................................................................</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================= Section 3: أهدافي وتطلعاتي من الانضمام (مسطرة بأسطر واضحة) ================= */}
        <div className="mb-2.5">
          <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs">
            ثالثاً: أهدافي وتطلعاتي من الانضمام لمجلس أولياء الأمور
          </div>

          <div className="border-2 border-slate-900 p-2.5 bg-white text-xs space-y-1.5">
            {[0, 1, 2].map((i) => {
              const defaultGoals = [
                "المساهمة الفاعلة في دعم البرامج التعليمية وتعزيز الشراكة بين الأسرة والمدرسة.",
                "تقديم المقترحات التطويرية التي تخدم العملية التعليمية وتحسن البيئة المدرسية.",
                "المشاركة الإيجابية في متابعة الطلاب ودعم مبادرات التوجيه الطلابي ورعاية المتفوقين.",
              ];
              const goalText = application.goals?.[i] || defaultGoals[i];
              return (
                <div key={i} className="flex items-baseline gap-2 border-b border-dotted border-slate-400 pb-1 last:border-b-0">
                  <span className="font-black text-slate-950 font-mono">.{i + 1}</span>
                  <div className="flex-1 font-bold text-slate-950 text-[11px]">
                    {goalText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= Section 4: تعهد المرشح والتوقيع (منظم ومسطر) ================= */}
        <div className="mb-2.5">
          <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs">
            رابعاً: إقرار وتعهد المرشح
          </div>

          <div className="border-2 border-slate-900 p-2 bg-white text-xs">
            <p className="font-bold text-slate-900 leading-normal text-[11px] mb-2 text-justify">
              أتعهد بالالتزام بحضور اجتماعات مجلس أولياء الأمور المقررة والمشاركة الفاعلة والإيجابية في تحقيق أهداف المجلس، والتقيد بالمهام والضوابط المنظمة وفق اللائحة الوزارية المعتمدة.
            </p>

            <table className="w-full border-collapse border border-slate-800 text-xs text-center">
              <tbody>
                <tr className="bg-slate-100/90 font-black text-slate-900">
                  <td className="border border-slate-800 py-1 px-2 w-1/3">اسم المرشح كاملاً</td>
                  <td className="border border-slate-800 py-1 px-2 w-1/3">التوقيع والاعتماد</td>
                  <td className="border border-slate-800 py-1 px-2 w-1/3">تاريخ التقديم</td>
                </tr>
                <tr>
                  <td className="border border-slate-800 py-1.5 px-2 font-black text-slate-950 text-xs">
                    {application.fullName}
                  </td>
                  <td className="border border-slate-800 py-1.5 px-2 font-serif italic font-black text-slate-900 text-sm">
                    {application.signature || application.fullName}
                  </td>
                  <td className="border border-slate-800 py-1.5 px-2 font-bold text-slate-900 text-[11px]" dir="rtl">
                    {formatHijriDisplayDate(application.submissionDateHijri)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= Section 5: الاعتماد والتذييل المدرسي والختم الرسمي ================= */}
        <div className="mb-2 border-2 border-slate-900 p-2.5 bg-white">
          <div className="text-center font-black text-xs text-slate-950 border-b border-slate-800 pb-1 mb-2">
            خامساً: الاعتماد الرسمي من إدارة المدرسة ولجنة التوجيه الطلابي
          </div>

          <div className="grid grid-cols-2 gap-4 items-start text-xs">
            {/* Right: لجنة التوجيه الطلابي */}
            <div className="text-center border-l border-slate-400 pl-3">
              <div className="font-black text-slate-950 text-xs">لجنة التوجيه الطلابي</div>
              <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي / منسق المجلس"}
              </div>
              <div className="mt-4 border-b border-dotted border-slate-800 w-40 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع: ................................
              </div>
            </div>

            {/* Left: مدير المدرسة مع دائرة الختم الرسمي المنظمة */}
            <div className="text-center flex flex-col items-center">
              <div className="font-black text-slate-950 text-xs">مدير المدرسة / رئيس المجلس</div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-3 border-b border-dotted border-slate-800 w-40 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع والاعتماد
              </div>
              {/* Organized Official Stamp Circle */}
              <div className="w-18 h-18 border-2 border-dashed border-slate-700 rounded-full mt-1.5 flex flex-col items-center justify-center text-[9px] font-black text-slate-600 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[8px] font-normal text-slate-500">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= Footer Bar (رمز التحقق والتوثيق) ================= */}
        <div className="pt-1.5 border-t border-slate-400 text-[10px] text-slate-700 font-bold flex items-center justify-between">
          <span>
            رمز التحقق: <span className="font-mono font-black text-slate-950">{application.activationCode}</span>
          </span>
          <span className="flex items-center gap-1 text-slate-950 font-black">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-800" />
            استمارة ترشيح رسمية معتمدة عبر نظام {signatories.schoolName || "المدرسة"}
          </span>
          <span>
            التاريخ: {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("ar-SA") : "1447هـ"}
          </span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 2. CouncilFormationPrintSheet (محضر تشكيل واعتماد مجلس أولياء الأمور)
// A4 - 1.5cm margins - Ruled & Distinct - Seamless Multi-page Continuation
// =========================================================================

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

  const todayDisplayDate = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="parent-council-print-page min-h-screen bg-slate-200/70 p-3 sm:p-6 text-slate-900 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0"
      dir="rtl"
    >
      <style>{A4_PRINT_STYLE}</style>

      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للوحة التحكم</span>
            </button>
          )}
          <div className="h-5 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-800">
            معاينة محضر تشكيل مجلس أولياء الأمور
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold rounded-lg">
            <span>الورقة:</span>
            <span className="font-extrabold text-teal-950">A4 معتمد</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold rounded-lg">
            <span>الهوامش:</span>
            <span className="font-extrabold text-amber-950">1.5 سم من جميع الجهات</span>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
          id="btn-print-council-formation"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة محضر الاعتماد النهائي (A4)</span>
        </button>
      </div>

      {/* Manual Role Entry Guide Banner (no-print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-teal-50/90 border border-teal-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-teal-900 no-print">
        <div className="flex items-center gap-2.5">
          <PenLine className="w-4 h-4 text-teal-700 shrink-0" />
          <div>
            <div className="font-black text-teal-950">تخصيص الصفة في المجلس:</div>
            <div className="text-teal-800 text-[11px]">
              يمكنك كتابة صفة العضو (مثل: رئيس المجلس، نائب الرئيس، أمين المجلس، عضو) مباشرة في الجدول أدناه قبل الطباعة.
            </div>
          </div>
        </div>
      </div>

      {/* Official A4 Canvas with 15mm padding */}
      <div
        className="parent-council-sheet-canvas w-full max-w-[210mm] mx-auto bg-white shadow-2xl border border-slate-300 rounded-xs text-slate-900 print:m-0 print:p-0 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none"
        style={{
          fontFamily: "'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "15mm",
          minHeight: "297mm",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-2 mb-3">
          <div className="flex items-start justify-between">
            <div className="text-right leading-tight w-1/3">
              <div className="text-[11px] font-bold text-slate-700">
                {signatories.countryName || "المملكة العربية السعودية"}
              </div>
              <div className="text-sm font-black text-slate-950 mt-0.5">
                {signatories.ministryName || "وزارة التعليم"}
              </div>
              <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                {signatories.administrationName || "الإدارة العامة للتعليم"}
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5">
                {signatories.schoolName || "ثانوية الأبناء الأولى"}
              </div>
            </div>

            <div className="text-center w-1/3 pt-0.5">
              <div className="inline-block border-2 border-slate-900 bg-slate-100/90 px-3.5 py-1 rounded-sm shadow-2xs">
                <h1 className="text-base font-black text-slate-950 tracking-normal m-0">
                  محضر تشكيل واعتماد مجلس أولياء الأمور
                </h1>
              </div>
              <div className="text-[11px] font-extrabold text-slate-800 mt-1">
                للعام الدراسي {config.academicYear || "1447 - 1448 هـ"}
              </div>
            </div>

            <div className="text-left w-1/3 flex flex-col items-end leading-tight">
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
                <div className="text-[10px] font-mono font-bold text-slate-700 border border-slate-400 px-2 py-0.5 rounded mt-1 bg-slate-50">
                  التاريخ: {todayDisplayDate}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Minutes Introductory Text (مقدمة المحضر النظامية) */}
        <div className="mb-3 border-2 border-slate-900 p-2.5 bg-slate-50/60 rounded-xs text-xs font-bold text-slate-900 leading-relaxed text-justify">
          <p>
            بناءً على التوجيهات واللوائح المنظمة لمجالس أولياء الأمور في التعليم العام، وإشارةً إلى إجراءات الترشح والاقتراع الإلكتروني المنفذة لاختيار أعضاء مجلس أولياء الأمور للعام الدراسي{" "}
            <strong className="font-black text-slate-950">{config.academicYear || "1447 - 1448هـ"}</strong>، اجتمعت لجنة التوجيه الطلابي وإدارة المدرسة لفرز وتدقيق طلبات الترشح، وقد أقرّت اللجنة اعتماد التشكيل النهائي للمجلس على النحو التالي:
          </p>
        </div>

        {/* Primary Council Members Table (مسطرة ومميزة) */}
        <div className="mb-4">
          <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs flex items-center justify-between">
            <span>أولاً: الأعضاء الأساسيون لمجلس أولياء الأمور (العدد: {selectedMembers.length} عضواً)</span>
            <span className="text-[10px] font-normal text-slate-200">الترتيب بحسب نتائج الفرز والاعتماد</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-xs multi-page-table">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-slate-950 font-black">
                <th className="border-l border-slate-800 py-1.5 px-2 w-8 text-center">م</th>
                <th className="border-l border-slate-800 py-1.5 px-3 text-right">الاسم الرباعي</th>
                <th className="border-l border-slate-800 py-1.5 px-2 w-36 text-center">الصفة في المجلس</th>
                <th className="border-l border-slate-800 py-1.5 px-3 text-right">اسم الطالب والصف</th>
                <th className="border-l border-slate-800 py-1.5 px-2 w-32 text-center">رقم الجوال</th>
                <th className="py-1.5 px-2 w-28 text-center">التوقيع</th>
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
                  <tr key={member.id} className="border-b border-slate-800 last:border-b-0">
                    <td className="border-l border-slate-800 py-1.5 px-2 text-center font-mono font-bold text-slate-950">
                      {index + 1}
                    </td>
                    <td className="border-l border-slate-800 py-1.5 px-3 font-black text-slate-950 text-xs sm:text-sm">
                      {member.fullName}
                    </td>
                    <td className="border-l border-slate-800 py-1.5 px-2 text-center font-black text-slate-950">
                      <input
                        type="text"
                        value={localRoles[member.id] !== undefined ? localRoles[member.id] : (member.assignedRole || "عضو مجلس")}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        placeholder="الصفة بالمجلس..."
                        className="w-full text-center text-xs font-black text-slate-950 bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-600 focus:bg-white rounded px-1 py-0.5 outline-none print:border-none print:p-0"
                      />
                    </td>
                    <td className="border-l border-slate-800 py-1.5 px-3 text-slate-950">
                      <div className="font-black text-xs">{member.studentName}</div>
                      <div className="text-[10px] text-slate-700 font-bold">
                        {member.studentGrade}{member.studentClass ? ` - شعبة ${member.studentClass}` : ""}
                      </div>
                    </td>
                    <td className="border-l border-slate-800 py-1.5 px-2 text-center font-mono font-black text-slate-950" dir="ltr">
                      {member.phone}
                    </td>
                    <td className="py-1.5 px-2 text-center font-serif italic text-slate-400 text-xs">
                      ...................
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Reserve Members Table (الأعضاء الاحتياط) */}
        {reserveMembers.length > 0 && (
          <div className="mb-4">
            <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs flex items-center justify-between">
              <span>ثانياً: الأعضاء الاحتياط لمجلس أولياء الأمور (العدد: {reserveMembers.length} عضواً)</span>
              <span className="text-[10px] font-normal text-slate-200">الاحتياط بحسب أسبقية الفرز</span>
            </div>

            <table className="w-full border-collapse border-2 border-slate-900 text-xs multi-page-table">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-slate-950 font-black">
                  <th className="border-l border-slate-800 py-1.5 px-2 w-8 text-center">م</th>
                  <th className="border-l border-slate-800 py-1.5 px-3 text-right">الاسم الرباعي</th>
                  <th className="border-l border-slate-800 py-1.5 px-3 text-right">اسم الطالب والصف</th>
                  <th className="border-l border-slate-800 py-1.5 px-2 w-32 text-center">رقم الجوال</th>
                  <th className="py-1.5 px-2 w-28 text-center">التوقيع</th>
                </tr>
              </thead>
              <tbody>
                {reserveMembers.map((member, index) => (
                  <tr key={member.id} className="border-b border-slate-800 last:border-b-0">
                    <td className="border-l border-slate-800 py-1.5 px-2 text-center font-mono font-bold text-slate-950">
                      {index + 1}
                    </td>
                    <td className="border-l border-slate-800 py-1.5 px-3 font-black text-slate-950">
                      {member.fullName}
                      <span className="text-[10px] text-slate-700 font-bold mr-2">(عضو احتياط)</span>
                    </td>
                    <td className="border-l border-slate-800 py-1.5 px-3 text-slate-950">
                      <div className="font-black text-xs">{member.studentName}</div>
                      <div className="text-[10px] text-slate-700 font-bold">
                        {member.studentGrade}{member.studentClass ? ` - شعبة ${member.studentClass}` : ""}
                      </div>
                    </td>
                    <td className="border-l border-slate-800 py-1.5 px-2 text-center font-mono font-black text-slate-950" dir="ltr">
                      {member.phone}
                    </td>
                    <td className="py-1.5 px-2 text-center font-serif italic text-slate-400 text-xs">
                      ...................
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* School Signatures & Official Stamp (تجنب القطع في الطباعة) */}
        <div className="print-avoid-break mt-4 border-2 border-slate-900 p-3 bg-white">
          <div className="text-center font-black text-xs text-slate-950 border-b border-slate-800 pb-1 mb-2">
            اعتماد محضر تشكيل المجلس والختم الرسمي للمدرسة
          </div>

          <div className="grid grid-cols-2 gap-6 items-start text-xs">
            <div className="text-center border-l border-slate-400 pl-4">
              <div className="font-black text-slate-950 text-sm">لجنة التوجيه الطلابي</div>
              <div className="text-[11px] font-bold text-slate-700 mt-1">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي / أمين المجلس"}
              </div>
              <div className="mt-6 border-b border-dotted border-slate-800 w-44 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع والاعتماد
              </div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="font-black text-slate-950 text-sm">مدير المدرسة</div>
              <div className="text-[11px] font-bold text-slate-800 mt-1">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-5 border-b border-dotted border-slate-800 w-44 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع والاعتماد
              </div>
              <div className="w-20 h-20 border-2 border-dashed border-slate-700 rounded-full mt-2 flex flex-col items-center justify-center text-[10px] font-black text-slate-600 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[8px] font-normal text-slate-500">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-slate-400 text-[10px] text-slate-700 font-bold flex items-center justify-between">
          <span>توثيق رسمي صادر عبر منظومة إدارة المدرسة الإلكترونية</span>
          <span className="flex items-center gap-1 text-slate-950 font-black">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-800" />
            محضر تشكيل مجلس أولياء الأمور المعتمد
          </span>
          <span>تاريخ الطباعة: {todayDisplayDate}</span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 3. SentMessagesReportPrintSheet (تقرير متابعة الدعوات والرسائل المرسلة)
// A4 - 1.5cm margins - Ruled & Distinct - Seamless Multi-page Continuation
// =========================================================================

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
  councilTerm = "العام الدراسي 1447هـ",
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
    <div
      className="parent-council-print-page min-h-screen bg-slate-200/70 p-3 sm:p-6 text-slate-900 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0"
      dir="rtl"
    >
      <style>{A4_PRINT_STYLE}</style>

      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للوحة التحكم</span>
            </button>
          )}
          <div className="h-5 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-800">
            معاينة التقرير الرسمي لمتابعة الدعوات والرسائل
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold rounded-lg">
            <span>الورقة:</span>
            <span className="font-extrabold text-teal-950">A4 معتمد</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold rounded-lg">
            <span>الهوامش:</span>
            <span className="font-extrabold text-amber-950">1.5 سم من جميع الجهات</span>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
          id="btn-print-sent-messages-report"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة التقرير الرسمي (A4)</span>
        </button>
      </div>

      {/* Official A4 Canvas with 15mm padding */}
      <div
        className="parent-council-sheet-canvas w-full max-w-[210mm] mx-auto bg-white shadow-2xl border border-slate-300 rounded-xs text-slate-900 print:m-0 print:p-0 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none"
        style={{
          fontFamily: "'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "15mm",
          minHeight: "297mm",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-2 mb-3">
          <div className="flex items-start justify-between">
            <div className="text-right leading-tight w-1/3">
              <div className="text-[11px] font-bold text-slate-700">
                {signatories.countryName || "المملكة العربية السعودية"}
              </div>
              <div className="text-sm font-black text-slate-950 mt-0.5">
                {signatories.ministryName || "وزارة التعليم"}
              </div>
              <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                {signatories.administrationName || "الإدارة العامة للتعليم"}
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5">
                {signatories.schoolName || "ثانوية الأبناء الأولى"}
              </div>
            </div>

            <div className="text-center w-1/3 pt-0.5">
              <div className="inline-block border-2 border-slate-900 bg-slate-100/90 px-3.5 py-1 rounded-sm shadow-2xs">
                <h1 className="text-base font-black text-slate-950 tracking-normal m-0">
                  تقرير متابعة الدعوات والرسائل المرسلة
                </h1>
              </div>
              <div className="text-[11px] font-extrabold text-slate-800 mt-1">
                استبيان الترشح لمجلس أولياء الأمور — العام {academicYear}
              </div>
            </div>

            <div className="text-left w-1/3 flex flex-col items-end leading-tight">
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
                <div className="text-[10px] font-mono font-bold text-slate-700 border border-slate-400 px-2 py-0.5 rounded mt-1 bg-slate-50">
                  تاريخ: {todayDate}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistical Summary Boxes (مسطرة ومميزة) */}
        <div className="grid grid-cols-4 gap-2.5 mb-3.5">
          <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
            <div className="text-[11px] font-bold text-slate-700">إجمالي الرسائل المرسلة</div>
            <div className="text-xl font-black text-slate-950 font-mono mt-0.5">{totalSent}</div>
          </div>
          <div className="border-2 border-slate-900 p-2 text-center bg-teal-50/50">
            <div className="text-[11px] font-bold text-teal-900">الروابط التي تم فتحها</div>
            <div className="text-xl font-black text-teal-950 font-mono mt-0.5">
              {totalOpened} <span className="text-xs font-bold text-teal-800">({openRate}%)</span>
            </div>
          </div>
          <div className="border-2 border-slate-900 p-2 text-center bg-emerald-50/50">
            <div className="text-[11px] font-bold text-emerald-900">الطلبات المكتملة والمقدمة</div>
            <div className="text-xl font-black text-emerald-950 font-mono mt-0.5">
              {totalSubmitted} <span className="text-xs font-bold text-emerald-800">({submitRate}%)</span>
            </div>
          </div>
          <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
            <div className="text-[11px] font-bold text-slate-700">تاريخ وتوقيت التقرير</div>
            <div className="text-xs font-black text-slate-950 mt-0.5">{todayDate}</div>
            <div className="text-[10px] text-slate-600 font-mono">{printTime}</div>
          </div>
        </div>

        {/* Detailed Ruled Table (مسطرة بحواف دقيقة ومتصلة في الصفحات التالية) */}
        <div className="mb-4">
          <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs flex items-center justify-between">
            <span>سجل الطلاب وأولياء الأمور وحالة التفاعل</span>
            <span className="text-[10px] font-normal text-slate-200">البيانات الموثقة إلكترونياً</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-xs multi-page-table">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-slate-950 font-black">
                <th className="border-l border-slate-800 py-1.5 px-2 w-8 text-center">م</th>
                <th className="border-l border-slate-800 py-1.5 px-2.5 text-right">اسم الطالب</th>
                <th className="border-l border-slate-800 py-1.5 px-2 text-right">الصف والشعبة</th>
                <th className="border-l border-slate-800 py-1.5 px-2.5 text-right">ولي الأمر</th>
                <th className="border-l border-slate-800 py-1.5 px-2 w-28 text-center">رقم الجوال</th>
                <th className="border-l border-slate-800 py-1.5 px-2 w-20 text-center">حالة الفتح</th>
                <th className="py-1.5 px-2 w-24 text-center">حالة التقديم</th>
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
                    <tr key={inv.studentId || index} className="border-b border-slate-800 last:border-b-0">
                      <td className="border-l border-slate-800 py-1 px-2 text-center font-mono font-bold text-slate-950">
                        {index + 1}
                      </td>
                      <td className="border-l border-slate-800 py-1 px-2.5 font-bold text-slate-950">
                        {inv.studentName}
                      </td>
                      <td className="border-l border-slate-800 py-1 px-2 text-slate-800 text-[11px]">
                        {inv.studentGrade} {inv.studentClass ? `- شعبة ${inv.studentClass}` : ""}
                      </td>
                      <td className="border-l border-slate-800 py-1 px-2.5 text-slate-950 font-bold">
                        {inv.guardianName || "ولي الأمر"}
                      </td>
                      <td className="border-l border-slate-800 py-1 px-2 text-center font-mono font-bold text-slate-950 text-[11px]" dir="ltr">
                        {inv.guardianPhone}
                      </td>
                      <td className="border-l border-slate-800 py-1 px-2 text-center font-black">
                        {hasOpened ? (
                          <span className="text-teal-900 font-bold">تم الفتح ✓</span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-center font-black">
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

        {/* Official Signatures (تجنب القطع في الطباعة) */}
        <div className="print-avoid-break border-2 border-slate-900 p-3 bg-white">
          <div className="text-center font-black text-xs text-slate-950 border-b border-slate-800 pb-1 mb-2">
            اعتماد التقرير الإحصائي
          </div>

          <div className="grid grid-cols-2 gap-6 items-start text-xs">
            <div className="text-center border-l border-slate-400 pl-4">
              <div className="font-black text-slate-950 text-sm">لجنة التوجيه الطلابي</div>
              <div className="text-[11px] font-bold text-slate-700 mt-1">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي / رائد النشاط"}
              </div>
              <div className="mt-6 border-b border-dotted border-slate-800 w-44 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع والاعتماد
              </div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="font-black text-slate-950 text-sm">مدير المدرسة</div>
              <div className="text-[11px] font-bold text-slate-800 mt-1">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-5 border-b border-dotted border-slate-800 w-44 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-20 h-20 border-2 border-dashed border-slate-700 rounded-full mt-2 flex flex-col items-center justify-center text-[10px] font-black text-slate-600 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[8px] font-normal text-slate-500">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-slate-400 text-[10px] text-slate-700 font-bold flex items-center justify-between">
          <span>تقرير إحصائي صادر إلكترونياً عبر منظومة إدارة المدرسة</span>
          <span className="flex items-center gap-1 text-slate-950 font-black">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-800" />
            توثيق إرسال ومتابعة مجالس أولياء الأمور
          </span>
          <span>تاريخ الطباعة: {todayDate}</span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 4. VotingResultsReportPrintSheet (محضر نتائج وفرز تصويت أولياء الأمور)
// A4 - 1.5cm margins - Ruled & Distinct - Seamless Multi-page Continuation
// =========================================================================

export interface VotingResultsReportPrintSheetProps {
  candidates: Array<{
    id: string;
    fullName: string;
    studentName?: string;
    studentGrade?: string;
    studentClass?: string;
    votesCount: number;
  }>;
  totalVotesCast: number;
  config: ParentCouncilConfig;
  signatories: SchoolSignatories;
  onClose?: () => void;
}

export function VotingResultsReportPrintSheet({
  candidates,
  totalVotesCast,
  config,
  signatories,
  onClose,
}: VotingResultsReportPrintSheetProps) {
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

  const seatsCount = Number(config.seatsCount) || 9;
  const reserveCount = 4;

  return (
    <div
      className="parent-council-print-page min-h-screen bg-slate-200/70 p-3 sm:p-6 text-slate-900 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0"
      dir="rtl"
    >
      <style>{A4_PRINT_STYLE}</style>

      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للوحة الاقتراع</span>
            </button>
          )}
          <div className="h-5 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-800">
            معاينة محضر نتائج وفرز تصويت أولياء الأمور
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold rounded-lg">
            <span>الورقة:</span>
            <span className="font-extrabold text-teal-950">A4 معتمد</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold rounded-lg">
            <span>الهوامش:</span>
            <span className="font-extrabold text-amber-950">1.5 سم من جميع الجهات</span>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
          id="btn-print-voting-results-report"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة محضر النتائج (A4)</span>
        </button>
      </div>

      {/* Official A4 Canvas */}
      <div
        className="parent-council-sheet-canvas w-full max-w-[210mm] mx-auto bg-white shadow-2xl border border-slate-300 rounded-xs text-slate-900 print:m-0 print:p-0 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none"
        style={{
          fontFamily: "'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "15mm",
          minHeight: "297mm",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-2 mb-3">
          <div className="flex items-start justify-between">
            <div className="text-right leading-tight w-1/3">
              <div className="text-[11px] font-bold text-slate-700">
                {signatories.countryName || "المملكة العربية السعودية"}
              </div>
              <div className="text-sm font-black text-slate-950 mt-0.5">
                {signatories.ministryName || "وزارة التعليم"}
              </div>
              <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                {signatories.administrationName || "الإدارة العامة للتعليم"}
              </div>
              <div className="text-xs font-black text-slate-900 mt-0.5">
                {signatories.schoolName || "ثانوية الأبناء الأولى"}
              </div>
            </div>

            <div className="text-center w-1/3 pt-0.5">
              <div className="inline-block border-2 border-slate-900 bg-slate-100/90 px-3.5 py-1 rounded-sm shadow-2xs">
                <h1 className="text-base font-black text-slate-950 tracking-normal m-0">
                  محضر نتائج وفرز تصويت أولياء الأمور
                </h1>
              </div>
              <div className="text-[11px] font-extrabold text-slate-800 mt-1">
                لاختيار أعضاء المجلس — العام الدراسي {config.academicYear || "1447 - 1448 هـ"}
              </div>
            </div>

            <div className="text-left w-1/3 flex flex-col items-end leading-tight">
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
                <div className="text-[10px] font-mono font-bold text-slate-700 border border-slate-400 px-2 py-0.5 rounded mt-1 bg-slate-50">
                  تاريخ: {todayDate}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistical Summary Boxes */}
        <div className="grid grid-cols-4 gap-2.5 mb-3.5">
          <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
            <div className="text-[11px] font-bold text-slate-700">إجمالي الأصوات المقترعة</div>
            <div className="text-xl font-black text-slate-950 font-mono mt-0.5">{totalVotesCast}</div>
          </div>
          <div className="border-2 border-slate-900 p-2 text-center bg-teal-50/50">
            <div className="text-[11px] font-bold text-teal-900">إجمالي المرشحين بالاقتراع</div>
            <div className="text-xl font-black text-teal-950 font-mono mt-0.5">{candidates.length}</div>
          </div>
          <div className="border-2 border-slate-900 p-2 text-center bg-emerald-50/50">
            <div className="text-[11px] font-bold text-emerald-900">مقاعد المجلس المقررة</div>
            <div className="text-xl font-black text-emerald-950 font-mono mt-0.5">
              {seatsCount} <span className="text-xs font-bold text-emerald-800">أساسي + 4 احتياط</span>
            </div>
          </div>
          <div className="border-2 border-slate-900 p-2 text-center bg-slate-50">
            <div className="text-[11px] font-bold text-slate-700">توقيت إغلاق الفرز</div>
            <div className="text-xs font-black text-slate-950 mt-0.5">{todayDate}</div>
            <div className="text-[10px] text-slate-600 font-mono">{printTime}</div>
          </div>
        </div>

        {/* Detailed Ruled Results Table */}
        <div className="mb-4">
          <div className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded-t-xs flex items-center justify-between">
            <span>جدول الفرز النهائي وترتيب المرشحين بحسب عدد الأصوات</span>
            <span className="text-[10px] font-normal text-slate-200">فرز إلكتروني مباشر</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-xs multi-page-table">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-slate-950 font-black">
                <th className="border-l border-slate-800 py-1.5 px-2 w-8 text-center">الترتيب</th>
                <th className="border-l border-slate-800 py-1.5 px-3 text-right">اسم المرشح</th>
                <th className="border-l border-slate-800 py-1.5 px-3 text-right">اسم الطالب والصف</th>
                <th className="border-l border-slate-800 py-1.5 px-2 w-24 text-center">عدد الأصوات</th>
                <th className="border-l border-slate-800 py-1.5 px-2 w-20 text-center">النسبة</th>
                <th className="py-1.5 px-2 w-36 text-center">نتيجة الاقتراع</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-4 text-slate-500 font-bold">
                    لا توجد أصوات مسجلة في هذا التقرير بعد.
                  </td>
                </tr>
              ) : (
                candidates.map((cand, index) => {
                  const isTop = index < seatsCount;
                  const isRes = index >= seatsCount && index < seatsCount + reserveCount;
                  const pct = totalVotesCast > 0 ? Math.round((cand.votesCount / totalVotesCast) * 100) : 0;
                  return (
                    <tr
                      key={cand.id}
                      className={`border-b border-slate-800 last:border-b-0 ${
                        isTop ? "bg-emerald-50/30" : isRes ? "bg-blue-50/20" : ""
                      }`}
                    >
                      <td className="border-l border-slate-800 py-1.5 px-2 text-center font-mono font-black text-slate-950">
                        {index + 1}
                      </td>
                      <td className="border-l border-slate-800 py-1.5 px-3 font-black text-slate-950 text-xs sm:text-sm">
                        {cand.fullName}
                      </td>
                      <td className="border-l border-slate-800 py-1.5 px-3 text-slate-800">
                        <span className="font-bold">{cand.studentName || "—"}</span>
                        {cand.studentGrade && <span className="text-[11px] text-slate-600 block">{cand.studentGrade}</span>}
                      </td>
                      <td className="border-l border-slate-800 py-1.5 px-2 text-center font-mono font-black text-slate-950 text-sm">
                        {cand.votesCount}
                      </td>
                      <td className="border-l border-slate-800 py-1.5 px-2 text-center font-mono font-bold text-slate-800 text-xs">
                        {pct}%
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {isTop ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            عضو أساسي منتخب ✓
                          </span>
                        ) : isRes ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300">
                            عضو احتياط #{index - seatsCount + 1}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] font-bold">مرشح</span>
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
        <div className="print-avoid-break border-2 border-slate-900 p-3 bg-white">
          <div className="text-center font-black text-xs text-slate-950 border-b border-slate-800 pb-1 mb-2">
            اعتماد نتائج الفرز والاقتراع الرسمي
          </div>

          <div className="grid grid-cols-2 gap-6 items-start text-xs">
            <div className="text-center border-l border-slate-400 pl-4">
              <div className="font-black text-slate-950 text-sm">لجنة الفرز والتوجيه الطلابي</div>
              <div className="text-[11px] font-bold text-slate-700 mt-1">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي / أمين اللجنة"}
              </div>
              <div className="mt-6 border-b border-dotted border-slate-800 w-44 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع والاعتماد
              </div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="font-black text-slate-950 text-sm">مدير المدرسة / رئيس اللجنة</div>
              <div className="text-[11px] font-bold text-slate-800 mt-1">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-5 border-b border-dotted border-slate-800 w-44 mx-auto pb-1 text-[10px] text-slate-600 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-20 h-20 border-2 border-dashed border-slate-700 rounded-full mt-2 flex flex-col items-center justify-center text-[10px] font-black text-slate-600 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[8px] font-normal text-slate-500">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-slate-400 text-[10px] text-slate-700 font-bold flex items-center justify-between">
          <span>محضر إلكتروني موثق عبر منصة التصويت المدرسية</span>
          <span className="flex items-center gap-1 text-slate-950 font-black">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-800" />
            محضر فرز أصوات مجلس أولياء الأمور المعتمد
          </span>
          <span>تاريخ الطباعة: {todayDate}</span>
        </div>
      </div>
    </div>
  );
}

export default ParentCouncilPrintSheet;
