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
  Square,
  MessageCircle,
  FileText,
  Eye,
  Clock
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
import { VotingResultsReportPrintSheet, VotingSentReportPrintSheet } from "./ParentCouncilPrintSheets";

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
  onRefreshData?: () => Promise<void>;
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
  onRefreshData,
  showToast,
}: ParentCouncilVotingManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"results" | "dispatch" | "sent_report" | "settings">("results");
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Dispatcher filtering state
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "voted">("all");
  const [searchStudent, setSearchStudent] = useState("");

  // Sent Report filtering state
  const [reportFilter, setReportFilter] = useState<"all_sent" | "voted" | "viewed_only" | "not_opened">("all_sent");
  const [reportGradeFilter, setReportGradeFilter] = useState("all");
  const [reportSearch, setReportSearch] = useState("");

  // Student selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Campaign Modal & Print Sheets
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [showSentReportPrintSheet, setShowSentReportPrintSheet] = useState(false);

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

  // WhatsApp Group Universal Voting Links
  const groupVoteUrl = `${origin}?portal=parent-council-vote&mode=group`;
  const groupVoteShortUrl = `${origin}/v/group`;

  const [copiedGroupVoteLink, setCopiedGroupVoteLink] = useState(false);
  const [copiedGroupMessage, setCopiedGroupMessage] = useState(false);

  const defaultGroupBroadcastMessage = `السلام عليكم ورحمة الله وبركاته،
المكرمون أولياء أمور طلاب ${schoolSignatories?.schoolName || "المدرسة"}،،،

حرصاً على تعزيز الشراكة المجتمعية الفاعلة بين البيت والمدرسة، وتطبيقاً للائحة مجالس أولياء الأمور، يسرنا دعوتكم للمشاركة في التصويت لاختيار ممثليكم في مجلس أولياء الأمور للعام الدراسي الحالي.

نأمل التكرم بالدخول على رابط التصويت واختيار مرشح واحد فقط من قائمة المرشحين المعتمدين:
${groupVoteUrl}

📌 ملاحظات تنظيمية:
• يتم التحقق تلقائياً برقم الجوال المسجل بنظام نور (دون الحاجة لرمز تفعيل).
• التصويت متاح لمرة واحدة فقط لكل ولي أمر لضمان الشفافية وتكافؤ الفرص.

شاكرين لكم كريم تعاونكم واهتمامكم الدائم.
إدارة ${schoolSignatories?.schoolName || "المدرسة"}`;

  const [groupBroadcastMessage, setGroupBroadcastMessage] = useState(defaultGroupBroadcastMessage);

  // Helper to mark all roster students as having received the WhatsApp Group voting link
  const markGroupVoteLinkDispatched = async () => {
    try {
      await fetch("/api/parent-councils/vote/mark-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markAllRoster: true,
          method: "whatsapp_group",
        }),
      });
      if (onRefreshData) {
        onRefreshData().catch(() => {});
      }
    } catch (e) {}
  };

  const copyGroupVoteLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(groupVoteUrl);
      } else {
        const ta = document.createElement("textarea");
        ta.value = groupVoteUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedGroupVoteLink(true);
      setTimeout(() => setCopiedGroupVoteLink(false), 3000);
      await markGroupVoteLinkDispatched();
      const msg = "تم نسخ رابط التصويت لقروب الواتساب وتوثيق الإرسال في التقرير الرسمي";
      if (showToast) showToast(msg);
      setNotification(msg);
    } catch (e) {
      console.error(e);
    }
  };

  const copyGroupMessageText = async () => {
    try {
      const textToCopy = groupBroadcastMessage.replace(/{الرابط}/g, groupVoteUrl);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedGroupMessage(true);
      setTimeout(() => setCopiedGroupMessage(false), 3000);
      await markGroupVoteLinkDispatched();
      const msg = "تم نسخ نص رسالة قروب الواتساب الجاهزة وتوثيق الإرسال في التقرير الرسمي";
      if (showToast) showToast(msg);
      setNotification(msg);
    } catch (e) {
      console.error(e);
    }
  };

  const shareGroupToWhatsApp = () => {
    markGroupVoteLinkDispatched();
    const text = groupBroadcastMessage.replace(/{الرابط}/g, groupVoteUrl);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  // Helper to build shortened voting link
  const buildVoteUrl = (token: string) => {
    return `${origin}/v/${token}`;
  };

  // Helper to record that a voting invite was sent to a student's parent
  const recordVotingInviteSent = async (student: Student, invite: ParentCouncilInvite, method: "whatsapp_bot" | "whatsapp_direct") => {
    const sId = String(student.id);
    const sName = student.name || (student as any)["اسم الطالب"] || "طالب";
    const sPhone = student.phone || (student as any)["رقم الجوال"] || "";
    const sGrade = student.grade || (student as any)["الصف"] || "";
    const sClass = student.className || (student as any)["الفصل"] || "";

    try {
      await fetch("/api/parent-councils/vote/mark-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [sId],
          method,
          recipients: [
            {
              id: sId,
              name: sName,
              phone: sPhone,
              grade: sGrade,
              className: sClass,
              token: invite.token,
              code: invite.code,
            },
          ],
        }),
      });
      if (onRefreshData) {
        onRefreshData().catch(() => {});
      }
    } catch (e) {}
  };

  // Build candidate pool items - strictly candidates approved from smart screening
  const candidatePoolIds = useMemo(() => {
    let ids: string[] = [];
    if (votingConfig?.candidateIds && votingConfig.candidateIds.length > 0) {
      ids = votingConfig.candidateIds;
    } else if (config.selectedMemberIds && config.selectedMemberIds.length > 0) {
      ids = config.selectedMemberIds;
    }
    // Strictly filter out deleted or missing applications
    return ids.filter((id) => !!(applications[id] || Object.values(applications || {}).find((a) => a?.id === id)));
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

  // Compute Sent & Engagement Report Statistics
  const votingDeliveryRecords = useMemo(() => {
    const records: Array<{
      studentId: string;
      studentName: string;
      studentGrade: string;
      studentClass: string;
      guardianPhone: string;
      code: string;
      token: string;
      isVoteSent: boolean;
      voteSentAt?: string;
      voteSendMethod?: string;
      isVoteLinkOpened: boolean;
      voteLinkOpenedAt?: string;
      voteOpenCount: number;
      hasVoted: boolean;
      votedAt?: string;
      statusType: "voted" | "viewed_only" | "not_opened";
    }> = [];

    const allVoteObjs = Object.values(votes || {});
    const seenStudentIds = new Set<string>();

    // Check all students & invites that have been sent a voting link, opened it, or voted
    students.forEach((student) => {
      const sId = String(student.id);
      const inv = invites[sId];
      const token = inv?.token || getStableTokenForStudent(sId);
      const code = inv?.code || getStableCodeForStudent(sId);
      const sPhone = student.phone || (student as any)["رقم الجوال"] || inv?.guardianPhone || "";
      const cleanPhone = String(sPhone).replace(/\D/g, "").slice(-9);

      const matchedVote =
        votes[sId] ||
        allVoteObjs.find(
          (v) =>
            v.studentId === sId ||
            v.token === token ||
            (cleanPhone.length >= 9 && String(v.guardianPhone || "").replace(/\D/g, "").slice(-9) === cleanPhone)
        );

      const hasVoted = !!(matchedVote || inv?.hasVoted);
      const isOpened = !!(inv?.isVoteLinkOpened || inv?.hasOpenedVote || hasVoted);
      const isSent = !!(inv?.isVoteSent || isOpened || hasVoted);

      if (isSent) {
        seenStudentIds.add(sId);
        records.push({
          studentId: sId,
          studentName: student.name || (student as any)["اسم الطالب"] || inv?.studentName || "طالب",
          studentGrade: student.grade || (student as any)["الصف"] || inv?.studentGrade || "—",
          studentClass: student.className || (student as any)["الفصل"] || inv?.studentClass || "—",
          guardianPhone: sPhone,
          code,
          token,
          isVoteSent: true,
          voteSentAt: inv?.voteSentAt || inv?.sentAt || inv?.voteOpenedAt || matchedVote?.votedAt,
          voteSendMethod: inv?.voteSendMethod || inv?.sendMethod || "whatsapp_bot",
          isVoteLinkOpened: isOpened,
          voteLinkOpenedAt: inv?.voteLinkOpenedAt || inv?.voteOpenedAt || matchedVote?.votedAt,
          voteOpenCount: inv?.voteOpenCount || (isOpened ? 1 : 0),
          hasVoted,
          votedAt: matchedVote?.votedAt || inv?.votedAt,
          statusType: hasVoted ? "voted" : isOpened ? "viewed_only" : "not_opened",
        });
      }
    });

    // Also include any invites not in current students array that were sent/opened/voted
    Object.values(invites || {}).forEach((inv) => {
      if (!inv || !inv.studentId || seenStudentIds.has(String(inv.studentId))) return;
      const sId = String(inv.studentId);
      const matchedVote =
        votes[sId] ||
        allVoteObjs.find((v) => v.studentId === sId || v.token === inv.token);
      const hasVoted = !!(matchedVote || inv.hasVoted);
      const isOpened = !!(inv.isVoteLinkOpened || inv.hasOpenedVote || hasVoted);
      const isSent = !!(inv.isVoteSent || isOpened || hasVoted);

      if (isSent) {
        seenStudentIds.add(sId);
        records.push({
          studentId: sId,
          studentName: inv.studentName || "طالب",
          studentGrade: inv.studentGrade || "—",
          studentClass: inv.studentClass || "—",
          guardianPhone: inv.guardianPhone || "",
          code: inv.code || "",
          token: inv.token || `pc_${sId}`,
          isVoteSent: true,
          voteSentAt: inv.voteSentAt || inv.sentAt || inv.voteOpenedAt || matchedVote?.votedAt,
          voteSendMethod: inv.voteSendMethod || inv.sendMethod || "whatsapp_bot",
          isVoteLinkOpened: isOpened,
          voteLinkOpenedAt: inv.voteLinkOpenedAt || inv.voteOpenedAt || matchedVote?.votedAt,
          voteOpenCount: inv.voteOpenCount || (isOpened ? 1 : 0),
          hasVoted,
          votedAt: matchedVote?.votedAt || inv.votedAt,
          statusType: hasVoted ? "voted" : isOpened ? "viewed_only" : "not_opened",
        });
      }
    });

    return records.sort((a, b) => {
      // Order: voted first, then viewed_only, then not_opened
      const score = (st: string) => (st === "voted" ? 3 : st === "viewed_only" ? 2 : 1);
      if (score(b.statusType) !== score(a.statusType)) {
        return score(b.statusType) - score(a.statusType);
      }
      const tA = a.voteSentAt ? new Date(a.voteSentAt).getTime() : 0;
      const tB = b.voteSentAt ? new Date(b.voteSentAt).getTime() : 0;
      return tB - tA;
    });
  }, [students, invites, votes]);

  const deliveryStats = useMemo(() => {
    const totalSent = votingDeliveryRecords.length;
    const totalOpened = votingDeliveryRecords.filter((r) => r.isVoteLinkOpened).length;
    const totalVoted = votingDeliveryRecords.filter((r) => r.hasVoted).length;
    const viewedOnly = votingDeliveryRecords.filter((r) => r.statusType === "viewed_only").length;
    const notOpened = votingDeliveryRecords.filter((r) => r.statusType === "not_opened").length;
    return { totalSent, totalOpened, totalVoted, viewedOnly, notOpened };
  }, [votingDeliveryRecords]);

  const filteredReportRecords = useMemo(() => {
    return votingDeliveryRecords.filter((rec) => {
      if (reportFilter === "voted" && rec.statusType !== "voted") return false;
      if (reportFilter === "viewed_only" && rec.statusType !== "viewed_only") return false;
      if (reportFilter === "not_opened" && rec.statusType !== "not_opened") return false;
      if (reportGradeFilter !== "all" && rec.studentGrade !== reportGradeFilter) return false;
      if (reportSearch.trim()) {
        const q = reportSearch.trim().toLowerCase();
        const matchName = rec.studentName.toLowerCase().includes(q);
        const matchPhone = rec.guardianPhone.includes(q);
        const matchCode = rec.code.includes(q);
        if (!matchName && !matchPhone && !matchCode) return false;
      }
      return true;
    });
  }, [votingDeliveryRecords, reportFilter, reportGradeFilter, reportSearch]);

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
      setSelectedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
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

  if (showPrintSheet) {
    return (
      <VotingResultsReportPrintSheet
        candidates={rankedCandidates}
        totalVotesCast={totalVotesCast}
        config={config}
        signatories={
          schoolSignatories || {
            principalName: "مدير المدرسة",
            vicePrincipalName: "وكيل المدرسة",
            counselorName: "الموجه الطلابي",
            schoolName: "ثانوية الأبناء الأولى",
          }
        }
        onClose={() => setShowPrintSheet(false)}
      />
    );
  }

  if (showSentReportPrintSheet) {
    return (
      <VotingSentReportPrintSheet
        invites={invites}
        votes={votes}
        students={students}
        config={config}
        signatories={
          schoolSignatories || {
            principalName: "مدير المدرسة",
            vicePrincipalName: "وكيل المدرسة",
            counselorName: "الموجه الطلابي",
            schoolName: "ثانوية الأبناء الأولى",
          }
        }
        onClose={() => setShowSentReportPrintSheet(false)}
      />
    );
  }

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
              إرسال روابط التصويت المختصرة وكود التفعيل لأولياء الأمور لاختيار مرشح واحد، مع فرز النتائج وتوثيق من تم إرسال الرابط لهم ومن فتح الرابط ومن صوت ومن شاهد فقط.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Action: Print Official Delivery & Engagement Report */}
            <button
              type="button"
              onClick={() => setShowSentReportPrintSheet(true)}
              className="px-3.5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="طباعة التقرير الرسمي لإثبات إرسال روابط التصويت ومتابعة الفتح والتصويت والمشاهدة فقط"
            >
              <Printer className="w-3.5 h-3.5 text-slate-950" />
              <span>طباعة تقرير إرسال ومتابعة التصويت ({deliveryStats.totalSent})</span>
            </button>

            {/* Quick Action: Copy WhatsApp Group Voting Link */}
            <button
              type="button"
              onClick={copyGroupVoteLink}
              className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="نسخ الرابط الموحد المخصص للإرسال في قروب الواتساب (التفعيل برقم الجوال لجميع أولياء الأمور)"
            >
              {copiedGroupVoteLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>تم نسخ رابط القروب!</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-200" />
                  <span>نسخ رابط التصويت لقروب الواتساب</span>
                </>
              )}
            </button>

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">تم إرسال رابط التصويت لهم</span>
            <span className="text-xl sm:text-2xl font-black text-white">{deliveryStats.totalSent}</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">فتحوا رابط التصويت</span>
            <span className="text-xl sm:text-2xl font-black text-blue-200">{deliveryStats.totalOpened}</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">أتموا التصويت فعلياً</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-300">{totalVotesCast}</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[11px] text-teal-200/80 block">شاهد فقط (فتح ولم يصوت)</span>
            <span className="text-xl sm:text-2xl font-black text-amber-300">{deliveryStats.viewedOnly}</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-teal-200/80 block">قائمة المرشحين للاقتراع</span>
            <span className="text-xl sm:text-2xl font-black text-white">{candidatePoolIds.length} مرشحاً</span>
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
          onClick={() => setActiveSubTab("sent_report")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "sent_report"
              ? "bg-white text-teal-900 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <FileText className="w-4 h-4 text-blue-600" />
          <span>تقرير إرسال ومتابعة روابط التصويت ({deliveryStats.totalSent})</span>
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSentReportPrintSheet(true)}
                  className="px-4 py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-black shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <FileText className="w-4 h-4 text-teal-700" />
                  <span>تقرير إرسال ومتابعة التصويت (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintSheet(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-850 border-2 border-slate-300 text-xs font-black shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  id="btn-open-print-voting-results"
                >
                  <Printer className="w-4 h-4 text-teal-700" />
                  <span>طباعة محضر النتائج (A4)</span>
                </button>

                {/* Action: Apply Top Candidates to Council based on configured seats */}
                <button
                  type="button"
                  onClick={async () => {
                    const seatsCount = Number(config.seatsCount) || 9;
                    const reserveCount = Number(config.reserveSeatsCount) || 4;
                    const topSelected = rankedCandidates.slice(0, seatsCount).map(c => c.id);
                    const reserves = rankedCandidates.slice(seatsCount, seatsCount + reserveCount).map(c => c.id);
                    if (topSelected.length === 0) {
                      alert("لا يوجد مرشحون لاعتمادهم حالياً.");
                      return;
                    }
                    if (window.confirm(`هل ترغب في اعتماد أكثر (${topSelected.length}) مرشحين حصولاً على الأصوات كأعضاء أساسيين بمجلس أولياء الأمور؟`)) {
                      await onApplyTopCandidatesToCouncil(topSelected, reserves);
                      if (showToast) showToast(`تم اعتماد أكثر ${topSelected.length} مرشحاً بالمجلس بنجاح`);
                      setNotification(`تم اعتماد أكثر ${topSelected.length} مرشحين بناء على أصوات أولياء الأمور بنجاح.`);
                    }
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>اعتماد أكثر {Number(config.seatsCount) || 9} ترشيحاً بالمجلس</span>
                </button>
              </div>
            </div>

            {rankedCandidates.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-600 text-xs space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="font-extrabold text-sm text-slate-800">لا يوجد مرشحون معتمدون في بطاقة الاقتراع بعد</div>
                <p className="text-slate-500 max-w-md mx-auto">
                  وفقاً للائحة، لا ينتقل أي عضو لمرحلة التصويت إلا بعد اعتماده من خلال قسم "فرز وترتيب المتقدمين الذكي". يرجى التوجه إلى قسم الفرز الذكي وتحديد المرشحين المطلوب انتقالهم للاقتراع.
                </p>
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

          {/* HIGHLIGHTED CARD: WHATSAPP GROUP UNIVERSAL VOTING LINK */}
          <div className="bg-gradient-to-l from-emerald-950 via-teal-900 to-slate-900 text-white rounded-3xl p-6 shadow-lg border-2 border-emerald-500/40 relative overflow-hidden space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 flex items-center justify-center shrink-0 shadow-inner">
                  <MessageCircle className="w-8 h-8 text-emerald-300" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">
                      رابط التصويت العام لقروب الواتساب (بالتحقق برقم الجوال)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                      رابط موحد لكافة أولياء الأمور
                    </span>
                  </div>
                  <p className="text-xs text-teal-100/80 leading-relaxed max-w-2xl">
                    يمكن إرسال هذا الرابط الموحد مباشرة في قروب الواتساب لجميع أولياء الأمور (دون الحاجة لإرسال رسائل خاصة لكل ولي أمر)؛ حيث يدخل ولي الأمر رقم جواله المسجل بنظام نور للتحقق واختيار مرشح واحد فقط.
                  </p>
                </div>
              </div>

              {/* URL Display Badge */}
              <div className="bg-black/40 border border-emerald-400/40 px-4 py-2.5 rounded-2xl text-xs font-mono font-black text-emerald-300 flex items-center gap-2 self-start md:self-auto shadow-inner" dir="ltr">
                <span className="text-emerald-400">{groupVoteShortUrl}</span>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={copyGroupVoteLink}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer"
                title="نسخ رابط قروب الواتساب المباشر"
              >
                {copiedGroupVoteLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-emerald-200" />}
                <span>{copiedGroupVoteLink ? "تم نسخ رابط القروب" : "نسخ رابط التصويت لقروب الواتساب"}</span>
              </button>

              <button
                type="button"
                onClick={copyGroupMessageText}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-100 border border-white/20 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                title="نسخ نص الرسالة الجاهزة للنشر المباشر بالقروب"
              >
                {copiedGroupMessage ? <Check className="w-4 h-4 text-emerald-300" /> : <MessageSquare className="w-4 h-4 text-teal-300" />}
                <span>{copiedGroupMessage ? "تم نسخ نص الرسالة الجاهزة" : "نسخ نص رسالة القروب الجاهزة"}</span>
              </button>

              <button
                type="button"
                onClick={shareGroupToWhatsApp}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                title="فتح واتساب لمشاركة الرسالة فوراً"
              >
                <Share2 className="w-4 h-4 text-emerald-300" />
                <span>مشاركة مباشرة عبر واتساب</span>
              </button>

              <a
                href={groupVoteUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all"
                title="معاينة نموذج التصويت لقروب الواتساب"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                <span>معاينة صفحة التصويت (تجربة ولي الأمر)</span>
              </a>
            </div>

            {/* Collapsible Editable Broadcast Message Preview */}
            <div className="bg-black/25 border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-teal-200">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>نص رسالة الإعلان المقترحة لقروب أولياء الأمور عبر الواتساب:</span>
                </span>
                <span className="text-[11px] text-teal-300/70">يمكنك تعديلها مباشرة ونسخها</span>
              </div>
              <textarea
                rows={5}
                value={groupBroadcastMessage}
                onChange={(e) => setGroupBroadcastMessage(e.target.value)}
                className="w-full p-3 rounded-xl border border-white/15 bg-slate-900/70 text-xs text-teal-50 font-sans leading-relaxed focus:outline-hidden focus:border-emerald-400 shadow-inner"
              />
            </div>

            {/* Safeguard Assurance Box */}
            <div className="bg-emerald-950/70 border border-emerald-500/30 rounded-2xl p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-black text-emerald-300 block">نظام منع تكرار التصويت الموحد:</span>
                <span className="leading-relaxed">
                  يتحقق النظام من قاعدة البيانات الموحدة برقم الجوال؛ لذا لا يمكن لأي ولي أمر التصويت أكثر من مرة واحدة سواء دخل عبر رابط قروب الواتساب أو عبر الرابط الخاص برمز التفعيل، مما يضمن أعلى معايير النزاهة والعدالة بين المرشحين.
                </span>
              </div>
            </div>
          </div>

          {/* CARD 2: INDIVIDUAL SHORT LINKS & PERSONALIZED MESSAGES */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-teal-700" />
                  <span>إرسال رابط التصويت الخاص (برسالة فردية لكل ولي أمر)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يصل لكل ولي أمر رابط تصويت مختصر مع رمز التفعيل المخصص له لاختيار مرشح المجلس، ويقوم ولي الأمر بإدخال رمز التفعيل في الخانة الفارغة عند فتح الرابط.
                </p>
              </div>

              <div className="bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold px-3 py-1.5 rounded-xl">
                الرابط المختصر الخاص: <span className="font-mono font-black" dir="ltr">{origin}/v/:token</span>
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
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowSentReportPrintSheet(true)}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-teal-700" />
                  <span>طباعة تقرير المرسل لهم ({deliveryStats.totalSent})</span>
                </button>

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
                    const isOpened = !!(invite.isVoteLinkOpened || hasVoted);
                    const isSent = !!(invite.isVoteSent || isOpened || hasVoted);
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900">{sName}</span>
                              {hasVoted ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                  ✓ قام بالتصويت
                                </span>
                              ) : isOpened ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                                  👁 شاهد فقط (فتح الرابط ولم يصوت)
                                </span>
                              ) : isSent ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800">
                                  تم الإرسال (لم يفتح الرابط بعد)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                                  بانتظار الإرسال
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
                            onClick={() => {
                              if (sPhone) {
                                recordVotingInviteSent(student, invite, "whatsapp_direct");
                              }
                            }}
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

      {/* SUB-TAB 3: OFFICIAL SENT & ENGAGEMENT REPORT (تقرير لمن تم إرسال الرابط لهم ومن فتح الرابط ومن صوت ومن شاهد فقط) */}
      {activeSubTab === "sent_report" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
            {/* Top Header & Print Action */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-700" />
                  <span>التقرير الرسمي لإثبات إرسال رسائل التصويت ومتابعة التفاعل</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  يوثق هذا التقرير الرسمي كافة أولياء الأمور الذين تم إرسال رابط التصويت لهم، مع إثبات من فتح الرابط، ومن أتم التصويت فعلياً، ومن شاهد فقط دون تصويت.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSentReportPrintSheet(true)}
                className="px-5 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>طباعة التقرير الرسمي المعتمد (A4)</span>
              </button>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={() => setReportFilter("all_sent")}
                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                  reportFilter === "all_sent"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className={`text-[11px] font-bold block ${reportFilter === "all_sent" ? "text-slate-300" : "text-slate-500"}`}>
                  إجمالي من أُرسل لهم الرابط
                </span>
                <span className="text-xl font-black mt-0.5 block">{deliveryStats.totalSent}</span>
              </button>

              <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/60 text-right">
                <span className="text-[11px] font-bold text-blue-800 block">إجمالي من فتح الرابط</span>
                <span className="text-xl font-black text-blue-950 mt-0.5 block">{deliveryStats.totalOpened}</span>
              </div>

              <button
                type="button"
                onClick={() => setReportFilter("voted")}
                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                  reportFilter === "voted"
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
                    : "bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:bg-emerald-100/70"
                }`}
              >
                <span className={`text-[11px] font-bold block ${reportFilter === "voted" ? "text-emerald-100" : "text-emerald-800"}`}>
                  ✓ فتح الرابط وصوّت فعلياً
                </span>
                <span className="text-xl font-black mt-0.5 block">{deliveryStats.totalVoted}</span>
              </button>

              <button
                type="button"
                onClick={() => setReportFilter("viewed_only")}
                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                  reportFilter === "viewed_only"
                    ? "bg-amber-600 text-white border-amber-700 shadow-sm"
                    : "bg-amber-50/80 text-amber-950 border-amber-200 hover:bg-amber-100/70"
                }`}
              >
                <span className={`text-[11px] font-bold block ${reportFilter === "viewed_only" ? "text-amber-100" : "text-amber-800"}`}>
                  👁 شاهد فقط (فتح ولم يصوت)
                </span>
                <span className="text-xl font-black mt-0.5 block">{deliveryStats.viewedOnly}</span>
              </button>

              <button
                type="button"
                onClick={() => setReportFilter("not_opened")}
                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                  reportFilter === "not_opened"
                    ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className={`text-[11px] font-bold block ${reportFilter === "not_opened" ? "text-slate-200" : "text-slate-500"}`}>
                  لم يفتح الرابط بعد
                </span>
                <span className="text-xl font-black mt-0.5 block">{deliveryStats.notOpened}</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تصفية حسب حالة التفاعل:</label>
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
                >
                  <option value="all_sent">جميع من تم إرسال الرابط لهم ({deliveryStats.totalSent})</option>
                  <option value="voted">من فتح الرابط وصوّت فعلياً ({deliveryStats.totalVoted})</option>
                  <option value="viewed_only">من شاهد فقط دون تصويت ({deliveryStats.viewedOnly})</option>
                  <option value="not_opened">من لم يفتح الرابط بعد ({deliveryStats.notOpened})</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">الصف الدراسي:</label>
                <select
                  value={reportGradeFilter}
                  onChange={(e) => setReportGradeFilter(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
                >
                  <option value="all">جميع الصفوف</option>
                  {uniqueGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث بالاسم أو الجوال أو الرمز:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="ابحث عن طالب أو جوال ولي الأمر..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Report Table */}
            {filteredReportRecords.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-black text-slate-800">لا توجد سجلات مطابقة في التقرير حالياً</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  عند قيامك بإرسال روابط التصويت لأولياء الأمور من تبويب "إرسال رابط التصويت لأولياء الأمور عبر واتساب"، سيظهر هنا فوراً بيان رسمي يثبت الإرسال ويوضح من فتح الرابط ومن صوت ومن شاهد فقط.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black">
                      <th className="p-3 border-l border-slate-700 text-center w-10">م</th>
                      <th className="p-3 border-l border-slate-700">اسم الطالب وولي الأمر</th>
                      <th className="p-3 border-l border-slate-700 text-center">الصف / الفصل</th>
                      <th className="p-3 border-l border-slate-700 text-center">جوال ولي الأمر</th>
                      <th className="p-3 border-l border-slate-700 text-center">رمز التفعيل المرسل</th>
                      <th className="p-3 border-l border-slate-700 text-center">تاريخ ووقت الإرسال</th>
                      <th className="p-3 border-l border-slate-700 text-center">حالة فتح الرابط</th>
                      <th className="p-3 text-center">حالة التصويت / التفاعل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredReportRecords.map((rec, idx) => (
                      <tr key={rec.studentId} className="hover:bg-slate-50">
                        <td className="p-3 border-l border-slate-100 text-center font-mono font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-3 border-l border-slate-100 font-black text-slate-900">
                          {rec.studentName}
                        </td>
                        <td className="p-3 border-l border-slate-100 text-center text-slate-700 font-bold">
                          {rec.studentGrade} {rec.studentClass && rec.studentClass !== "—" ? `/ ${rec.studentClass}` : ""}
                        </td>
                        <td className="p-3 border-l border-slate-100 text-center font-mono font-bold text-slate-800" dir="ltr">
                          {rec.guardianPhone || "—"}
                        </td>
                        <td className="p-3 border-l border-slate-100 text-center font-mono font-black text-teal-800">
                          {rec.code || "—"}
                        </td>
                        <td className="p-3 border-l border-slate-100 text-center text-[11px] text-slate-600">
                          {rec.voteSentAt
                            ? new Date(rec.voteSentAt).toLocaleString("ar-SA", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "تم الإرسال"}
                        </td>
                        <td className="p-3 border-l border-slate-100 text-center">
                          {rec.isVoteLinkOpened ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                              <Eye className="w-3 h-3" />
                              <span>تم فتح الرابط</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              <Clock className="w-3 h-3" />
                              <span>لم يفتح بعد</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {rec.statusType === "voted" ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>قام بالتصويت ✓</span>
                            </span>
                          ) : rec.statusType === "viewed_only" ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              <Eye className="w-3.5 h-3.5 text-amber-700" />
                              <span>شاهد فقط (فتح ولم يصوت)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span>أُرسل له ولم يفتح الرابط</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SETTINGS & CONFIG */}
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
          onClose={() => {
            setIsCampaignModalOpen(false);
            if (onRefreshData) onRefreshData().catch(() => {});
          }}
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
                // Record official voting link delivery in database
                await fetch("/api/parent-councils/vote/mark-sent", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    studentIds: [String(item.id)],
                    method: "whatsapp_bot",
                    recipients: [
                      {
                        id: String(item.id),
                        name: item.name,
                        phone: sPhone,
                        grade: item.grade,
                        className: item.className,
                        token: item.token,
                        code: item.code,
                      },
                    ],
                  }),
                }).catch(() => {});
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
