import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Award,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowUpDown,
  Printer,
  Share2,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Send,
  FileCheck2,
  Eye,
  Trash2,
  RotateCcw,
  Check,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  UserX,
  FileText,
  School,
  Settings,
  HelpCircle,
  Save,
  PenLine,
  CheckSquare,
  Square,
  ClipboardCheck,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  ParentCouncilApplication,
  ParentCouncilConfig,
  ParentCouncilInvite,
  evaluateParentCouncilApplication,
} from "../../types";
import { SchoolSignatories, Student } from "../../types";
import {
  ParentCouncilPrintSheet,
  CouncilFormationPrintSheet,
  SentMessagesReportPrintSheet,
} from "./ParentCouncilPrintSheets";
import ParentCouncilStudentInvites from "./ParentCouncilStudentInvites";
import ParentCouncilSentMessagesLog from "./ParentCouncilSentMessagesLog";

interface ParentCouncilDashboardProps {
  students: Student[];
  schoolSignatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onNavigateToWhatsApp?: () => void;
  onNavigateToMessages?: (tab?: string) => void;
  onOpenSignatoriesModal?: () => void;
}

export default function ParentCouncilDashboard({
  students,
  schoolSignatories,
  isWhatsAppConnected,
  onNavigateToWhatsApp,
  onNavigateToMessages,
  onOpenSignatoriesModal,
}: ParentCouncilDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    "smart_screening" | "approved_council" | "all_applications" | "links_and_wa" | "sent_invites"
  >("smart_screening");

  // Main state
  const [applications, setApplications] = useState<Record<string, ParentCouncilApplication>>({});
  const [invites, setInvites] = useState<Record<string, any>>({});
  const [config, setConfig] = useState<ParentCouncilConfig>({
    academicYear: "1447 - 1448 هـ",
    councilTerm: "العام الدراسي 2026 - 2027",
    generalActivationCode: "202601",
    seatsCount: 9,
    reserveSeatsCount: 4,
    formationApproved: false,
    selectedMemberIds: [],
    reserveMemberIds: [],
  });
  const [loading, setLoading] = useState(true);
  const [isRealtimeRefreshing, setIsRealtimeRefreshing] = useState(false);

  // Seat configuration editing state
  const [seatsCountInput, setSeatsCountInput] = useState<number>(9);
  const [reserveSeatsCountInput, setReserveSeatsCountInput] = useState<number>(4);
  const [activationCodeInput, setActivationCodeInput] = useState<string>("202601");
  const [isSavingSeats, setIsSavingSeats] = useState(false);
  const [seatsSavedSuccess, setSeatsSavedSuccess] = useState(false);

  // Sync inputs when config is loaded or updated
  useEffect(() => {
    if (config.seatsCount !== undefined) {
      setSeatsCountInput(config.seatsCount);
    }
    if (config.reserveSeatsCount !== undefined) {
      setReserveSeatsCountInput(config.reserveSeatsCount);
    }
    if (config.generalActivationCode !== undefined) {
      setActivationCodeInput(config.generalActivationCode);
    }
  }, [config.seatsCount, config.reserveSeatsCount, config.generalActivationCode]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "eligible" | "disqualified" | "selected">("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  // Modals & Preview Sheets
  const [selectedAppForPrint, setSelectedAppForPrint] = useState<ParentCouncilApplication | null>(null);
  const [showFormationPrint, setShowFormationPrint] = useState(false);
  const [showSentReportPrint, setShowSentReportPrint] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState<string | null>(null); // holds candidate id to swap
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // WhatsApp Batch Invite
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState(
    `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب،\nانطلاقاً من حرص إدارة {المدرسة} على تعزيز الشراكة وتفعيل دور أولياء الأمور، يسرنا دعوتكم للترشح لعضوية "مجلس أولياء الأمور" للعام الدراسي الحالي.\n\nرابط الترشيح المباشر:\n{الرابط}\nرمز التفعيل: {الرمز}\n\nشاكرين ومقدرين كريم تعاونكم وتفاعلكم.\n- إدارة المدرسة ولجنة التوجيه الطلابي`
  );

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handler to explicitly save seats and general activation configuration
  const handleSaveSeats = async (customSeats?: number, customReserve?: number) => {
    const finalSeats = customSeats !== undefined ? customSeats : (Number(seatsCountInput) > 0 ? Number(seatsCountInput) : 9);
    const finalReserve = customReserve !== undefined ? customReserve : (Number(reserveSeatsCountInput) >= 0 ? Number(reserveSeatsCountInput) : 4);
    const finalCode = (activationCodeInput && activationCodeInput.trim()) || config.generalActivationCode || "202601";

    setIsSavingSeats(true);
    const updated: ParentCouncilConfig = {
      ...config,
      seatsCount: finalSeats,
      reserveSeatsCount: finalReserve,
      generalActivationCode: finalCode,
    };

    await syncUpdates(applications, updated);
    setIsSavingSeats(false);
    setSeatsSavedSuccess(true);
    showToast(`تم حفظ تحديد المقاعد بنجاح: ${finalSeats} مقاعد للمجلس، و ${finalReserve} مقاعد للاحتياط.`);
    setTimeout(() => setSeatsSavedSuccess(false), 3000);
  };

  // Real-time Fetcher for instantaneous updates across tabs
  const fetchLatestData = useCallback(async (silent = false) => {
    if (!silent) setIsRealtimeRefreshing(true);
    try {
      const res = await fetch("/api/parent-councils/data");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.applications) setApplications(data.applications);
          if (data.invites) setInvites(data.invites);
          if (data.config) {
            setConfig((prev) => ({
              ...prev,
              ...data.config,
              seatsCount: data.config.seatsCount === 7 ? 9 : (data.config.seatsCount ?? prev.seatsCount),
              reserveSeatsCount: data.config.reserveSeatsCount === 2 ? 4 : (data.config.reserveSeatsCount ?? prev.reserveSeatsCount),
            }));
          }
        }
      }
    } catch (e) {
      // Local storage fallback
      try {
        const savedApps = localStorage.getItem("parent_councils_apps");
        if (savedApps) setApplications(JSON.parse(savedApps));
        const savedInvites = localStorage.getItem("parent_councils_invites");
        if (savedInvites) setInvites(JSON.parse(savedInvites));
      } catch (err) {}
    } finally {
      if (!silent) setIsRealtimeRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Initial Load from Server or Local Storage + Real-time sync listeners
  useEffect(() => {
    fetchLatestData(false);

    // 1. Polling every 3.5 seconds for instant updates
    const pollInterval = setInterval(() => {
      fetchLatestData(true);
    }, 3500);

    // 2. BroadcastChannel for zero-latency cross-tab synchronization
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("parent_councils_channel");
      bc.onmessage = () => {
        fetchLatestData(true);
      };
    } catch (e) {}

    // 3. Window event listeners
    const handleEventSync = () => fetchLatestData(true);
    window.addEventListener("parent_councils_data_changed", handleEventSync);
    window.addEventListener("storage", handleEventSync);
    window.addEventListener("focus", handleEventSync);

    return () => {
      clearInterval(pollInterval);
      bc?.close();
      window.removeEventListener("parent_councils_data_changed", handleEventSync);
      window.removeEventListener("storage", handleEventSync);
      window.removeEventListener("focus", handleEventSync);
    };
  }, [fetchLatestData]);

  // Consolidated Sent Invites List & Count
  const sentList: ParentCouncilInvite[] = useMemo(() => {
    const list: ParentCouncilInvite[] = [];
    const seenIds = new Set<string>();

    Object.values(invites || {}).forEach((inv: any) => {
      if (inv && (inv.isSent || inv.sentAt)) {
        seenIds.add(inv.studentId);
        const matchedApp = inv.studentId ? applications[inv.studentId] : null;
        list.push({
          ...inv,
          isSubmitted: inv.isSubmitted || !!matchedApp,
          submittedAt: inv.submittedAt || matchedApp?.submittedAt,
          hasOpened: inv.hasOpened || !!matchedApp,
          applicationId: inv.applicationId || matchedApp?.id,
        });
      }
    });

    Object.values(applications || {}).forEach((app: ParentCouncilApplication) => {
      if (app.studentId && !seenIds.has(app.studentId)) {
        seenIds.add(app.studentId);
        list.push({
          studentId: app.studentId,
          studentName: app.studentName,
          studentGrade: app.studentGrade,
          studentClass: app.studentClass || "1",
          guardianPhone: app.phone,
          guardianName: app.fullName,
          code: app.activationCode || "202601",
          token: app.activationToken || `tok_${app.studentId}`,
          isSent: true,
          sentAt: app.submittedAt,
          hasOpened: true,
          openedAt: app.submittedAt,
          isSubmitted: true,
          submittedAt: app.submittedAt,
          applicationId: app.id,
        });
      }
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.sentAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.sentAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [invites, applications]);

  const sentCount = sentList.length;

  // Handler to update student invites across state, storage, and server
  const handleUpdateInvites = async (newInvites: Record<string, any>) => {
    setInvites(newInvites);
    try {
      localStorage.setItem("parent_councils_invites", JSON.stringify(newInvites));
      await fetch("/api/parent-councils/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invites: newInvites }),
      });
    } catch (e) {
      console.error("Error saving invites:", e);
    }
  };

  // Seed sample data based on actual students in the school
  const seedSampleApplications = () => {
    const samples: Record<string, ParentCouncilApplication> = {};

    const studentSample1 = students[0] || { name: "ابراهيم بن سلمان البلوي", grade: "الأول ثانوي", className: "1", id: "1", phone: "0501112233" };
    const studentSample2 = students[1] || { name: "احمد بن علاء ابو ذراع", grade: "الأول ثانوي", className: "1", id: "2", phone: "0502223344" };
    const studentSample3 = students[2] || { name: "راكان بن سعد الشهراني", grade: "الثاني ثانوي", className: "2", id: "3", phone: "0503334455" };
    const studentSample4 = students[3] || { name: "فيصل بن عبدالله الشهري", grade: "الثالث ثانوي", className: "1", id: "4", phone: "0504445566" };
    const studentSample5 = students[4] || { name: "خالد بن صالح الغامدي", grade: "الأول ثانوي", className: "2", id: "5", phone: "0505556677" };
    const studentSample6 = students[5] || { name: "عمر بن فهد الدوسري", grade: "الثاني ثانوي", className: "1", id: "6", phone: "0506667788" };

    // App 1: Excellent leadership profile
    const app1: ParentCouncilApplication = {
      id: "app_seed_1",
      activationCode: "202601",
      activationToken: "pc_seed_1",
      studentId: studentSample1.id,
      studentName: studentSample1.name || "ابراهيم بن سلمان البلوي",
      studentGrade: studentSample1.grade || "الأول ثانوي",
      studentClass: studentSample1.className || "1",
      fullName: "سلمان بن محمد بن سلمان البلوي",
      nationalId: "1087429103",
      phone: studentSample1.phone || "0501112233",
      email: "salman.m@example.com",
      skills: {
        organizationalManagement: true,
        organizationalDetails: "مدير مشاريع تنفيذي وإدارة فرق عمل لأكثر من 8 سنوات",
        volunteerExperience: true,
        volunteerDetails: "عضو مؤسس في جمعية رعاية الأيتام ومبادرات الأحياء",
        reportingAndDoc: true,
        reportingDetails: "إعداد التقارير الإحصائية وتوثيق المحاضر بجودة عالية",
        digitalPlatforms: true,
        digitalPlatformsDetails: "إتقان مدرستي، تيمز، وGoogle Workspace",
        previousCommittees: true,
        committeeDetails: "عضو مجلس مدرسة سابق ومقرر لجنة التوجيه لعام 1445هـ",
      },
      goals: [
        "تعزيز الشراكة الفاعلة والمستدامة بين أولياء الأمور وإدارة المدرسة والمعلمين.",
        "دعم المبادرات الطلابية والمشاريع العلمية والبرامج التوجيهية لرعاية الموهوبين.",
        "المساهمة في تطوير مرافق الأنشطة المدرسية وتهيئة البيئة المحفزة للإبداع.",
      ],
      compliance: {
        isParentOrStaff: true,
        commitmentToAttend: true,
        notMemberInOtherSchool: true,
        hasKidsInOtherSchoolsOnlyOneCouncil: true,
        goodConductAndNoLegalJudgments: true,
      },
      pledgeAccepted: true,
      signature: "سلمان بن محمد البلوي",
      submissionDateHijri: "1447/03/12هـ",
      submittedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
      status: "approved",
      assignedRole: "",
    };
    app1.smartEvaluation = evaluateParentCouncilApplication(app1);
    samples[app1.id] = app1;

    // App 2: Educational background
    const app2: ParentCouncilApplication = {
      id: "app_seed_2",
      activationCode: "202602",
      activationToken: "pc_seed_2",
      studentId: studentSample2.id,
      studentName: studentSample2.name || "احمد بن علاء ابو ذراع",
      studentGrade: studentSample2.grade || "الأول ثانوي",
      studentClass: studentSample2.className || "1",
      fullName: "علاء بن احمد بن صالح ابو ذراع",
      nationalId: "1054329871",
      phone: studentSample2.phone || "0502223344",
      email: "alaa.saleh@example.com",
      skills: {
        organizationalManagement: true,
        organizationalDetails: "رئيس قسم إداري في التعليم سابقاً",
        volunteerExperience: false,
        reportingAndDoc: true,
        reportingDetails: "صياغة محاضر الاجتماعات والقرارات التنفيذية",
        digitalPlatforms: true,
        digitalPlatformsDetails: "إتقان المنصات الوزارية والاجتماعات الافتراضية",
        previousCommittees: true,
        committeeDetails: "أمين سر مجلس أولياء أمور لمدة دورتين متتاليتين",
      },
      goals: [
        "متابعة شؤون انضباط الطلاب وتعزيز السلوك الإيجابي داخل البيئة المدرسية.",
        "تنسيق لقاءات دورية مثرية تجمع أولياء الأمور بالمعلمين لمناقشة المستويات التحصيلية.",
        "المشاركة في إعداد التقارير الفصلية لأعمال المجلس وإبراز التوصيات الميدانية.",
      ],
      compliance: {
        isParentOrStaff: true,
        commitmentToAttend: true,
        notMemberInOtherSchool: true,
        hasKidsInOtherSchoolsOnlyOneCouncil: true,
        goodConductAndNoLegalJudgments: true,
      },
      pledgeAccepted: true,
      signature: "علاء احمد ابو ذراع",
      submissionDateHijri: "1447/03/13هـ",
      submittedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      status: "approved",
      assignedRole: "",
    };
    app2.smartEvaluation = evaluateParentCouncilApplication(app2);
    samples[app2.id] = app2;

    // App 3: Active community member
    const app3: ParentCouncilApplication = {
      id: "app_seed_3",
      activationCode: "202603",
      activationToken: "pc_seed_3",
      studentId: studentSample3.id,
      studentName: studentSample3.name || "راكان بن سعد الشهراني",
      studentGrade: studentSample3.grade || "الثاني ثانوي",
      studentClass: studentSample3.className || "2",
      fullName: "سعد بن محمد الشهراني",
      nationalId: "1098765432",
      phone: studentSample3.phone || "0503334455",
      email: "saad.m@example.com",
      skills: {
        organizationalManagement: false,
        volunteerExperience: true,
        volunteerDetails: "منسق برامج مجتمعية ورعاية ذوي الإعاقة",
        reportingAndDoc: false,
        digitalPlatforms: true,
        digitalPlatformsDetails: "المنصات الرقمية وخدمات مايكروسوفت",
        previousCommittees: false,
      },
      goals: [
        "دعم الطلاب المحتاجين وتنسيق المساعدات التكافلية بالتعاون مع التوجيه الطلابي.",
        "تنظيم فعاليات ومسابقات مجتمعية تثري اليوم المدرسي.",
        "تمثيل أولياء أمور الصف الثاني ثانوي ونقل مقترحاتهم البناءة للمجلس.",
      ],
      compliance: {
        isParentOrStaff: true,
        commitmentToAttend: true,
        notMemberInOtherSchool: true,
        hasKidsInOtherSchoolsOnlyOneCouncil: true,
        goodConductAndNoLegalJudgments: true,
      },
      pledgeAccepted: true,
      signature: "سعد الشهراني",
      submissionDateHijri: "1447/03/14هـ",
      submittedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      status: "approved",
      assignedRole: "",
    };
    app3.smartEvaluation = evaluateParentCouncilApplication(app3);
    samples[app3.id] = app3;

    // App 4: Disqualified candidate (Violates Article 3 clause 3 - Duplicate membership in another school)
    const app4: ParentCouncilApplication = {
      id: "app_seed_4",
      activationCode: "202604",
      activationToken: "pc_seed_4",
      studentId: studentSample4.id,
      studentName: studentSample4.name || "فيصل بن عبدالله الشهري",
      studentGrade: studentSample4.grade || "الثالث ثانوي",
      studentClass: studentSample4.className || "1",
      fullName: "عبدالله بن فهد الشهري",
      nationalId: "1032165498",
      phone: studentSample4.phone || "0504445566",
      email: "abdullah.f@example.com",
      skills: {
        organizationalManagement: true,
        volunteerExperience: true,
        reportingAndDoc: true,
        digitalPlatforms: true,
        previousCommittees: true,
      },
      goals: [
        "تقديم استشارات للمدرسة.",
        "دعم الأنشطة المدرسية.",
        "المشاركة في الاجتماعات.",
      ],
      compliance: {
        isParentOrStaff: true,
        commitmentToAttend: true,
        notMemberInOtherSchool: false, // VIOLATION
        hasKidsInOtherSchoolsOnlyOneCouncil: false, // VIOLATION
        goodConductAndNoLegalJudgments: true,
      },
      pledgeAccepted: true,
      signature: "عبدالله الشهري",
      submissionDateHijri: "1447/03/14هـ",
      submittedAt: new Date(Date.now() - 3600000 * 15).toISOString(),
      status: "disqualified",
    };
    app4.smartEvaluation = evaluateParentCouncilApplication(app4);
    samples[app4.id] = app4;

    // App 5: Solid member candidate
    const app5: ParentCouncilApplication = {
      id: "app_seed_5",
      activationCode: "202605",
      activationToken: "pc_seed_5",
      studentId: studentSample5.id,
      studentName: studentSample5.name || "خالد بن صالح الغامدي",
      studentGrade: studentSample5.grade || "الأول ثانوي",
      studentClass: studentSample5.className || "2",
      fullName: "صالح بن علي الغامدي",
      nationalId: "1077665544",
      phone: studentSample5.phone || "0505556677",
      email: "saleh.ali@example.com",
      skills: {
        organizationalManagement: true,
        organizationalDetails: "تخطيط استراتيجي وإدارة جودة",
        volunteerExperience: true,
        volunteerDetails: "متطوع نشط في مبادرات التشجير وتجميل الأحياء",
        reportingAndDoc: true,
        reportingDetails: "تقارير ونماذج مؤشرات قياس أداء",
        digitalPlatforms: true,
        previousCommittees: false,
      },
      goals: [
        "تطبيق مبادرات تحسين جودة البيئة المدرسية والمرافق التعليمية.",
        "المساهمة بخبرات إدارة الجودة في تقييم فعاليات المجلس.",
        "تعزيز تكريم الطلاب المتميزين أكاديمياً وسلوكياً.",
      ],
      compliance: {
        isParentOrStaff: true,
        commitmentToAttend: true,
        notMemberInOtherSchool: true,
        hasKidsInOtherSchoolsOnlyOneCouncil: true,
        goodConductAndNoLegalJudgments: true,
      },
      pledgeAccepted: true,
      signature: "صالح الغامدي",
      submissionDateHijri: "1447/03/15هـ",
      submittedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      status: "approved",
      assignedRole: "",
    };
    app5.smartEvaluation = evaluateParentCouncilApplication(app5);
    samples[app5.id] = app5;

    // App 6: Reserve candidate
    const app6: ParentCouncilApplication = {
      id: "app_seed_6",
      activationCode: "202606",
      activationToken: "pc_seed_6",
      studentId: studentSample6.id,
      studentName: studentSample6.name || "عمر بن فهد الدوسري",
      studentGrade: studentSample6.grade || "الثاني ثانوي",
      studentClass: studentSample6.className || "1",
      fullName: "فهد بن مسفر الدوسري",
      nationalId: "1044332211",
      phone: studentSample6.phone || "0506667788",
      email: "fahad.m@example.com",
      skills: {
        organizationalManagement: false,
        volunteerExperience: true,
        volunteerDetails: "مشاركات تطوعية رياضية وثقافية",
        reportingAndDoc: false,
        digitalPlatforms: true,
        previousCommittees: false,
      },
      goals: [
        "تشجيع الأنشطة الرياضية والبطولات الطلابية.",
        "حضور اجتماعات المجلس والمشاركة بالرأي.",
        "دعم برامج التوجيه الطلابي.",
      ],
      compliance: {
        isParentOrStaff: true,
        commitmentToAttend: true,
        notMemberInOtherSchool: true,
        hasKidsInOtherSchoolsOnlyOneCouncil: true,
        goodConductAndNoLegalJudgments: true,
      },
      pledgeAccepted: true,
      signature: "فهد الدوسري",
      submissionDateHijri: "1447/03/15هـ",
      submittedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      status: "reserve",
      assignedRole: "عضو احتياط",
    };
    app6.smartEvaluation = evaluateParentCouncilApplication(app6);
    samples[app6.id] = app6;

    setApplications(samples);

    const initialConfig: ParentCouncilConfig = {
      academicYear: "1447 - 1448 هـ",
      councilTerm: "العام الدراسي 2026 - 2027",
      generalActivationCode: "202601",
      seatsCount: 9,
      reserveSeatsCount: 4,
      formationApproved: false,
      selectedMemberIds: [app1.id, app2.id, app3.id, app5.id],
      reserveMemberIds: [app6.id],
    };
    setConfig(initialConfig);

    localStorage.setItem("parent_councils_apps", JSON.stringify(samples));
    localStorage.setItem("parent_councils_config", JSON.stringify(initialConfig));

    // Save to server
    fetch("/api/parent-councils/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applications: samples, config: initialConfig }),
    }).catch(() => {});
  };

  // Sync / Save Updates
  const syncUpdates = async (newApps: Record<string, ParentCouncilApplication>, newConfig: ParentCouncilConfig) => {
    setApplications(newApps);
    setConfig(newConfig);
    localStorage.setItem("parent_councils_apps", JSON.stringify(newApps));
    localStorage.setItem("parent_councils_config", JSON.stringify(newConfig));

    try {
      await fetch("/api/parent-councils/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applications: newApps, config: newConfig }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // AI / Smart Sort Action: Sorts and Ranks applicants only without auto-selecting
  const handleRunSmartSort = () => {
    const appsList = Object.values(applications) as ParentCouncilApplication[];
    const updatedApps: Record<string, ParentCouncilApplication> = { ...applications };

    // 1. Re-evaluate all applications against criteria and Article 3
    appsList.forEach((app) => {
      const evalRes = evaluateParentCouncilApplication(app);
      updatedApps[app.id] = {
        ...app,
        smartEvaluation: evalRes,
        status: evalRes.isEligible ? (app.status === "disqualified" ? "submitted" : app.status) : "disqualified",
      };
    });

    // 2. Save evaluated applications (system sorts them by score for display)
    syncUpdates(updatedApps, config);
    showToast("تم فرز وترتيب المتقدمين بنجاح حسب معايير الاستحقاق. قم الآن بوضع علامة (✓) على من ترغب بترشيحه.");
  };

  // Action: Toggle Nomination Mark on Candidate (وضع علامة على من يتم ترشيحه)
  const handleToggleNomination = (appId: string) => {
    const isSelected = config.selectedMemberIds.includes(appId);
    if (isSelected) {
      // Unmark / remove from council
      const newSelected = config.selectedMemberIds.filter((id) => id !== appId);
      const updatedApps = { ...applications };
      if (updatedApps[appId]) {
        updatedApps[appId] = {
          ...updatedApps[appId],
          status: "submitted",
          assignedRole: "",
        };
      }
      syncUpdates(updatedApps, {
        ...config,
        selectedMemberIds: newSelected,
      });
      showToast(`تم إلغاء علامة الترشيح عن المرشح: ${applications[appId]?.fullName || ""}`);
    } else {
      // Mark / add to council
      const app = applications[appId];
      if (!app) return;
      const newSelected = [...config.selectedMemberIds, appId];
      const newReserve = config.reserveMemberIds.filter((id) => id !== appId);
      const updatedApps = { ...applications };
      updatedApps[appId] = {
        ...app,
        status: "approved",
        assignedRole: app.assignedRole || "",
      };
      syncUpdates(updatedApps, {
        ...config,
        selectedMemberIds: newSelected,
        reserveMemberIds: newReserve,
      });
      showToast(`تم وضع علامة الترشيح لـ (${app.fullName}) وإضافته إلى قائمة الاعتماد.`);
    }
  };

  // Helper: Quick-mark top N candidates based on smart rank
  const handleSelectTopCandidates = () => {
    const appsList = Object.values(applications) as ParentCouncilApplication[];
    const eligible = appsList
      .filter((a) => a.smartEvaluation?.isEligible && !a.isManuallyExcluded && a.status !== "disqualified")
      .sort((a, b) => {
        const scoreA = a.smartEvaluation?.overallScore || 0;
        const scoreB = b.smartEvaluation?.overallScore || 0;
        return scoreB - scoreA;
      });
    const topIds = eligible.slice(0, config.seatsCount).map((a) => a.id);
    const updatedApps = { ...applications };
    topIds.forEach((id) => {
      if (updatedApps[id]) {
        updatedApps[id].status = "approved";
        if (updatedApps[id].assignedRole === undefined) {
          updatedApps[id].assignedRole = "";
        }
      }
    });
    syncUpdates(updatedApps, {
      ...config,
      selectedMemberIds: topIds,
    });
    showToast(`تم وضع علامة الترشيح على أعلى ${topIds.length} مرشحين استحقاقاً في الترتيب.`);
  };

  // Action: Toggle Survey Closed / Open globally
  const handleToggleSurveyStatus = async () => {
    const newStatus = !config.isSurveyClosed;
    const newConfig: ParentCouncilConfig = {
      ...config,
      isSurveyClosed: newStatus,
    };
    await syncUpdates(applications, newConfig);
    if (newStatus) {
      showToast("تم إيقاف استقبال جميع الاستبيانات بنجاح. لن يتمكن أولياء الأمور من التقديم الآن.");
    } else {
      showToast("تم فتح استقبال الاستبيانات بنجاح. يمكن لأولياء الأمور الآن تعبئة الاستمارة.");
    }
  };

  // Action: Disqualify candidate manually (with reason)
  const handleExcludeCandidate = (appId: string) => {
    const app = applications[appId];
    if (!app) return;

    const newApps = { ...applications };
    newApps[appId] = {
      ...app,
      status: "disqualified",
      isManuallyExcluded: true,
      assignedRole: undefined,
    };

    const newSelected = config.selectedMemberIds.filter((id) => id !== appId);
    const newReserve = config.reserveMemberIds.filter((id) => id !== appId);

    syncUpdates(newApps, {
      ...config,
      selectedMemberIds: newSelected,
      reserveMemberIds: newReserve,
    });

    showToast(`تم استبعاد المرشح: ${app.fullName} من تشكيل المجلس`);
  };

  // Action: Add/Select candidate into council
  const handleSelectCandidate = (appId: string, role?: any) => {
    const app = applications[appId];
    if (!app) return;

    const newApps = { ...applications };
    newApps[appId] = {
      ...app,
      status: "approved",
      assignedRole: role !== undefined ? role : (app.assignedRole || ""),
      isManuallySelected: true,
      isManuallyExcluded: false,
    };

    const newSelected = Array.from(new Set([...config.selectedMemberIds, appId]));
    const newReserve = config.reserveMemberIds.filter((id) => id !== appId);

    syncUpdates(newApps, {
      ...config,
      selectedMemberIds: newSelected,
      reserveMemberIds: newReserve,
    });

    showToast(`تمت إضافة المرشح: ${app.fullName} إلى المجلس الأساسي`);
  };

  // Action: Move candidate to Reserve
  const handleMoveToReserve = (appId: string) => {
    const app = applications[appId];
    if (!app) return;

    const newApps = { ...applications };
    newApps[appId] = {
      ...app,
      status: "reserve",
      assignedRole: "عضو احتياط",
    };

    const newSelected = config.selectedMemberIds.filter((id) => id !== appId);
    const newReserve = Array.from(new Set([...config.reserveMemberIds, appId]));

    syncUpdates(newApps, {
      ...config,
      selectedMemberIds: newSelected,
      reserveMemberIds: newReserve,
    });

    showToast(`تم نقل المرشح: ${app.fullName} إلى قائمة الاحتياط`);
  };

  // Action: Swap candidate with another
  const handleSwapCandidates = (currentId: string, targetId: string) => {
    const currentApp = applications[currentId];
    const targetApp = applications[targetId];
    if (!currentApp || !targetApp) return;

    const newApps = { ...applications };
    const oldRole = currentApp.assignedRole || "عضو مجلس";

    newApps[currentId] = {
      ...currentApp,
      status: "reserve",
      assignedRole: "عضو احتياط",
    };

    newApps[targetId] = {
      ...targetApp,
      status: "approved",
      assignedRole: oldRole,
    };

    const newSelected = config.selectedMemberIds.map((id) => (id === currentId ? targetId : id));
    const newReserve = config.reserveMemberIds.map((id) => (id === targetId ? currentId : id));

    syncUpdates(newApps, {
      ...config,
      selectedMemberIds: newSelected,
      reserveMemberIds: newReserve,
    });

    setShowSwapModal(null);
    showToast(`تم استبدال (${currentApp.fullName}) بالمرشح (${targetApp.fullName}) بنجاح`);
  };

  // Action: Manually update role of candidate
  const handleUpdateRole = (appId: string, role: string) => {
    const app = applications[appId];
    if (!app) return;

    const newApps = {
      ...applications,
      [appId]: {
        ...app,
        assignedRole: role,
      },
    };

    syncUpdates(newApps, config);
  };

  // Action: Approve Council Formation officially
  const handleApproveFormation = () => {
    if (config.selectedMemberIds.length === 0) {
      showToast("تنبيه: يجب وضع علامة على عضو واحد على الأقل في قائمة الاعتماد لاعتماد تشكيل المجلس.");
      return;
    }

    const newConfig: ParentCouncilConfig = {
      ...config,
      formationApproved: true,
      formationApprovedAt: new Date().toISOString(),
    };

    syncUpdates(applications, newConfig);
    showToast("تم اعتماد تشكيل مجلس أولياء الأمور رسمياً، وجاهز للطباعة والرفع للإدارة التعليمية.");
  };

  // Public portal link generator
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicPortalUrl = `${origin}?parent_council=true&code=${config.generalActivationCode}`;

  const copyPortalLink = () => {
    navigator.clipboard.writeText(publicPortalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    showToast("تم نسخ رابط بوابة ترشيح مجلس أولياء الأمور بنجاح");
  };

  // Filtered applications list
  const appsList = Object.values(applications) as ParentCouncilApplication[];
  const eligibleApps = appsList.filter((a) => a.smartEvaluation?.isEligible);
  const disqualifiedApps = appsList.filter((a) => !a.smartEvaluation?.isEligible || a.status === "disqualified");
  const selectedApps = config.selectedMemberIds.map((id) => applications[id]).filter(Boolean);
  const reserveApps = config.reserveMemberIds.map((id) => applications[id]).filter(Boolean);

  const sortedEligibleApps = useMemo(() => {
    return [...eligibleApps].sort(
      (a, b) => (b.smartEvaluation?.overallScore || 0) - (a.smartEvaluation?.overallScore || 0)
    );
  }, [eligibleApps]);

  const filteredApplications = appsList.filter((app) => {
    const matchesSearch =
      !searchQuery ||
      app.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.phone.includes(searchQuery) ||
      app.nationalId.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "eligible" && app.smartEvaluation?.isEligible) ||
      (statusFilter === "disqualified" && (!app.smartEvaluation?.isEligible || app.status === "disqualified")) ||
      (statusFilter === "selected" && config.selectedMemberIds.includes(app.id));

    const matchesGrade = gradeFilter === "all" || app.studentGrade.includes(gradeFilter);

    return matchesSearch && matchesStatus && matchesGrade;
  });

  // Modal Views
  if (selectedAppForPrint) {
    return (
      <ParentCouncilPrintSheet
        application={selectedAppForPrint}
        signatories={schoolSignatories}
        onClose={() => setSelectedAppForPrint(null)}
      />
    );
  }

  if (showFormationPrint) {
    return (
      <CouncilFormationPrintSheet
        config={config}
        applications={applications}
        signatories={schoolSignatories}
        onClose={() => setShowFormationPrint(false)}
        onUpdateRole={handleUpdateRole}
      />
    );
  }

  return (
    <div className="space-y-6" dir="rtl" id="parent-councils-main-view">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Primary Section Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-md shrink-0">
              <Users className="w-7 h-7 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">
                  مجالس أولياء الأمور في التعليم العام
                </h1>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  إصدار رسمي معتمد
                </span>
                {config.formationApproved && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    المجلس معتمد
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                إدارة طلبات الترشيح، الفرز الآلي واستبعاد من لا تنطبق عليه الشروط، وتوليد استمارات المجلس الرسمية لـ{" "}
                <span className="font-bold text-slate-700">{schoolSignatories.schoolName || "المدرسة"}</span>
              </p>
            </div>
          </div>

          {/* Quick Header Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            
            <button
              type="button"
              onClick={copyPortalLink}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
              title="نسخ رابط التقديم لولي الأمر"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copiedLink ? "تم نسخ الرابط" : "نسخ رابط الترشيح"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFormationPrint(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-extrabold text-xs transition-colors cursor-pointer border border-teal-200 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-teal-700" />
              <span>محضر التشكيل والاعتماد</span>
            </button>

            {onOpenSignatoriesModal && (
              <button
                type="button"
                onClick={onOpenSignatoriesModal}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 cursor-pointer"
                title="تعديل بيانات المدرسة والمدير والتوجيه الطلابي"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>المعتمدون</span>
              </button>
            )}

          </div>

        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[11px] font-bold text-slate-500">إجمالي طلبات الترشيح</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{appsList.length}</div>
            <div className="text-[10px] text-slate-400 mt-1">استمارة ترشيح مسجلة</div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80">
            <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>المطابقون للشروط</span>
            </div>
            <div className="text-xl font-black text-emerald-900 mt-0.5 font-mono">{eligibleApps.length}</div>
            <div className="text-[10px] text-emerald-700 mt-1">استوفوا المادة (الثالثة)</div>
          </div>

          <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80">
            <div className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
              <UserX className="w-3.5 h-3.5 text-rose-600" />
              <span>المستبعدون نظامياً</span>
            </div>
            <div className="text-xl font-black text-rose-900 mt-0.5 font-mono">{disqualifiedApps.length}</div>
            <div className="text-[10px] text-rose-700 mt-1">بموجب ضوابط المادة (3)</div>
          </div>

          <div className="p-3.5 bg-teal-50 rounded-2xl border border-teal-200/80">
            <div className="text-[11px] font-bold text-teal-800 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-teal-600" />
              <span>المعتمدون في المجلس</span>
            </div>
            <div className="text-xl font-black text-teal-900 mt-0.5 font-mono">
              {config.selectedMemberIds.length} <span className="text-xs font-normal text-teal-700">/ {config.seatsCount}</span>
            </div>
            <div className="text-[10px] text-teal-700 mt-1">+{config.reserveMemberIds.length} احتياط</div>
          </div>

        </div>

      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab("smart_screening")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "smart_screening"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>فرز وترتيب المتقدمين الذكي</span>
          <span className="text-[10px] bg-teal-900/40 text-teal-100 px-2 py-0.5 rounded-full font-mono">
            {eligibleApps.length} مؤهلين
          </span>
        </button>

        <button
          onClick={() => setActiveTab("approved_council")}
          id="tab-approved-council"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "approved_council"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Award className="w-4 h-4 text-amber-300" />
          <span>قائمة الاعتماد واعتماد المجلس</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
            activeTab === "approved_council" ? "bg-teal-900/40 text-teal-100" : "bg-emerald-100 text-emerald-800"
          }`}>
            {config.selectedMemberIds.length} / {config.seatsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("all_applications")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "all_applications"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>كافة الاستمارات والطلبات ({appsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("links_and_wa")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "links_and_wa"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Share2 className="w-4 h-4 text-emerald-500" />
          <span>تحديد الطلاب وإرسال دعوات الترشح عبر واتساب</span>
        </button>

        <button
          onClick={() => setActiveTab("sent_invites")}
          id="tab-sent-invites"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "sent_invites"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Send className="w-4 h-4 text-emerald-400" />
          <span>الدعوات والرسائل المرسلة</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
            activeTab === "sent_invites" ? "bg-teal-900/40 text-teal-100" : "bg-emerald-100 text-emerald-800"
          }`}>
            {sentCount}
          </span>
        </button>
      </div>

      {/* TAB 1: نظام فرز وترشيح المجلس */}
      {activeTab === "smart_screening" && (
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="bg-linear-to-r from-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h2 className="text-base font-black">نظام فرز وترتيب المتقدمين الذكي</h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                يقوم النظام بترتيب المتقدمين فقط وفق معايير الاستحقاق والكفاءة وضوابط المادة (الثالثة). بعد الفرز والترتيب، يضع مدير النظام علامة (✓) على من يتم ترشيحه لتتكون قائمة الاعتماد في القسم المستقل.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                type="button"
                onClick={handleRunSmartSort}
                id="btn-run-smart-sort"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-md"
                title="ترتيب المتقدمين فقط بناءً على نقاط التقييم والاستحقاق"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>تشغيل فرز وترتيب المتقدمين ذكياً</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("approved_council")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-md"
              >
                <ClipboardCheck className="w-4 h-4 text-emerald-200" />
                <span>قائمة الاعتماد ({config.selectedMemberIds.length}) ←</span>
              </button>
            </div>
          </div>

          {/* Seats Configuration Card with Save button */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    تحديد عدد أفراد المجلس والاحتياط
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    حدد العدد المطلوب لمقاعد المجلس ومقاعد الاحتياط ثم اضغط زر الحفظ لاعتمادها في الفرز الآلي
                  </p>
                </div>
              </div>

              {/* Inputs & Save button */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <label htmlFor="tab1-seats-count" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    عدد مقاعد المجلس:
                  </label>
                  <input
                    id="tab1-seats-count"
                    type="number"
                    min={1}
                    max={25}
                    value={seatsCountInput}
                    onChange={(e) => setSeatsCountInput(Number(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold font-mono text-sm text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500 font-bold">مقاعد</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <label htmlFor="tab1-reserve-seats-count" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    عدد مقاعد الاحتياط:
                  </label>
                  <input
                    id="tab1-reserve-seats-count"
                    type="number"
                    min={0}
                    max={15}
                    value={reserveSeatsCountInput}
                    onChange={(e) => setReserveSeatsCountInput(Number(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold font-mono text-sm text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500 font-bold">مقاعد</span>
                </div>

                <button
                  id="btn-save-seats-tab1"
                  type="button"
                  onClick={() => handleSaveSeats()}
                  disabled={isSavingSeats}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer active:scale-95 ${
                    seatsSavedSuccess
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-teal-700 hover:bg-teal-800"
                  }`}
                >
                  {seatsSavedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>تم حفظ التحديد</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-white" />
                      <span>{isSavingSeats ? "جارٍ الحفظ..." : "حفظ التحديد"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: نتائج الفرز الذكي وترتيب المتقدمين المؤهلين */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>نتائج الفرز الذكي وترتيب المتقدمين المؤهلين ({sortedEligibleApps.length} متقدماً)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تم ترتيب المتقدمين تنازلياً وفق معايير المفاضلة ونقاط التقييم. ضع علامة (✓) على من ترغب بترشيحه لتتكون قائمة الاعتماد في القسم المستقل.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-teal-900 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-200">
                  المحدد للترشيح: {config.selectedMemberIds.length} من {config.seatsCount} مقاعد
                </span>

                <button
                  type="button"
                  onClick={handleSelectTopCandidates}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition-colors cursor-pointer"
                  title={`تحديد أعلى ${config.seatsCount} في الترتيب كمرشحين تلقائياً`}
                >
                  <CheckSquare className="w-3.5 h-3.5 text-amber-700" />
                  <span>تحديد أعلى {config.seatsCount} تلقائياً</span>
                </button>
              </div>
            </div>

            {sortedEligibleApps.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                لا يوجد متقدمون مؤهلون حتى الآن. اضغط على "تشغيل فرز وترتيب المتقدمين ذكياً" للبدء بعد استلام الاستمارات.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedEligibleApps.map((app, index) => {
                  const isNominated = config.selectedMemberIds.includes(app.id);
                  const isReserve = config.reserveMemberIds.includes(app.id);
                  const isTopSeat = index < config.seatsCount;

                  return (
                    <div
                      key={app.id}
                      className={`py-4 px-3 sm:px-4 rounded-2xl transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                        isNominated
                          ? "bg-teal-50/60 border border-teal-200/80 shadow-2xs"
                          : isReserve
                          ? "bg-amber-50/50 border border-amber-200/60"
                          : "hover:bg-slate-50/70 border border-transparent"
                      }`}
                    >
                      {/* Member Info */}
                      <div className="flex items-start gap-3 w-full lg:w-auto">
                        <div
                          className={`w-9 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-xs ${
                            isTopSeat
                              ? "bg-amber-500 text-slate-950 ring-2 ring-amber-300"
                              : "bg-slate-800 text-white"
                          }`}
                          title={`الترتيب الاستحقاقي: المركز ${index + 1}`}
                        >
                          #{index + 1}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-slate-900">{app.fullName}</span>
                            
                            {isNominated && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-teal-700 text-white flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-300" />
                                مرشح بالقائمة
                              </span>
                            )}

                            {isReserve && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                احتياط
                              </span>
                            )}

                            <span className="text-xs text-slate-600">
                              (طالب: {app.studentName} - {app.studentGrade}) • جوال: <span dir="ltr">{app.phone}</span>
                            </span>
                          </div>

                          {/* Verified skills badges */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {app.skills.organizationalManagement && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                                تنظيم وإدارة ✓
                              </span>
                            )}
                            {app.skills.volunteerExperience && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                                عمل تطوعي ✓
                              </span>
                            )}
                            {app.skills.reportingAndDoc && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-800 rounded border border-purple-200">
                                توثيق وتقارير ✓
                              </span>
                            )}
                            {app.skills.digitalPlatforms && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-900 rounded border border-amber-200">
                                منصات رقمية ✓
                              </span>
                            )}
                            {app.skills.previousCommittees && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded border border-indigo-200">
                                لجان سابقة ✓
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score & Actions */}
                      <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-2.5 lg:pt-0 border-slate-100">
                        {/* Smart score badge */}
                        <div className="text-center px-3 py-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
                          <div className="text-[10px] font-bold text-slate-500">درجة التقييم</div>
                          <div className="text-sm font-black font-mono text-teal-800">
                            {app.smartEvaluation?.overallScore || 85}%
                          </div>
                        </div>

                        {/* Nomination Checkbox / Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleNomination(app.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 ${
                            isNominated
                              ? "bg-teal-700 text-white ring-2 ring-teal-400"
                              : "bg-white hover:bg-teal-50 text-slate-800 border-2 border-slate-300 hover:border-teal-600"
                          }`}
                        >
                          {isNominated ? (
                            <>
                              <CheckSquare className="w-4 h-4 text-emerald-300" />
                              <span>✓ تم ترشيحه للمجلس</span>
                            </>
                          ) : (
                            <>
                              <Square className="w-4 h-4 text-slate-400" />
                              <span>وضع علامة ترشيح</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveToReserve(app.id)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                            isReserve
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                          }`}
                          title="ترشيح للاحتياط"
                        >
                          احتياط
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedAppForPrint(app)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                          title="معاينة الاستمارة الرسمية A4"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: المستبعدون نظامياً بموجب المادة (الثالثة) */}
          <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 border-b border-rose-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-rose-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <span>المستبعدون نظامياً بموجب المادة (الثالثة) لضوابط العضوية ({disqualifiedApps.length})</span>
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  تم استبعادهم تلقائياً لعدم استيفاء الشروط والضوابط المنصوص عليها في لائحة مجالس أولياء الأمور
                </p>
              </div>
            </div>

            {disqualifiedApps.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-bold">
                لا يوجد مرشحون مستبعدون حالياً، جميع المتقدمين استوفوا الضوابط النظامية.
              </div>
            ) : (
              <div className="space-y-3">
                {disqualifiedApps.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs sm:text-sm text-rose-950">{app.fullName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          مستبعد نظامياً
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        الطالب: {app.studentName} ({app.studentGrade}) • جوال: <span dir="ltr">{app.phone}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {(app.smartEvaluation?.disqualificationReasons || ["لم يستوفِ شروط المادة (3)"]).map((reason, rIdx) => (
                          <div key={rIdx} className="text-[11px] font-bold text-rose-700 flex items-start gap-1.5">
                            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setSelectedAppForPrint(app)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-900 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                      >
                        معاينة الاستمارة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(app.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold cursor-pointer"
                        title="إعادة قبول المرشح استثنائياً"
                      >
                        إعادة قبول استثنائي
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB: قائمة الاعتماد واعتماد المجلس (قسم مستقل) */}
      {activeTab === "approved_council" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-linear-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-300" />
                <h2 className="text-lg font-black">قائمة الاعتماد النهائي لتشكيل مجلس أولياء الأمور</h2>
              </div>
              <p className="text-xs text-slate-200 mt-1.5 max-w-2xl leading-relaxed">
                يضم هذا القسم المستقل المرشحين الذين قام مدير النظام بوضع علامة الترشيح عليهم من نتائج الفرز الذكي. يمكنك هنا إدخال الصفة في المجلس يدوياً لكل مرشح أو تركها فارغة، ثم استعراض وطباعة محضر الاعتماد النهائي.
              </p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-800/80 text-teal-100 border border-teal-600">
                  المقاعد المعتمدة: {selectedApps.length} من {config.seatsCount}
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40">
                  الأعضاء الاحتياط: {reserveApps.length}
                </span>
                {config.formationApproved && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    المجلس معتمد رسمياً
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setShowFormationPrint(true)}
                id="btn-print-approved-council"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-md"
                title="معاينة وطباعة محضر تشكيل واعتماد المجلس النهائي A4"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>طباعة محضر الاعتماد النهائي A4</span>
              </button>

              <button
                type="button"
                onClick={handleApproveFormation}
                disabled={config.formationApproved}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-md ${
                  config.formationApproved ? "bg-emerald-600 cursor-default" : "bg-teal-600 hover:bg-teal-500"
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{config.formationApproved ? "تم اعتماد التشكيل رسمياً" : "اعتماد تشكيل المجلس رسمياً"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("smart_screening")}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>العودة لفرز المتقدمين</span>
              </button>
            </div>
          </div>

          {/* Members List Section */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-teal-700" />
                  <span>الأعضاء المعتمدون في المجلس الأساسي ({selectedApps.length} من {config.seatsCount} مقاعد)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تم وضع علامة الترشيح عليهم. أدخل الصفة لكل عضو يدوياً أو اتركها فارغة، ثم اطبع المحضر النهائي.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormationPrint(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-extrabold text-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-700" />
                  <span>معاينة الطباعة A4</span>
                </button>
              </div>
            </div>

            {selectedApps.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h4 className="font-extrabold text-sm text-slate-800">لا توجد أسماء في قائمة الاعتماد بعد</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  قم بالدخول إلى قسم "فرز وترتيب المتقدمين الذكي"، ثم ضع علامة (✓) على المرشحين المطلوب اعتمادهم لتظهر أسماؤهم هنا تلقائياً.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("smart_screening")}
                  className="mt-4 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs cursor-pointer shadow-xs"
                >
                  الذهاب إلى فرز وترتيب المتقدمين الذكي ←
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedApps.map((app, index) => (
                  <div
                    key={app.id}
                    className="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/70 p-3.5 rounded-2xl transition-colors border border-transparent hover:border-slate-200"
                  >
                    {/* Member Info */}
                    <div className="flex items-start gap-3 w-full lg:w-auto">
                      <div className="w-9 h-9 rounded-xl bg-teal-700 text-white font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">{app.fullName}</span>
                          {app.assignedRole ? (
                            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-teal-100 text-teal-950 border border-teal-300">
                              الصفة: {app.assignedRole}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-300">
                              (الصفة متروكة فارغة)
                            </span>
                          )}
                          <span className="text-xs text-slate-600">
                            (طالب: {app.studentName} - {app.studentGrade}) • جوال: <span dir="ltr">{app.phone}</span>
                          </span>
                        </div>

                        {/* Manual Role Selector / Input */}
                        <div className="flex items-center gap-2 flex-wrap mt-2.5 pt-2 border-t border-slate-100">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <PenLine className="w-3.5 h-3.5 text-teal-700" />
                            <span>الصفة في المجلس (إدخال يدوي):</span>
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              type="text"
                              value={app.assignedRole || ""}
                              onChange={(e) => handleUpdateRole(app.id, e.target.value)}
                              placeholder="اكتب الصفة يدوياً أو اتركها فارغة..."
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                app.assignedRole
                                  ? "bg-teal-50/70 border-teal-300 text-teal-950 font-black"
                                  : "bg-slate-50 border-slate-300 text-slate-800 placeholder:text-slate-400"
                              } focus:ring-2 focus:ring-teal-600 focus:outline-hidden w-44 sm:w-56`}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateRole(app.id, "نائب الرئيس")}
                              className={`text-[10px] px-2.5 py-1 rounded-md font-bold cursor-pointer transition-colors border ${
                                app.assignedRole === "نائب الرئيس"
                                  ? "bg-teal-700 text-white border-teal-800 shadow-xs"
                                  : "bg-slate-100 hover:bg-teal-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              نائب الرئيس
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateRole(app.id, "أمين السر")}
                              className={`text-[10px] px-2.5 py-1 rounded-md font-bold cursor-pointer transition-colors border ${
                                app.assignedRole === "أمين السر"
                                  ? "bg-teal-700 text-white border-teal-800 shadow-xs"
                                  : "bg-slate-100 hover:bg-teal-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              أمين السر
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateRole(app.id, "عضو مجلس")}
                              className={`text-[10px] px-2.5 py-1 rounded-md font-bold cursor-pointer transition-colors border ${
                                app.assignedRole === "عضو مجلس"
                                  ? "bg-teal-700 text-white border-teal-800 shadow-xs"
                                  : "bg-slate-100 hover:bg-teal-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              عضو مجلس
                            </button>
                            {app.assignedRole && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(app.id, "")}
                                className="text-[10px] px-2 py-1 rounded-md font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 cursor-pointer"
                                title="مسح وترك الصفة فارغة"
                              >
                                مسح (فارغة)
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Verified skills badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {app.skills.organizationalManagement && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                              تنظيم وإدارة ✓
                            </span>
                          )}
                          {app.skills.volunteerExperience && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                              عمل تطوعي ✓
                            </span>
                          )}
                          {app.skills.reportingAndDoc && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-800 rounded border border-purple-200">
                              توثيق وتقارير ✓
                            </span>
                          )}
                          {app.skills.digitalPlatforms && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-900 rounded border border-amber-200">
                              منصات رقمية ✓
                            </span>
                          )}
                          {app.skills.previousCommittees && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded border border-indigo-200">
                              لجان سابقة ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedAppForPrint(app)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                        title="معاينة وطباعة الاستمارة الرسمية A4"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveToReserve(app.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                        title="نقله إلى قائمة الأعضاء الاحتياط"
                      >
                        تحويل للاحتياط
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleNomination(app.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                        title="إلغاء الترشيح من المجلس وإعادته للمتقدمين"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>إلغاء الترشيح</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reserve Section */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <span>قائمة الأعضاء الاحتياط المعتمدين ({reserveApps.length} أعضاء)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  أعضاء احتياط يتم إدراجهم في محضر التشكيل والاعتماد الرسمي
                </p>
              </div>
            </div>

            {reserveApps.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-bold">
                لا يوجد أعضاء احتياط حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reserveApps.map((app) => (
                  <div
                    key={app.id}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">{app.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        طالب: {app.studentName} ({app.studentGrade})
                      </div>
                      <div className="text-[10px] font-mono font-bold text-teal-800 mt-0.5">
                        درجة التقييم: {app.smartEvaluation?.overallScore || "—"}%
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(app.id)}
                        className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs cursor-pointer shadow-xs transition-transform active:scale-95"
                      >
                        تصعيد للمجلس
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAppForPrint(app)}
                        className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        title="معاينة الاستمارة الرسمية"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Final Action Card */}
          <div className="bg-linear-to-br from-teal-50 to-slate-100 rounded-3xl border-2 border-teal-300/80 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-700" />
                <span>جاهز لطباعة محضر الاعتماد النهائي</span>
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                بعد الانتهاء من إدخال الصفات المحددة يدوياً (أو تركها فارغة للمجلس)، يمكنك طباعة المحضر الرسمي الكامل وفق اللائحة الوزارية المعتمدة بمقاس A4.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setShowFormationPrint(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-black text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>طباعة محضر الاعتماد النهائي (A4)</span>
              </button>
              <button
                type="button"
                onClick={handleApproveFormation}
                disabled={config.formationApproved}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all shadow-md active:scale-95 cursor-pointer ${
                  config.formationApproved ? "bg-emerald-700 text-white cursor-default" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{config.formationApproved ? "المجلس معتمد" : "اعتماد المجلس"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: كافة الاستمارات والطلبات */}
      {activeTab === "all_applications" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، الطالب، أو الجوال..."
                className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:bg-white"
              >
                <option value="all">جميع الحالات ({appsList.length})</option>
                <option value="selected">المعتمدون في المجلس ({selectedApps.length})</option>
                <option value="eligible">المطابقون للشروط ({eligibleApps.length})</option>
                <option value="disqualified">المستبعدون ({disqualifiedApps.length})</option>
              </select>

              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:bg-white"
              >
                <option value="all">كافة الصفوف</option>
                <option value="الأول">الأول ثانوي</option>
                <option value="الثاني">الثاني ثانوي</option>
                <option value="الثالث">الثالث ثانوي</option>
              </select>
            </div>

          </div>

          {/* Applications Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                  <th className="p-3">اسم ولي الأمر</th>
                  <th className="p-3">الطالب والصف</th>
                  <th className="p-3">المهارات المعتمدة</th>
                  <th className="p-3 text-center">التقييم النظامي</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">تاريخ التقديم</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplications.map((app) => {
                  const isSelected = config.selectedMemberIds.includes(app.id);
                  const isDisqualified = !app.smartEvaluation?.isEligible || app.status === "disqualified";

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 min-w-[150px]">
                        <div className="font-extrabold text-slate-900 break-words whitespace-normal leading-snug">{app.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{app.phone}</div>
                      </td>

                      <td className="p-3 min-w-[150px]">
                        <div className="font-bold text-slate-800 break-words whitespace-normal leading-snug">{app.studentName}</div>
                        <div className="text-[10px] text-slate-500">{app.studentGrade}</div>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {app.skills.organizationalManagement && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded">إداري</span>
                          )}
                          {app.skills.volunteerExperience && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded">تطوع</span>
                          )}
                          {app.skills.reportingAndDoc && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-800 rounded">تقارير</span>
                          )}
                          {app.skills.digitalPlatforms && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-900 rounded">رقمي</span>
                          )}
                          {app.skills.previousCommittees && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-800 rounded">لجان</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {app.smartEvaluation?.overallScore || "—"}%
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {isSelected ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300">
                            معتمد بالمجلس
                          </span>
                        ) : isDisqualified ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                            مستبعد
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            مؤهل
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center text-[10px] font-mono text-slate-500">
                        {app.submissionDateHijri || new Date(app.submittedAt).toLocaleDateString("ar-SA")}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedAppForPrint(app)}
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold transition-colors cursor-pointer"
                            title="عرض وطباعة الاستمارة الرسمية A4"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {!isSelected ? (
                            <button
                              type="button"
                              onClick={() => handleSelectCandidate(app.id)}
                              className="px-2 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-[10px] cursor-pointer"
                              title="إضافة إلى المجلس"
                            >
                              اختيار
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleExcludeCandidate(app.id)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] cursor-pointer"
                              title="استبعاد من المجلس"
                            >
                              استبعاد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: تحديد الطلاب وإرسال دعوات الترشح عبر واتساب */}
      {activeTab === "links_and_wa" && (
        <div className="space-y-6">
          <ParentCouncilStudentInvites
            students={students}
            schoolSignatories={schoolSignatories}
            isWhatsAppConnected={isWhatsAppConnected}
            onNavigateToWhatsApp={onNavigateToWhatsApp}
            onNavigateToMessages={onNavigateToMessages}
            applications={applications}
            invites={invites}
            onUpdateInvites={handleUpdateInvites}
            showToast={showToast}
            isSurveyClosed={config.isSurveyClosed}
            onToggleSurveyStatus={handleToggleSurveyStatus}
          />

          {/* Supplementary Council Settings & General Fallback Link */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-600" />
                  <span>إعدادات مقاعد المجلس وإيقاف/تفعيل الاستبيانات والرابط العام المباشر</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  التحكم في إيقاف أو فتح استقبال طلبات أولياء الأمور والرابط العام البديل
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSurveyStatus}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer border transition-colors ${
                    config.isSurveyClosed
                      ? "bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200"
                      : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                  }`}
                >
                  <span>{config.isSurveyClosed ? "الاستبيان موقوف (اضغط للفتح)" : "إيقاف استقبال الاستبيانات"}</span>
                </button>
                <button
                  type="button"
                  onClick={copyPortalLink}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الرابط العام</span>
                </button>
                <a
                  href={publicPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>تجربة الرابط العام</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  رمز التفعيل العام المعتمد:
                </label>
                <input
                  type="text"
                  value={activationCodeInput}
                  onChange={(e) => setActivationCodeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono font-bold tracking-wider text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عدد مقاعد المجلس الأساسية:
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={seatsCountInput}
                  onChange={(e) => setSeatsCountInput(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عدد مقاعد الاحتياط:
                </label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  value={reserveSeatsCountInput}
                  onChange={(e) => setReserveSeatsCountInput(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                id="btn-save-settings-tab3"
                type="button"
                onClick={() => handleSaveSeats()}
                disabled={isSavingSeats}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer active:scale-95 ${
                  seatsSavedSuccess
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-teal-700 hover:bg-teal-800"
                }`}
              >
                {seatsSavedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>تم حفظ التحديد والإعدادات</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-white" />
                    <span>{isSavingSeats ? "جارٍ الحفظ..." : "حفظ تحديد المقاعد والإعدادات"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: الدعوات والرسائل المرسلة */}
      {activeTab === "sent_invites" && (
        <ParentCouncilSentMessagesLog
          invites={invites}
          applications={applications}
          students={students}
          onRefreshData={() => fetchLatestData(false)}
          isRefreshing={isRealtimeRefreshing}
          onOpenPrintReport={() => setShowSentReportPrint(true)}
          onViewApplication={(app) => setSelectedAppForPrint(app)}
        />
      )}

      {/* SWAP CANDIDATE MODAL */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                استبدال المرشح: {applications[showSwapModal]?.fullName}
              </h3>
              <button
                onClick={() => setShowSwapModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              اختر البديل من قائمة المتقدمين المؤهلين أو أعضاء الاحتياط ليحل محله في المجلس:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {appsList
                .filter((a) => a.id !== showSwapModal && !config.selectedMemberIds.includes(a.id) && a.smartEvaluation?.isEligible)
                .map((candidate) => (
                  <div
                    key={candidate.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">{candidate.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        طالب: {candidate.studentName} ({candidate.studentGrade})
                      </div>
                      <div className="text-[10px] font-mono text-teal-800 font-bold">
                        الدرجة: {candidate.smartEvaluation?.overallScore || "—"}%
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSwapCandidates(showSwapModal, candidate.id)}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      اختيار كبديل
                    </button>
                  </div>
                ))}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSwapModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Sent Messages Report Print Sheet */}
      {showSentReportPrint && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <SentMessagesReportPrintSheet
            invitesList={sentList}
            applications={applications}
            signatories={schoolSignatories}
            academicYear={config.academicYear}
            councilTerm={config.councilTerm}
            onClose={() => setShowSentReportPrint(false)}
          />
        </div>
      )}

    </div>
  );
}
