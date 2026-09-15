import React, { useState } from "react";
import { Printer, ArrowRight, Award, ShieldCheck, PenLine } from "lucide-react";
import { ParentCouncilApplication, ParentCouncilConfig } from "../../types/parentCouncil";
import { SchoolSignatories } from "../../types";

interface CouncilFormationPrintSheetProps {
  config: ParentCouncilConfig;
  applications: Record<string, ParentCouncilApplication>;
  signatories: SchoolSignatories;
  onClose?: () => void;
  onUpdateRole?: (appId: string, role: string) => void;
}

export default function CouncilFormationPrintSheet({
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

  // Local state for manual role entries in the formation minutes
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
    <div className="parent-council-print-page min-h-screen bg-slate-100 p-4 sm:p-8 text-slate-900 font-sans print:p-0 print:m-0 print:bg-white print:min-h-0" dir="rtl">
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
            معاينة محضر الاعتماد النهائي لمجلس أولياء الأمور
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
              وفقاً للتنظيم، يتم إدخال صفة كل عضو يدوياً (مثل: <strong>نائب الرئيس</strong>، <strong>أمين السر</strong>، <strong>عضو مجلس</strong>) أو <strong>تركها فارغة</strong> بحسب رغبة إدارة المدرسة، ثم طباعة محضر الاعتماد النهائي.
            </div>
          </div>
        </div>
      </div>

      {/* Official Minutes Canvas - Ink-Saving Clean A4 Design with 2cm Margins */}
      <div 
        className="parent-council-sheet-canvas font-ah-manal max-w-4xl mx-auto bg-white shadow-lg border border-slate-300 rounded-sm print:m-0 print:p-0 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none print-avoid-break"
        style={{ 
          fontFamily: "'(AH) Manal Medium', 'AH Manal Medium', 'AH Manal', 'Cairo', sans-serif",
          padding: "2cm",
        }}
      >
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4.5">
          <div className="text-right leading-tight">
            <div className="text-sm sm:text-base font-bold text-slate-800">{signatories.countryName || "المملكة العربية السعودية"}</div>
            <div className="text-base sm:text-lg font-black text-slate-950 mt-0.5">{signatories.ministryName || "وزارة التعليم"}</div>
            <div className="text-sm sm:text-base font-bold text-slate-700">{signatories.administrationName || "الإدارة العامة للتعليم"}</div>
            <div className="text-base sm:text-lg font-black text-slate-950 mt-0.5">{signatories.schoolName || "ثانوية الأبناء الأولى"}</div>
          </div>

          <div className="text-center pt-1">
            <div className="text-xl sm:text-2xl font-black text-slate-950 tracking-wide border-b-2 border-slate-900 pb-1 inline-block px-4">
              محضر الاعتماد النهائي لتشكيل مجلس أولياء الأمور
            </div>
            <div className="text-sm sm:text-base font-black text-slate-800 mt-1">
              للعام الدراسي {config.academicYear || "1447 - 1448هـ"}
            </div>
          </div>

          <div className="text-left flex flex-col items-end leading-tight">
            <div className="text-base sm:text-lg font-black text-slate-950">
              مجالس أولياء الأمور
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-700">
              في التعليم العام
            </div>
            {signatories.logoUrl && (
              <img
                src={signatories.logoUrl}
                alt="شعار المدرسة"
                className="w-12 h-12 object-contain mt-1"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>

        {/* Preamble */}
        <div className="mb-4 text-sm sm:text-base leading-relaxed text-slate-950 font-bold">
          <p>
            بناءً على القواعد المنظمة لمجالس أولياء الأمور في التعليم العام الصادرة عن وزارة التعليم، واستناداً إلى المادة (الثالثة) المنظمة لضوابط العضوية، وبعد فحص وتدقيق استمارات الترشيح وفرزها فرزاً ذكياً ومعيارياً؛ تم بحمد الله وتوفيقه اعتماد التشكيل النهائي لمجلس أولياء الأمور بـ{" "}
            <span className="font-black text-slate-950">{signatories.schoolName || "المدرسة"}</span> على النحو الآتي:
          </p>
        </div>

        {/* Primary Council Members Table - Clean White, Crisp Borders */}
        <div className="mb-5">
          <div className="text-base sm:text-lg font-black text-slate-950 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-teal-800" />
              <span>أولاً: الأعضاء الأساسيون المعتمدون في المجلس ({selectedMembers.length} أعضاء):</span>
            </span>
            <span className="text-xs text-slate-600 font-mono font-bold">
              تاريخ الاعتماد: {config.formationApprovedAt ? new Date(config.formationApprovedAt).toLocaleDateString("ar-SA") : "1447هـ"}
            </span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 text-sm sm:text-base">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-50/80 text-slate-950 font-black">
                <th className="py-2.5 px-2 border-l-2 border-slate-900 w-10 text-center">م</th>
                <th className="py-2.5 px-3 border-l-2 border-slate-900 text-right">اسم ولي الأمر</th>
                <th className="py-2.5 px-3 border-l-2 border-slate-900 text-center w-40">
                  <div>الصفة في المجلس</div>
                  <div className="no-print text-[10px] font-normal text-teal-800 font-sans mt-0.5">(إدخال يدوي)</div>
                </th>
                <th className="py-2.5 px-3 border-l-2 border-slate-900 text-right">اسم الطالب والصف</th>
                <th className="py-2.5 px-3 border-l-2 border-slate-900 text-center w-32">رقم الجوال</th>
                <th className="py-2.5 px-2 text-center w-24">درجة التقييم</th>
              </tr>
            </thead>
            <tbody>
              {selectedMembers.map((m, idx) => (
                <tr key={m.id} className="border-b border-slate-800 last:border-b-0">
                  <td className="py-2.5 px-2 text-center border-l-2 border-slate-900 font-black">{idx + 1}</td>
                  <td className="py-2.5 px-3 border-l-2 border-slate-900 font-black text-slate-950 text-base">
                    {m.fullName}
                    {m.relationLabel && m.relationLabel !== "الأب" && (
                      <span className="text-xs font-bold text-slate-700 mr-1.5">({m.relationLabel})</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center border-l-2 border-slate-900 font-black text-slate-950 align-middle">
                    {/* Screen Mode: Interactive Input and quick presets */}
                    <div className="no-print flex flex-col items-center gap-1">
                      <input
                        type="text"
                        value={localRoles[m.id] !== undefined ? localRoles[m.id] : (m.assignedRole || "")}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        placeholder="الصفة يدوياً (أو اتركها فارغة)..."
                        className="w-full text-center px-2 py-1 bg-amber-50/70 hover:bg-amber-50 focus:bg-white border border-amber-300 rounded text-xs font-black text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-teal-600 transition-all placeholder:text-slate-400 placeholder:font-normal"
                        title="اكتب أو عدل الصفة في المجلس يدوياً أو اتركها فارغة"
                      />
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRoleChange(m.id, "نائب الرئيس")}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors border ${
                            (localRoles[m.id] ?? m.assignedRole) === "نائب الرئيس"
                              ? "bg-teal-700 text-white border-teal-800"
                              : "bg-slate-100 hover:bg-teal-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          نائب الرئيس
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRoleChange(m.id, "أمين السر")}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors border ${
                            (localRoles[m.id] ?? m.assignedRole) === "أمين السر"
                              ? "bg-teal-700 text-white border-teal-800"
                              : "bg-slate-100 hover:bg-teal-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          أمين السر
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRoleChange(m.id, "عضو مجلس")}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors border ${
                            (localRoles[m.id] ?? m.assignedRole) === "عضو مجلس"
                              ? "bg-teal-700 text-white border-teal-800"
                              : "bg-slate-100 hover:bg-teal-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          عضو مجلس
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRoleChange(m.id, "")}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors border ${
                            !(localRoles[m.id] ?? m.assignedRole)
                              ? "bg-slate-700 text-white border-slate-800"
                              : "bg-slate-50 hover:bg-rose-50 text-slate-500 border-slate-200"
                          }`}
                          title="ترك الصفة فارغة"
                        >
                          ترك فارغة
                        </button>
                      </div>
                    </div>

                    {/* Print Mode: Pure Crisp Text (Clean Ministerial Layout) */}
                    <span className="hidden print:inline font-black text-slate-950 text-base">
                      {(localRoles[m.id] !== undefined ? localRoles[m.id] : (m.assignedRole || "")).trim()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 border-l-2 border-slate-900 text-slate-950">
                    <span className="font-bold text-base">{m.studentName}</span>
                    <span className="text-xs text-slate-700 font-bold mr-1">({m.studentGrade}{m.studentClass ? ` - ${m.studentClass}` : ""})</span>
                  </td>
                  <td className="py-2.5 px-3 text-center border-l-2 border-slate-900 font-mono font-bold text-slate-950" dir="ltr">
                    {m.phone}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-black text-slate-950 text-base">
                    {m.smartEvaluation?.overallScore || "—"}%
                  </td>
                </tr>
              ))}
              {selectedMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 font-bold">
                    لم يتم اعتماد أي أعضاء أساسيين بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Reserve Members Table */}
        {reserveMembers.length > 0 && (
          <div className="mb-5">
            <div className="text-base sm:text-lg font-black text-slate-950 mb-2">
              ثانياً: الأعضاء الاحتياط ({reserveMembers.length} أعضاء):
            </div>
            <table className="w-full border-collapse border-2 border-slate-900 text-sm sm:text-base">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-50/80 text-slate-950 font-black">
                  <th className="py-2.5 px-2 border-l-2 border-slate-900 w-10 text-center">م</th>
                  <th className="py-2.5 px-3 border-l-2 border-slate-900 text-right">اسم ولي الأمر</th>
                  <th className="py-2.5 px-3 border-l-2 border-slate-900 text-right">اسم الطالب والصف</th>
                  <th className="py-2.5 px-3 border-l-2 border-slate-900 text-center w-32">رقم الجوال</th>
                  <th className="py-2.5 px-2 text-center w-24">درجة التقييم</th>
                </tr>
              </thead>
              <tbody>
                {reserveMembers.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-800 last:border-b-0">
                    <td className="py-2.5 px-2 text-center border-l-2 border-slate-900 font-black">{idx + 1}</td>
                    <td className="py-2.5 px-3 border-l-2 border-slate-900 font-black text-slate-950 text-base">{m.fullName}</td>
                    <td className="py-2.5 px-3 border-l-2 border-slate-900 text-slate-950">
                      <span className="font-bold text-base">{m.studentName}</span>
                      <span className="text-xs text-slate-700 font-bold mr-1">({m.studentGrade})</span>
                    </td>
                    <td className="py-2.5 px-3 text-center border-l-2 border-slate-900 font-mono font-bold text-slate-950" dir="ltr">{m.phone}</td>
                    <td className="py-2.5 px-2 text-center font-mono font-black text-slate-950 text-base">
                      {m.smartEvaluation?.overallScore || "—"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Closing Decision */}
        <div className="mb-5 text-sm sm:text-base font-bold text-slate-950 leading-relaxed border-2 border-slate-900 p-3 rounded-xs bg-white">
          يعتمد هذا التشكيل لبدء أعمال المجلس وجلساته الدورية، وتتولى أمانة المجلس تنظيم المواعيد وجداول الأعمال ومتابعة القرارات والتوصيات الصادرة لخدمة الطلاب والبيئة المدرسية.
        </div>

        {/* Signatures: لجنة التوجيه الطلابي باليمين ومدير المدرسة باليسار */}
        <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center text-base sm:text-lg">
          
          {/* Right Side: لجنة التوجيه الطلابي */}
          <div className="flex flex-col items-center">
            <div className="font-black text-slate-950 text-xl sm:text-2xl">لجنة التوجيه الطلابي</div>
            <div className="mt-8 flex flex-col items-center">
              <div className="w-52 border-b border-dotted border-slate-800 pb-1 text-sm sm:text-base text-slate-600 font-bold">
                التوقيع والاعتماد
              </div>
            </div>
          </div>

          {/* Left Side: مدير المدرسة */}
          <div className="flex flex-col items-center">
            <div className="font-black text-slate-950 text-xl sm:text-2xl">مدير المدرسة</div>
            <div className="text-base sm:text-lg font-bold text-slate-800 mt-1">
              {signatories.principalName ? `أ. ${signatories.principalName}` : "مدير المدرسة"}
            </div>
            <div className="mt-8 flex flex-col items-center">
              <div className="w-52 border-b border-dotted border-slate-800 pb-1 text-sm sm:text-base text-slate-600 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-22 h-22 border-2 border-dashed border-slate-600 rounded-full mt-2.5 flex items-center justify-center text-xs text-slate-600 font-bold">
                الختم الرسمي
              </div>
            </div>
          </div>

        </div>

        {/* Verification Footer Note */}
        <div className="mt-4 pt-2.5 border-t border-slate-300 text-xs sm:text-sm text-slate-700 font-bold flex items-center justify-between">
          <span>العام الدراسي: {config.academicYear || "1447 - 1448هـ"}</span>
          <span className="flex items-center gap-1 text-slate-900 font-extrabold">
            <ShieldCheck className="w-4 h-4 text-teal-800" />
            محضر رسمي معتمد من إدارة المدرسة
          </span>
          <span>المجلس: {config.councilTerm || "الفصل الدراسي الأول"}</span>
        </div>

      </div>
    </div>
  );
}
