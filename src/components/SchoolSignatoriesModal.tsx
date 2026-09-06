import React, { useState, useRef, useEffect } from "react";
import {
  Settings,
  Image as ImageIcon,
  Upload,
  Check,
  Building,
  School,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { SchoolSignatories } from "../types";

export const DEFAULT_MINISTRY_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="300" height="160">
  <g fill="#008b7d">
    <circle cx="150" cy="60" r="4.5"/>
    <circle cx="140" cy="50" r="4"/>
    <circle cx="160" cy="50" r="4"/>
    <circle cx="130" cy="42" r="3.5"/>
    <circle cx="170" cy="42" r="3.5"/>
    <circle cx="120" cy="36" r="3"/>
    <circle cx="180" cy="36" r="3"/>
    
    <circle cx="150" cy="46" r="4.5"/>
    <circle cx="138" cy="36" r="4"/>
    <circle cx="162" cy="36" r="4"/>
    <circle cx="126" cy="28" r="3.5"/>
    <circle cx="174" cy="28" r="3.5"/>
    <circle cx="114" cy="22" r="3"/>
    <circle cx="186" cy="22" r="3"/>

    <circle cx="150" cy="32" r="4.5"/>
    <circle cx="136" cy="23" r="4"/>
    <circle cx="164" cy="23" r="4"/>
    <circle cx="122" cy="16" r="3.5"/>
    <circle cx="178" cy="16" r="3.5"/>

    <text x="150" y="104" font-family="'Cairo', 'Tajawal', sans-serif" font-size="25" font-weight="900" text-anchor="middle" fill="#008b7d">وزارة التعليم</text>
    <text x="150" y="130" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="#64748b" letter-spacing="1">Ministry of Education</text>
  </g>
</svg>`
)}`;

interface SchoolSignatoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  signatories: SchoolSignatories;
  onSave: (updated: SchoolSignatories) => void;
}

