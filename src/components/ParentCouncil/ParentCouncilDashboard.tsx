import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  ParentCouncilApplication,
  ParentCouncilConfig,
  evaluateParentCouncilApplication,
} from "../../types/parentCouncil";
import { SchoolSignatories, Student } from "../../types";
import ParentCouncilPrintSheet from "./ParentCouncilPrintSheet";
import CouncilFormationPrintSheet from "./CouncilFormationPrintSheet";

interface ParentCouncilDashboardProps {
  students: Student[];
  schoolSignatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onNavigateToWhatsApp?: () => void;
  onOpenSignatoriesModal?: () => void;
}

export default function ParentCouncilDashboard({
  students,
  schoolSignatories,
  isWhatsAppConnected,
  onNavigateToWhatsApp,
  onOpenSignatoriesModal,
}: ParentCouncilDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"smart_screening" | "all_applications" | "links_and_wa">("smart_screening");

  // Main state
  const [applications, setApplications] = useState<Record<string, ParentCouncilApplication>>({});
  const [config, setConfig] = useState<ParentCouncilConfig>({
    academicYear: "1447 - 1448 هـ",
    councilTerm: "العام الدراسي 2026 - 2027",
    generalActivationCode: "202601",
    seatsCount: 7,
    reserveSeatsCount: 2,
    formationApproved: false,
    selectedMemberIds: [],
    reserveMemberIds: [],
  });
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "eligible" | "disqualified" | "selected">("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  // Modals & Preview Sheets
  const [selectedAppForPrint, setSelectedAppForPrint] = useState<ParentCouncilApplication | null>(null);
  const [showFormationPrint, setShowFormationPrint] = useState(false);
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

  // Initial Load from Server or Local Storage
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/parent-councils/data");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setApplications(data.applications || {});
            if (data.config) setConfig((prev) => ({ ...prev, ...data.config }));
            return;
          }
        }
      } catch (e) {
        console.error("Error loading parent councils data:", e);
      } finally {
        setLoading(false);
      }

      // Local storage fallback
      const savedApps = localStorage.getItem("parent_councils_apps");
      const savedConfig = localStorage.getItem("parent_councils_config");
      if (savedApps) {
        try {
          setApplications(JSON.parse(savedApps));
        } catch (e) {}
      } else {
        // Seed realistic sample applications for immediate visual testing if empty
        seedSampleApplications();
      }
      if (savedConfig) {
        try {
          setConfig(JSON.parse(savedConfig));
        } catch (e) {}
      }
      setLoading(false);
    }

    loadData();
  }, [students]);

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
      assignedRole: "نائب الرئيس",
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
      assignedRole: "أمين السر",
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
      assignedRole: "عضو مجلس",
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
      assignedRole: "عضو مجلس",
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
      seatsCount: 7,
      reserveSeatsCount: 2,
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

  // AI / Smart Re-Sort Action
  const handleRunSmartSort = () => {
    const appsList = Object.values(applications) as ParentCouncilApplication[];
    const updatedApps: Record<string, ParentCouncilApplication> = { ...applications };

    // 1. Re-evaluate all applications
    appsList.forEach((app) => {
      const evalRes = evaluateParentCouncilApplication(app);
      updatedApps[app.id] = {
        ...app,
        smartEvaluation: evalRes,
        status: evalRes.isEligible ? (app.status === "disqualified" ? "submitted" : app.status) : "disqualified",
      };
    });

    // 2. Filter eligible and sort descending by overallScore
    const eligible = (Object.values(updatedApps) as ParentCouncilApplication[])
      .filter((a) => a.smartEvaluation?.isEligible)
      .sort((a, b) => (b.smartEvaluation?.overallScore || 0) - (a.smartEvaluation?.overallScore || 0));

    // 3. Propose selection (e.g. top config.seatsCount members + top reserveSeatsCount reserve)
    const proposedSelectedIds: string[] = [];
    const proposedReserveIds: string[] = [];

    eligible.forEach((app, idx) => {
      if (idx < config.seatsCount) {
        proposedSelectedIds.push(app.id);
        updatedApps[app.id].status = "approved";
        if (!updatedApps[app.id].assignedRole) {
          updatedApps[app.id].assignedRole = app.smartEvaluation?.suggestedRole || "عضو مجلس";
        }
      } else if (idx < config.seatsCount + config.reserveSeatsCount) {
        proposedReserveIds.push(app.id);
        updatedApps[app.id].status = "reserve";
        updatedApps[app.id].assignedRole = "عضو احتياط";
      } else {
        updatedApps[app.id].status = "submitted";
      }
    });

    const newConfig = {
      ...config,
      selectedMemberIds: proposedSelectedIds,
      reserveMemberIds: proposedReserveIds,
      formationApproved: false,
    };

    syncUpdates(updatedApps, newConfig);
    showToast("تم إجراء الفرز الذكي الآلي وتوزيع المقاعد والاحتياط بنجاح.");
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
      assignedRole: role || app.assignedRole || "عضو مجلس",
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

  // Action: Approve Council Formation officially
  const handleApproveFormation = () => {
    if (config.selectedMemberIds.length === 0) {
      alert("يجب اختيار عضو واحد على الأقل لاعتماد تشكيل المجلس.");
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
                إدارة طلبات الترشيح، الفرز الذكي واستبعاد من لا تنطبق عليه الشروط، وتوليد استمارات المجلس الرسمية لـ{" "}
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
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("smart_screening")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === "smart_screening"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>القسم الذكي لفرز وترشيح المجلس</span>
          <span className="text-[10px] bg-teal-900/40 text-teal-100 px-2 py-0.5 rounded-full font-mono">
            {config.selectedMemberIds.length}
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
          <span>دعوات الواتساب ورمز التفعيل</span>
        </button>
      </div>

      {/* TAB 1: القسم الذكي لفرز وترشيح المجلس */}
      {activeTab === "smart_screening" && (
        <div className="space-y-6">
          
          {/* Smart Controls Bar */}
          <div className="bg-linear-to-r from-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h2 className="text-base font-black">المساعد الذكي لفرز واختيار أعضاء المجلس</h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                يقوم النظام بدراسة الاستمارات وفحص امتلاك المهارات الإدارية والتطوعية وتطبيق ضوابط المادة (الثالثة)، واقتراح التشكيل الأنسب للمجلس مع إمكانية استبعاد أو استبدال أي مرشح يدوياً.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                type="button"
                onClick={handleRunSmartSort}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-sm"
                title="إعادة الفرز التلقائي لجميع الطلبات"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة الفرز الذكي</span>
              </button>

              <button
                type="button"
                onClick={handleApproveFormation}
                disabled={config.formationApproved}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-sm ${
                  config.formationApproved ? "bg-emerald-600 cursor-default" : "bg-teal-600 hover:bg-teal-500"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{config.formationApproved ? "تم اعتماد التشكيل" : "اعتماد تشكيل المجلس"}</span>
              </button>
            </div>
          </div>

          {/* Section 1: التشكيل المعتمد / المقترح للمجلس (الأساسيون) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-teal-700" />
                  <span>التشكيل المقترح والمعتمد للمجلس ({selectedApps.length} من {config.seatsCount} مقاعد)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  المرشحون الأساسيون الذين تم اختيارهم بناءً على أعلى درجات التقييم والمهارات والتنوع الصفي
                </p>
              </div>

              <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                المتبقي: {Math.max(0, config.seatsCount - selectedApps.length)} مقاعد
              </span>
            </div>

            {selectedApps.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                لا يوجد أعضاء في التشكيل حتى الآن. اضغط على "إعادة الفرز الذكي" لاقتراح التشكيل تلقائياً.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedApps.map((app, index) => (
                  <div
                    key={app.id}
                    className="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/70 p-3 rounded-2xl transition-colors"
                  >
                    {/* Member Info */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-700 text-white font-mono font-black text-sm flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">{app.fullName}</span>
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-teal-100 text-teal-900 border border-teal-300">
                            {app.assignedRole || "عضو مجلس"}
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            (ولي أمر الطالب: {app.studentName} - {app.studentGrade})
                          </span>
                        </div>

                        {/* Verified skills badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {app.skills.organizationalManagement && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200" title={app.skills.organizationalDetails}>
                              تنظيم وإدارة ✓
                            </span>
                          )}
                          {app.skills.volunteerExperience && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200" title={app.skills.volunteerDetails}>
                              عمل تطوعي ✓
                            </span>
                          )}
                          {app.skills.reportingAndDoc && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-800 rounded border border-purple-200" title={app.skills.reportingDetails}>
                              توثيق وتقارير ✓
                            </span>
                          )}
                          {app.skills.digitalPlatforms && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-900 rounded border border-amber-200" title={app.skills.digitalPlatformsDetails}>
                              منصات رقمية ✓
                            </span>
                          )}
                          {app.skills.previousCommittees && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded border border-indigo-200" title={app.skills.committeeDetails}>
                              لجان سابقة ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score & Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                      
                      {/* Smart score badge */}
                      <div className="text-center px-3 py-1 bg-slate-100 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500">تقييم النظام</div>
                        <div className="text-sm font-black font-mono text-teal-800">
                          {app.smartEvaluation?.overallScore || 85}%
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
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
                          onClick={() => setShowSwapModal(app.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
                          title="استبدال بمرشح آخر من الاحتياط أو المتقدمين"
                        >
                          استبدال
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveToReserve(app.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                          title="نقله إلى قائمة الأعضاء الاحتياط"
                        >
                          للاحتياط
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExcludeCandidate(app.id)}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                          title="استبعاد من المجلس"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: الأعضاء الاحتياط (Reserve Members) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <span>قائمة الأعضاء الاحتياط ({reserveApps.length} أعضاء)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مرشحون مؤهلون ومستوفون للشروط يمكن تصعيد أي منهم للمجلس الأساسي بنقرة زر
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
                  <th className="p-3 text-center">التقييم الذكي</th>
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
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900">{app.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{app.phone}</div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-800">{app.studentName}</div>
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

      {/* TAB 3: دعوات الواتساب ورمز التفعيل */}
      {activeTab === "links_and_wa" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Portal Link & Activation Code */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-teal-700" />
                <span>رابط الترشيح المباشر ورمز التفعيل</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                يمكن مشاركة هذا الرابط مع أولياء الأمور عبر مجموعات الواتساب أو الرسائل النصية للترشح
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Direct Link Box */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  رابط بوابة الترشيح العامة:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicPortalUrl}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={copyPortalLink}
                    className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "تم النسخ" : "نسخ"}</span>
                  </button>
                </div>
              </div>

              {/* Activation Code Setting */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  رمز التفعيل العام المعتمد:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.generalActivationCode}
                    onChange={(e) => {
                      const updated = { ...config, generalActivationCode: e.target.value };
                      setConfig(updated);
                      localStorage.setItem("parent_councils_config", JSON.stringify(updated));
                    }}
                    className="w-48 px-3.5 py-2.5 bg-white border-2 border-teal-600 rounded-xl text-center text-base font-mono font-black tracking-widest text-teal-900"
                    dir="ltr"
                  />
                  <span className="text-xs text-slate-500">
                    رمز رقمي مخصص للمدرسة للدخول للاستمارة
                  </span>
                </div>
              </div>

              {/* Council Quota */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عدد مقاعد المجلس الأساسية:
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={15}
                    value={config.seatsCount}
                    onChange={(e) => {
                      const updated = { ...config, seatsCount: Number(e.target.value) || 7 };
                      setConfig(updated);
                      localStorage.setItem("parent_councils_config", JSON.stringify(updated));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عدد مقاعد الاحتياط:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.reserveSeatsCount}
                    onChange={(e) => {
                      const updated = { ...config, reserveSeatsCount: Number(e.target.value) || 2 };
                      setConfig(updated);
                      localStorage.setItem("parent_councils_config", JSON.stringify(updated));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono"
                  />
                </div>
              </div>

              {/* Test in New Tab */}
              <div className="pt-2">
                <a
                  href={publicPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-700 hover:text-teal-900 underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح وتجربة استمارة ولي الأمر في نافذة جديدة</span>
                </a>
              </div>

            </div>
          </div>

          {/* Card 2: WhatsApp Messaging */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <span>إرسال دعوة الترشح عبر واتساب</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تخصيص وإرسال رسالة الدعوة الرسمية برمز التفعيل لأولياء الأمور
              </p>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                نص رسالة الدعوة:
              </label>
              <textarea
                rows={6}
                value={customWhatsAppMsg}
                onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
              />
              <div className="text-[10px] text-slate-400 mt-1">
                المتغيرات التلقائية: &#123;المدرسة&#125; اسم المدرسة، &#123;الرابط&#125; رابط البوابة، &#123;الرمز&#125; رمز التفعيل.
              </div>
            </div>

            {/* Connection Check */}
            {!isWhatsAppConnected && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                <span>واتساب غير مرتبط حالياً في النظام.</span>
                {onNavigateToWhatsApp && (
                  <button
                    type="button"
                    onClick={onNavigateToWhatsApp}
                    className="font-bold underline text-amber-900"
                  >
                    ربط الواتساب الآن
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const finalMsg = customWhatsAppMsg
                  .replace("{المدرسة}", schoolSignatories.schoolName || "المدرسة")
                  .replace("{الرابط}", publicPortalUrl)
                  .replace("{الرمز}", config.generalActivationCode);
                navigator.clipboard.writeText(finalMsg);
                showToast("تم نسخ نص رسالة الواتساب بالرابط والرمز بنجاح، يمكنك لصقها في المجموعات.");
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Copy className="w-4 h-4" />
              <span>نسخ الرسالة الجاهزة للإرسال في واتساب</span>
            </button>
          </div>

        </div>
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

    </div>
  );
}
