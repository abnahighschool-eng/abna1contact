import React from "react";
import { Printer, ArrowRight, CheckCircle2, Clock, Send, Eye, FileCheck } from "lucide-react";
import { ParentCouncilApplication, ParentCouncilInvite } from "../../types/parentCouncil";
import { SchoolSignatories } from "../../types";

interface SentMessagesReportPrintSheetProps {
  invitesList: ParentCouncilInvite[];
  applications: Record<string, ParentCouncilApplication>;
  signatories: SchoolSignatories;
  academicYear?: string;
  councilTerm?: string;
  onClose?: () => void;
}

export default function SentMessagesReportPrintSheet({
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

      {/* Official Minutes Canvas - Ink-Saving Clean A4 Design */}
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
            <div className="text-xs font-black text-slate-900">
              مجالس أولياء الأمور
            </div>
            <div className="text-[11px] font-bold text-slate-600">
              في التعليم العام
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              تاريخ الطباعة: {todayDate} - {printTime}
            </div>
          </div>
        </div>

        {/* Statistical Summary Box */}
        <div className="grid grid-cols-4 gap-3 mb-4 text-center">
          <div className="p-2.5 rounded-xl border border-slate-300 bg-slate-50">
            <div className="text-[10px] font-bold text-slate-600">إجمالي الدعوات المرسلة</div>
            <div className="text-base font-black text-slate-900 font-mono mt-0.5">{totalSent}</div>
            <div className="text-[9px] text-slate-500 font-bold">رسالة عبر واتساب</div>
          </div>

          <div className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/60">
            <div className="text-[10px] font-bold text-emerald-900">استلموا الرسالة</div>
            <div className="text-base font-black text-emerald-900 font-mono mt-0.5">{totalSent}</div>
            <div className="text-[9px] text-emerald-800 font-bold">100% تم الإرسال بنجاح</div>
          </div>

          <div className="p-2.5 rounded-xl border border-sky-300 bg-sky-50/60">
            <div className="text-[10px] font-bold text-sky-900">تم فتح الرابط</div>
            <div className="text-base font-black text-sky-900 font-mono mt-0.5">{totalOpened}</div>
            <div className="text-[9px] text-sky-800 font-bold">نسبة الفتح: {openRate}%</div>
          </div>

          <div className="p-2.5 rounded-xl border border-teal-300 bg-teal-50/60">
            <div className="text-[10px] font-bold text-teal-900">تم تعبئة الاستمارة</div>
            <div className="text-base font-black text-teal-900 font-mono mt-0.5">{totalSubmitted}</div>
            <div className="text-[9px] text-teal-800 font-bold">نسبة الإنجاز: {submitRate}%</div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-right border-collapse border border-slate-800 text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-800">
                <th className="border border-slate-800 p-1.5 text-center w-8">م</th>
                <th className="border border-slate-800 p-1.5 font-bold">اسم الطالب</th>
                <th className="border border-slate-800 p-1.5 font-bold">الصف والشعبة</th>
                <th className="border border-slate-800 p-1.5 font-bold">اسم ولي الأمر</th>
                <th className="border border-slate-800 p-1.5 font-bold">رقم الجوال</th>
                <th className="border border-slate-800 p-1.5 font-bold text-center">رمز التفعيل</th>
                <th className="border border-slate-800 p-1.5 font-bold text-center">حالة استلام الرسالة</th>
                <th className="border border-slate-800 p-1.5 font-bold text-center">حالة فتح الرابط</th>
                <th className="border border-slate-800 p-1.5 font-bold text-center">حالة تعبئة الاستمارة</th>
              </tr>
            </thead>
            <tbody>
              {invitesList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-slate-800 p-4 text-center text-slate-500 font-bold">
                    لا توجد دعوات مرسلة مسجلة حتى الآن.
                  </td>
                </tr>
              ) : (
                invitesList.map((inv, idx) => {
                  const isSubmitted = !!inv.isSubmitted || (inv.studentId ? !!applications[inv.studentId] : false);
                  const hasOpened = !!inv.hasOpened || isSubmitted;
                  const sentTimeStr = inv.sentAt
                    ? new Date(inv.sentAt).toLocaleDateString("ar-SA", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "مُرسل";
                  const openedTimeStr = inv.openedAt
                    ? new Date(inv.openedAt).toLocaleDateString("ar-SA", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "";
                  const submittedTimeStr = inv.submittedAt
                    ? new Date(inv.submittedAt).toLocaleDateString("ar-SA", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "";

                  return (
                    <tr key={inv.studentId || idx} className="hover:bg-slate-50 even:bg-slate-50/50">
                      <td className="border border-slate-800 p-1.5 text-center font-mono font-bold">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-800 p-1.5 font-extrabold text-slate-900">
                        {inv.studentName}
                      </td>
                      <td className="border border-slate-800 p-1.5 font-medium text-slate-700">
                        {inv.studentGrade} {inv.studentClass ? `(${inv.studentClass})` : ""}
                      </td>
                      <td className="border border-slate-800 p-1.5 text-slate-800">
                        {inv.guardianName || "ولي أمر الطالب"}
                      </td>
                      <td className="border border-slate-800 p-1.5 font-mono text-slate-800" dir="ltr">
                        {inv.guardianPhone || "—"}
                      </td>
                      <td className="border border-slate-800 p-1.5 text-center font-mono font-bold text-slate-900">
                        {inv.code}
                      </td>
                      <td className="border border-slate-800 p-1.5 text-center">
                        <span className="font-bold text-emerald-800">
                          ✓ استلم الرسالة
                        </span>
                        {sentTimeStr && (
                          <span className="block text-[9px] text-slate-500 font-mono">
                            {sentTimeStr}
                          </span>
                        )}
                      </td>
                      <td className="border border-slate-800 p-1.5 text-center">
                        {hasOpened ? (
                          <span className="font-bold text-sky-800">
                            ✓ تم فتح الرابط
                            {openedTimeStr && (
                              <span className="block text-[9px] text-slate-500 font-mono">
                                {openedTimeStr}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">لم يفتح بعد</span>
                        )}
                      </td>
                      <td className="border border-slate-800 p-1.5 text-center">
                        {isSubmitted ? (
                          <span className="font-extrabold text-teal-800">
                            ✓ تم تعبئة الاستمارة
                            {submittedTimeStr && (
                              <span className="block text-[9px] text-slate-500 font-mono">
                                {submittedTimeStr}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">بانتظار التعبئة</span>
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
        <div className="border-t-2 border-slate-800 pt-4 mt-8">
          <div className="text-[11px] font-bold text-slate-700 mb-6 text-center">
            تم استخراج هذا التقرير آلياً من منصة متابعة مجالس أولياء الأمور بالتعليم العام وتعتبر بياناته معتمدة رسمياً.
          </div>

          <div className="grid grid-cols-4 gap-4 text-center">
            {/* Student Counselor */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-600">موجه الطلاب / مقرر المجلس</div>
              <div className="text-xs font-black text-slate-900 min-h-[1.5rem] flex items-center justify-center">
                {signatories.counselorName || "أ. أحمد الغامدي"}
              </div>
              <div className="text-[10px] text-slate-400 pt-5">التوقيع: .....................</div>
            </div>

            {/* Activity Leader / Vice Principal */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-600">وكيل الشؤون التعليمية / النشاط</div>
              <div className="text-xs font-black text-slate-900 min-h-[1.5rem] flex items-center justify-center">
                {signatories.vicePrincipalName || "أ. خالد العتيبي"}
              </div>
              <div className="text-[10px] text-slate-400 pt-5">التوقيع: .....................</div>
            </div>

            {/* School Principal */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-600">مدير المدرسة / رئيس المجلس</div>
              <div className="text-xs font-black text-slate-900 min-h-[1.5rem] flex items-center justify-center">
                {signatories.principalName || "أ. محمد بن عبدالله العمري"}
              </div>
              <div className="text-[10px] text-slate-400 pt-5">التوقيع: .....................</div>
            </div>

            {/* Official Stamp Box */}
            <div className="space-y-1 flex flex-col items-center">
              <div className="text-[11px] font-bold text-slate-600">الختم الرسمي للمدرسة</div>
              <div className="w-20 h-16 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center text-[10px] text-slate-400 mt-1">
                موضع الختم
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
