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
  Leaf,
} from "lucide-react";
import {
  ParentCouncilApplication,
  ParentCouncilConfig,
  ParentCouncilInvite,
  SchoolSignatories,
} from "../../types";
import { formatHijriDisplayDate } from "../../utils/parentCouncilUtils";
import { DEFAULT_MINISTRY_LOGO } from "../SchoolSignatoriesModal";

// =========================================================================
// Global Print Styles - Eco-Friendly / Ink-Saving / Crisp Arabic Typography
// Designed for standard Saudi Ministry of Education A4 reporting standards
// =========================================================================
const A4_PRINT_STYLE = `
  @page {
    size: A4 portrait;
    margin: 8mm 10mm 8mm 10mm;
  }
  @media print {
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      text-shadow: none !important;
      box-shadow: none !important;
    }
    /* Reset browser viewport and root document tree */
    html, body {
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13px !important;
      line-height: 1.45 !important;
      -webkit-font-smoothing: antialiased !important;
      text-rendering: optimizeLegibility !important;
    }
    /* Completely eliminate non-printable UI chrome */
    .no-print, header, nav, aside, footer, #main-header, #main-footer, [id*="sidebar"] {
      display: none !important;
    }
    /* Force ancestor wrappers to clean full width WITHOUT breaking child flex/table layouts */
    #root, #app-root, #primary-content-viewport, main, div[id*="viewport"] {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 100% !important;
      display: block !important;
      float: none !important;
      position: static !important;
      overflow: visible !important;
      box-shadow: none !important;
      border: none !important;
      background: transparent !important;
    }
    .parent-council-print-page {
      background: #ffffff !important;
      background-color: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      min-height: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      display: block !important;
    }
    .parent-council-sheet-canvas {
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 100% !important;
      min-height: 0 !important;
      height: auto !important;
      background: #ffffff !important;
      background-color: #ffffff !important;
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      display: block !important;
    }
    .parent-council-sheet-canvas,
    .parent-council-sheet-canvas * {
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    /* Header table safety: strictly keeps 3-column layout side-by-side with zero wrapping */
    .official-report-header-table {
      width: 100% !important;
      border: none !important;
      border-collapse: collapse !important;
      margin: 0 !important;
      padding: 0 !important;
      display: table !important;
    }
    .official-report-header-table tr {
      display: table-row !important;
    }
    .official-report-header-table td {
      border: none !important;
      padding: 0 4px !important;
      vertical-align: top !important;
      display: table-cell !important;
    }
    /* Single-page fit for individual application: fills A4 completely without breaking */
    .single-page-sheet {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    /* Seamless multi-page continuity for rosters, logs, and vote tables */
    .multi-page-table {
      page-break-inside: auto !important;
      break-inside: auto !important;
      width: 100% !important;
      border-collapse: collapse !important;
    }
    .multi-page-table thead {
      display: table-header-group !important;
    }
    .multi-page-table tbody {
      display: table-row-group !important;
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

// Shared Arabic Font Family - Strictly Cairo
const ARABIC_FONT_FAMILY =
  "'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// =========================================================================
// Official Ministry Report Header (طراز وزارة التعليم الرسمي فائق الوضوح والتحبير)
// مبني بجدول طباعي هندسي محكم يمنع انفصال الهوامش أو انزياح الأعمدة نهائياً
// =========================================================================
export function OfficialReportHeader({
  countryName = "المملكة العربية السعودية",
  ministryName = "وزارة التعليم",
  administrationName = "الإدارة العامة للتعليم بمنطقة تبوك",
  schoolName = "ثانوية الأبناء الأولى",
  logoUrl,
  title,
  subtitle,
  reportDate,
  issueTime,
  refNumber,
}: {
  countryName?: string;
  ministryName?: string;
  administrationName?: string;
  schoolName?: string;
  logoUrl?: string;
  title: string;
  subtitle?: string;
  reportDate?: string;
  issueTime?: string;
  refNumber?: string;
}) {
  const now = new Date();
  const defaultDate = now.toLocaleDateString("ar-SA");
  const defaultTime = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="border-b-2 border-slate-900 pb-2 mb-2.5 print-avoid-break w-full">
      <table
        className="official-report-header-table w-full border-collapse m-0 p-0"
        style={{ width: "100%", border: "none", borderCollapse: "collapse" }}
      >
        <tbody>
          <tr style={{ border: "none", verticalAlign: "top" }}>
            {/* Right: Ministerial Information (30%) */}
            <td
              className="text-right align-top"
              style={{ width: "30%", verticalAlign: "top", textAlign: "right", border: "none", padding: "0 0 2px 0" }}
            >
              <div className="text-xs font-semibold text-slate-700 leading-tight">
                {countryName || "المملكة العربية السعودية"}
              </div>
              <div className="text-sm font-black text-slate-950 mt-0.5 leading-tight">
                {ministryName || "وزارة التعليم"}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5 leading-tight">
                {administrationName || "الإدارة العامة للتعليم بمنطقة تبوك"}
              </div>
              <div className="text-xs sm:text-sm font-bold text-emerald-800 mt-0.5 leading-tight">
                {schoolName || "ثانوية الأبناء الأولى"}
              </div>
            </td>

            {/* Center: Ministry Logo & Report Title (40%) */}
            <td
              className="text-center align-top"
              style={{ width: "40%", verticalAlign: "top", textAlign: "center", border: "none", padding: "0 4px 2px 4px" }}
            >
              <div className="flex flex-col items-center justify-center">
                <img
                  src={logoUrl || DEFAULT_MINISTRY_LOGO}
                  alt="وزارة التعليم"
                  className="h-10 sm:h-11 w-auto max-h-11 object-contain mb-1 inline-block"
                  style={{ maxHeight: "44px", width: "auto", display: "inline-block" }}
                  referrerPolicy="no-referrer"
                />
                <h1 className="text-sm sm:text-base font-black text-slate-950 tracking-tight leading-snug m-0">
                  {title}
                </h1>
                {subtitle && (
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-600 mt-0.5 block leading-tight">
                    {subtitle}
                  </span>
                )}
              </div>
            </td>

            {/* Left: Metadata & Reference Code (30%) */}
            <td
              className="text-left align-top"
              style={{ width: "30%", verticalAlign: "top", textAlign: "left", border: "none", padding: "0 0 2px 0" }}
            >
              <div className="flex flex-col items-end text-xs leading-tight text-slate-800">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-bold text-slate-900">تاريخ التقرير:</span>
                  <span className="font-bold font-mono text-slate-950">{reportDate || defaultDate}</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="font-medium text-slate-600">وقت الإصدار:</span>
                  <span className="font-mono text-slate-800">{issueTime || defaultTime}</span>
                </div>
                {refNumber && (
                  <div className="flex items-center justify-end gap-1.5 mt-1">
                    <span className="font-medium text-slate-600">الرقم المرجعي:</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-bold font-mono text-slate-950 border border-slate-300">
                      {refNumber}
                    </span>
                  </div>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// =========================================================================
// Official Statistics & Metadata Box (صندوق الإحصاء والبيانات المنظم فائق التنسيق)
// =========================================================================
export function OfficialStatsBox({
  metaItems,
  kpis,
  summaryNote,
}: {
  metaItems: { label: string; value: React.ReactNode }[];
  kpis: { label: string; value: React.ReactNode; color?: "emerald" | "red" | "amber" | "slate" }[];
  summaryNote?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50/80 border border-slate-400 rounded-lg p-2.5 flex flex-col gap-1.5 text-[11px] print-avoid-break mb-3 w-full">
      {/* Metadata Row */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-300 pb-1.5 text-right w-full">
        {metaItems.map((item, idx) => (
          <div key={idx} className="leading-tight">
            <span className="text-slate-600 font-bold block text-[10px]">{item.label}:</span>
            <span className="font-extrabold text-slate-950 text-[11px] truncate block">{item.value}</span>
          </div>
        ))}
      </div>

      {/* KPI Summary Row */}
      <div className="flex items-center justify-between text-[10px] pt-0.5 w-full">
        <div className="flex items-center gap-3.5 font-bold flex-wrap">
          {kpis.map((kpi, idx) => {
            const colorClass =
              kpi.color === "emerald"
                ? "text-emerald-900"
                : kpi.color === "red"
                ? "text-red-900"
                : kpi.color === "amber"
                ? "text-amber-900"
                : "text-slate-950";
            return (
              <span key={idx} className={colorClass}>
                <strong className="text-slate-700">{kpi.label}:</strong> {kpi.value}
              </span>
            );
          })}
        </div>
        {summaryNote && (
          <div className="font-bold text-slate-900 text-[10px]">
            {summaryNote}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 1. ParentCouncilPrintSheet (استمارة ترشح لعضوية مجلس أولياء الأمور)
// A4 - صفحة واحدة مطابقة وموفرة للحبر 100% وبخط عالي الوضوح
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
          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg">
            <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            <span>طباعة موفرة للحبر (Eco)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg">
            <span>الورقة:</span>
            <span className="font-extrabold text-slate-900">A4 صفحة واحدة كاملة</span>
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

      {/* Official A4 Form Canvas (Exact A4 size: 210mm x 297mm) */}
      <div
        className="parent-council-sheet-canvas single-page-sheet w-full max-w-[210mm] mx-auto bg-white shadow-xl border border-slate-300 rounded-none text-slate-900 leading-normal p-6 sm:p-9 print:p-0 print:m-0 print:shadow-none print:border-none print:max-w-none print:w-full"
        style={{
          fontFamily: ARABIC_FONT_FAMILY,
          boxSizing: "border-box",
        }}
      >
        {/* ================= Header (المملكة / الوزارة / المدرسة) ================= */}
        <OfficialReportHeader
          countryName={signatories.countryName}
          ministryName={signatories.ministryName}
          administrationName={signatories.administrationName}
          schoolName={signatories.schoolName}
          logoUrl={signatories.logoUrl}
          title="استمارة ترشح لعضوية مجلس أولياء الأمور"
          subtitle={`النموذج الرسمي المعتمد — للعام الدراسي ${academicYear}`}
          reportDate={new Date().toLocaleDateString("ar-SA")}
          issueTime={new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          refNumber={application.activationCode || `PC-REQ-1447`}
        />

        {/* Statistical & Metadata Summary Box */}
        <OfficialStatsBox
          metaItems={[
            { label: "رقم الطلب المرجعي", value: application.activationCode || "PC-1447" },
            { label: "تاريخ تقديم الطلب", value: formatHijriDisplayDate(application.submissionDateHijri) || new Date().toLocaleDateString("ar-SA") },
            { label: "حالة الطلب والنظام", value: "مقيد ومعتمد بالنظام الإلكتروني" },
            { label: "المسار المستهدف", value: "عضوية مجلس أولياء الأمور" },
          ]}
          kpis={[
            { label: "حالة الترشح", value: "مكتمل ومعتمد ✓", color: "emerald" },
            { label: "رقم الجوال", value: application.phone, color: "slate" },
            { label: "المهارات المسجلة", value: `${skillsList.filter(s => s.checked).length} مهارات`, color: "emerald" },
          ]}
          summaryNote={`الطالب: ${application.studentName} (${application.studentGrade})`}
        />

        {/* ================= Section 1: البيانات الأساسية لولي الأمر والمرشح ================= */}
        <div className="mb-3.5">
          <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 flex items-center justify-between border-b-0">
            <span>أولاً: البيانات الأساسية لولي الأمر والمرشح</span>
            <span className="text-[11px] font-normal text-slate-700">النموذج الرسمي المعتمد</span>
          </div>

          <table className="w-full border-collapse border border-slate-800 text-xs">
            <tbody>
              <tr className="border-b border-slate-400">
                <td className="w-36 bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  الاسم الرباعي للمرشح:
                </td>
                <td className="py-2.5 px-3 font-bold text-slate-950 border-l border-slate-400 text-sm">
                  {application.fullName}
                </td>
                <td className="w-32 bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  رقم الهوية الوطنية:
                </td>
                <td className="w-40 py-2.5 px-3 font-mono font-bold text-slate-950 text-sm">
                  {application.nationalId || "—"}
                </td>
              </tr>

              <tr className="border-b border-slate-400">
                <td className="bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  رقم الجوال للتواصل:
                </td>
                <td className="py-2.5 px-3 font-mono font-bold text-slate-950 border-l border-slate-400 text-sm" dir="ltr">
                  {application.phone}
                </td>
                <td className="bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  صفة مقدم الطلب:
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-950 text-xs">
                  {application.relationLabel || "أب / ولي أمر"}
                </td>
              </tr>

              <tr className="border-b border-slate-400">
                <td className="bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  اسم الطالب التابع:
                </td>
                <td className="py-2.5 px-3 font-bold text-slate-950 border-l border-slate-400 text-xs">
                  {application.studentName}
                </td>
                <td className="bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  الصف والشعبة:
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-950 text-xs">
                  {application.studentGrade}
                  {application.studentClass ? ` - شعبة ${application.studentClass}` : ""}
                </td>
              </tr>

              <tr>
                <td className="bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  البريد الإلكتروني:
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-800 border-l border-slate-400 text-xs" dir="ltr">
                  {application.email || "—"}
                </td>
                <td className="bg-slate-50/80 font-bold text-slate-900 py-2.5 px-3 border-l border-slate-400">
                  أبناء آخرون بالمدرسة:
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-950 text-xs">
                  {additionalStudentsDisplay}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ================= Section 2: الخبرات والمهارات ذات العلاقة ================= */}
        <div className="mb-3.5">
          <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 flex items-center justify-between border-b-0">
            <span>ثانياً: الخبرات والمهارات ذات العلاقة للمرشح</span>
            <span className="text-[11px] font-normal text-slate-700">الضوابط والمعايير المنظمة</span>
          </div>

          <table className="w-full border-collapse border border-slate-800 text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-800 text-slate-950 font-bold">
                <th className="border-l border-slate-400 py-2 px-2 w-9 text-center">م</th>
                <th className="border-l border-slate-400 py-2 px-3 text-right">المهارة / مجال المساهمة</th>
                <th className="border-l border-slate-400 py-2 px-2 w-28 text-center">الحالة</th>
                <th className="py-2 px-3 text-right">البيان والتفاصيل المسجلة</th>
              </tr>
            </thead>
            <tbody>
              {skillsList.map((skill, index) => (
                <tr key={skill.key} className="border-b border-slate-300 last:border-b-0">
                  <td className="border-l border-slate-400 py-2.5 px-2 text-center font-mono font-bold text-slate-950">
                    {index + 1}
                  </td>
                  <td className="border-l border-slate-400 py-2.5 px-3 font-bold text-slate-950 text-xs">
                    {skill.label}
                  </td>
                  <td className="border-l border-slate-400 py-2.5 px-2 text-center">
                    {skill.checked ? (
                      <span className="inline-block border border-slate-800 bg-white px-2.5 py-0.5 rounded-sm text-xs font-bold text-slate-950">
                        [ ✓ ] متوفر ومؤهل
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs font-normal">— غير مسجل</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-900">
                    {skill.checked && skill.details ? (
                      <span className="font-semibold text-xs text-slate-950">
                        {skill.details}
                      </span>
                    ) : skill.checked ? (
                      <span className="text-slate-700 text-xs">تمت الإفادة بتوفر المهارة في طلب الترشح الرسمي</span>
                    ) : (
                      <span className="text-slate-400 text-xs">....................................................................</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================= Section 3: أهدافي وتطلعاتي من الانضمام ================= */}
        <div className="mb-3.5">
          <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 border-b-0">
            ثالثاً: أهدافي وتطلعاتي من الانضمام لمجلس أولياء الأمور
          </div>

          <div className="border border-slate-800 p-2.5 bg-white text-xs space-y-1.5">
            {[0, 1, 2].map((i) => {
              const defaultGoals = [
                "المساهمة الفاعلة في دعم البرامج التعليمية وتعزيز الشراكة بين الأسرة والمدرسة.",
                "تقديم المقترحات التطويرية التي تخدم العملية التعليمية وتحسن البيئة المدرسية.",
                "المشاركة الإيجابية في متابعة الطلاب ودعم مبادرات التوجيه الطلابي ورعاية المتفوقين.",
              ];
              const goalText = application.goals?.[i] || defaultGoals[i];
              return (
                <div key={i} className="flex items-baseline gap-2.5 border-b border-dotted border-slate-400 pb-1.5 last:border-b-0">
                  <span className="font-bold text-slate-950 font-mono text-xs">.{i + 1}</span>
                  <div className="flex-1 font-medium text-slate-900 text-xs leading-relaxed">
                    {goalText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= Section 4: إقرار وتعهد المرشح ================= */}
        <div className="mb-3.5">
          <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 border-b-0">
            رابعاً: إقرار وتعهد المرشح
          </div>

          <div className="border border-slate-800 p-2.5 bg-white text-xs">
            <p className="font-medium text-slate-900 leading-relaxed text-xs mb-2 text-justify">
              أتعهد بالالتزام بحضور اجتماعات مجلس أولياء الأمور المقررة والمشاركة الفاعلة والإيجابية في تحقيق أهداف المجلس، والتقيد بالمهام والضوابط المنظمة وفق اللائحة الوزارية المعتمدة.
            </p>

            <table className="w-full border-collapse border border-slate-800 text-xs text-center">
              <tbody>
                <tr className="bg-slate-50/80 font-bold text-slate-900">
                  <td className="border border-slate-800 py-1.5 px-3 w-1/3">اسم المرشح كاملاً</td>
                  <td className="border border-slate-800 py-1.5 px-3 w-1/3">التوقيع والاعتماد</td>
                  <td className="border border-slate-800 py-1.5 px-3 w-1/3">تاريخ التقديم</td>
                </tr>
                <tr>
                  <td className="border border-slate-800 py-2.5 px-3 font-bold text-slate-950 text-sm">
                    {application.fullName}
                  </td>
                  <td className="border border-slate-800 py-2.5 px-3 font-serif italic font-bold text-slate-900 text-base">
                    {application.signature || application.fullName}
                  </td>
                  <td className="border border-slate-800 py-2.5 px-3 font-bold text-slate-950 text-xs" dir="rtl">
                    {formatHijriDisplayDate(application.submissionDateHijri)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= Section 5: الاعتماد والتذييل المدرسي والختم الرسمي ================= */}
        <div className="mb-2.5 border border-slate-800 p-3 bg-white">
          <div className="text-center font-bold text-xs text-slate-950 border-b border-slate-400 pb-1 mb-2.5">
            خامساً: الاعتماد الرسمي من إدارة المدرسة ولجنة التوجيه الطلابي
          </div>

          <div className="grid grid-cols-2 gap-6 items-start text-xs">
            {/* Right: لجنة التوجيه الطلابي */}
            <div className="text-center border-l border-slate-400 pl-4">
              <div className="font-bold text-slate-950 text-xs">لجنة التوجيه الطلابي / مقرر المجلس</div>
              <div className="text-xs font-medium text-slate-700 mt-1">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي / منسق المجلس"}
              </div>
              <div className="mt-6 border-b border-dotted border-slate-600 w-44 mx-auto pb-1 text-xs text-slate-700">
                التوقيع: ................................
              </div>
              <div className="mt-2 text-[11px] text-slate-600">
                التاريخ: ..... / ..... / 1447هـ
              </div>
            </div>

            {/* Left: مدير المدرسة مع دائرة الختم الرسمي المنظمة */}
            <div className="text-center flex flex-col items-center">
              <div className="font-bold text-slate-950 text-xs">مدير المدرسة / رئيس المجلس</div>
              <div className="text-xs font-semibold text-slate-800 mt-1">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-4 border-b border-dotted border-slate-600 w-44 mx-auto pb-1 text-xs text-slate-700">
                التوقيع والاعتماد
              </div>
              {/* Clean Official Stamp Circle - Outlined thin border */}
              <div className="w-22 h-22 border-2 border-dashed border-slate-600 rounded-full mt-2 flex flex-col items-center justify-center text-[11px] font-bold text-slate-700 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[10px] font-normal text-slate-600">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= Footer Bar (رمز التحقق والتوثيق) ================= */}
        <div className="pt-2 border-t-2 border-slate-800 text-xs text-slate-700 font-medium flex items-center justify-between">
          <span>
            رمز التحقق: <span className="font-mono font-bold text-slate-950 text-sm">{application.activationCode}</span>
          </span>
          <span className="flex items-center gap-1 text-slate-950 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
            استمارة ترشيح رسمية موثقة عبر نظام {signatories.schoolName || "المدرسة"}
          </span>
          <span>
            تاريخ الطباعة: {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("ar-SA") : "1447هـ"}
          </span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 2. CouncilFormationPrintSheet (محضر تشكيل واعتماد مجلس أولياء الأمور)
// A4 - هوامش منظمة - جداول واضحة وتوفير حبر عالي
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

  // Flexible capacity controls: allows printing blank rows for manual entry or subsequent completion
  const [targetSeatsCount, setTargetSeatsCount] = useState<number>(() => {
    return Math.max(8, selectedMembers.length);
  });
  const [includeManualRows, setIncludeManualRows] = useState<boolean>(true);
  const [reserveTargetCount, setReserveTargetCount] = useState<number>(() => {
    return Math.max(3, reserveMembers.length);
  });

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

  // Calculate actual rows to render
  const primaryRowsCount = includeManualRows
    ? Math.max(targetSeatsCount, selectedMembers.length)
    : Math.max(1, selectedMembers.length);

  const reserveRowsCount = includeManualRows
    ? Math.max(reserveTargetCount, reserveMembers.length)
    : reserveMembers.length;

  return (
    <div
      className="parent-council-print-page min-h-screen bg-slate-200/70 p-3 sm:p-6 text-slate-900 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0"
      dir="rtl"
    >
      <style>{A4_PRINT_STYLE}</style>

      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2.5">
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
            معاينة محضر تشكيل المجلس
          </span>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg">
            <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            <span>طباعة اقتصادية A4</span>
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

      {/* Flexible Roster & Manual Fill Control Panel (no-print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white border border-teal-200 rounded-xl p-3 shadow-xs space-y-2.5 text-xs no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 pb-2">
          <div className="flex items-center gap-2 text-teal-950 font-bold">
            <PenLine className="w-4 h-4 text-teal-700" />
            <span>خيارات مرونة التقرير واستيعاب الأسماء اليدوية لاحقاً:</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors">
            <input
              type="checkbox"
              checked={includeManualRows}
              onChange={(e) => setIncludeManualRows(e.target.checked)}
              className="accent-teal-700 w-3.5 h-3.5"
            />
            <span>إتاحة أسطر فارغة للتعبئة اليدوية بالمحضر</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-slate-700">
          <span className="font-semibold text-slate-900">سعة مقاعد المجلس:</span>
          <div className="flex items-center gap-1.5">
            {[8, 10, 12].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => {
                  setTargetSeatsCount(count);
                  setIncludeManualRows(true);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                  targetSeatsCount === count && includeManualRows
                    ? "bg-teal-800 text-white border-teal-800"
                    : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {count} مقاعد {count === 8 ? "(المعيار الوزاري)" : ""}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIncludeManualRows(false)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                !includeManualRows
                  ? "bg-teal-800 text-white border-teal-800"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              المعتمدون فقط ({selectedMembers.length})
            </button>
          </div>
          <span className="text-slate-500 text-[11px] mr-auto">
            (يطبع المحضر بـ {primaryRowsCount} صفاً أساسياً منظماً لا يتأثر بأي إضافات)
          </span>
        </div>
      </div>

      {/* Official A4 Canvas */}
      <div
        className="parent-council-sheet-canvas w-full max-w-[210mm] mx-auto bg-white shadow-xl border border-slate-300 rounded-none text-slate-900 leading-normal p-6 sm:p-9 print:p-0 print:m-0 print:shadow-none print:border-none print:max-w-none print:w-full"
        style={{
          fontFamily: ARABIC_FONT_FAMILY,
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <OfficialReportHeader
          countryName={signatories.countryName}
          ministryName={signatories.ministryName}
          administrationName={signatories.administrationName}
          schoolName={signatories.schoolName}
          logoUrl={signatories.logoUrl}
          title="محضر تشكيل واعتماد مجلس أولياء الأمور"
          subtitle={`(نظام مجالس أولياء الأمور ولائحة التعليم العام — العام الدراسي ${config.academicYear || "1447 - 1448 هـ"})`}
          reportDate={todayDisplayDate}
          issueTime={new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          refNumber={`PC-COUNCIL-${new Date().getFullYear()}`}
        />

        {/* Statistical & Metadata Box (الصندوق المنظم) */}
        <OfficialStatsBox
          metaItems={[
            { label: "نطاق المحضر", value: `تشكيل المجلس للعام ${config.academicYear || "1447 - 1448هـ"}` },
            { label: "المقاعد المقررة", value: `${primaryRowsCount} مقاعد أساسية` },
            { label: "المقاعد الاحتياطية", value: `${reserveRowsCount} مقاعد احتياط` },
            { label: "حالة الاعتماد", value: "معتمد رسمياً من الإدارة المدرسية" },
          ]}
          kpis={[
            { label: "إجمالي المقاعد", value: `${primaryRowsCount + reserveRowsCount} مقعد` },
            { label: "المقيدون أساسي", value: `${selectedMembers.length} من ${primaryRowsCount}`, color: "emerald" },
            { label: "الاحتياط", value: `${reserveMembers.length} عضو`, color: "amber" },
            { label: "نسبة اكتمال التشكيل", value: `${Math.min(100, Math.round((selectedMembers.length / primaryRowsCount) * 100))}%`, color: "emerald" },
          ]}
          summaryNote={`المجلس المعتمد: ${selectedMembers.length} عضو`}
        />

        {/* Primary Council Members Table - Mathematical Fixed Geometry */}
        <div className="mb-4">
          <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 flex items-center justify-between border-b-0">
            <span>
              أولاً: الأعضاء الأساسيون لمجلس أولياء الأمور (العدد المقيد: {selectedMembers.length} من {primaryRowsCount} مقعداً)
            </span>
            <span className="text-[11px] font-normal text-slate-700">الترتيب بحسب نتائج الفرز والاعتماد النظامي</span>
          </div>

          <table className="w-full border-collapse border border-slate-800 text-xs multi-page-table table-fixed">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-50/80 text-slate-950 font-bold">
                <th className="border-l border-slate-400 py-2 px-1 text-center w-[5%]">م</th>
                <th className="border-l border-slate-400 py-2 px-3 text-right w-[28%]">الاسم الرباعي لولي الأمر</th>
                <th className="border-l border-slate-400 py-2 px-2 text-center w-[18%]">الصفة في المجلس</th>
                <th className="border-l border-slate-400 py-2 px-3 text-right w-[23%]">اسم الطالب والصف</th>
                <th className="border-l border-slate-400 py-2 px-2 text-center w-[14%]">رقم الجوال</th>
                <th className="py-2 px-2 text-center w-[12%]">التوقيع</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: primaryRowsCount }).map((_, index) => {
                const member = selectedMembers[index];
                if (member) {
                  const defaultRole =
                    index === 0
                      ? "رئيس المجلس"
                      : index === 1
                      ? "نائب رئيس المجلس"
                      : index === 2
                      ? "أمين المجلس"
                      : "عضو مجلس";
                  const currentRole =
                    localRoles[member.id] !== undefined
                      ? localRoles[member.id]
                      : member.assignedRole || defaultRole;

                  return (
                    <tr key={member.id} className="border-b border-slate-300 last:border-b-0 min-h-[44px]">
                      <td className="border-l border-slate-400 py-2.5 px-1 text-center font-mono font-bold text-slate-950">
                        {index + 1}
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-3 font-bold text-slate-950 text-sm truncate">
                        {member.fullName}
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-2 text-center font-bold text-slate-950">
                        <span className="hidden print:inline-block text-xs font-bold text-slate-950">
                          {currentRole}
                        </span>
                        <input
                          type="text"
                          value={currentRole}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          placeholder="الصفة بالمجلس..."
                          className="print:hidden w-full text-center text-xs font-bold text-slate-950 bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-600 focus:bg-white rounded px-1 py-0.5 outline-none"
                        />
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-3 text-slate-950">
                        <div className="font-bold text-xs truncate">{member.studentName}</div>
                        <div className="text-[11px] text-slate-600 truncate">
                          {member.studentGrade}
                          {member.studentClass ? ` - شعبة ${member.studentClass}` : ""}
                        </div>
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-2 text-center font-mono font-bold text-slate-950 text-xs" dir="ltr">
                        {member.phone}
                      </td>
                      <td className="py-2.5 px-2 text-center font-serif text-slate-400 text-xs select-none">
                        ...................
                      </td>
                    </tr>
                  );
                }

                // Placeholder row for manual handwriting or subsequent completion
                const defaultBlankRole =
                  index === 0
                    ? "رئيس المجلس"
                    : index === 1
                    ? "نائب رئيس المجلس"
                    : index === 2
                    ? "أمين المجلس"
                    : "عضو مجلس";

                return (
                  <tr key={`blank-seat-${index}`} className="border-b border-slate-300 last:border-b-0 min-h-[44px]">
                    <td className="border-l border-slate-400 py-2.5 px-1 text-center font-mono font-bold text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border-l border-slate-400 py-2.5 px-3">
                      <div className="font-mono text-slate-400 text-xs">................................................</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 print:hidden sm:block">
                        (الاسم الرباعي لولي الأمر)
                      </div>
                    </td>
                    <td className="border-l border-slate-400 py-2.5 px-2 text-center">
                      <div className="text-slate-800 font-semibold text-xs">{defaultBlankRole}</div>
                    </td>
                    <td className="border-l border-slate-400 py-2.5 px-3">
                      <div className="font-mono text-slate-400 text-xs">..............................................</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 print:hidden sm:block">
                        (اسم الطالب والصف)
                      </div>
                    </td>
                    <td className="border-l border-slate-400 py-2.5 px-2 text-center" dir="ltr">
                      <div className="font-mono text-slate-400 text-xs">......................</div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-serif text-slate-400 text-xs select-none">
                      ...................
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Reserve Members Table (الأعضاء الاحتياط) */}
        {(reserveRowsCount > 0 || reserveMembers.length > 0) && (
          <div className="mb-4">
            <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 flex items-center justify-between border-b-0">
              <span>
                ثانياً: الأعضاء الاحتياط لمجلس أولياء الأمور (العدد: {reserveMembers.length} من {reserveRowsCount})
              </span>
              <span className="text-[11px] font-normal text-slate-700">الاحتياط بحسب أسبقية الفرز أو التعيين الإضافي</span>
            </div>

            <table className="w-full border-collapse border border-slate-800 text-xs multi-page-table table-fixed">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-50/80 text-slate-950 font-bold">
                  <th className="border-l border-slate-400 py-2 px-1 text-center w-[5%]">م</th>
                  <th className="border-l border-slate-400 py-2 px-3 text-right w-[28%]">الاسم الرباعي لولي الأمر</th>
                  <th className="border-l border-slate-400 py-2 px-2 text-center w-[18%]">الصفة</th>
                  <th className="border-l border-slate-400 py-2 px-3 text-right w-[23%]">اسم الطالب والصف</th>
                  <th className="border-l border-slate-400 py-2 px-2 text-center w-[14%]">رقم الجوال</th>
                  <th className="py-2 px-2 text-center w-[12%]">التوقيع</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: reserveRowsCount }).map((_, index) => {
                  const member = reserveMembers[index];
                  if (member) {
                    return (
                      <tr key={member.id} className="border-b border-slate-300 last:border-b-0 min-h-[44px]">
                        <td className="border-l border-slate-400 py-2.5 px-1 text-center font-mono font-bold text-slate-950">
                          {index + 1}
                        </td>
                        <td className="border-l border-slate-400 py-2.5 px-3 font-semibold text-slate-950 text-sm truncate">
                          {member.fullName}
                        </td>
                        <td className="border-l border-slate-400 py-2.5 px-2 text-center font-medium text-slate-800 text-xs">
                          عضو احتياط #{index + 1}
                        </td>
                        <td className="border-l border-slate-400 py-2.5 px-3 text-slate-950">
                          <div className="font-semibold text-xs truncate">{member.studentName}</div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {member.studentGrade}
                            {member.studentClass ? ` - شعبة ${member.studentClass}` : ""}
                          </div>
                        </td>
                        <td className="border-l border-slate-400 py-2.5 px-2 text-center font-mono font-bold text-slate-950 text-xs" dir="ltr">
                          {member.phone}
                        </td>
                        <td className="py-2.5 px-2 text-center font-serif text-slate-400 text-xs select-none">
                          ...................
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={`blank-reserve-${index}`} className="border-b border-slate-300 last:border-b-0 min-h-[44px]">
                      <td className="border-l border-slate-400 py-2.5 px-1 text-center font-mono font-bold text-slate-500">
                        {index + 1}
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-3">
                        <div className="font-mono text-slate-400 text-xs">................................................</div>
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-2 text-center font-medium text-slate-600 text-xs">
                        عضو احتياط #{index + 1}
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-3">
                        <div className="font-mono text-slate-400 text-xs">..............................................</div>
                      </td>
                      <td className="border-l border-slate-400 py-2.5 px-2 text-center" dir="ltr">
                        <div className="font-mono text-slate-400 text-xs">......................</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-serif text-slate-400 text-xs select-none">
                        ...................
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Signatures Block (محمي من الانقطاع في الطباعة) */}
        <div className="print-avoid-break border border-slate-800 p-3.5 bg-white mb-3.5">
          <div className="text-center font-bold text-xs text-slate-950 border-b border-slate-400 pb-1 mb-3">
            الاعتماد والتوثيق الرسمي لمحضر التشكيل
          </div>

          <div className="grid grid-cols-3 gap-4 items-start text-xs text-center">
            {/* 1: أمين المجلس / الموجه الطلابي */}
            <div className="border-l border-slate-300 pl-2">
              <div className="font-bold text-slate-950 text-xs">أمين المجلس / الموجه الطلابي</div>
              <div className="text-xs font-medium text-slate-700 mt-1">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي"}
              </div>
              <div className="mt-7 border-b border-dotted border-slate-600 w-36 mx-auto pb-0.5 text-xs text-slate-600">
                التوقيع: ...................
              </div>
            </div>

            {/* 2: نائب رئيس المجلس */}
            <div className="border-l border-slate-300 pl-2">
              <div className="font-bold text-slate-950 text-xs">نائب رئيس المجلس</div>
              <div className="text-xs font-medium text-slate-700 mt-1">
                ولي أمر منتخب
              </div>
              <div className="mt-7 border-b border-dotted border-slate-600 w-36 mx-auto pb-0.5 text-xs text-slate-600">
                التوقيع: ...................
              </div>
            </div>

            {/* 3: مدير المدرسة / رئيس المجلس والختم */}
            <div className="flex flex-col items-center">
              <div className="font-bold text-slate-950 text-xs">مدير المدرسة / رئيس المجلس</div>
              <div className="text-xs font-semibold text-slate-800 mt-1">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-4 border-b border-dotted border-slate-600 w-40 mx-auto pb-0.5 text-xs text-slate-600">
                التوقيع والاعتماد
              </div>
              <div className="w-20 h-20 border-2 border-dashed border-slate-600 rounded-full mt-2 flex flex-col items-center justify-center text-[10px] font-bold text-slate-700 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[9px] font-normal text-slate-500">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t-2 border-slate-800 text-xs text-slate-700 font-medium flex items-center justify-between">
          <span>محضر رسمي معتمد صادر إلكترونياً من المدرسة</span>
          <span className="flex items-center gap-1 text-slate-950 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
            توثيق تشكيل مجلس أولياء الأمور
          </span>
          <span>تاريخ الطباعة: {todayDisplayDate}</span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 3. SentMessagesReportPrintSheet (تقرير متابعة الدعوات والرسائل المرسلة)
// A4 - بطاقات إحصائية خفيفة وجداول متصلة موفرة للحبر
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
            معاينة تقرير متابعة الدعوات والرسائل
          </span>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg">
            <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            <span>نمط موفر للحبر (Eco-Print)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg">
            <span>الورقة:</span>
            <span className="font-extrabold text-slate-900">A4 معتمد</span>
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

      {/* Official A4 Canvas */}
      <div
        className="parent-council-sheet-canvas w-full max-w-[210mm] mx-auto bg-white shadow-xl border border-slate-300 rounded-none text-slate-900 leading-normal p-6 sm:p-9 print:p-0 print:m-0 print:shadow-none print:border-none print:max-w-none print:w-full"
        style={{
          fontFamily: ARABIC_FONT_FAMILY,
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <OfficialReportHeader
          countryName={signatories.countryName}
          ministryName={signatories.ministryName}
          administrationName={signatories.administrationName}
          schoolName={signatories.schoolName}
          logoUrl={signatories.logoUrl}
          title="تقرير متابعة الدعوات والرسائل المرسلة"
          subtitle={`استبيان الترشح لمجلس أولياء الأمور — العام الدراسي ${academicYear}`}
          reportDate={todayDate}
          issueTime={printTime}
          refNumber={`MSG-REP-${new Date().getFullYear()}`}
        />

        {/* Statistical Summary Box */}
        <OfficialStatsBox
          metaItems={[
            { label: "نطاق التقرير", value: `دعوات أولياء الأمور — ${academicYear}` },
            { label: "قناة الإرسال", value: "رسائل الواتساب الرسمية المعتمدة" },
            { label: "المستهدفون", value: "كافة أولياء أمور الطلاب المسجلين" },
            { label: "حالة الربط", value: "نظام المتابعة الآني المعتمد" },
          ]}
          kpis={[
            { label: "إجمالي الرسائل", value: totalSent, color: "slate" },
            { label: "الروابط المفتوحة", value: `${totalOpened} (${openRate}%)`, color: "emerald" },
            { label: "الطلبات المقدمة", value: `${totalSubmitted} (${submitRate}%)`, color: "emerald" },
            { label: "قيد المتابعة", value: totalSent - totalSubmitted, color: "amber" },
          ]}
          summaryNote={`الطلاب المشمولون: ${invitesList.length} طالب`}
        />

        {/* Detailed Ruled Table */}
        <div className="mb-4">
          <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 flex items-center justify-between border-b-0">
            <span>سجل الطلاب وأولياء الأمور وحالة التفاعل</span>
            <span className="text-[11px] font-normal text-slate-700">البيانات الموثقة إلكترونياً</span>
          </div>

          <table className="w-full border-collapse border border-slate-800 text-xs multi-page-table table-fixed">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-50/80 text-slate-950 font-bold">
                <th className="border-l border-slate-400 py-2 px-1 text-center w-[5%]">م</th>
                <th className="border-l border-slate-400 py-2 px-2.5 text-right w-[24%]">اسم الطالب</th>
                <th className="border-l border-slate-400 py-2 px-2 text-right w-[18%]">الصف والشعبة</th>
                <th className="border-l border-slate-400 py-2 px-2.5 text-right w-[22%]">ولي الأمر</th>
                <th className="border-l border-slate-400 py-2 px-2 text-center w-[15%]">رقم الجوال</th>
                <th className="border-l border-slate-400 py-2 px-1.5 text-center w-[8%]">الفتح</th>
                <th className="py-2 px-1.5 text-center w-[8%]">التقديم</th>
              </tr>
            </thead>
            <tbody>
              {invitesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-slate-500 font-medium">
                    لا توجد رسائل مسجلة في هذا التقرير حالياً.
                  </td>
                </tr>
              ) : (
                invitesList.map((inv, index) => {
                  const hasOpened = inv.hasOpened || inv.isSubmitted;
                  const isSubmitted = inv.isSubmitted || (inv.studentId && applications[inv.studentId]);
                  return (
                    <tr key={inv.studentId || index} className="border-b border-slate-300 last:border-b-0 min-h-[38px]">
                      <td className="border-l border-slate-400 py-2 px-1 text-center font-mono font-bold text-slate-950">
                        {index + 1}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-2.5 font-bold text-slate-950 truncate">
                        {inv.studentName}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-2 text-slate-800 text-xs truncate">
                        {inv.studentGrade} {inv.studentClass ? `- شعبة ${inv.studentClass}` : ""}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-2.5 text-slate-950 font-semibold truncate">
                        {inv.guardianName || "ولي الأمر"}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-2 text-center font-mono font-bold text-slate-950 text-xs" dir="ltr">
                        {inv.guardianPhone}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-1.5 text-center">
                        {hasOpened ? (
                          <span className="font-bold text-slate-950 text-xs">✓ تم</span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-center">
                        {isSubmitted ? (
                          <span className="font-bold text-slate-950 text-xs">✓ قدم</span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
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
        <div className="print-avoid-break border border-slate-800 p-3.5 bg-white mb-3.5">
          <div className="text-center font-bold text-xs text-slate-950 border-b border-slate-400 pb-1 mb-3">
            اعتماد التقرير الإحصائي
          </div>

          <div className="grid grid-cols-2 gap-6 items-start text-xs">
            <div className="text-center border-l border-slate-300 pl-4">
              <div className="font-bold text-slate-950 text-xs">لجنة التوجيه الطلابي</div>
              <div className="text-xs font-medium text-slate-700 mt-1">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي / رائد النشاط"}
              </div>
              <div className="mt-7 border-b border-dotted border-slate-600 w-44 mx-auto pb-0.5 text-xs text-slate-600">
                التوقيع والاعتماد
              </div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="font-bold text-slate-950 text-xs">مدير المدرسة</div>
              <div className="text-xs font-semibold text-slate-800 mt-1">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-5 border-b border-dotted border-slate-600 w-44 mx-auto pb-0.5 text-xs text-slate-600">
                التوقيع والختم الرسمي
              </div>
              <div className="w-20 h-20 border-2 border-dashed border-slate-600 rounded-full mt-2 flex flex-col items-center justify-center text-[10px] font-bold text-slate-700 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[9px] font-normal text-slate-500">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t-2 border-slate-800 text-xs text-slate-700 font-medium flex items-center justify-between">
          <span>تقرير إحصائي صادر إلكترونياً عبر منظومة إدارة المدرسة</span>
          <span className="flex items-center gap-1 text-slate-950 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
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
// A4 - بطاقات فرز وجداول نتائج موفرة للحبر تماماً
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
  const seatsCount = Number(config.seatsCount) || 8;
  const reserveCount = 4;

  const [includeManualRows, setIncludeManualRows] = useState<boolean>(() => candidates.length === 0);
  const [targetRowsCount, setTargetRowsCount] = useState<number>(() => Math.max(10, candidates.length));

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

  const renderedRowsCount = includeManualRows
    ? Math.max(targetRowsCount, candidates.length)
    : Math.max(1, candidates.length);

  return (
    <div
      className="parent-council-print-page min-h-screen bg-slate-200/70 p-3 sm:p-6 text-slate-900 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0"
      dir="rtl"
    >
      <style>{A4_PRINT_STYLE}</style>

      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2.5">
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
          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg">
            <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            <span>طباعة اقتصادية موفرة للحبر A4</span>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-extrabold rounded-xl shadow-md text-xs cursor-pointer transition-all active:scale-95"
          id="btn-print-voting-results-report"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة محضر النتائج والفرز (A4)</span>
        </button>
      </div>

      {/* Manual / Advance Tally Flexibility Panel (no-print) */}
      <div className="max-w-[210mm] mx-auto mb-4 bg-white border border-teal-200 rounded-xl p-3 shadow-xs space-y-2.5 text-xs no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 pb-2">
          <div className="flex items-center gap-2 text-teal-950 font-bold">
            <PenLine className="w-4 h-4 text-teal-700" />
            <span>مرونة محضر الفرز (إلكتروني أو يدوي للجمعية العمومية):</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors">
            <input
              type="checkbox"
              checked={includeManualRows}
              onChange={(e) => setIncludeManualRows(e.target.checked)}
              className="accent-teal-700 w-3.5 h-3.5"
            />
            <span>إتاحة أسطر إضافية لتعبئة الفرز يدوياً</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-slate-700">
          <span className="font-semibold text-slate-900">عدد أسطر الفرز بالورقة:</span>
          <div className="flex items-center gap-1.5">
            {[8, 10, 12, 15].map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => {
                  setTargetRowsCount(cnt);
                  setIncludeManualRows(true);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                  targetRowsCount === cnt && includeManualRows
                    ? "bg-teal-800 text-white border-teal-800"
                    : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {cnt} صفاً
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIncludeManualRows(false)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                !includeManualRows
                  ? "bg-teal-800 text-white border-teal-800"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              المرشحون الحاليون فقط ({candidates.length})
            </button>
          </div>
        </div>
      </div>

      {/* Official A4 Canvas */}
      <div
        className="parent-council-sheet-canvas w-full max-w-[210mm] mx-auto bg-white shadow-xl border border-slate-300 rounded-none text-slate-900 leading-normal p-6 sm:p-9 print:p-0 print:m-0 print:shadow-none print:border-none print:max-w-none print:w-full"
        style={{
          fontFamily: ARABIC_FONT_FAMILY,
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <OfficialReportHeader
          countryName={signatories.countryName}
          ministryName={signatories.ministryName}
          administrationName={signatories.administrationName}
          schoolName={signatories.schoolName}
          logoUrl={signatories.logoUrl}
          title="محضر نتائج وفرز تصويت أولياء الأمور"
          subtitle={`لاختيار أعضاء المجلس — العام الدراسي ${config.academicYear || "1447 - 1448 هـ"}`}
          reportDate={todayDate}
          issueTime={printTime}
          refNumber={`VOTE-REP-${new Date().getFullYear()}`}
        />

        {/* Statistical Summary Box */}
        <OfficialStatsBox
          metaItems={[
            { label: "نوع العملية", value: "تصويت إلكتروني سري وموثق" },
            { label: "المقاعد المقررة", value: `${seatsCount} مقعد أساسي + 4 مقاعد احتياط` },
            { label: "توقيت الإغلاق", value: `${todayDate} — ${printTime}` },
            { label: "نظام الفرز", value: "فرز آلي إلكتروني معتمد وفق أعلى الأصوات" },
          ]}
          kpis={[
            { label: "الأصوات المقترعة", value: totalVotesCast, color: "emerald" },
            { label: "المرشحون المقيدون", value: candidates.length, color: "slate" },
            { label: "الفائزون الأساسيون", value: Math.min(seatsCount, candidates.length), color: "emerald" },
            { label: "الأعضاء الاحتياط", value: Math.min(reserveCount, Math.max(0, candidates.length - seatsCount)), color: "amber" },
          ]}
          summaryNote={`إجمالي المشاركين: ${totalVotesCast} صوت`}
        />

        {/* Detailed Ruled Results Table - Mathematical Fixed Geometry */}
        <div className="mb-4">
          <div className="border border-slate-800 bg-slate-100/90 text-slate-950 text-xs font-bold px-3 py-1.5 flex items-center justify-between border-b-0">
            <span>جدول الفرز النهائي وترتيب المرشحين بحسب عدد الأصوات</span>
            <span className="text-[11px] font-normal text-slate-700">توثيق نظامي للفرز والاعتماد</span>
          </div>

          <table className="w-full border-collapse border border-slate-800 text-xs multi-page-table table-fixed">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-50/80 text-slate-950 font-bold">
                <th className="border-l border-slate-400 py-2 px-1 text-center w-[7%]">الترتيب</th>
                <th className="border-l border-slate-400 py-2 px-3 text-right w-[28%]">اسم المرشح لولي الأمر</th>
                <th className="border-l border-slate-400 py-2 px-3 text-right w-[25%]">اسم الطالب والصف</th>
                <th className="border-l border-slate-400 py-2 px-2 text-center w-[12%]">الأصوات</th>
                <th className="border-l border-slate-400 py-2 px-2 text-center w-[10%]">النسبة</th>
                <th className="py-2 px-2 text-center w-[18%]">نتيجة الفرز</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: renderedRowsCount }).map((_, index) => {
                const cand = candidates[index];
                if (cand) {
                  const isTop = index < seatsCount;
                  const isRes = index >= seatsCount && index < seatsCount + reserveCount;
                  const pct = totalVotesCast > 0 ? Math.round((cand.votesCount / totalVotesCast) * 100) : 0;

                  return (
                    <tr key={cand.id} className="border-b border-slate-300 last:border-b-0 min-h-[40px]">
                      <td className="border-l border-slate-400 py-2 px-1 text-center font-mono font-bold text-slate-950">
                        {index + 1}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-3 font-bold text-slate-950 text-sm truncate">
                        {cand.fullName}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-3 text-slate-800">
                        <div className="font-semibold text-xs text-slate-950 truncate">{cand.studentName || "—"}</div>
                        {cand.studentGrade && <div className="text-[11px] text-slate-600 truncate">{cand.studentGrade}</div>}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-2 text-center font-mono font-bold text-slate-950 text-sm">
                        {cand.votesCount}
                      </td>
                      <td className="border-l border-slate-400 py-2 px-2 text-center font-mono font-semibold text-slate-800 text-xs">
                        {pct}%
                      </td>
                      <td className="py-2 px-2 text-center">
                        {isTop ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-white text-slate-950 border border-slate-800">
                            ✓ عضو أساسي منتخب
                          </span>
                        ) : isRes ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-white text-slate-800 border border-slate-500">
                            عضو احتياط #{index - seatsCount + 1}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs font-normal">مرشح</span>
                        )}
                      </td>
                    </tr>
                  );
                }

                // Placeholder row for manual tallying during assembly
                const isBlankTop = index < seatsCount;
                const isBlankRes = index >= seatsCount && index < seatsCount + reserveCount;

                return (
                  <tr key={`blank-tally-${index}`} className="border-b border-slate-300 last:border-b-0 min-h-[40px]">
                    <td className="border-l border-slate-400 py-2 px-1 text-center font-mono font-bold text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border-l border-slate-400 py-2 px-3">
                      <div className="font-mono text-slate-400 text-xs">................................................</div>
                    </td>
                    <td className="border-l border-slate-400 py-2 px-3">
                      <div className="font-mono text-slate-400 text-xs">..............................................</div>
                    </td>
                    <td className="border-l border-slate-400 py-2 px-2 text-center">
                      <div className="font-mono text-slate-400 text-xs">..........</div>
                    </td>
                    <td className="border-l border-slate-400 py-2 px-2 text-center">
                      <div className="font-mono text-slate-400 text-xs">.....%</div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {isBlankTop ? (
                        <span className="text-[11px] font-semibold text-slate-700">
                          (مقعد أساسي #{index + 1})
                        </span>
                      ) : isBlankRes ? (
                        <span className="text-[11px] font-normal text-slate-500">
                          (مقعد احتياط #{index - seatsCount + 1})
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Official Signatures */}
        <div className="print-avoid-break border border-slate-800 p-3.5 bg-white mb-3.5">
          <div className="text-center font-bold text-xs text-slate-950 border-b border-slate-400 pb-1 mb-3">
            اعتماد نتائج الفرز والاقتراع الرسمي
          </div>

          <div className="grid grid-cols-2 gap-6 items-start text-xs">
            <div className="text-center border-l border-slate-300 pl-4">
              <div className="font-bold text-slate-950 text-xs">لجنة الفرز والتوجيه الطلابي</div>
              <div className="text-xs font-medium text-slate-700 mt-1">
                {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي / أمين اللجنة"}
              </div>
              <div className="mt-7 border-b border-dotted border-slate-600 w-44 mx-auto pb-0.5 text-xs text-slate-600">
                التوقيع والاعتماد
              </div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="font-bold text-slate-950 text-xs">مدير المدرسة / رئيس اللجنة</div>
              <div className="text-xs font-semibold text-slate-800 mt-1">
                {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
              </div>
              <div className="mt-5 border-b border-dotted border-slate-600 w-44 mx-auto pb-0.5 text-xs text-slate-600">
                التوقيع والختم الرسمي
              </div>
              <div className="w-20 h-20 border-2 border-dashed border-slate-600 rounded-full mt-2 flex flex-col items-center justify-center text-[10px] font-bold text-slate-700 leading-tight">
                <span>الختم الرسمي</span>
                <span className="text-[9px] font-normal text-slate-500">للمدرسة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t-2 border-slate-800 text-xs text-slate-700 font-medium flex items-center justify-between">
          <span>محضر إلكتروني موثق عبر منصة التصويت المدرسية</span>
          <span className="flex items-center gap-1 text-slate-950 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
            محضر فرز أصوات مجلس أولياء الأمور المعتمد
          </span>
          <span>تاريخ الطباعة: {todayDate}</span>
        </div>
      </div>
    </div>
  );
}

export default ParentCouncilPrintSheet;
