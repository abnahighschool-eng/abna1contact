import React, { useState, useEffect } from "react";
import {
  Vote,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Users,
  UserCheck,
  Search,
  Lock,
  Calendar,
  School,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  Award
} from "lucide-react";

interface CandidateItem {
  id: string;
  fullName: string;
  studentName?: string;
  studentGrade?: string;
  studentClass?: string;
  skills?: string[];
  specialization?: string;
}

export default function ParentCouncilVotePortal() {
  const [token, setToken] = useState("");
  const [studentId, setStudentId] = useState("");
  const [code, setCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [maxVotes, setMaxVotes] = useState(9);
  const [isVotingClosed, setIsVotingClosed] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [existingVoteData, setExistingVoteData] = useState<any>(null);
  const [inviteData, setInviteData] = useState<any>(null);

  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Read URL params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token") || params.get("t") || params.get("council_token") || "";
    const urlStudentId = params.get("studentId") || params.get("sid") || "";
    const urlCode = params.get("code") || params.get("c") || "";

    if (urlToken) setToken(urlToken);
    if (urlStudentId) setStudentId(urlStudentId);
    if (urlCode) {
      setCode(urlCode);
      setEnteredCode(urlCode);
      // Auto-verify if code present in URL
      verifyCode(urlCode, urlToken, urlStudentId);
    }
  }, []);

  const verifyCode = async (codeToVerify: string, t = token, sId = studentId) => {
    const clean = codeToVerify.trim();
    if (!clean) {
      setVerifyError("يرجى إدخال رمز التفعيل المكون من 6 أرقام");
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const res = await fetch("/api/parent-councils/vote/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean, token: t, studentId: sId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.isVotingClosed) {
          setIsVotingClosed(true);
        }
        throw new Error(data.error || "رمز التفعيل غير صحيح أو انتهت صلاحيته");
      }

      setCodeVerified(true);
      setCode(clean);
      setCandidates(data.candidates || []);
      setMaxVotes(data.votingConfig?.maxVotesPerParent || 9);
      setInviteData(data.invite || null);

      if (data.alreadyVoted) {
        setAlreadyVoted(true);
        setExistingVoteData(data.vote);
      }
    } catch (err: any) {
      setVerifyError(err.message || "حدث خطأ أثناء التحقق من الرمز");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleToggleCandidate = (cid: string) => {
    if (alreadyVoted || submitSuccess) return;

    if (selectedCandidateIds.includes(cid)) {
      setSelectedCandidateIds(prev => prev.filter(id => id !== cid));
      setSubmitError(null);
    } else {
      if (selectedCandidateIds.length >= maxVotes) {
        setSubmitError(`لقد اخترت الحد الأقصى المسموح به (${maxVotes} مرشحين). يمكنك إلغاء اختيار أحد المرشحين لإضافة غيره.`);
        return;
      }
      setSelectedCandidateIds(prev => [...prev, cid]);
      setSubmitError(null);
    }
  };

  const handleSubmitVote = async () => {
    if (selectedCandidateIds.length === 0) {
      setSubmitError("يرجى اختيار مرشح واحد على الأقل قبل اعتماد التصويت");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/parent-councils/vote/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          code,
          studentId: studentId || inviteData?.studentId,
          selectedCandidateIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل إرسال التصويت، يرجى المحاولة مرة أخرى.");
      }

      setSubmitSuccess(true);
      setExistingVoteData(data.vote);
    } catch (err: any) {
      setSubmitError(err.message || "تعذر إرسال التصويت");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCandidates = candidates.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.studentName && c.studentName.toLowerCase().includes(q)) ||
      (c.studentGrade && c.studentGrade.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-3 sm:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto my-4 sm:my-8 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Ministry & School Header */}
        <div className="bg-gradient-to-l from-slate-900 via-teal-950 to-teal-900 text-white p-6 sm:p-8 relative overflow-hidden">
          <div className="relative z-10 text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-xs font-bold border border-white/10 mb-1">
              <School className="w-3.5 h-3.5" />
              <span>المملكة العربية السعودية • وزارة التعليم • الإدارة العامة للتعليم بمنطقة تبوك</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              ثانوية الأبناء الأولى
            </h1>
            <h2 className="text-sm sm:text-base font-bold text-teal-300 flex items-center justify-center gap-2">
              <Vote className="w-5 h-5" />
              <span>تصويت وترشيح أعضاء مجلس أولياء الأمور (1447 - 1448 هـ)</span>
            </h2>
          </div>
        </div>

        {/* Closed Banner */}
        {isVotingClosed && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800">التصويت غير متاح حالياً</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              عذراً، التصويت لعضوية مجلس أولياء الأمور غير متاح حالياً أو قد تم إغلاقه بعد اكتمال مرحلة الفرز. شكراً لاهتمامكم وحرصكم الدائم.
            </p>
          </div>
        )}

        {/* Step 0: Activation Code Verification */}
        {!isVotingClosed && !codeVerified && (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-teal-100 text-teal-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                رمز التفعيل للتصويت
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                المكرم ولي الأمر، نأمل إدخال رمز التفعيل المكون من 6 أرقام والموضح في رسالة الدعوة لفتح بطاقة ترشيح أعضاء المجلس.
              </p>
            </div>

            <div className="max-w-xs mx-auto space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                  رمز التفعيل (6 أرقام)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="مثال: 202601"
                  className="w-full text-center tracking-widest text-2xl font-mono font-black py-3 px-4 rounded-2xl border-2 border-teal-300 focus:border-teal-600 focus:outline-none bg-slate-50 text-slate-900 shadow-inner"
                />
              </div>

              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => verifyCode(enteredCode)}
                disabled={isVerifying || !enteredCode.trim()}
                className="w-full py-3 px-4 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifying ? (
                  <span>جارٍ التحقق من الرمز...</span>
                ) : (
                  <>
                    <span>التحقق والدخول إلى بطاقة التصويت</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 text-center max-w-md mx-auto">
              <span className="font-bold text-slate-800 block mb-0.5">ملاحظة أمنية:</span>
              يُسمح لكل ولي أمر بالتصويت لمرة واحدة فقط لضمان النزاهة والعدالة وتكافؤ الفرص لجميع المرشحين.
            </div>
          </div>
        )}

        {/* Already Voted Screen */}
        {!isVotingClosed && codeVerified && (alreadyVoted || submitSuccess) && (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                تم تسجيل وتوثيق تصويتكم بنجاح!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                المكرم ولي الأمر، نود إحاطتكم بأنه تم استلام وترشيح ممثليكم لعضوية مجلس أولياء الأمور وتوثيقه في سجلات ثانوية الأبناء الأولى.
              </p>
            </div>

            {existingVoteData && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                  <span>رقم توثيق التصويت:</span>
                  <span className="font-mono text-teal-800 font-black">{existingVoteData.id}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>تاريخ وتوقيت التسجيل:</span>
                  <span className="font-mono font-medium">
                    {new Date(existingVoteData.votedAt || Date.now()).toLocaleString("ar-SA")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>عدد المرشحين المختارين:</span>
                  <span className="font-bold text-emerald-800">
                    {existingVoteData.selectedCandidateIds?.length || selectedCandidateIds.length} مرشحين
                  </span>
                </div>
              </div>
            )}

            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center text-xs text-teal-950 font-bold max-w-lg mx-auto">
              شكراً لمشاركتكم القيمة وحرصكم الدائم على تعزيز الشراكة بين البيت والمدرسة لما فيه مصلحة أبنائنا الطلاب.
            </div>

            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center space-y-1.5 max-w-md mx-auto">
              <div className="text-xs sm:text-sm font-black text-slate-800">
                فضلاً قم بإغلاق المتصفح الآن
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                تم توثيق اختياراتكم رسمياً ولا توجد خطوات إضافية مطلوبة.
              </p>
            </div>
          </div>
        )}

        {/* Active Voting Ballot */}
        {!isVotingClosed && codeVerified && !alreadyVoted && !submitSuccess && (
          <div className="p-5 sm:p-8 space-y-6">
            {/* Student & Parent Info Banner */}
            <div className="bg-gradient-to-l from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-teal-700 block">بيانات ولي الأمر المصوت:</span>
                <span className="text-sm font-black text-slate-900">
                  {inviteData?.studentName ? `ولي أمر الطالب: ${inviteData.studentName}` : "المكرم ولي الأمر"}
                </span>
                {inviteData?.studentGrade && (
                  <span className="text-xs text-slate-600 block">
                    الصف: {inviteData.studentGrade} {inviteData.studentClass ? `- الشعبة ${inviteData.studentClass}` : ""}
                  </span>
                )}
              </div>

              <div className="bg-white px-3.5 py-2 rounded-xl border border-teal-200 shadow-sm shrink-0">
                <span className="text-[10px] text-slate-500 block font-bold">المرشحون المختارون:</span>
                <div className="flex items-center gap-1.5 font-mono text-sm font-black text-teal-800">
                  <span className="text-lg text-emerald-600">{selectedCandidateIds.length}</span>
                  <span>/</span>
                  <span>{maxVotes}</span>
                  <span className="text-xs font-sans text-slate-600 font-bold">مرشحين كحد أقصى</span>
                </div>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-medium text-amber-900 leading-relaxed flex items-start gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block text-sm text-amber-950 mb-0.5">تعليمات التصويت والترشيح:</span>
                المكرم ولي الأمر، نأمل اختيار وترشيح ممثليكم لعضوية مجلس أولياء الأمور من بين قائمة المرشحين المؤهلين أدناه. يمكنك اختيار ما يصل إلى <strong className="font-black">{maxVotes} مرشحين</strong> كحد أقصى لدعم تشكيل المجلس.
              </div>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم ولي الأمر المرشح أو اسم ابنه..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Candidates List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                <span>قائمة المرشحين المؤهلين ({filteredCandidates.length}):</span>
                <span>اضغط على البطاقة لاختيار المرشح</span>
              </div>

              {filteredCandidates.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  لا يوجد مرشحون مطابقون للبحث الحالي.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredCandidates.map((candidate) => {
                    const isSelected = selectedCandidateIds.includes(candidate.id);
                    return (
                      <div
                        key={candidate.id}
                        onClick={() => handleToggleCandidate(candidate.id)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? "bg-teal-50/80 border-teal-600 shadow-md ring-2 ring-teal-600/20"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                                {candidate.fullName}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-bold">
                                ولي أمر الطالب: {candidate.studentName || "طالب بالمدرسة"}
                              </p>
                              {candidate.studentGrade && (
                                <p className="text-[10px] text-slate-400 font-medium">
                                  الصف: {candidate.studentGrade} {candidate.studentClass ? `(${candidate.studentClass})` : ""}
                                </p>
                              )}
                            </div>

                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                              isSelected
                                ? "bg-teal-700 border-teal-700 text-white"
                                : "bg-white border-slate-300 text-transparent"
                            }`}>
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          </div>

                          {/* Skills badges */}
                          {candidate.skills && candidate.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {candidate.skills.slice(0, 3).map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className={isSelected ? "text-teal-800 font-black" : "text-slate-400 font-medium"}>
                            {isSelected ? "✓ تم الاختيار والترشيح" : "انقر للاختيار"}
                          </span>
                          <span className="text-slate-400 font-mono">#{candidate.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700">
                تم اختيار <span className="font-mono text-teal-800 text-sm font-black">{selectedCandidateIds.length}</span> من أصل <span className="font-mono text-slate-900 font-black">{maxVotes}</span> مرشحين كحد أقصى
              </div>

              <button
                type="button"
                onClick={handleSubmitVote}
                disabled={isSubmitting || selectedCandidateIds.length === 0}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>جارٍ تسجيل التصويت...</span>
                ) : (
                  <>
                    <Vote className="w-4 h-4" />
                    <span>اعتماد وإرسال الترشيح ({selectedCandidateIds.length} مرشحين)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