export const SchoolSignatoriesModal: React.FC<SchoolSignatoriesModalProps> = ({
  isOpen,
  onClose,
  signatories,
  onSave,
}) => {
  const [localSignatories, setLocalSignatories] = useState<SchoolSignatories>({
    countryName: signatories.countryName || "المملكة العربية السعودية",
    ministryName: signatories.ministryName || "وزارة التعليم",
    administrationName: signatories.administrationName || "الإدارة العامة للتعليم بمنطقة تبوك",
    schoolName: signatories.schoolName || "ثانوية الأبناء الأولى",
    principalName: signatories.principalName || "",
    vicePrincipalName: signatories.vicePrincipalName || "",
    counselorName: signatories.counselorName || "",
    systemManagerName: signatories.systemManagerName || "",
    logoUrl: signatories.logoUrl || DEFAULT_MINISTRY_LOGO,
    logoWidth: signatories.logoWidth || 76,
    logoHeight: signatories.logoHeight || 76,
    showStudentGuidanceLine:
      signatories.showStudentGuidanceLine !== undefined
        ? signatories.showStudentGuidanceLine
        : true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSignatories({
        countryName: signatories.countryName || "المملكة العربية السعودية",
        ministryName: signatories.ministryName || "وزارة التعليم",
        administrationName: signatories.administrationName || "الإدارة العامة للتعليم بمنطقة تبوك",
        schoolName: signatories.schoolName || "ثانوية الأبناء الأولى",
        principalName: signatories.principalName || "",
        vicePrincipalName: signatories.vicePrincipalName || "",
        counselorName: signatories.counselorName || "",
        systemManagerName: signatories.systemManagerName || "",
        logoUrl: signatories.logoUrl || DEFAULT_MINISTRY_LOGO,
        logoWidth: signatories.logoWidth || 76,
        logoHeight: signatories.logoHeight || 76,
        showStudentGuidanceLine:
          signatories.showStudentGuidanceLine !== undefined
            ? signatories.showStudentGuidanceLine
            : true,
      });
    }
  }, [isOpen, signatories]);

  if (!isOpen) return null;

  // Handle Logo Upload from local computer
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("حجم ملف الشعار كبير، يرجى اختيار صورة أقل من 3 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (base64) {
        setLocalSignatories((prev) => ({ ...prev, logoUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAndApply = () => {
    onSave(localSignatories);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print"
      id="modal-school-signatories-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col gap-6 animate-fadeIn my-auto text-right"
        dir="rtl"
        id="modal-school-signatories-content"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-2xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                تخصيص بيانات المدرسة، الشعار والمعتمدين
              </h3>
              <p className="text-xs text-slate-400">
                تنعكس هذه البيانات تلقائياً على ترويسة وتذييل كل التقارير المطبوعة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm p-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
            id="btn-close-signatories-modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Two Column Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Country Name */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">اسم الدولة (السطر الأول):</label>
            <input
              type="text"
              value={localSignatories.countryName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, countryName: e.target.value }))
              }
              placeholder="المملكة العربية السعودية"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-bold"
            />
          </div>

          {/* Ministry Name */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">اسم الوزارة (السطر الثاني):</label>
            <input
              type="text"
              value={localSignatories.ministryName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, ministryName: e.target.value }))
              }
              placeholder="وزارة التعليم"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-medium"
            />
          </div>

          {/* Administration Name */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">
              اسم الإدارة العامة للتعليم (السطر الثالث):
            </label>
            <input
              type="text"
              value={localSignatories.administrationName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, administrationName: e.target.value }))
              }
              placeholder="الإدارة العامة للتعليم بمنطقة تبوك"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-medium"
            />
          </div>

          {/* School Name */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">اسم المدرسة (السطر الرابع):</label>
            <input
              type="text"
              value={localSignatories.schoolName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, schoolName: e.target.value }))
              }
              placeholder="ثانوية الأبناء الأولى"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-bold text-emerald-900"
            />
          </div>

          {/* Principal Name */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">اسم مدير المدرسة:</label>
            <input
              type="text"
              value={localSignatories.principalName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, principalName: e.target.value }))
              }
              placeholder="محمد الأسمري"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-medium"
            />
          </div>

          {/* Vice Principal Name */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">اسم وكيل شؤون الطلاب:</label>
            <input
              type="text"
              value={localSignatories.vicePrincipalName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, vicePrincipalName: e.target.value }))
              }
              placeholder="محمد الحويطي"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-medium"
            />
          </div>

          {/* Counselor Name */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">اسم الموجه الطلابي:</label>
            <input
              type="text"
              value={localSignatories.counselorName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, counselorName: e.target.value }))
              }
              placeholder="عبدالله البلوي"
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-medium"
            />
          </div>

          {/* System Manager / Sender */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-700">مسؤول النظام / التوثيق:</label>
            <input
              type="text"
              value={localSignatories.systemManagerName || ""}
              onChange={(e) =>
                setLocalSignatories((p) => ({ ...p, systemManagerName: e.target.value }))
              }
              placeholder="اسم مسؤول النظام (اختياري)..."
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden font-medium"
            />
          </div>
        </div>

        {/* NEW: Student Guidance Line Toggle in Report Header */}
        <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span className="font-bold text-slate-800 text-xs">
                إظهار عبارة (التوجيه الطلابي) على ترويسة التقارير الرسمية:
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              تمنحك حرية إضافة أو إخفاء سطر «التوجيه الطلابي» أسفل اسم المدرسة في الترويسة المطبوعة لكافة تقارير الأقسام.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setLocalSignatories((p) => ({
                ...p,
                showStudentGuidanceLine: !(p.showStudentGuidanceLine !== false),
              }))
            }
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs ${
              localSignatories.showStudentGuidanceLine !== false
                ? "bg-emerald-700 text-white hover:bg-emerald-800"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {localSignatories.showStudentGuidanceLine !== false ? (
              <>
                <ToggleRight className="w-5 h-5 text-emerald-200" />
                <span>مفعلة (ظاهرة بالتقارير)</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5 text-slate-400" />
                <span>معطلة (مخفية)</span>
              </>
            )}
          </button>
        </div>

        {/* LOGO UPLOAD & RESIZE SECTION */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
          <span className="font-bold text-slate-800 flex items-center gap-2 text-xs">
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            شعار المدرسة أو الوزارة بالترويسة:
          </span>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Logo Preview */}
            <div className="w-24 h-24 rounded-2xl border border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs p-1">
              {localSignatories.logoUrl ? (
                <img
                  src={localSignatories.logoUrl}
                  alt="Logo preview"
                  className="object-contain"
                  style={{
                    width: `${localSignatories.logoWidth || 76}px`,
                    maxHeight: "84px",
                  }}
                />
              ) : (
                <span className="text-[10px] text-slate-400 text-center px-1">بدون شعار مخصص</span>
              )}
            </div>

            {/* Actions & Sliders */}
            <div className="flex-1 flex flex-col gap-2.5 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  id="btn-upload-school-logo"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع صورة شعار من جهازك</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setLocalSignatories((p) => ({ ...p, logoUrl: DEFAULT_MINISTRY_LOGO }))
                  }
                  className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                  title="استعادة الشعار الرسمي المعتمد لوزارة التعليم"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>شعار وزارة التعليم</span>
                </button>

                {localSignatories.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLocalSignatories((p) => ({ ...p, logoUrl: "" }))}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2 px-3 rounded-xl border border-rose-200 cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>إزالة الشعار</span>
                  </button>
                )}
              </div>

              {/* Logo Width & Height Slider */}
              {localSignatories.logoUrl && (
                <div className="flex items-center gap-4 text-[11px] pt-1">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-slate-600 font-medium">مقاس الشعار بالتقرير:</span>
                    <input
                      type="range"
                      min="40"
                      max="140"
                      value={localSignatories.logoWidth || 76}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalSignatories((p) => ({ ...p, logoWidth: val, logoHeight: val }));
                      }}
                      className="flex-1 accent-emerald-600"
                    />
                    <span className="font-mono font-bold text-slate-800">
                      {localSignatories.logoWidth || 76}px
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-400">يتم الحفظ في الخادم السحابي والمتصفح</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              id="btn-save-signatories"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتطبيق</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
