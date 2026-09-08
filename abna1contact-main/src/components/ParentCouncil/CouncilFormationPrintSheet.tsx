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
              وفقاً للتنظيم، يتم إدخال صفة كل عضو يدوياً (مثل: <strong>نائب الرئيس</strong>، <strong>أمين السر</strong>، <strong>عضو مجلس</strong>) أو <strong>تركها فارغة</strong> بحسب رغبة إدارة المدرسة، ثم طباعة محضر الاعتماد النهائي.
            </div>
          </div>
        </div>
      </div>

      {/* Official Minutes Canvas - Ink-Saving Clean A4 Design */}
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 shadow-lg border border-slate-300 rounded-sm print:m-0 print:p-6 print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-5">
          <div className="text-right leading-tight">
            <div className="text-[11px] font-bold text-slate-700">{signatories.countryName || "المملكة العربية السعودية"}</div>
            <div className="text-xs font-black text-slate-900 mt-0.5">{signatories.ministryName || "وزارة التعليم"}</div>
            <div className="text-[11px] text-slate-700">{signatories.administrationName || "الإدارة العامة للتعليم"}</div>
            <div className="text-[11px] font-extrabold text-teal-900 mt-0.5">{signatories.schoolName || "ثانوية الأبناء الأولى"}</div>
          </div>

          <div className="text-center pt-1">
            <div className="text-lg sm:text-xl font-black text-slate-900 tracking-wide border-b border-slate-800 pb-1 inline-block px-4">
              محضر الاعتماد النهائي لتشكيل مجلس أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600 mt-1">
              للعام الدراسي {config.academicYear || "1447 - 1448هـ"}
            </div>
          </div>

          <div className="text-left flex flex-col items-end leading-tight">
            <div className="text-xs font-black text-slate-900">
              مجالس أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600">
              في التعليم العام
            </div>
            {signatories.logoUrl && (
              <img
                src={signatories.logoUrl}
                alt="شعار المدرسة"
                className="w-10 h-10 object-contain mt-1"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>

        {/* Preamble */}
        <div className="mb-4 text-xs leading-relaxed text-slate-800">
          <p>
            بناءً على القواعد المنظمة لمجالس أولياء الأمور في التعليم العام الصادرة عن وزارة التعليم، واستناداً إلى المادة (الثالثة) المنظمة لضوابط العضوية، وبعد فحص وتدقيق استمارات الترشيح وفرزها فرزاً ذكياً ومعيارياً؛ تم بحمد الله وتوفيقه اعتماد التشكيل النهائي لمجلس أولياء الأمور بـ{" "}
            <span className="font-extrabold text-slate-900">{signatories.schoolName || "المدرسة"}</span> على النحو الآتي:
          </p>
        </div>

        {/* Primary Council Members Table - Clean White, Crisp Borders */}
        <div className="mb-5">
          <div className="text-xs font-black text-slate-900 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-teal-700" />
              <span>أولاً: الأعضاء الأساسيون المعتمدون في المجلس ({selectedMembers.length} أعضاء):</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              تاريخ الاعتماد: {config.formationApprovedAt ? new Date(config.formationApprovedAt).toLocaleDateString("ar-SA") : "1447هـ"}
            </span>
          </div>

          <table className="w-full border-collapse border border-slate-800 text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-white text-slate-900 font-extrabold">
                <th className="p-1.5 border-l border-slate-800 w-8 text-center">م</th>
                <th className="p-1.5 border-l border-slate-800 text-right">اسم ولي الأمر</th>
                <th className="p-1.5 border-l border-slate-800 text-center w-36">
                  <div>الصفة في المجلس</div>
                  <div className="no-print text-[9px] font-normal text-teal-700 font-sans mt-0.5">(إدخال يدوي)</div>
                </th>
                <th className="p-1.5 border-l border-slate-800 text-right">اسم الطالب والصف</th>
                <th className="p-1.5 border-l border-slate-800 text-center w-28">رقم الجوال</th>
                <th className="p-1.5 text-center w-20">درجة التقييم</th>
              </tr>
            </thead>
            <tbody>
              {selectedMembers.map((m, idx) => (
                <tr key={m.id} className="border-b border-slate-700 last:border-b-0">
                  <td className="p-1.5 text-center border-l border-slate-700 font-extrabold">{idx + 1}</td>
                  <td className="p-1.5 border-l border-slate-700 font-black text-slate-900">
                    {m.fullName}
                    {m.relationLabel && m.relationLabel !== "الأب" && (
                      <span className="text-[10px] font-normal text-slate-600 mr-1">({m.relationLabel})</span>
                    )}
                  </td>
                  <td className="p-1.5 text-center border-l border-slate-700 font-black text-slate-900 align-middle">
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
                    <span className="hidden print:inline">
                      {(localRoles[m.id] !== undefined ? localRoles[m.id] : (m.assignedRole || "")).trim()}
                    </span>
                  </td>
                  <td className="p-1.5 border-l border-slate-700 text-slate-800">
                    <span className="font-bold">{m.studentName}</span>
                    <span className="text-[10px] text-slate-600 mr-1">({m.studentGrade}{m.studentClass ? ` - ${m.studentClass}` : ""})</span>
                  </td>
                  <td className="p-1.5 text-center border-l border-slate-700 font-mono text-slate-900" dir="ltr">
                    {m.phone}
                  </td>
                  <td className="p-1.5 text-center font-mono font-bold text-slate-900">
                    {m.smartEvaluation?.overallScore || "—"}%
                  </td>
                </tr>
              ))}
              {selectedMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400 font-bold">
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
            <div className="text-xs font-black text-slate-900 mb-1.5">
              ثانياً: الأعضاء الاحتياط ({reserveMembers.length} أعضاء):
            </div>
            <table className="w-full border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-white text-slate-900 font-extrabold">
                  <th className="p-1.5 border-l border-slate-800 w-8 text-center">م</th>
                  <th className="p-1.5 border-l border-slate-800 text-right">اسم ولي الأمر</th>
                  <th className="p-1.5 border-l border-slate-800 text-right">اسم الطالب والصف</th>
                  <th className="p-1.5 border-l border-slate-800 text-center w-28">رقم الجوال</th>
                  <th className="p-1.5 text-center w-20">درجة التقييم</th>
                </tr>
              </thead>
              <tbody>
                {reserveMembers.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-700 last:border-b-0">
                    <td className="p-1.5 text-center border-l border-slate-700 font-extrabold">{idx + 1}</td>
                    <td className="p-1.5 border-l border-slate-700 font-black text-slate-900">{m.fullName}</td>
                    <td className="p-1.5 border-l border-slate-700 text-slate-800">
                      <span className="font-bold">{m.studentName}</span>
                      <span className="text-[10px] text-slate-600 mr-1">({m.studentGrade})</span>
                    </td>
                    <td className="p-1.5 text-center border-l border-slate-700 font-mono text-slate-900" dir="ltr">{m.phone}</td>
                    <td className="p-1.5 text-center font-mono font-bold text-slate-900">
                      {m.smartEvaluation?.overallScore || "—"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Closing Decision */}
        <div className="mb-5 text-xs font-bold text-slate-900 leading-relaxed border border-slate-700 p-2.5 rounded-sm bg-white">
          يعتمد هذا التشكيل لبدء أعمال المجلس وجلساته الدورية، وتتولى أمانة المجلس تنظيم المواعيد وجداول الأعمال ومتابعة القرارات والتوصيات الصادرة لخدمة الطلاب والبيئة المدرسية.
        </div>

        {/* Signatures: لجنة التوجيه الطلابي باليمين ومدير المدرسة باليسار */}
        <div className="pt-4 border-t-2 border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
          
          {/* Right Side: لجنة التوجيه الطلابي */}
          <div className="flex flex-col items-center">
            <div className="font-black text-slate-900 text-sm">لجنة التوجيه الطلابي</div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {signatories.counselorName ? `أ. ${signatories.counselorName}` : "الموجه الطلابي وأعضاء اللجنة"}
            </div>
            <div className="mt-8 flex flex-col items-center">
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
            <div className="mt-8 flex flex-col items-center">
              <div className="w-36 border-b border-dotted border-slate-600 pb-0.5 text-[11px] text-slate-400 font-bold">
                التوقيع والختم الرسمي
              </div>
              <div className="w-16 h-16 border border-dashed border-slate-400 rounded-full mt-2 flex items-center justify-center text-[9px] text-slate-400">
                الختم الرسمي
              </div>
            </div>
          </div>

        </div>

        {/* Verification Footer Note */}
        <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
          <span>العام الدراسي: {config.academicYear || "1447 - 1448هـ"}</span>
          <span className="flex items-center gap-1 text-slate-700 font-bold">
            <ShieldCheck className="w-3 h-3 text-teal-700" />
            محضر رسمي معتمد من إدارة المدرسة
          </span>
          <span>المجلس: {config.councilTerm || "الفصل الدراسي الأول"}</span>
        </div>

      </div>
    </div>
  );
}
