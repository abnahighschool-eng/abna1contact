import React, { useState, useMemo } from "react";
import {
  Vote,
  Users,
  CheckCircle2,
  AlertCircle,
  Share2,
  Copy,
  ExternalLink,
  MessageSquare,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Trophy,
  Award,
  Search,
  Check,
  Printer,
  ChevronDown,
  Filter,
  ShieldCheck,
  Flame,
  Star,
  UserCheck
} from "lucide-react";
import {
  ParentCouncilApplication,
  ParentCouncilConfig,
  ParentCouncilInvite,
  ParentCouncilVotingConfig,
  ParentCouncilVote,
  Student
} from "../../types";

interface ParentCouncilVotingManagerProps {
  applications: Record<string, ParentCouncilApplication>;
  config: ParentCouncilConfig;
  invites: Record<string, ParentCouncilInvite>;
  votes: Record<string, ParentCouncilVote>;
  votingConfig: ParentCouncilVotingConfig;
  students: Student[];
  onUpdateVotingConfig: (newConfig: Partial<ParentCouncilVotingConfig>) => Promise<void>;
  onApplyTopCandidatesToCouncil: (topIds: string[], reserveIds: string[]) => Promise<void>;
  onResetVotes: () => Promise<void>;
}

export default function ParentCouncilVotingManager({
  applications,
  config,
  invites,
  votes,
  votingConfig,
  students,
  onUpdateVotingConfig,
  onApplyTopCandidatesToCouncil,
  onResetVotes,
}: ParentCouncilVotingManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"results" | "dispatch" | "settings">("results");
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Dispatcher state
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [searchStudent, setSearchStudent] = useState("");
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const defaultTemplate = `السلام عليكم ورحمة الله وبركاته،
المكرم ولي أمر الطالب/ {اسم الطالب} ({الصف})،
نظراً لترشح نخبة من أولياء الأمور لعضوية مجلس أولياء الأمور بثانوية الأبناء الأولى، يسرنا دعوتكم للمشاركة في التصويت وترشيح ممثليكم في المجلس لاختيار أفضل 9 مرشحين لتمثيلكم.

رابط التصويت المباشر:
{الرابط}

رمز التفعيل: {رمز التفعيل}

- إدارة ثانوية الأبناء الأولى`;

  const [messageTemplate, setMessageTemplate] = useState(
    votingConfig?.messageTemplate || defaultTemplate
  );

  // Origin for links
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Helper to build shortened voting link
  const buildVoteUrl = (token: string) => {
    return `${origin}/v/${token}`;
  };

  // Candidate pool items
  const candidatePoolIds = useMemo(() => {
    if (votingConfig?.candidateIds && votingConfig.candidateIds.length > 0) {
      return votingConfig.candidateIds;
    }
    return config.selectedMemberIds || [];
  }, [votingConfig?.candidateIds, config.selectedMemberIds]);

  const candidatePoolApps = useMemo(() => {
    return candidatePoolIds
      .map(id => applications[id] || Object.values(applications).find(a => a.id === id))
      .filter(Boolean) as ParentCouncilApplication[];
  }, [candidatePoolIds, applications]);

  // Votes tallying: count votes for each candidate
  const votesList = useMemo(() => Object.values(votes || {}), [votes]);
  const totalVotesCount = votesList.length;

  const candidateTallies = useMemo(() => {
    const counts: Record<string, number> = {};
    candidatePoolIds.forEach(id => {
      counts[id] = 0;
    });

    votesList.forEach(vote => {
      if (Array.isArray(vote.selectedCandidateIds)) {
        vote.selectedCandidateIds.forEach(cid => {
          counts[cid] = (counts[cid] || 0) + 1;
        });
      }
    });

    const ranked = candidatePoolApps.map(app => {
      const count = counts[app.id] || 0;
      const pct = totalVotesCount > 0 ? Math.round((count / totalVotesCount) * 100) : 0;
      return {
        app,
        count,
        percentage: pct,
      };
    });

    // Sort descending by vote count, then by smart score as secondary tie-breaker
    ranked.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (b.app.smartEvaluation?.calculatedScore || 0) - (a.app.smartEvaluation?.calculatedScore || 0);
    });

    return ranked;
  }, [candidatePoolApps, candidatePoolIds, votesList, totalVotesCount]);

  // Top 9 candidates
  const top9Candidates = useMemo(() => {
    return candidateTallies.slice(0, 9);
  }, [candidateTallies]);

  const reserveCandidates = useMemo(() => {
    return candidateTallies.slice(9, 13);
  }, [candidateTallies]);

  // Handle toggle voting active state
  const handleToggleVotingActive = async () => {
    setIsSaving(true);
    try {
      const nextActive = !votingConfig?.isActive;
      await onUpdateVotingConfig({
        isActive: nextActive,
        candidateIds: candidatePoolIds,
        messageTemplate,
      });
      setNotification(nextActive ? "تم تفعيل مرحلة تصويت أولياء الأمور بنجاح" : "تم إيقاف مرحلة التصويت مؤقتاً");
    } finally {
      setIsSaving(false);
    }
  };

  // One-click apply top 9 candidates
  const handleApplyTop9 = async () => {
    if (top9Candidates.length === 0) return;
    const confirmMsg = `هل ترغب في اعتماد أكثر 9 مرشحين تصويتاً كأعضاء أساسيين بمجلس أولياء الأمور؟\n\n- سيتم تحديث تشكيل المجلس تلقائياً بالنتائج الاسترشادية للتصويت.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
      const topIds = top9Candidates.map(c => c.app.id);
      const resIds = reserveCandidates.map(c => c.app.id);
      await onApplyTopCandidatesToCouncil(topIds, resIds);
      setNotification("تم اعتماد أكثر 9 مرشحين تصويتاً في التشكيل الرسمي للمجلس بنجاح.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to construct WhatsApp message text for a student
  const buildStudentMessage = (student: Student, invite: ParentCouncilInvite) => {
    const sName = student.name || (student as any)["اسم الطالب"] || (student as any)["الاسم"] || "الطالب";
    const sGrade = student.grade || (student as any)["الصف"] || "";
    const sClass = student.className || (student as any)["الفصل"] || "";
    const url = buildVoteUrl(invite.token);

    const classLabel = sGrade ? `${sGrade} ${sClass ? `- ${sClass}` : ""}` : "";

    return messageTemplate
      .replace(/{اسم الطالب}/g, sName)
      .replace(/{اسم_الطالب}/g, sName)
      .replace(/{الصف}/g, classLabel)
      .replace(/{الرابط}/g, url)
      .replace(/{رابط التصويت}/g, url)
      .replace(/{رمز التفعيل}/g, invite.code)
      .replace(/{كود التفعيل}/g, invite.code);
  };

  // Filter students for dispatch
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (s.isArchived) return false;
      const sGrade = s.grade || (s as any)["الصف"] || "";
      const sClass = s.className || (s as any)["الفصل"] || "";
      const sName = s.name || (s as any)["اسم الطالب"] || "";

      if (selectedGrade !== "all" && sGrade !== selectedGrade) return false;
      if (selectedClass !== "all" && sClass !== selectedClass) return false;
      if (searchStudent.trim() && !sName.toLowerCase().includes(searchStudent.toLowerCase())) return false;
      return true;
    });
  }, [students, selectedGrade, selectedClass, searchStudent]);

  // Unique grades and classes
  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const g = s.grade || (s as any)["الصف"];
      if (g) set.add(g);
    });
    return Array.from(set);
  }, [students]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const c = s.className || (s as any)["الفصل"];
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [students]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Highlights */}
      <div className="bg-gradient-to-l from-slate-900 via-teal-950 to-teal-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30">
              <Vote className="w-3.5 h-3.5" />
              <span>المرحلة الانتخابية • ترشيح وتصويت أولياء الأمور</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              فرز واختيار أكثر 9 مرشحين استرشادياً
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
              عند اختيار أكثر من 9 مرشحين، يتيح النظام إرسال رابط تصويت مختصر لأولياء الأمور للمشاركة في ترشيح ممثلي المجلس، ليقوم النظام باحتساب الأصوات واختيار أكثر 9 ترشيحاً استرشادياً.
            </p>
          </div>

          {/* Quick status button */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleToggleVotingActive}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                votingConfig?.isActive
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white ring-4 ring-emerald-500/20"
                  : "bg-amber-500 hover:bg-amber-600 text-slate-950"
              }`}
            >
              {votingConfig?.isActive ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>التصويت مفعّل وجارٍ استقبال الأصوات</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>تفعيل وفتح التصويت لأولياء الأمور</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-300 block font-medium">عدد المرشحين بالبطاقة:</span>
            <span className="text-xl font-black text-amber-300 font-mono">{candidatePoolIds.length} مرشحاً</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-300 block font-medium">إجمالي الأصوات المسجلة:</span>
            <span className="text-xl font-black text-teal-300 font-mono">{totalVotesCount} ولي أمر</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-300 block font-medium">المقاعد الأساسية المستهدفة:</span>
            <span className="text-xl font-black text-white font-mono">9 مقاعد</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-300 block font-medium">حالة الرابط المختصر:</span>
            <span className="text-sm font-bold text-emerald-300 font-mono">/v/:token نشط</span>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 font-black cursor-pointer text-xs"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Sub-tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab("results")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "results"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>نتائج الفرز وتحديد أكثر 9 ترشيحاً ({candidateTallies.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("dispatch")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "dispatch"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Share2 className="w-4 h-4 text-emerald-500" />
          <span>إرسال رابط التصويت المختصر لأولياء الأمور عبر واتساب</span>
        </button>

        <button
          onClick={() => setActiveSubTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "settings"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>إعدادات بطاقة الاقتراع والرسالة</span>
        </button>
      </div>

      {/* SUB-TAB 1: LIVE RESULTS & TOP 9 GUIDED SELECTION */}
      {activeSubTab === "results" && (
        <div className="space-y-6">
          {/* Action Header Banner for Adoption */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span>النتائج الاسترشادية لأكثر 9 مرشحين بناءً على تصويت أولياء الأمور:</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed max-w-xl">
                يقوم النظام تلقائياً بترتيب المرشحين بحسب عدد الأصوات، وتحديد أكثر 9 ترشيحاً لتمكين الإدارة من الاسترشاد باختيارهم واعتمادهم بضغطة زر واحدة.
              </p>
            </div>

            <button
              onClick={handleApplyTop9}
              disabled={isSaving || top9Candidates.length === 0}
              className="px-5 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
            >
              <UserCheck className="w-4 h-4 text-teal-300" />
              <span>اعتماد أكثر 9 ترشيحاً بالمجلس</span>
            </button>
          </div>

          {/* Results Table & Ranked Cards */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-teal-700" />
                  <span>ترتيب المرشحين حسب أعلى نسبة تصويت من أولياء الأمور</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  إجمالي المشاركين في التصويت حتى الآن: <strong className="text-slate-800">{totalVotesCount} ولي أمر</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة محضر الفرز والتصويت</span>
                </button>
              </div>
            </div>

            {candidateTallies.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                لم يتم إضافة أي مرشحين لبطاقة التصويت بعد. يمكنك اختيار المرشحين من تبويب "الفرز الذكي".
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {candidateTallies.map((item, index) => {
                  const isTop9 = index < 9;
                  const isReserve = index >= 9 && index < 13;

                  return (
                    <div
                      key={item.app.id}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                        isTop9
                          ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                          : isReserve
                          ? "bg-amber-50/30 hover:bg-amber-50/60"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Rank & Candidate Info */}
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-sm ${
                          isTop9
                            ? "bg-emerald-600 text-white"
                            : isReserve
                            ? "bg-amber-500 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {index + 1}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900">
                              {item.app.fullName}
                            </h4>
                            {isTop9 && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                                <span>ضمن الـ 9 الأكثر ترشيحاً</span>
                              </span>
                            )}
                            {isReserve && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                مرشح احتياطي ({index - 8})
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                            <span>ولي أمر الطالب: <strong className="text-slate-700">{item.app.studentName}</strong></span>
                            <span>الصف: {item.app.studentGrade} {item.app.studentClass ? `(${item.app.studentClass})` : ""}</span>
                            <span>الجوال: <span className="font-mono" dir="ltr">{item.app.phone}</span></span>
                          </div>

                          {item.app.skills && item.app.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {item.app.skills.map((s, i) => (
                                <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-bold">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vote Progress Bar & Count */}
                      <div className="w-full sm:w-64 space-y-1.5 shrink-0 bg-white/70 p-3 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold">الأصوات المحصلة:</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-base font-black text-teal-800">{item.count}</span>
                            <span className="text-[10px] text-slate-400 font-medium">صوت</span>
                            <span className="text-xs font-bold text-slate-700">({item.percentage}%)</span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isTop9 ? "bg-emerald-500" : isReserve ? "bg-amber-500" : "bg-slate-400"
                            }`}
                            style={{ width: `${Math.min(100, item.percentage)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>درجة التقييم الذكي: {item.app.smartEvaluation?.calculatedScore || 0}%</span>
                          <span>المرتبة: #{index + 1}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: WHATSAPP DISPATCHER WITH SHORT LINKS */}
      {activeSubTab === "dispatch" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-emerald-600" />
                  <span>إرسال رابط التصويت المختصر لأولياء الأمور عبر واتساب</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يصل لكل ولي أمر رابط تصويت مختصر مع رمز التفعيل المخصص له للتصويت وترشيح أعضاء المجلس.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl">
                نمط الرابط: <span className="font-mono font-black" dir="ltr">{origin}/v/:token</span>
              </div>
            </div>

            {/* Template preview & edit */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <label className="block text-xs font-black text-slate-700">
                نص رسالة دعوة التصويت عبر واتساب (يمكنك التعديل عليها):
              </label>
              <textarea
                rows={5}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 font-sans focus:outline-none focus:border-teal-500 bg-white"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>المتغيرات المتاحة: &#123;اسم الطالب&#125;، &#123;الصف&#125;، &#123;الرابط&#125;، &#123;رمز التفعيل&#125;</span>
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateVotingConfig({ messageTemplate });
                    setNotification("تم حفظ قالب رسالة التصويت بنجاح");
                  }}
                  className="px-3 py-1 rounded-lg bg-teal-700 text-white font-bold text-xs hover:bg-teal-800 cursor-pointer"
                >
                  حفظ القالب
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تصفية حسب الصف:</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="all">كافة الصفوف الدراسية</option>
                  {uniqueGrades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تصفية حسب الشعبة/الفصل:</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="all">كافة الشعب</option>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c}>الشعبة {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث باسم الطالب:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    placeholder="ابحث باسم الطالب..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Student List with one-click send */}
            <div className="space-y-3 pt-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>كشف الطلاب وأولياء الأمور المستهدفين ({filteredStudents.length}):</span>
                <span className="text-[11px] text-teal-700">اضغط على أيقونة واتساب للإرسال الفردي الفوري</span>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white">
                {filteredStudents.map((student) => {
                  const sId = String(student.id);
                  const sName = student.name || (student as any)["اسم الطالب"] || "طالب";
                  const sPhone = student.phone || (student as any)["رقم الجوال"] || "";
                  const sGrade = student.grade || (student as any)["الصف"] || "";
                  const sClass = student.className || (student as any)["الفصل"] || "";

                  const invite: ParentCouncilInvite = invites[sId] || {
                    studentId: sId,
                    studentName: sName,
                    studentGrade: sGrade,
                    studentClass: sClass,
                    guardianPhone: sPhone,
                    token: `pc_${sId}`,
                    code: "202601",
                  };

                  const shortUrl = buildVoteUrl(invite.token);
                  const msgText = buildStudentMessage(student, invite);
                  const waHref = sPhone
                    ? `https://wa.me/${sPhone.replace(/\D/g, "")}?text=${encodeURIComponent(msgText)}`
                    : "#";

                  const hasVoted = !!votes[sId] || Object.values(votes).some(v => v.token === invite.token || v.studentId === sId);

                  return (
                    <div
                      key={sId}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{sName}</span>
                          {hasVoted ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ قام بالتصويت
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                              بانتظار التصويت
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{sGrade} {sClass ? `- شعبة ${sClass}` : ""}</span>
                          <span>•</span>
                          <span className="font-mono font-bold" dir="ltr">{sPhone || "بدون جوال"}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">الرابط المختصر:</span>
                          <span className="text-[10px] text-teal-800 font-mono font-bold">{shortUrl}</span>
                          <span className="text-[10px] text-slate-400 font-mono">كود: {invite.code}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(shortUrl);
                            setCopiedToken(sId);
                            setTimeout(() => setCopiedToken(null), 2000);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedToken === sId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedToken === sId ? "تم النسخ" : "نسخ الرابط"}</span>
                        </button>

                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-teal-700 hover:bg-teal-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>معاينة</span>
                        </a>

                        <a
                          href={waHref}
                          target="_blank"
                          rel="noreferrer"
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer text-white shadow-sm ${
                            sPhone ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 pointer-events-none"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>إرسال واتساب</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SETTINGS & CANDIDATE BALLOT CONFIG */}
      {activeSubTab === "settings" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-700" />
              <span>إعدادات بطاقة التصويت والترشيح</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تحديد الحد الأقصى للمرشحين وإدارة قائمة المرشحين المعتمدين للاقتراع.
            </p>
          </div>

          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                الحد الأقصى للمرشحين المسموح لولي الأمر باختيارهم:
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={votingConfig?.maxVotesPerParent || 9}
                onChange={async (e) => {
                  const val = parseInt(e.target.value) || 9;
                  await onUpdateVotingConfig({ maxVotesPerParent: val });
                }}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">القيمة النظامية الافتراضية هي 9 مرشحين كحد أقصى.</span>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <span className="text-xs font-black text-rose-800 block">إعادة تعيين أصوات أولياء الأمور:</span>
              <p className="text-[11px] text-slate-500">
                في حال الرغبة في بدء جولة تصويت جديدة تماماً ومسح كافة الأصوات المسجلة:
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("هل أنت متأكد من مسح كافة أصوات أولياء الأمور والبدء من جديد؟")) {
                    await onResetVotes();
                    setNotification("تمت إعادة تعيين أصوات أولياء الأمور بنجاح.");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط ومسح الأصوات</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
