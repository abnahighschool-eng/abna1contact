import React, { useState, useEffect } from "react";
import {
  Vote,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Users,
  Search,
  Lock,
  Calendar,
  School,
  ArrowRight,
  ExternalLink,
  Check,
  Star,
  Award,
  X
} from "lucide-react";

interface CandidateItem {
  id: string;
  fullName: string;
  studentName?: string;
  studentGrade?: string;
  studentClass?: string;
  specialization?: string;
}

interface ParentCouncilVotePortalProps {
  initialToken?: string | null;
  initialCode?: string | null;
  onClose?: () => void;
}

export default function ParentCouncilVotePortal({
  initialToken,
  initialCode,
  onClose,
}: ParentCouncilVotePortalProps) {
  const [token, setToken] = useState<string>(initialToken || "");
  const [studentId, setStudentId] = useState<string>("");
  const [code, setCode] = useState<string>(initialCode || "");
  const [enteredCode, setEnteredCode] = useState<string>(initialCode || "202601");
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [isVotingClosed, setIsVotingClosed] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [existingVoteData, setExistingVoteData] = useState<any>(null);
  const [inviteData, setInviteData] = useState<any>(null);

  // Single candidate choice
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedCandidateName, setSubmittedCandidateName] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Read URL params and pathname on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;

    let resolvedToken = initialToken || params.get("token") || params.get("t") || params.get("council_token") || "";
    if (!resolvedToken && pathname.startsWith("/v/")) {
      resolvedToken = pathname.replace(/^\/v\/?/, "").split("/")[0].split("?")[0] || "";
    }

    const resolvedStudentId = params.get("studentId") || params.get("sid") || "";
    const resolvedCode = initialCode || params.get("code") || params.get("c") || params.get("council_code") || "";

    if (resolvedToken) setToken(resolvedToken);
    if (resolvedStudentId) setStudentId(resolvedStudentId);
    if (resolvedCode) {
      setCode(resolvedCode);
      setEnteredCode(resolvedCode);
    }

    // Check localStorage if this user already voted previously
    const checkToken = resolvedToken;
    const checkSid = resolvedStudentId || (resolvedToken.startsWith("pc_") ? resolvedToken.split("_")[1] : "");
    const localVoted = (checkToken && localStorage.getItem(`pc_voted_${checkToken}`)) ||
      (checkSid && localStorage.getItem(`pc_voted_${checkSid}`));

    if (localVoted) {
      setAlreadyVoted(true);
      try {
        const savedVote = localStorage.getItem(`pc_vote_data_${checkToken || checkSid}`);
        if (savedVote) {
          setExistingVoteData(JSON.parse(savedVote));
        }
      } catch (e) {}
    }

    // Auto-verify if code or default code is ready
    const codeToUse = resolvedCode || "202601";
    verifyCode(codeToUse, resolvedToken, resolvedStudentId);
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
        throw new Error(data.error || "رمز التفعيل غير مطابق، يرجى التأكد من كتابته بشكل صحيح");
      }

      setCodeVerified(true);
      setCode(clean);
      setCandidates(data.candidates || []);
      setInviteData(data.invite || null);

      if (data.alreadyVoted) {
        setAlreadyVoted(true);
        setExistingVoteData(data.vote);
        if (t) localStorage.setItem(`pc_voted_${t}`, "true");
        if (data.invite?.studentId) localStorage.setItem(`pc_voted_${data.invite.studentId}`, "true");
      }
    } catch (err: any) {
      setVerifyError(err.message || "حدث خطأ أثناء التحقق من الرمز");
    } finally {
      setIsVerifying(false);
    }
  };

  // Select single candidate
  const handleSelectCandidate = (cid: string) => {
    if (alreadyVoted || submitSuccess) return;
    setSelectedCandidateId(cid);
    setSubmitError(null);
  };

  const handleSubmitVote = async () => {
    if (!selectedCandidateId) {
      setSubmitError("يرجى اختيار مرشح واحد قبل إرسال الترشيح");
      return;
    }

    const candidateObj = candidates.find(c => c.id === selectedCandidateId);
    const chosenName = candidateObj ? candidateObj.fullName : "المرشح المختار";

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
          selectedCandidateIds: [selectedCandidateId],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.alreadyVoted) {
          setAlreadyVoted(true);
          setExistingVoteData(data.vote);
          throw new Error("لقد قمت بالتصويت مسبقاً، شكراً لمشاركتكم.");
        }
        throw new Error(data.error || "فشل إرسال الترشيح، يرجى المحاولة مرة أخرى.");
      }

      setSubmitSuccess(true);
      setSubmittedCandidateName(chosenName);
      setExistingVoteData(data.vote);

      // Persist voted state locally
      if (token) {
        localStorage.setItem(`pc_voted_${token}`, "true");
        localStorage.setItem(`pc_vote_data_${token}`, JSON.stringify(data.vote));
      }
      const finalSid = studentId || inviteData?.studentId;
      if (finalSid) {
        localStorage.setItem(`pc_voted_${finalSid}`, "true");
        localStorage.setItem(`pc_vote_data_${finalSid}`, JSON.stringify(data.vote));
      }
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
      <div className="max-w-2xl mx-auto my-3 sm:my-8 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Ministry & School Header */}
        <div className="bg-gradient-to-l from-slate-900 via-teal-950 to-teal-900 text-white p-6 sm:p-8 relative overflow-hidden text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-[11px] font-bold border border-white/10 mb-1">
            <School className="w-3.5 h-3.5" />
            <span>المملكة العربية السعودية • وزارة التعليم • الإدارة العامة للتعليم بمنطقة تبوك</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            ثانوية الأبناء الأولى
          </h1>
          <h2 className="text-xs sm:text-sm font-bold text-teal-300 flex items-center justify-center gap-2">
            <Vote className="w-4 h-4" />
            <span>تصويت وترشيح أعضاء مجلس أولياء الأمور (1447 - 1448 هـ)</span>
          </h2>
        </div>

        {/* Closed Banner */}
        {isVotingClosed && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800">التصويت غير متاح حالياً</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              عذراً، التصويت لعضوية مجلس أولياء الأمور غير متاح حالياً أو قد تم إغلاقه بعد اكتمال مرحلة الفرز. شكراً لاهتمامكم وحرصكم الدائم.
            </p>
            {onClose && (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
              >
                إغلاق النافذة
              </button>
            )}
          </div>
        )}

        {/* Step 0: Activation Code Verification */}
        {!isVotingClosed && !codeVerified && (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-teal-100 text-teal-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                رمز التفعيل للتصويت والترشيح
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                المكرم ولي الأمر، نأمل إدخال رمز التفعيل المكون من 6 أرقام والموضح في رسالة الدعوة لفتح بطاقة ترشيح ممثليكم في المجلس.
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
                  className="w-full text-center tracking-widest text-2xl font-mono font-black py-3 px-4 rounded-2xl border-2 border-teal-300 focus:border-teal-600 focus:outline-hidden bg-slate-50 text-slate-900 shadow-inner"
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
                className="w-full py-3 px-4 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
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

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600 text-center max-w-md mx-auto">
              <span className="font-bold text-slate-800 block mb-0.5">ملاحظة نظامية:</span>
              يُسمح لكل ولي أمر باختيار مرشح واحد فقط لضمان تكافؤ الفرص والعدالة في تشكيل المجلس.
            </div>
          </div>
        )}

        {/* SCREEN 1: NEW VOTE SUBMISSION THANK YOU SCREEN */}
        {!isVotingClosed && submitSuccess && (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                شكراً لمشاركتكم في ترشيح أعضاء مجلس أولياء الأمور
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                المكرم ولي الأمر، تم استلام وتسجيل ترشيحكم بنجاح للمرشح:{" "}
                <strong className="text-teal-800 font-black">{submittedCandidateName}</strong>
              </p>
            </div>

            {existingVoteData && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-700 border-b border-slate-200 pb-2 font-bold">
                  <span>رقم توثيق التصويت:</span>
                  <span className="font-mono text-teal-800 font-black">{existingVoteData.id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>تاريخ وتوقيت التسجيل:</span>
                  <span className="font-mono font-medium">
                    {new Date(existingVoteData.votedAt || Date.now()).toLocaleString("ar-SA")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>حالة المشاركة:</span>
                  <span className="font-bold text-emerald-700">✓ موثقة ومعتمدة بالسجلات</span>
                </div>
              </div>
            )}

            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center text-xs text-teal-950 font-bold max-w-md mx-auto leading-relaxed">
              تقدر إدارة ثانوية الأبناء الأولى كريم تعاونكم وحرصكم الدائم على تعزيز الشراكة بين البيت والمدرسة لما فيه مصلحة أبنائنا الطلاب.
            </div>

            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center space-y-2 max-w-sm mx-auto">
              <div className="text-xs font-black text-slate-800">
                فضلاً قم بإغلاق المتصفح الآن
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                تم حفظ وتوثيق اختياركم بنجاح ولا توجد أي خطوات إضافية مطلوبة.
              </p>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  إغلاق النافذة
                </button>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 2: ALREADY VOTED RETURN SCREEN (عند عودة ولي الأمر للرابط مرة أخرى) */}
        {!isVotingClosed && codeVerified && alreadyVoted && !submitSuccess && (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                شكراً لكم، لقد قمت بالتصويت مسبقاً
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                المكرم ولي الأمر، نفيدكم بأنه تم تسجيل وتوثيق مشاركتكم في ترشيح وتصويت أعضاء مجلس أولياء الأمور مسبقاً، ولا يمكن تكرار التصويت لضمان العدالة وتكافؤ الفرص لجميع المرشحين.
              </p>
            </div>

            {existingVoteData && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-700 border-b border-slate-200 pb-2 font-bold">
                  <span>رقم توثيق التصويت:</span>
                  <span className="font-mono text-teal-800 font-black">{existingVoteData.id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>تاريخ وتوقيت التسجيل:</span>
                  <span className="font-mono font-medium">
                    {new Date(existingVoteData.votedAt || Date.now()).toLocaleString("ar-SA")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>حالة التصويت:</span>
                  <span className="font-bold text-emerald-700">✓ تم التصويت والترشيح</span>
                </div>
              </div>
            )}

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center text-xs text-emerald-950 font-bold max-w-md mx-auto">
              شاكرين ومقدرين لكم كريم تفاعلكم واهتمامكم الدائم بدعم أنشطة ومسيرة المدرسة.
            </div>

            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center space-y-2 max-w-sm mx-auto">
              <div className="text-xs font-black text-slate-800">
                فضلاً قم بإغلاق المتصفح الآن
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  إغلاق النافذة
                </button>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 3: ACTIVE VOTING BALLOT (اسماء المرشحين فقط دون نسبهم لاختيار مرشح واحد) */}
        {!isVotingClosed && codeVerified && !alreadyVoted && !submitSuccess && (
          <div className="p-5 sm:p-8 space-y-5">
            {/* Student & Parent Info Banner */}
            <div className="bg-gradient-to-l from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-teal-700 block">بيانات ولي الأمر المصوت:</span>
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  {inviteData?.studentName ? `ولي أمر الطالب: ${inviteData.studentName}` : "المكرم ولي الأمر"}
                </span>
                {inviteData?.studentGrade && (
                  <span className="text-[11px] text-slate-600 block">
                    الصف: {inviteData.studentGrade} {inviteData.studentClass ? `- الشعبة ${inviteData.studentClass}` : ""}
                  </span>
                )}
              </div>

              <div className="bg-white px-3.5 py-1.5 rounded-xl border border-teal-200 shadow-xs shrink-0 text-center">
                <span className="text-[10px] text-slate-500 block font-bold">المرشح المختار:</span>
                <span className="text-xs font-black text-teal-800">
                  {selectedCandidateId ? "١ مرشح تم اختياره" : "لم يتم الاختيار بعد"}
                </span>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <Star className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block text-xs text-amber-950 mb-0.5">تعليمات التصويت:</span>
                المكرم ولي الأمر، يرجى اختيار <strong className="font-black">مرشح واحد فقط</strong> من بين قائمة أولياء الأمور المرشحين أدناه، ثم الضغط على زر "إرسال الترشيح".
              </div>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم المرشح..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-teal-500"
              />
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Candidates List - Names ONLY, NO percentages, NO scores */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                <span>قائمة المرشحين المعتمدين ({filteredCandidates.length}):</span>
                <span className="text-[11px] text-teal-700">اضغط على المرشح لاختياره</span>
              </div>

              {filteredCandidates.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  لا يوجد مرشحون مطابقون للبحث الحالي.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredCandidates.map((candidate) => {
                    const isSelected = selectedCandidateId === candidate.id;
                    return (
                      <div
                        key={candidate.id}
                        onClick={() => handleSelectCandidate(candidate.id)}
                        className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-teal-50 border-teal-600 shadow-md ring-2 ring-teal-600/20"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Radio Button Indicator */}
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                              isSelected
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>

                          {/* Candidate Name ONLY */}
                          <div className="space-y-0.5">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                              {candidate.fullName}
                            </h4>
                            {candidate.studentName && (
                              <p className="text-[11px] text-slate-500 font-medium">
                                ولي أمر الطالب: {candidate.studentName}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-300 flex items-center gap-1">
                              <Check className="w-3 h-3 text-teal-700" />
                              <span>تم الاختيار</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                              انقر للاختيار
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700">
                {selectedCandidateId ? (
                  <span className="text-emerald-700 font-black">
                    ✓ تم تحديد مرشح واحد وجاهز للإرسال
                  </span>
                ) : (
                  <span className="text-slate-500">
                    يرجى اختيار مرشح واحد من القائمة أعلاه
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitVote}
                disabled={isSubmitting || !selectedCandidateId}
                className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>جارٍ إرسال الترشيح...</span>
                ) : (
                  <>
                    <Vote className="w-4 h-4" />
                    <span>إرسال الترشيح</span>
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
