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
  UserCheck,
  Send,
  XSquare,
  CheckSquare,
  Square
} from "lucide-react";
import {
  ParentCouncilApplication,
  ParentCouncilConfig,
  ParentCouncilInvite,
  ParentCouncilVotingConfig,
  ParentCouncilVote,
  Student,
  SchoolSignatories
} from "../../types";
import { getStableCodeForStudent, getStableTokenForStudent } from "./ParentCouncilStudentInvites";
import UnifiedCampaignModal, { CampaignLaunchButtons } from "../UnifiedCampaignModal";
import { launchOfficialCampaign } from "../../utils/campaignLauncher";

interface ParentCouncilVotingManagerProps {
  applications: Record<string, ParentCouncilApplication>;
  config: ParentCouncilConfig;
  invites: Record<string, ParentCouncilInvite>;
  votes: Record<string, ParentCouncilVote>;
  votingConfig: ParentCouncilVotingConfig;
  students: Student[];
  schoolSignatories?: SchoolSignatories;
  isWhatsAppConnected?: boolean;
  onNavigateToWhatsApp?: () => void;
  onNavigateToMessages?: (tab?: string) => void;
  onUpdateVotingConfig: (newConfig: Partial<ParentCouncilVotingConfig>) => Promise<void>;
  onApplyTopCandidatesToCouncil: (topIds: string[], reserveIds: string[]) => Promise<void>;
  onResetVotes: () => Promise<void>;
  showToast?: (msg: string) => void;
}

