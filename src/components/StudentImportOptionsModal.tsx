import React, { useState } from "react";
import {
  Sparkles,
  Trash2,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  UserCheck,
  UserPlus,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { StudentImportAnalysis } from "../utils/rosterReconciliation";

interface StudentImportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  analysis: StudentImportAnalysis;
  onConfirm: (
    mode: "smart_merge" | "full_replace",
    options: { archiveUnmatched: boolean }
  ) => void;
}

export const StudentImportOptionsModal: React.FC<StudentImportOptionsModalProps> = ({
  isOpen,
  onClose,
  fileName,
  analysis,
  onConfirm,
}) => {
  const [selectedMode, setSelectedMode] = useState<"smart_merge" | "full_replace">("smart_merge");
  const [archiveUnmatched, setArchiveUnmatched] = useState<boolean>(true);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleApply = () => {
    onConfirm(selectedMode, { archiveUnmatched });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs transition-opacity"
      dir="rtl"
      id="modal-student-import-options"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                خيارات تنزيل وتحديث كشف الطلاب
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-sm">
                الملف المرفوع: {fileName || "كشف إكسل"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            id="btn-close-import-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-right">
          
          {/* Quick Stats Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-medium text-slate-500 block">طلاب الكشف الجديد</span>
              <span className="text-lg font-black text-slate-800 mt-0.5 block">{analysis.cleanedCount}</span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-medium text-emerald-700 block">مطابقون لسجلات سابقة</span>
              <span className="text-lg font-black text-emerald-800 mt-0.5 block">{analysis.matchedCount}</span>
            </div>

            <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-medium text-blue-700 block">طلاب جدد مضافون</span>
              <span className="text-lg font-black text-blue-800 mt-0.5 block">{analysis.newCount}</span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-medium text-amber-700 block">سجلات سابقة غير مدرجة</span>
              <span className="text-lg font-black text-amber-800 mt-0.5 block">{analysis.unmatchedExistingCount}</span>
            </div>
          </div>

          {(analysis.junkCount > 0 || analysis.duplicateCount > 0) && (
            <div className="bg-slate-100/80 border border-slate-200 text-slate-600 rounded-xl px-3.5 py-2 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                تم تنظيف الملف تلقائياً: تم استبعاد {analysis.junkCount} من صفوف التذييل/المجاميع/الفارغة، و {analysis.duplicateCount} تكرارات داخلية.
              </span>
            </div>
          )}

          {/* Mode Selection Options */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              اختر طريقة التعامل مع بيانات الطلاب الحالية والجديدة:
            </label>

            {/* Option 1: Smart Merge (Recommended) */}
            <div
              onClick={() => setSelectedMode("smart_merge")}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedMode === "smart_merge"
                  ? "border-emerald-500 bg-emerald-50/30 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
              id="opt-smart-merge"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border ${
                  selectedMode === "smart_merge"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 bg-white"
                }`}>
                  {selectedMode === "smart_merge" && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">
                        1. إنزال ومطابقة مع الاحتفاظ بكامل العمليات دون تكرار
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        موصى به
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                    يقوم النظام بمطابقة الطلاب المشتركين (مثل الطالب <strong>محمد أحمد</strong>) برقم الهوية أو الاسم والصف، فيبقي على نفس معرفه الثابت ويحافظ على <strong>كامل سجلاته التاريخية</strong> (الغياب، التأخر، رسائل الواتساب، الحالات الصحية والاستبيانات) دون تكرار اسمه نهائياً. كما يضيف الطلاب الجدد المنضمين للمدرسة ويحدث أي أرقام أو فصول جديدة.
                  </p>

                  {/* Sub-option: Archive unmatched */}
                  {selectedMode === "smart_merge" && analysis.unmatchedExistingCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-200/50 flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="check-archive-unmatched"
                        checked={archiveUnmatched}
                        onChange={(e) => setArchiveUnmatched(e.target.checked)}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="check-archive-unmatched" className="text-xs text-slate-700 cursor-pointer leading-normal">
                        <strong>حفظ الطلاب غير المدرجين ({analysis.unmatchedExistingCount} طالب) في الأرشيف المحصن:</strong>
                        <span className="text-slate-500 block text-[11px] mt-0.5">
                          مثالي عند نقل طلاب من المدرسة؛ يتم حفظ تاريخهم وعملياتهم السابقة بأمان مع استبعادهم من كشف الإرسال النشط الحالي.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Option 2: Full Replace */}
            <div
              onClick={() => setSelectedMode("full_replace")}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedMode === "full_replace"
                  ? "border-rose-500 bg-rose-50/30 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
              id="opt-full-replace"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border ${
                  selectedMode === "full_replace"
                    ? "border-rose-500 bg-rose-500 text-white"
                    : "border-slate-300 bg-white"
                }`}>
                  {selectedMode === "full_replace" && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">
                        2. حذف واستبدال الكشوف السابقة بالكامل
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        كشف جديد نظيف
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                    يقوم النظام بمسح وحذف الكشوف والأسماء السابقة بالكامل من القائمة، واعتماد الأسماء الواردة في هذا الملف فقط دون تكرار.
                    <span className="block text-rose-700 font-medium text-[11px] mt-1">
                      (استخدم هذا الخيار عند بداية عام دراسي جديد بالكامل أو إعادة بناء قاعدة بيانات الطلاب من الصفر).
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Toggleable Preview & Details */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                معاينة عينة من الطلاب في الكشف ({Math.min(analysis.cleanedCount, 5)} طلاب)
              </span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDetails && (
              <div className="p-3 border-t border-slate-200/80 bg-white space-y-2">
                {analysis.sampleMatches.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 mb-1 block flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      عينة من الطلاب المطابقين (سجلاتهم وعملياتهم محفوظة):
                    </span>
                    <div className="space-y-1">
                      {analysis.sampleMatches.map((s, idx) => (
                        <div key={idx} className="text-xs p-2 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                          <span className="font-bold text-slate-800">{s.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{s.grade} - {s.className} | {s.phone || "بدون جوال"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.sampleNew.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[11px] font-bold text-blue-800 mb-1 block flex items-center gap-1">
                      <UserPlus className="w-3 h-3 text-blue-600" />
                      عينة من الطلاب الجدد المنضمين للمدرسة:
                    </span>
                    <div className="space-y-1">
                      {analysis.sampleNew.map((s, idx) => (
                        <div key={idx} className="text-xs p-2 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                          <span className="font-bold text-slate-800">{s.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{s.grade} - {s.className} | {s.phone || "بدون جوال"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            id="btn-cancel-import"
          >
            إلغاء الأمر
          </button>

          <button
            type="button"
            onClick={handleApply}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
              selectedMode === "smart_merge"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
            id="btn-confirm-import"
          >
            <span>
              {selectedMode === "smart_merge"
                ? "تأكيد المطابقة الذكية وحفظ العمليات"
                : "تأكيد حذف واستبدال الكشوف السابقة"}
            </span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
