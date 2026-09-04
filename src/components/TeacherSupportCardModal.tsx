import React from "react";
import {
  X,
  Printer,
  HeartPulse,
  Sparkles,
  AlertTriangle,
  Users,
  CheckCircle2,
  BookOpen,
  MessageSquare,
  ShieldCheck,
  GraduationCap
} from "lucide-react";
import { StudentSupportProfile } from "../types/studentSupport";
import { generateTeacherSupportCard, getIndicatorColor } from "../utils/studentSupportRulesEngine";

interface TeacherSupportCardModalProps {
  profile: StudentSupportProfile;
  isOpen: boolean;
  onClose: () => void;
  onContactCounselor?: (studentName: string) => void;
}

export default function TeacherSupportCardModal({
  profile,
  isOpen,
  onClose,
  onContactCounselor,
}: TeacherSupportCardModalProps) {
  if (!isOpen) return null;

  const card = generateTeacherSupportCard(profile);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">بطاقة دعم الطالب للمعلم</h3>
                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                  مخصصة للاستخدام الصفي
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                إرشادات عملية ومختصرة للمعلمين داخل الصف لدعم الطالب أكاديمياً وتربوياً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="طباعة البطاقة"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Card Area */}
        <div className="p-6 overflow-y-auto space-y-6 print:p-0 print:overflow-visible">
          {/* Student Banner */}
          <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-teal-800 font-medium">اسم الطالب:</span>
              <h2 className="text-lg font-black text-teal-950">{card.studentName}</h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-teal-800">
                <span>الصف: <strong>{card.grade}</strong></span>
                <span>•</span>
                <span>الشعبة: <strong>{card.className}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">التحديث:</span>
              <span className="font-bold text-slate-700">
                {profile.lastUpdatedAt ? new Date(profile.lastUpdatedAt).toLocaleDateString("ar-SA") : "حديث"}
              </span>
            </div>
          </div>

          {/* 1. Classroom Health Alert */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-teal-600" />
              <span>التنبيه الصحي الصفي</span>
            </h4>
            <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${
              card.healthAlert.severity === "urgent"
                ? "bg-rose-50 border-rose-200 text-rose-900 font-bold"
                : card.healthAlert.severity === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <div className="flex items-start gap-2.5">
                {card.healthAlert.severity === "urgent" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                )}
                <span>{card.healthAlert.message}</span>
              </div>
            </div>
          </div>

          {/* 2. Practical Classroom Tips */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>كيف أساعد الطالب داخل الصف؟ (توصيات تعليمية وتربوية)</span>
            </h4>
            <div className="space-y-2">
              {card.classroomTips.map((tip, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="mt-0.5 font-medium leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Social Interaction Notice */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-teal-600" />
              <span>الاندماج والتواصل الاجتماعي في الصف</span>
            </h4>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
              {card.socialNotice}
            </div>
          </div>

          {/* Privacy Footnote */}
          <div className="p-3 bg-slate-100/70 border border-slate-200/60 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              هذه البطاقة تلخص فقط الإجراءات الصفية الإيجابية، ولا تتضمن التفاصيل الطبية أو الأسرية الخاصة مراعاةً لسرية الطالب.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            ثانوية الأبناء الأولى — وحدة التوجيه الطلابي والإرشاد الصحي
          </div>

          <div className="flex items-center gap-2">
            {onContactCounselor && (
              <button
                onClick={() => onContactCounselor(card.studentName)}
                className="py-2 px-3.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>التواصل مع المرشد</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