export default function ParentCouncilVotingManager({
  applications,
  config,
  invites,
  votes,
  votingConfig,
  students,
  schoolSignatories,
  isWhatsAppConnected = false,
  onNavigateToWhatsApp,
  onNavigateToMessages,
  onUpdateVotingConfig,
  onApplyTopCandidatesToCouncil,
  onResetVotes,
  showToast,
}: ParentCouncilVotingManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"results" | "dispatch" | "settings">("results");
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Dispatcher filtering state
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "voted">("all");
  const [searchStudent, setSearchStudent] = useState("");

  // Student selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Campaign Modal
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

  const defaultTemplate = `السلام عليكم ورحمة الله وبركاته،
المكرم ولي أمر الطالب/ {اسم الطالب} ({الصف})،
نظراً لترشح نخبة من أولياء الأمور لعضوية مجلس أولياء الأمور بثانوية الأبناء الأولى، يسرنا دعوتكم للمشاركة في التصويت وترشيح ممثلكم في المجلس لاختيار المرشح الأنسب لتمثيلكم.

رابط التصويت المباشر:
{الرابط}

رمز التفعيل: {رمز التفعيل}

ملاحظة: يُسمح باختيار مرشح واحد فقط.
- إدارة ثانوية الأبناء الأولى`;

  const [messageTemplate, setMessageTemplate] = useState(
    votingConfig?.messageTemplate || defaultTemplate
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Helper to build shortened voting link
  const buildVoteUrl = (token: string) => {
    return `${origin}/v/${token}`;
  };

  // Build candidate pool items
  const candidatePoolIds = useMemo(() => {
    if (votingConfig?.candidateIds && votingConfig.candidateIds.length > 0) {
      return votingConfig.candidateIds;
    }
    if (config.selectedMemberIds && config.selectedMemberIds.length > 0) {
      return config.selectedMemberIds;
    }
    return Object.keys(applications);
  }, [votingConfig?.candidateIds, config.selectedMemberIds, applications]);

  // Tallied votes for each candidate
  const candidateTally = useMemo(() => {
    const tally: Record<string, { count: number; voterNames: string[]; voters: ParentCouncilVote[] }> = {};
    candidatePoolIds.forEach((id) => {
      tally[id] = { count: 0, voterNames: [], voters: [] };
    });

    Object.values(votes || {}).forEach((vote) => {
      if (Array.isArray(vote.selectedCandidateIds)) {
        vote.selectedCandidateIds.forEach((cid) => {
          if (!tally[cid]) {
            tally[cid] = { count: 0, voterNames: [], voters: [] };
          }
          tally[cid].count += 1;
          const voterLabel = vote.studentName ? `ولي أمر الطالب: ${vote.studentName}` : (vote.guardianPhone || "ولي أمر");
          tally[cid].voterNames.push(voterLabel);
          tally[cid].voters.push(vote);
        });
      }
    });

    return tally;
  }, [candidatePoolIds, votes]);

  // Ranked candidates descending by votes
  const rankedCandidates = useMemo(() => {
    return candidatePoolIds
      .map((id) => {
        const app = applications[id] || Object.values(applications).find((a) => a.id === id);
        const data = candidateTally[id] || { count: 0, voterNames: [], voters: [] };
        return {
          id,
          application: app,
          fullName: app?.fullName || "مرشح",
          studentName: app?.studentName || "",
          studentGrade: app?.studentGrade || "",
          votesCount: data.count,
          voterNames: data.voterNames,
          voters: data.voters,
        };
      })
      .sort((a, b) => b.votesCount - a.votesCount);
  }, [candidatePoolIds, applications, candidateTally]);

  const totalVotesCast = useMemo(() => {
    return Object.keys(votes || {}).length;
  }, [votes]);

  // Unique Grades & Classes for dropdowns
  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const g = s.grade || (s as any)["الصف"];
      if (g) set.add(String(g).trim());
    });
    return Array.from(set).sort();
  }, [students]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const c = s.className || (s as any)["الفصل"];
      if (c) set.add(String(c).trim());
    });
    return Array.from(set).sort();
  }, [students]);

  // Filtered students list for dispatch
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const sGrade = s.grade || (s as any)["الصف"] || "";
      const sClass = s.className || (s as any)["الفصل"] || "";
      const sName = s.name || (s as any)["اسم الطالب"] || "";
      const sPhone = s.phone || (s as any)["رقم الجوال"] || "";
      const sId = String(s.id);

      if (selectedGrade !== "all" && sGrade !== selectedGrade) return false;
      if (selectedClass !== "all" && sClass !== selectedClass) return false;

      const token = `pc_${sId}`;
      const hasVoted = !!votes[sId] || Object.values(votes || {}).some(v => v.token === token || v.studentId === sId);

      if (statusFilter === "pending" && hasVoted) return false;
      if (statusFilter === "voted" && !hasVoted) return false;

      if (searchStudent.trim()) {
        const q = searchStudent.toLowerCase();
        const matchName = sName.toLowerCase().includes(q);
        const matchPhone = sPhone.includes(q);
        const matchId = sId.includes(q);
        if (!matchName && !matchPhone && !matchId) return false;
      }

      return true;
    });
  }, [students, selectedGrade, selectedClass, statusFilter, searchStudent, votes]);

  // Multi-selection handlers
  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredStudents.map(s => String(s.id));
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedStudentIds.includes(id));
    if (allSelected) {
      // Unselect only the filtered ones
      setSelectedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Add all filtered to selection
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedStudentIds.includes(String(s.id)));
  }, [filteredStudents, selectedStudentIds]);

  // Message builder
  const buildStudentMessage = (student: Student, invite: ParentCouncilInvite) => {
    const sName = student.name || (student as any)["اسم الطالب"] || "ولي الأمر";
    const sGrade = student.grade || (student as any)["الصف"] || "";
    const shortUrl = buildVoteUrl(invite.token);
    const code = invite.code || "202601";

    return messageTemplate
      .replace(/{اسم الطالب}/g, sName)
      .replace(/{الصف}/g, sGrade)
      .replace(/{الرابط}/g, shortUrl)
      .replace(/{رمز التفعيل}/g, code);
  };

  // Campaign recipients mapping
  const campaignRecipients = useMemo(() => {
    return students
      .filter(s => selectedStudentIds.includes(String(s.id)))
      .map(student => {
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
          token: getStableTokenForStudent(sId),
          code: getStableCodeForStudent(sId),
        };

        const shortUrl = buildVoteUrl(invite.token);
        const customMessage = buildStudentMessage(student, invite);

        return {
          id: sId,
          name: sName,
          phone: sPhone,
          grade: sGrade,
          className: sClass,
          token: invite.token,
          code: invite.code,
          shortUrl,
          customMessage,
        };
      });
  }, [students, selectedStudentIds, invites, messageTemplate]);

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header Card */}
      <div className="bg-gradient-to-l from-slate-900 via-teal-950 to-teal-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-xs font-bold border border-white/10">
              <Vote className="w-3.5 h-3.5" />
              <span>نظام تصويت واقتراع أولياء الأمور الإلكتروني</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              إدارة تصويت وفرز أولياء الأمور
            </h2>
            <p className="text-xs sm:text-sm text-teal-100/80 max-w-2xl leading-relaxed">
              إرسال روابط التصويت المختصرة وكود التفعيل لأولياء الأمور لاختيار مرشح واحد، مع فرز النتائج وترتيب المرشحين تلقائياً حسب أعلى الأصوات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Voting Status Indicator */}
            <div className={`px-3.5 py-2 rounded-2xl text-xs font-black flex items-center gap-2 border shadow-sm ${
              votingConfig?.isActive !== false
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                : "bg-rose-500/20 border-rose-400/40 text-rose-200"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${votingConfig?.isActive !== false ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
              <span>{votingConfig?.isActive !== false ? "التصويت مفتوح حالياً" : "التصويت مغلق"}</span>
            </div>

            {/* Toggle Status Button */}
            <button
              type="button"
              onClick={async () => {
                const newStatus = votingConfig?.isActive === false ? true : false;
                await onUpdateVotingConfig({ isActive: newStatus });
                const msg = newStatus ? "تم فتح التصويت لجميع أولياء الأمور" : "تم إغلاق التصويت بنجاح";
                if (showToast) showToast(msg);
                setNotification(msg);
              }}
              className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {votingConfig?.isActive !== false ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-300" />
                  <span>إيقاف التصويت مؤقتاً</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-300" />
                  <span>فتح التصويت لأولياء الأمور</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">إجمالي أولياء الأمور المصوتين</span>
            <span className="text-xl sm:text-2xl font-black text-white">{totalVotesCast}</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">قائمة المرشحين للاقتراع</span>
            <span className="text-xl sm:text-2xl font-black text-white">{candidatePoolIds.length} مرشحاً</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">المقاعد الأساسية المعتمدة</span>
            <span className="text-xl sm:text-2xl font-black text-amber-300">9 مقاعد أساسية</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">مقاعد الاحتياط</span>
            <span className="text-xl sm:text-2xl font-black text-teal-200">4 مقاعد</span>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">✕</button>
        </div>
      )}

      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab("results")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "results"
              ? "bg-white text-teal-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-600" />
          <span>نتائج الفرز وتحديد الأكثر ترشيحاً ({candidatePoolIds.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("dispatch")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "dispatch"
              ? "bg-white text-teal-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Share2 className="w-4 h-4 text-emerald-600" />
          <span>إرسال رابط التصويت لأولياء الأمور عبر واتساب</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("settings")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "settings"
              ? "bg-white text-teal-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Sparkles className="w-4 h-4 text-teal-700" />
          <span>إعدادات التصويت والقالب</span>
        </button>
      </div>

      {/* SUB-TAB 1: LIVE RESULTS & RANKING */}
      {activeSubTab === "results" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-600" />
                  <span>ترتيب المرشحين حسب تصويت أولياء الأمور (فرز فوري)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يتغير ترتيب المرشحين تلقائياً وبشكل مباشر مع كل تصويت يرسله أولياء الأمور.
                </p>
              </div>

              {/* Action: Apply Top 9 Candidates to Council */}
              <button
                type="button"
                onClick={async () => {
                  const top9 = rankedCandidates.slice(0, 9).map(c => c.id);
                  const reserves = rankedCandidates.slice(9, 13).map(c => c.id);
                  if (top9.length === 0) {
                    alert("لا يوجد مرشحون لاعتمادهم حالياً.");
                    return;
                  }
                  if (window.confirm(`هل ترغب في اعتماد أكثر 9 مرشحين حصولاً على الأصوات كأعضاء أساسيين بمجلس أولياء الأمور؟`)) {
                    await onApplyTopCandidatesToCouncil(top9, reserves);
                    if (showToast) showToast("تم اعتماد أعلى 9 مرشحين بالمجلس بنجاح");
                    setNotification("تم اعتماد أعلى 9 مرشحين بناء على أصوات أولياء الأمور بنجاح.");
                  }
                }}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>اعتماد أكثر 9 ترشيحاً بالمجلس</span>
              </button>
            </div>

            {rankedCandidates.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                لا يوجد مرشحون مسجلون في بطاقة الاقتراع بعد.
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {rankedCandidates.map((candidate, index) => {
                  const isTop9 = index < 9;
                  const isReserve = index >= 9 && index < 13;
                  const pct = totalVotesCast > 0 ? Math.round((candidate.votesCount / totalVotesCast) * 100) : 0;

                  return (
                    <div
                      key={candidate.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isTop9
                          ? "bg-amber-50/40 border-amber-300 shadow-xs"
                          : isReserve
                          ? "bg-blue-50/30 border-blue-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Rank Badge */}
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                            index === 0
                              ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300"
                              : index === 1
                              ? "bg-slate-200 text-slate-800"
                              : index === 2
                              ? "bg-amber-600 text-white"
                              : isTop9
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          #{index + 1}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-slate-900">
                              {candidate.fullName}
                            </span>
                            {isTop9 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ضمن الـ 9 الأكثر ترشيحاً
                              </span>
                            )}
                            {isReserve && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                                مقعد احتياط #{index - 8}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            {candidate.studentName && <span>ولي أمر الطالب: {candidate.studentName}</span>}
                            {candidate.studentGrade && <span>• {candidate.studentGrade}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Vote tally & progress */}
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left space-y-0.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-sm font-black text-teal-900">{candidate.votesCount}</span>
                            <span className="text-[10px] font-bold text-slate-500">صوت</span>
                            <span className="text-[10px] text-slate-400 font-mono">({pct}%)</span>
                          </div>
                          <div className="w-24 sm:w-28 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-teal-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
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
                  <span>إرسال رابط التصويت لأولياء الأمور عبر واتساب</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يصل لكل ولي أمر رابط تصويت مختصر مع رمز التفعيل المخصص له لاختيار مرشح المجلس.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl">
                الرابط المختصر: <span className="font-mono font-black" dir="ltr">{origin}/v/:token</span>
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
                className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 font-sans focus:outline-hidden focus:border-teal-500 bg-white"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>المتغيرات المتاحة: &#123;اسم الطالب&#125;، &#123;الصف&#125;، &#123;الرابط&#125;، &#123;رمز التفعيل&#125;</span>
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateVotingConfig({ messageTemplate });
                    if (showToast) showToast("تم حفظ قالب رسالة التصويت بنجاح");
                    setNotification("تم حفظ قالب رسالة التصويت بنجاح");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-700 text-white font-bold text-xs hover:bg-teal-800 cursor-pointer self-end sm:self-auto"
                >
                  حفظ القالب
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">الصف الدراسي:</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="all">كافة الصفوف الدراسية</option>
                  {uniqueGrades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">الشعبة / الفصل:</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="all">كافة الشعب</option>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c}>الشعبة {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">حالة التصويت:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="pending">بانتظار التصويت</option>
                  <option value="voted">قام بالتصويت</option>
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
                    placeholder="ابحث بالاسم أو الجوال..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Mass Selection Toolbar */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="p-1 text-teal-800 hover:bg-teal-50 rounded-lg cursor-pointer"
                  title="تحديد الكل"
                >
                  {isAllFilteredSelected ? (
                    <CheckSquare className="w-5 h-5 text-teal-700" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                <span className="text-xs font-bold text-slate-700">
                  تم تحديد <strong className="text-teal-900 font-black">{selectedStudentIds.length}</strong> من إجمالي {filteredStudents.length} طالب
                </span>
                {selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIds([])}
                    className="text-[11px] text-rose-600 hover:underline font-bold mr-2 cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                )}
              </div>

              {/* Mass Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(true)}
                  disabled={selectedStudentIds.length === 0}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>إرسال رابط التصويت للمحددين ({selectedStudentIds.length}) عبر واتساب</span>
                </button>
              </div>
            </div>

            {/* Student List with one-click send */}
            <div className="space-y-3 pt-2">
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    لا يوجد طلاب مطابقون لمعايير البحث والتصفية.
                  </div>
                ) : (
                  filteredStudents.map((student) => {
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
                      token: getStableTokenForStudent(sId),
                      code: getStableCodeForStudent(sId),
                    };

                    const shortUrl = buildVoteUrl(invite.token);
                    const msgText = buildStudentMessage(student, invite);
                    const waHref = sPhone
                      ? `https://wa.me/${sPhone.replace(/\D/g, "")}?text=${encodeURIComponent(msgText)}`
                      : "#";

                    const hasVoted = !!votes[sId] || Object.values(votes || {}).some(v => v.token === invite.token || v.studentId === sId);
                    const isSelected = selectedStudentIds.includes(sId);

                    return (
                      <div
                        key={sId}
                        className={`p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                          isSelected ? "bg-teal-50/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          {/* Row Checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleSelectStudent(sId)}
                            className="mt-0.5 sm:mt-0 text-teal-800 p-0.5 rounded cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-teal-700" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>

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
                              <span className="text-[10px] text-slate-400 font-mono">الرابط:</span>
                              <span className="text-[10px] text-teal-800 font-mono font-bold">{shortUrl}</span>
                              <span className="text-[10px] text-slate-400 font-mono">كود: {invite.code}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(shortUrl);
                              setCopiedToken(sId);
                              setTimeout(() => setCopiedToken(null), 2000);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="نسخ رابط التصويت"
                          >
                            {copiedToken === sId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedToken === sId ? "تم النسخ" : "نسخ الرابط"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(msgText);
                              setCopiedMsgId(sId);
                              setTimeout(() => setCopiedMsgId(null), 2000);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="نسخ الرسالة كاملة"
                          >
                            {copiedMsgId === sId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                            <span>{copiedMsgId === sId ? "تم النسخ" : "نسخ الرسالة"}</span>
                          </button>

                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-teal-700 hover:bg-teal-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="معاينة رابط التصويت كما يراه ولي الأمر"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>معاينة</span>
                          </a>

                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer text-white shadow-xs ${
                              sPhone ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 pointer-events-none"
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>إرسال واتساب</span>
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SETTINGS & CONFIG */}
      {activeSubTab === "settings" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-700" />
              <span>إعدادات وضوابط التصويت</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              الضوابط النظامية لبطاقة اقتراع أولياء الأمور وإعادة تعيين الأصوات.
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
                max={1}
                disabled
                value={1}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-500 bg-slate-100"
              />
              <span className="text-[10px] text-teal-700 font-bold block mt-1">
                ✓ نظامياً: يصوت ولي الأمر لمرشح واحد فقط لضمان تكافؤ الفرص والعدالة.
              </span>
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
                    if (showToast) showToast("تمت إعادة ضبط أصوات أولياء الأمور بنجاح");
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

      {/* Unified Campaign Modal for sending to multiple parents */}
      {isCampaignModalOpen && (
        <UnifiedCampaignModal
          isOpen={isCampaignModalOpen}
          onClose={() => setIsCampaignModalOpen(false)}
          title="إرسال روابط تصويت وترشيح أعضاء مجلس أولياء الأمور عبر الواتساب"
          subtitle={`سيتم إرسال رابط التصويت المخصص متضمناً كود التفعيل إلى ${campaignRecipients.length} من أولياء الأمور.`}
          recipients={campaignRecipients}
          recipientLabel="ولي أمر"
          intervalSeconds={15}
          onSendSingle={async (item) => {
            const sPhone = item.phone || (item as any)["رقم الجوال"] || (item as any).guardianPhone;
            const sMsg = item.customMessage || (item as any).message;
            if (!sPhone || !String(sPhone).trim()) {
              return { success: false, error: "لا يوجد رقم جوال مسجل" };
            }
            if (!sMsg || !String(sMsg).trim()) {
              return { success: false, error: "نص الرسالة غير محدد" };
            }
            try {
              const res = await fetch("/api/whatsapp/send-single", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phone: sPhone,
                  message: sMsg,
                  customMessage: sMsg,
                  studentName: item.name,
                  grade: item.grade,
                  className: item.className,
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.success) {
                return { success: true };
              }
              return { success: false, error: data.error || "تعذر الإرسال عبر الخادم" };
            } catch (e: any) {
              return { success: false, error: e.message || "خطأ أثناء الاتصال بالخادم" };
            }
          }}
        />
      )}
    </div>
  );
}
