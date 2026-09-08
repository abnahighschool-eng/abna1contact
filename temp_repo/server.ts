import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import * as BaileysModule from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import {
  backupBaileysSessionToFirestore,
  restoreBaileysSessionFromFirestore,
  deleteBaileysSessionInFirestore,
  syncServerStateToFirestore,
  loadServerStateFromFirestore,
  forceFlushServerStateToFirestore,
  deleteServerStateInFirestore,
} from "./src/serverFirebase";
import { DEFAULT_SAMPLE_TEACHERS, DEFAULT_SAMPLE_SCHEDULE } from "./src/utils/teachersScheduleParser";
import { calculateStudentIndicators, calculateOverallPriority } from "./src/utils/studentSupportRulesEngine";
import { analyzeSurveyResponses, generateActivationCode } from "./src/utils/studentNeedsRulesEngine";
import { evaluateParentCouncilApplication } from "./src/types/parentCouncil";
import { reconcileStudentsRoster, reconcileTeachersRoster } from "./src/utils/rosterReconciliation";

// Resilient resolution of makeWASocket and helpers across ESM/CJS environments
const baileysRaw: any = (BaileysModule as any).default || BaileysModule;
const makeWASocket = typeof baileysRaw === "function" 
  ? baileysRaw 
  : (baileysRaw.makeWASocket || (BaileysModule as any).makeWASocket || (BaileysModule as any).default);

const useMultiFileAuthState = (BaileysModule as any).useMultiFileAuthState || baileysRaw.useMultiFileAuthState;
const DisconnectReason = (BaileysModule as any).DisconnectReason || baileysRaw.DisconnectReason;
const fetchLatestBaileysVersion = (BaileysModule as any).fetchLatestBaileysVersion || baileysRaw.fetchLatestBaileysVersion;
const Browsers = (BaileysModule as any).Browsers || baileysRaw.Browsers;

// Process Safety Guards to prevent crashes on socket drops
process.on("uncaughtException", (err) => {
  console.warn("Recovered from uncaughtException:", err?.message || err);
});

process.on("unhandledRejection", (reason) => {
  console.warn("Recovered from unhandledRejection:", reason);
});

// Initialize Express app
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health Check Endpoints for Render, Uptime Monitors, and Cloud Probes
app.get(["/api/health", "/health", "/ping"], (req, res) => {
  const isConnected = realConnectionStatus === "connected" || !!(sock && sock.user);
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    whatsappMode: whatsappConfig.mode,
    isConnected,
    realStatus: realConnectionStatus,
    connectedPhone: connectedPhoneNumber ? `+${connectedPhoneNumber}` : (whatsappConfig.simulatedPhone || ""),
  });
});

// In-memory data store for WhatsApp states & Campaigns
let whatsappConfig = {
  mode: "simulated" as "simulated" | "real" | "cloud_api",
  simulatedStatus: "disconnected" as "disconnected" | "qr_ready" | "connecting" | "connected",
  simulatedPhone: "",
  cloudApiKey: "",
  cloudPhoneId: "",
  cloudAccountId: "",
};

function normalizePhoneNumber(input: string | number): string {
  if (input === undefined || input === null || input === "") return "";
  let str = String(input).trim();
  // Strip trailing decimal from Excel float conversions like 501234567.0 or 501234567.00
  str = str.replace(/\.0+$/, "").replace(/\.[0-9]+$/, "");
  // Convert Arabic/Eastern Hindi digits to Western digits
  let cleaned = str.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/[^0-9]/g, "");
  
  if (cleaned.startsWith("00966")) {
    cleaned = "966" + cleaned.substring(5);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith("96605")) {
    cleaned = "966" + cleaned.substring(4); // fix 96605... -> 9665...
  } else if (cleaned.startsWith("966")) {
    cleaned = cleaned;
  } else if (cleaned.startsWith("05")) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  return cleaned;
}

// Dedicated Baileys Real Message Dispatcher
async function sendBaileysMessage(phone: string, text: string): Promise<{ success: boolean; error?: string; jid?: string; messageId?: string }> {
  const isConnected = !!(sock && (sock.user || realConnectionStatus === "connected"));
  if (!isConnected) {
    return { 
      success: false, 
      error: "جهاز الواتساب غير متصل حالياً. يرجى التوجه لتبويب '1. الربط والاتصال' وربط جهازك بالرمز أو الباركود أولاً حتى تصل الرسائل لهواتف المستلمين." 
    };
  }

  const formattedPhone = normalizePhoneNumber(phone);
  if (!formattedPhone || formattedPhone.length < 8) {
    return { success: false, error: `رقم الجوال غير صالح أو غير مكتمل (${phone})` };
  }

  let targetJid = `${formattedPhone}@s.whatsapp.net`;
  
  // If user is sending to themselves (Notes to self / self-test):
  const myCleanPhone = connectedPhoneNumber ? normalizePhoneNumber(connectedPhoneNumber) : "";
  if (myCleanPhone && (formattedPhone === myCleanPhone) && sock.user?.id) {
    targetJid = sock.user.id.includes(":") ? `${sock.user.id.split(":")[0]}@s.whatsapp.net` : sock.user.id;
  }

  try {
    console.log(`[WhatsApp Real Dispatch] Initiating send to ${targetJid}...`);
    
    try {
      await sock.sendPresenceUpdate("composing", targetJid);
    } catch (presErr) {
      // non-fatal
    }

    const sentMsg = await sock.sendMessage(targetJid, { text });
    if (!sentMsg || !sentMsg.key) {
      return { success: false, error: "لم يتم استلام تأكيد تسليم الرسالة من خادم واتساب." };
    }
    const messageId = sentMsg.key.id || "";
    console.log(`[WhatsApp Real Dispatch] Successfully delivered to ${targetJid} (MsgId: ${messageId})`);
    return { success: true, jid: targetJid, messageId };
  } catch (sendErr: any) {
    console.error(`[WhatsApp Real Dispatch Error] Failed for ${targetJid}:`, sendErr);
    return { 
      success: false, 
      error: sendErr?.message || "فشل إرسال الرسالة عبر خادم واتساب. يرجى التأكد من اتصال هاتفك بالإنترنت وصحة الرقم." 
    };
  }
}

let sock: any = null;
let realQrCodeUrl: string = "";
let realPairingCode: string = "";
let realErrorMessage: string = "";
let realConnectionStatus: "disconnected" | "qr_ready" | "pairing_code_ready" | "connecting" | "connected" | "error" = "disconnected";
let connectedPhoneNumber: string = "";
let connectionTimeoutTimer: NodeJS.Timeout | null = null;
let firestoreSessionBackupTimer: NodeJS.Timeout | null = null;
let isExplicitlyDisconnected = false;

// 3 Days Expiration in milliseconds (3 days * 24 hours * 60 mins * 60 secs * 1000 ms)
const INQUIRY_EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000;

function scheduleFirestoreSessionBackup(force = false) {
  if (firestoreSessionBackupTimer) clearTimeout(firestoreSessionBackupTimer);
  firestoreSessionBackupTimer = setTimeout(() => {
    const authFolder = path.join(process.cwd(), "auth_info_baileys");
    backupBaileysSessionToFirestore(authFolder, force).catch(() => {});
  }, 15000); // 15 seconds debounce
}

async function initRealWhatsApp(method: "qr" | "pairing_code" | "resume" = "qr", targetPhone?: string) {
  try {
    isExplicitlyDisconnected = false;
    if (connectionTimeoutTimer) {
      clearTimeout(connectionTimeoutTimer);
      connectionTimeoutTimer = null;
    }

    if (method !== "resume") {
      realErrorMessage = "";
      realPairingCode = "";
      realQrCodeUrl = "";
      realConnectionStatus = "connecting";
    }

    // Clean up previous socket instance completely if starting a new pairing session
    if (sock && method !== "resume") {
      try {
        sock.ev?.removeAllListeners("creds.update");
        sock.ev?.removeAllListeners("connection.update");
        sock.end(undefined);
      } catch (e) {
        // ignore cleanup error
      }
      sock = null;
    }

    const authFolder = path.join(process.cwd(), "auth_info_baileys");
    
    // If starting a fresh new pairing (QR or Pairing Code), wipe any previous partial/stale auth state
    if (method === "qr" || method === "pairing_code") {
      if (fs.existsSync(authFolder)) {
        try {
          fs.rmSync(authFolder, { recursive: true, force: true });
        } catch (e) {}
      }
      connectedPhoneNumber = "";
      whatsappConfig.simulatedPhone = "";
      whatsappConfig.simulatedStatus = "disconnected";
    }

    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    let waVersion: any = undefined;
    try {
      if (typeof fetchLatestBaileysVersion === "function") {
        const v = await fetchLatestBaileysVersion();
        if (v && v.version) {
          waVersion = v.version;
          console.log(`[WhatsApp] Using dynamic Baileys version: ${waVersion.join(".")}`);
        }
      }
    } catch (verErr) {
      console.warn("fetchLatestBaileysVersion fallback used");
    }

    const browserInfo = typeof Browsers?.ubuntu === "function"
      ? Browsers.ubuntu("Chrome")
      : ["Ubuntu", "Chrome", "20.0.04"];

    const socketOptions: any = {
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any,
      browser: browserInfo,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
      shouldIgnoreJid: (jid: string) => !jid || jid.includes("@broadcast") || jid.endsWith("@newsletter"),
    };

    if (waVersion) {
      socketOptions.version = waVersion;
    }

    sock = makeWASocket(socketOptions);
    
    sock.ev.on("creds.update", async () => {
      await saveCreds();
      scheduleFirestoreSessionBackup();
    });
    
    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && method === "qr") {
        if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
        realConnectionStatus = "qr_ready";
        realErrorMessage = "";
        try {
          realQrCodeUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: "M",
            margin: 2,
            scale: 8,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          });
          console.log("[WhatsApp] QR Code generated successfully as DataURL");
        } catch (err) {
          console.error("Error generating QR code data URL", err);
        }
      }
      
      if (connection === "connecting") {
        if (realConnectionStatus !== "qr_ready" && realConnectionStatus !== "pairing_code_ready") {
          realConnectionStatus = "connecting";
        }
      }
      
      if (connection === "open") {
        if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
        realConnectionStatus = "connected";
        realQrCodeUrl = "";
        realPairingCode = "";
        realErrorMessage = "";
        const userJid = sock.user?.id || "";
        connectedPhoneNumber = userJid.split(":")[0]?.replace(/[^0-9]/g, "") || "";
        
        // Update general config
        whatsappConfig.simulatedStatus = "connected";
        whatsappConfig.simulatedPhone = "+" + connectedPhoneNumber;
        saveConfig();
        scheduleFirestoreSessionBackup(true);
        console.log(`[WhatsApp] Connected successfully to number: +${connectedPhoneNumber}`);

        try {
          await sock.sendPresenceUpdate("available");
        } catch (presErr) {
          // non-blocking
        }
      }
      
      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const errorMessage = (lastDisconnect?.error as any)?.message || "";
        const isLoggedOut =
          isExplicitlyDisconnected ||
          statusCode === DisconnectReason?.loggedOut ||
          statusCode === 401;

        const shouldReconnect = !isLoggedOut;
        
        console.log(`[WhatsApp] Connection closed. StatusCode: ${statusCode}. isLoggedOut: ${isLoggedOut}. ShouldReconnect: ${shouldReconnect}`);
        
        if (isLoggedOut) {
          // Total disconnection & purge of all previous phone numbers and auth files
          realConnectionStatus = "disconnected";
          realQrCodeUrl = "";
          realPairingCode = "";
          connectedPhoneNumber = "";
          whatsappConfig.simulatedStatus = "disconnected";
          whatsappConfig.simulatedPhone = "";
          saveConfig();
          deleteBaileysSessionInFirestore().catch(() => {});
          
          const authDir = path.join(process.cwd(), "auth_info_baileys");
          if (fs.existsSync(authDir)) {
            try {
              fs.rmSync(authDir, { recursive: true, force: true });
            } catch (e) {}
          }
          
          if (sock) {
            try {
              sock.ev?.removeAllListeners("creds.update");
              sock.ev?.removeAllListeners("connection.update");
              sock.end(undefined);
            } catch (e) {}
            sock = null;
          }
        } else if (shouldReconnect) {
          // Reconnect automatically on 515 (restartRequired) or temporary closed socket during handshake
          console.log("[WhatsApp] Auto-resuming Baileys socket handshake / session...");
          setTimeout(() => {
            if (!isExplicitlyDisconnected) {
              initRealWhatsApp("resume", targetPhone);
            }
          }, 1500);
        } else if (realConnectionStatus !== "connected") {
          realConnectionStatus = "error";
          realErrorMessage = "انقطع الاتصال بخوادم واتساب. يمكنك طلب رمز جديد أو مسح الباركود فوراً دون الحاجة لتسجيل الخروج.";
        }
      }
    });

    // Fallback timeout in case WhatsApp servers do not respond
    connectionTimeoutTimer = setTimeout(() => {
      if (realConnectionStatus === "connecting") {
        realConnectionStatus = "error";
        realErrorMessage = "استغرق طلب الرمز من خوادم واتساب وقتاً أطول من المعتاد. يمكنك الضغط على 'إعادة المحاولة' لتوليد رمز فوري جديد.";
      }
    }, 35000);

    // Handle Pairing Code flow if requested
    if (method === "pairing_code" && targetPhone && !sock.authState?.creds?.registered) {
      const cleanPhone = normalizePhoneNumber(targetPhone);

      const tryRequestCode = async (attempt = 1) => {
        try {
          if (!sock || sock.authState?.creds?.registered) return;
          const code = await sock.requestPairingCode(cleanPhone);
          if (code) {
            if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
            realPairingCode = code || "";
            realConnectionStatus = "pairing_code_ready";
            realErrorMessage = "";
            console.log(`[WhatsApp] Pairing code generated for ${cleanPhone}: ${code}`);
            return;
          }
        } catch (err: any) {
          if (attempt < 5 && realConnectionStatus === "connecting") {
            setTimeout(() => tryRequestCode(attempt + 1), 1000);
          } else {
            console.error("Error requesting WhatsApp pairing code:", err);
            realConnectionStatus = "error";
            realErrorMessage = err?.message || "فشل توليد رمز الربط لرقم الهاتف. تأكد من صحة الرقم ومفتاح الدولة ثم اضغط إعادة المحاولة.";
          }
        }
      };

      setTimeout(() => tryRequestCode(1), 700);
    }
  } catch (err: any) {
    console.error("Error starting Baileys socket connection:", err);
    realConnectionStatus = "error";
    realErrorMessage = err?.message || "حدث خطأ أثناء تشغيل محرك الواتساب.";
  }
}

// Store campaign states
interface CampaignLogItem {
  id: string;
  studentName: string;
  phone: string;
  grade?: string;
  className?: string;
  message: string;
  status: "pending" | "sending" | "success" | "failed";
  timestamp: string;
  error?: string;
}

interface Campaign {
  id: string;
  name: string;
  total: number;
  sent: number;
  failed: number;
  status: "idle" | "running" | "completed" | "paused";
  startTime: string | null;
  endTime: string | null;
  logs: CampaignLogItem[];
}

interface IndividualLogItem {
  id: string;
  studentName: string;
  phone: string;
  grade?: string;
  className?: string;
  message: string;
  status: "success" | "failed";
  timestamp: string;
  error?: string;
}

const campaigns: Record<string, Campaign> = {};
const individualLogs: IndividualLogItem[] = [];

// Persistent files paths
const INDIVIDUAL_LOGS_FILE = path.join(process.cwd(), "individual_logs.json");
const CAMPAIGNS_FILE = path.join(process.cwd(), "campaigns_store.json");
const APP_SETTINGS_FILE = path.join(process.cwd(), "app_settings.json");
const STUDENTS_FILE = path.join(process.cwd(), "students_store.json");
const TEMPLATE_FILE = path.join(process.cwd(), "template_store.json");
const USERS_FILE = path.join(process.cwd(), "users_store.json");
const ATTENDANCE_FILE = path.join(process.cwd(), "attendance_store.json");
const TEACHERS_FILE = path.join(process.cwd(), "teachers_store.json");
const SCHEDULE_FILE = path.join(process.cwd(), "schedule_store.json");
const INQUIRIES_FILE = path.join(process.cwd(), "inquiries_store.json");
const HEALTH_PROFILES_FILE = path.join(process.cwd(), "health_profiles_store.json");
const SUPPORT_CASES_FILE = path.join(process.cwd(), "support_cases_store.json");
const HEALTH_AUDIT_FILE = path.join(process.cwd(), "health_audit_store.json");
const NEEDS_SURVEY_FILE = path.join(process.cwd(), "needs_survey_store.json");
const PARENT_COUNCILS_FILE = path.join(process.cwd(), "parent_councils_store.json");

// Parent Councils Data Store
let parentCouncilsStore: {
  applications: Record<string, any>;
  invites: Record<string, any>;
  config: {
    academicYear: string;
    councilTerm: string;
    generalActivationCode: string;
    seatsCount: number;
    reserveSeatsCount: number;
    formationApproved: boolean;
    formationApprovedAt?: string;
    selectedMemberIds: string[];
    reserveMemberIds: string[];
    isSurveyClosed?: boolean;
    surveyClosedMessage?: string;
  };
} = {
  applications: {},
  invites: {},
  config: {
    academicYear: "1447 - 1448 هـ",
    councilTerm: "العام الدراسي 2026 - 2027",
    generalActivationCode: "202601",
    seatsCount: 9,
    reserveSeatsCount: 4,
    formationApproved: false,
    selectedMemberIds: [],
    reserveMemberIds: [],
    isSurveyClosed: false,
    surveyClosedMessage: "",
  },
};

// Default initial school settings
let appSettings = {
  countryName: "المملكة العربية السعودية",
  ministryName: "وزارة التعليم",
  administrationName: "الإدارة العامة للتعليم",
  schoolName: "ثانوية الأبناء الأولى",
  principalName: "",
  vicePrincipalName: "",
  counselorName: "",
  systemManagerName: "",
  logoUrl: "",
  logoWidth: 60,
  logoHeight: 60,
};

let activeStudentsList: any[] = [];
let activeTemplate: string = "السلام عليكم ورحمة الله وبركاته،\nأهلاً بك يا سيد {أبو الطالب}، نود إحاطتكم علماً بأن الطالب {اسم الطالب} قد حصل على درجة {الدرجة} في مادة الرياضيات.\nنتمنى له دوام التوفيق والنجاح.\n- إدارة المدرسة";
let attendanceRecordsStore: Record<string, Record<string, any>> = {};
let teachersList: any[] = [...DEFAULT_SAMPLE_TEACHERS];
let scheduleAssignments: any[] = [...DEFAULT_SAMPLE_SCHEDULE];
let inquiryRequestsStore: any[] = [];
let healthProfilesStore: Record<string, any> = {};
let supportCasesStore: any[] = [];
let healthAuditLogsStore: any[] = [];
let needsSurveyProfilesStore: Record<string, any> = {};

let systemUsersList: any[] = [
  {
    id: "admin_root_1",
    name: "مدير النظام العام",
    username: "admin",
    password: "123456",
    role: "admin",
    status: "active",
    phone: "",
    createdAt: new Date().toISOString(),
    notes: "حساب الإدارة الأساسي الافتراضي للنظام",
  }
];

if (fs.existsSync(USERS_FILE)) {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) systemUsersList = parsed;
  } catch (e) {
    console.error("Error reading users_store.json", e);
  }
}

if (fs.existsSync(ATTENDANCE_FILE)) {
  try {
    const raw = fs.readFileSync(ATTENDANCE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      attendanceRecordsStore = parsed;
    }
  } catch (e) {
    console.error("Error reading attendance_store.json", e);
  }
}

if (fs.existsSync(TEACHERS_FILE)) {
  try {
    const raw = fs.readFileSync(TEACHERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) teachersList = parsed;
  } catch (e) {
    console.error("Error reading teachers_store.json", e);
  }
}

if (fs.existsSync(SCHEDULE_FILE)) {
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      scheduleAssignments = parsed.filter((a: any) => {
        if (a?.id && String(a.id).includes("_34_")) return false;
        const sec = (a?.section || "").trim();
        return sec !== "شعبة 12" && sec !== "شعبة 18" && sec !== "12" && sec !== "18";
      });
    }
  } catch (e) {
    console.error("Error reading schedule_store.json", e);
  }
}

if (fs.existsSync(INQUIRIES_FILE)) {
  try {
    const raw = fs.readFileSync(INQUIRIES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) inquiryRequestsStore = parsed;
  } catch (e) {
    console.error("Error reading inquiries_store.json", e);
  }
}

if (fs.existsSync(HEALTH_PROFILES_FILE)) {
  try {
    const raw = fs.readFileSync(HEALTH_PROFILES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") healthProfilesStore = parsed;
  } catch (e) {
    console.error("Error reading health_profiles_store.json", e);
  }
}

if (fs.existsSync(SUPPORT_CASES_FILE)) {
  try {
    const raw = fs.readFileSync(SUPPORT_CASES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) supportCasesStore = parsed;
  } catch (e) {
    console.error("Error reading support_cases_store.json", e);
  }
}

if (fs.existsSync(HEALTH_AUDIT_FILE)) {
  try {
    const raw = fs.readFileSync(HEALTH_AUDIT_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) healthAuditLogsStore = parsed;
  } catch (e) {
    console.error("Error reading health_audit_store.json", e);
  }
}

if (fs.existsSync(NEEDS_SURVEY_FILE)) {
  try {
    const raw = fs.readFileSync(NEEDS_SURVEY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") needsSurveyProfilesStore = parsed;
  } catch (e) {
    console.error("Error reading needs_survey_store.json", e);
  }
}

if (fs.existsSync(PARENT_COUNCILS_FILE)) {
  try {
    const raw = fs.readFileSync(PARENT_COUNCILS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      parentCouncilsStore = {
        applications: parsed.applications || {},
        invites: parsed.invites || {},
        config: { ...parentCouncilsStore.config, ...(parsed.config || {}) },
      };
    }
  } catch (e) {
    console.error("Error reading parent_councils_store.json", e);
  }
}

// Load persisted state safely on startup
if (fs.existsSync(APP_SETTINGS_FILE)) {
  try {
    const raw = fs.readFileSync(APP_SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    appSettings = { ...appSettings, ...parsed };
  } catch (e) {
    console.error("Error reading app_settings.json", e);
  }
}

if (fs.existsSync(STUDENTS_FILE)) {
  try {
    const raw = fs.readFileSync(STUDENTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) activeStudentsList = parsed;
  } catch (e) {
    console.error("Error reading students_store.json", e);
  }
}

if (fs.existsSync(TEMPLATE_FILE)) {
  try {
    const raw = fs.readFileSync(TEMPLATE_FILE, "utf-8");
    if (raw && typeof raw === "string") activeTemplate = raw;
  } catch (e) {
    console.error("Error reading template_store.json", e);
  }
}

if (fs.existsSync(CAMPAIGNS_FILE)) {
  try {
    const raw = fs.readFileSync(CAMPAIGNS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      Object.assign(campaigns, parsed);
    }
  } catch (e) {
    console.error("Error reading campaigns_store.json", e);
  }
}

if (fs.existsSync(INDIVIDUAL_LOGS_FILE)) {
  try {
    const raw = fs.readFileSync(INDIVIDUAL_LOGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      individualLogs.push(...parsed);
    }
  } catch (e) {
    console.error("Error reading individual_logs.json", e);
  }
}

function saveIndividualLogs() {
  try {
    fs.writeFileSync(INDIVIDUAL_LOGS_FILE, JSON.stringify(individualLogs.slice(0, 1000), null, 2), "utf-8");
    syncServerStateToFirestore({ individualLogs: individualLogs.slice(0, 500) }).catch(() => {});
  } catch (e) {
    console.error("Error saving individual_logs.json", e);
  }
}

function saveCampaigns() {
  try {
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), "utf-8");
    syncServerStateToFirestore({ campaigns }).catch(() => {});
  } catch (e) {
    console.error("Error saving campaigns_store.json", e);
  }
}

function saveAppSettings() {
  try {
    fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(appSettings, null, 2), "utf-8");
    syncServerStateToFirestore({ appSettings }).catch(() => {});
  } catch (e) {
    console.error("Error saving app_settings.json", e);
  }
}

function saveStudentsList() {
  try {
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(activeStudentsList, null, 2), "utf-8");
    syncServerStateToFirestore({ activeStudentsList }).catch(() => {});
  } catch (e) {
    console.error("Error saving students_store.json", e);
  }
}

function saveTemplate() {
  try {
    fs.writeFileSync(TEMPLATE_FILE, activeTemplate, "utf-8");
    syncServerStateToFirestore({ activeTemplate }).catch(() => {});
  } catch (e) {
    console.error("Error saving template_store.json", e);
  }
}

function saveUsersList() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(systemUsersList, null, 2), "utf-8");
    syncServerStateToFirestore({ systemUsersList }).catch(() => {});
  } catch (e) {
    console.error("Error saving users_store.json", e);
  }
}

function saveAttendanceRecords() {
  try {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(attendanceRecordsStore, null, 2), "utf-8");
    syncServerStateToFirestore({ attendanceRecords: attendanceRecordsStore }).catch(() => {});
  } catch (e) {
    console.error("Error saving attendance_store.json", e);
  }
}

function saveTeachersList() {
  try {
    fs.writeFileSync(TEACHERS_FILE, JSON.stringify(teachersList, null, 2), "utf-8");
    syncServerStateToFirestore({ teachersList }).catch(() => {});
  } catch (e) {
    console.error("Error saving teachers_store.json", e);
  }
}

function saveScheduleAssignments() {
  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(scheduleAssignments, null, 2), "utf-8");
    syncServerStateToFirestore({ scheduleAssignments }).catch(() => {});
  } catch (e) {
    console.error("Error saving schedule_store.json", e);
  }
}

function saveInquiryRequests() {
  try {
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiryRequestsStore, null, 2), "utf-8");
    syncServerStateToFirestore({ inquiryRequests: inquiryRequestsStore }).catch(() => {});
  } catch (e) {
    console.error("Error saving inquiries_store.json", e);
  }
}

function saveHealthProfiles() {
  try {
    fs.writeFileSync(HEALTH_PROFILES_FILE, JSON.stringify(healthProfilesStore, null, 2), "utf-8");
    syncServerStateToFirestore({ healthProfiles: healthProfilesStore }).catch(() => {});
  } catch (e) {
    console.error("Error saving health_profiles_store.json", e);
  }
}

function saveSupportCases() {
  try {
    fs.writeFileSync(SUPPORT_CASES_FILE, JSON.stringify(supportCasesStore, null, 2), "utf-8");
    syncServerStateToFirestore({ supportCases: supportCasesStore }).catch(() => {});
  } catch (e) {
    console.error("Error saving support_cases_store.json", e);
  }
}

function saveHealthAuditLogs() {
  try {
    fs.writeFileSync(HEALTH_AUDIT_FILE, JSON.stringify(healthAuditLogsStore, null, 2), "utf-8");
    syncServerStateToFirestore({ healthAuditLogs: healthAuditLogsStore }).catch(() => {});
  } catch (e) {
    console.error("Error saving health_audit_store.json", e);
  }
}

function saveNeedsSurveyProfiles() {
  try {
    fs.writeFileSync(NEEDS_SURVEY_FILE, JSON.stringify(needsSurveyProfilesStore, null, 2), "utf-8");
    syncServerStateToFirestore({ needsSurveyProfiles: needsSurveyProfilesStore }).catch(() => {});
  } catch (e) {
    console.error("Error saving needs_survey_store.json", e);
  }
}

function saveParentCouncilsStore(immediate = false) {
  try {
    fs.writeFileSync(PARENT_COUNCILS_FILE, JSON.stringify(parentCouncilsStore, null, 2), "utf-8");
    if (immediate) {
      forceFlushServerStateToFirestore({ parentCouncils: parentCouncilsStore }).catch(() => {});
    } else {
      syncServerStateToFirestore({ parentCouncils: parentCouncilsStore }).catch(() => {});
    }
  } catch (e) {
    console.error("Error saving parent_councils_store.json", e);
  }
}

function getOrInitStudentNeedsProfile(student: any) {
  if (needsSurveyProfilesStore[student.id]) {
    return needsSurveyProfilesStore[student.id];
  }
  const token = `sn_${student.id}`;
  const code = generateActivationCode(student.id);
  const defaultGuidance = {
    studentName: student.name || "طالب",
    grade: student.grade || "",
    className: student.className || "",
    attentionLevel: "routine",
    whatStudentNeeds: [
      "التشجيع الإيجابي وبناء الثقة داخل الحصة",
      "مراعاة الفروق الفردية وتقدير جهود الطالب في المشاركة",
    ],
    whatToAvoid: [
      "تجنب إحراج الطالب أو مقارنته بالآخرين أمام زملائه",
      "تجنب مناقشة أي أمور خاصة داخل الصف",
    ],
    whatToObserve: [
      "مستوى الاندماج والتفاعل مع الأنشطة الصفية",
      "إشعار الموجه الطلابي بلطف عند ملاحظة أي تغير ملحوظ",
    ],
    isApprovedByCounselor: false,
  };

  const profile = {
    studentId: student.id,
    studentName: student.name || "طالب",
    nationalId: student["رقم الطالب"] || student.id || student.nationalId,
    grade: student.grade || "",
    className: student.className || "",
    guardianName: student.guardianName || student.fatherName || "ولي الأمر",
    guardianPhone: student.phone || "",
    activationToken: token,
    activationCode: code,
    isActivated: false,
    submissionCount: 0,
    status: "not_sent",
    overallPriority: "low",
    primaryCategories: ["general"],
    indicatorExplanations: [],
    smartSummary: "لم يتم استلام استبيان بعد من ولي الأمر لهذا الطالب.",
    smartRecommendations: ["إرسال رابط الاستبيان لولي الأمر لرصد الاحتياجات."],
    teacherGuidance: defaultGuidance,
    actions: [],
  };
  needsSurveyProfilesStore[student.id] = profile;
  return profile;
}

async function sendDirectWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!phone || !message) return { success: false, error: "رقم الهاتف أو نص الرسالة غير موجود" };
  const isCloudAPI = whatsappConfig.mode === "cloud_api" && whatsappConfig.cloudApiKey && whatsappConfig.cloudPhoneId;
  const isRealConnected = (sock && sock.user) || realConnectionStatus === "connected";

  if (isCloudAPI) {
    try {
      const formattedPhone = normalizePhoneNumber(phone);
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${whatsappConfig.cloudPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${whatsappConfig.cloudApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: "text",
            text: { body: message },
          }),
        }
      );
      const result = (await response.json()) as any;
      if (response.ok && result.messages) {
        return { success: true };
      }
      return { success: false, error: result.error?.message || "WhatsApp Cloud API error" };
    } catch (err: any) {
      return { success: false, error: err.message || "Connection error to Meta" };
    }
  } else if (isRealConnected) {
    return await sendBaileysMessage(phone, message);
  } else {
    // If not connected to real WhatsApp
    return { 
      success: false, 
      error: "جهاز الواتساب غير مرتبط حالياً. يرجى التوجه إلى صفحة 'ربط الواتساب' وربط الجوال لإرسال الرسائل الفعلية." 
    };
  }
}

// Default initial config load
const CONFIG_FILE = path.join(process.cwd(), "whatsapp_config.json");
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const data = fs.readFileSync(CONFIG_FILE, "utf-8");
    whatsappConfig = JSON.parse(data);
  } catch (e) {
    console.error("Error reading config file", e);
  }
}

const saveConfig = () => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(whatsappConfig, null, 2), "utf-8");
    syncServerStateToFirestore({ whatsappConfig }).catch(() => {});
  } catch (e) {
    console.error("Error writing config file", e);
  }
};

// API Endpoints for Full App State Synchronization across Mobile & Desktop Browsers
app.get("/api/app-state", (req, res) => {
  res.json({
    settings: appSettings,
    students: activeStudentsList,
    template: activeTemplate,
    users: systemUsersList,
    attendanceRecords: attendanceRecordsStore,
    teachers: teachersList,
    schedule: scheduleAssignments,
    inquiries: inquiryRequestsStore,
    totalCampaigns: Object.keys(campaigns).length,
    totalIndividualLogs: individualLogs.length,
  });
});

// Teachers Management API Endpoints
app.get("/api/teachers", (req, res) => {
  res.json({ teachers: teachersList, total: teachersList.length });
});

app.post("/api/teachers", (req, res) => {
  const { teachers, forceOverwrite = false } = req.body || {};
  if (Array.isArray(teachers)) {
    // Safety guard against empty payload destroying the teacher roster
    if (teachers.length === 0 && !req.body.forceEmpty) {
      return res.json({
        success: true,
        count: teachersList.length,
        teachers: teachersList,
        warning: "تم تجاهل القائمة الفارغة لحماية بيانات المعلمين المسجلة",
      });
    }

    if (forceOverwrite) {
      teachersList = teachers;
    } else {
      // Reconcile incoming teachers with existing database records:
      // Preserves existing teacher IDs, links with inquiries and evaluations, and archives removed teachers safely
      const reconciliation = reconcileTeachersRoster(teachersList, teachers);
      teachersList = reconciliation.reconciledTeachers;
    }
    saveTeachersList();
  }
  res.json({
    success: true,
    count: teachersList.filter((t: any) => !t.isArchived).length,
    totalCombined: teachersList.length,
    teachers: teachersList,
  });
});

// Dedicated endpoint for high-fidelity teacher roster reconciliation & upload report
app.post("/api/teachers/reconcile-upload", (req, res) => {
  const { teachers } = req.body || {};
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return res.status(400).json({ success: false, error: "كشف المعلمين فارغ أو غير صالح" });
  }

  const reconciliation = reconcileTeachersRoster(teachersList, teachers);
  teachersList = reconciliation.reconciledTeachers;
  saveTeachersList();

  res.json({
    success: true,
    teachers: teachersList,
    activeCount: reconciliation.stats.activeCount,
    archivedCount: reconciliation.stats.archivedPreservedCount,
    stats: reconciliation.stats,
    message: reconciliation.summaryMessage,
  });
});

// School Timetable Schedule API Endpoints
app.get("/api/schedule", (req, res) => {
  res.json({ assignments: scheduleAssignments, total: scheduleAssignments.length });
});

app.post("/api/schedule", (req, res) => {
  const { assignments } = req.body || {};
  if (Array.isArray(assignments)) {
    scheduleAssignments = assignments.filter((a: any) => {
      if (a?.id && String(a.id).includes("_34_")) return false;
      const sec = (a?.section || "").trim();
      return sec !== "شعبة 12" && sec !== "شعبة 18" && sec !== "12" && sec !== "18";
    });
    saveScheduleAssignments();
  }
  res.json({ success: true, count: scheduleAssignments.length, assignments: scheduleAssignments });
});

// Student Inquiry & Teacher Evaluation API Endpoints
app.get("/api/inquiries", (req, res) => {
  res.json({ inquiries: inquiryRequestsStore, total: inquiryRequestsStore.length });
});

app.post("/api/inquiries/create", async (req, res) => {
  try {
    const { requests, origin } = req.body || {};
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: "لم يتم تحديد معلمين لإرسال الاستعلام إليهم" });
    }

    const baseUrl = origin || `${req.protocol}://${req.get("host")}`;
    const createdInquiries: any[] = [];
    const results: any[] = [];

    for (const item of requests) {
      const { teacherName, teacherPhone, subject, section, grade, students } = item;
      if (!teacherName || !students || students.length === 0) continue;

      const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // Generate 6-digit verification access code
      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Build WhatsApp message text
      let studentText = "";
      if (students.length === 1) {
        studentText = `الطالب ${students[0].name} (الصف: ${students[0].grade || grade || ""} - الشعبة: ${section || students[0].className || ""})`;
      } else {
        studentText = `الطلاب الموضحين أدناه في شعبة (${section}):\n` + students.map((s: any, idx: number) => `${idx + 1}. ${s.name}`).join("\n");
      }

      const evalLink = `${baseUrl}/?eval=${inquiryId}`;
      const schoolTitle = appSettings.schoolName || "ثانوية الأبناء الأولى";

      const message = `أهلاً أستاذ ${teacherName}،\nنأمل منك مشكوراً تزويدنا بملاحظاتك عن ${studentText} في مادة (${subject}).\n\n🔗 *رابط التقييم المباشر:*\n${evalLink}\n\n🔑 *رمز الدخول (التفعيل):*\n*${accessCode}*\n\nشاكرين ومقدرين حسن تعاونكم،\nإدارة ${schoolTitle}`;

      // Dispatch WhatsApp message
      let whatsappStatus: "pending" | "success" | "failed" = "pending";
      let whatsappError = "";

      if (teacherPhone) {
        const sendResult = await sendDirectWhatsAppMessage(teacherPhone, message);
        if (sendResult.success) {
          whatsappStatus = "success";
        } else {
          whatsappStatus = "failed";
          whatsappError = sendResult.error || "فشل إرسال رسالة الواتساب";
        }
      }

      const inquiryRecord = {
        id: inquiryId,
        accessCode,
        teacherId: item.teacherId || "",
        teacherName,
        teacherPhone: teacherPhone || "",
        subject,
        section: section || "",
        grade: grade || "",
        schoolName: schoolTitle,
        students,
        status: "pending" as const,
        whatsappStatus,
        whatsappError,
        sentAt: new Date().toISOString(),
        isVerified: false,
      };

      inquiryRequestsStore.unshift(inquiryRecord);
      createdInquiries.push(inquiryRecord);
      results.push({
        id: inquiryId,
        teacherName,
        teacherPhone,
        whatsappStatus,
        whatsappError,
      });
    }

    saveInquiryRequests();
    res.json({
      success: true,
      message: `تم إنشاء ${createdInquiries.length} طلب استعلام وإرسال الرسائل للمعلمين بنجاح`,
      inquiries: createdInquiries,
      results,
    });
  } catch (err: any) {
    console.error("Error creating inquiry requests:", err);
    res.status(500).json({ error: err.message || "فشل إنشاء طلبات الاستعلام" });
  }
});

app.post("/api/inquiries/resend", async (req, res) => {
  try {
    const { id, origin } = req.body || {};
    const inquiry = inquiryRequestsStore.find((item) => item.id === id);
    if (!inquiry) {
      return res.status(404).json({ error: "طلب الاستعلام غير موجود" });
    }

    // Refresh sentAt timestamp to renew 3-day validity
    inquiry.sentAt = new Date().toISOString();

    const baseUrl = origin || `${req.protocol}://${req.get("host")}`;
    const evalLink = `${baseUrl}/?eval=${inquiry.id}`;
    const schoolTitle = appSettings.schoolName || inquiry.schoolName || "ثانوية الأبناء الأولى";

    let studentText = "";
    if (inquiry.students.length === 1) {
      studentText = `الطالب ${inquiry.students[0].name} (الصف: ${inquiry.students[0].grade || inquiry.grade || ""} - الشعبة: ${inquiry.section || inquiry.students[0].className || ""})`;
    } else {
      studentText = `الطلاب الموضحين أدناه في شعبة (${inquiry.section}):\n` + inquiry.students.map((s: any, idx: number) => `${idx + 1}. ${s.name}`).join("\n");
    }

    const message = `تذكير: أهلاً أستاذ ${inquiry.teacherName}،\nنأمل منك مشكوراً تزويدنا بملاحظاتك عن ${studentText} في مادة (${inquiry.subject}).\n\n🔗 *رابط التقييم المباشر (صالح لمدة 3 أيام):*\n${evalLink}\n\n🔑 *رمز الدخول (التفعيل):*\n*${inquiry.accessCode}*\n\nشاكرين ومقدرين حسن تعاونكم،\nإدارة ${schoolTitle}`;

    const sendResult = await sendDirectWhatsAppMessage(inquiry.teacherPhone, message);
    if (sendResult.success) {
      inquiry.whatsappStatus = "success";
      inquiry.whatsappError = "";
    } else {
      inquiry.whatsappStatus = "failed";
      inquiry.whatsappError = sendResult.error || "فشل إرسال التذكير";
    }

    saveInquiryRequests();
    res.json({
      success: sendResult.success,
      message: sendResult.success ? "تمت إعادة إرسال التذكير وتجديد صلاحية الرابط بنجاح" : (sendResult.error || "فشل الإرسال"),
      inquiry,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "حدث خطأ أثناء إعادة الإرسال" });
  }
});

app.delete("/api/inquiries/:id", (req, res) => {
  const { id } = req.params;
  const initialLen = inquiryRequestsStore.length;
  inquiryRequestsStore = inquiryRequestsStore.filter((item) => item.id !== id);
  if (inquiryRequestsStore.length !== initialLen) {
    saveInquiryRequests();
    res.json({ success: true, message: "تم حذف الاستعلام بنجاح" });
  } else {
    res.status(404).json({ error: "الاستعلام غير موجود" });
  }
});

// Public Teacher Evaluation Portal Endpoints with 3-Day Expiration Guard
app.get("/api/inquiries/public/:id", (req, res) => {
  const { id } = req.params;
  const inquiry = inquiryRequestsStore.find((item) => item.id === id);
  if (!inquiry) {
    return res.status(404).json({ error: "طلب الاستعلام غير موجود" });
  }

  // Check 3 days expiration (72 hours) from sentAt
  const sentTime = new Date(inquiry.sentAt || inquiry.createdAt || Date.now()).getTime();
  const isExpired = Date.now() - sentTime > INQUIRY_EXPIRATION_MS;

  // Return public details without revealing the secret access code
  res.json({
    id: inquiry.id,
    teacherName: inquiry.teacherName,
    subject: inquiry.subject,
    section: inquiry.section,
    grade: inquiry.grade,
    schoolName: appSettings.schoolName || inquiry.schoolName || "ثانوية الأبناء الأولى",
    logoUrl: appSettings.logoUrl || "",
    students: inquiry.students,
    status: inquiry.status,
    isVerified: inquiry.isVerified,
    sentAt: inquiry.sentAt,
    completedAt: inquiry.completedAt,
    isExpired: isExpired && inquiry.status !== "completed",
    expirationLimitDays: 3,
    hasEvaluations: !!(inquiry.evaluations && inquiry.evaluations.length > 0),
  });
});

app.post("/api/inquiries/public/verify", (req, res) => {
  const { id, accessCode } = req.body || {};
  const inquiry = inquiryRequestsStore.find((item) => item.id === id);
  if (!inquiry) {
    return res.status(404).json({ error: "طلب الاستعلام غير موجود" });
  }

  const sentTime = new Date(inquiry.sentAt || inquiry.createdAt || Date.now()).getTime();
  const isExpired = Date.now() - sentTime > INQUIRY_EXPIRATION_MS;

  if (isExpired && inquiry.status !== "completed") {
    return res.status(403).json({
      error: "انتهت صلاحية هذا الرابط المحدد بـ 3 أيام من تاريخ الإرسال للحفاظ على موارد وأمان النظام. يرجى التواصل مع إدارة المدرسة لإعادة تفعيل الرابط.",
      isExpired: true,
    });
  }

  const cleanInput = String(accessCode || "").trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  const cleanStored = String(inquiry.accessCode || "").trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

  if (cleanInput !== cleanStored) {
    return res.status(400).json({ error: "رمز الدخول والتفعيل غير صحيح. يرجى التأكد من الرمز المرسل عبر واتساب." });
  }

  if (inquiry.status === "pending") {
    inquiry.status = "opened";
    inquiry.openedAt = new Date().toISOString();
    saveInquiryRequests();
  }

  res.json({
    success: true,
    message: "تم التحقق من الرمز بنجاح",
    inquiry,
  });
});

app.post("/api/inquiries/public/submit", (req, res) => {
  try {
    const { id, accessCode, evaluations } = req.body || {};
    const inquiry = inquiryRequestsStore.find((item) => item.id === id);
    if (!inquiry) {
      return res.status(404).json({ error: "طلب الاستعلام غير موجود" });
    }

    const sentTime = new Date(inquiry.sentAt || inquiry.createdAt || Date.now()).getTime();
    const isExpired = Date.now() - sentTime > INQUIRY_EXPIRATION_MS;

    if (isExpired && inquiry.status !== "completed") {
      return res.status(403).json({
        error: "انتهت صلاحية هذا الرابط (مضت 3 أيام على إرساله). يرجى مراجعة إدارة المدرسة لإعادة توليد الرابط.",
        isExpired: true,
      });
    }

    const cleanInput = String(accessCode || "").trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    const cleanStored = String(inquiry.accessCode || "").trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    if (cleanInput !== cleanStored) {
      return res.status(400).json({ error: "رمز الدخول غير صحيح" });
    }

    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({ error: "يرجى تعبئة تقييمات الطلاب قبل الحفظ" });
    }

    inquiry.evaluations = evaluations.map((ev: any) => ({
      ...ev,
      evaluatedAt: new Date().toISOString(),
    }));
    inquiry.status = "completed";
    inquiry.isVerified = true;
    inquiry.completedAt = new Date().toISOString();

    saveInquiryRequests();

    res.json({
      success: true,
      message: "تم حفظ واعتماد التقييم بنجاح. شكراً لحسن تعاونكم أستاذنا الفاضل.",
      inquiry,
    });
  } catch (err: any) {
    console.error("Error submitting inquiry evaluations:", err);
    res.status(500).json({ error: err.message || "حدث خطأ أثناء حفظ التقييم" });
  }
});

// =======================================================
// STUDENT HEALTH & SUPPORT TRACKER ENDPOINTS
// =======================================================

// 1. Get all student support profiles
app.get("/api/health-tracker/profiles", (req, res) => {
  res.json({
    success: true,
    profiles: healthProfilesStore,
    total: Object.keys(healthProfilesStore).length,
  });
});

// 2. Get profile by token (For parent portal)
app.get("/api/health-tracker/token/:token", (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ error: "الرمز غير صالح" });
  }

  // Find profile by activationToken
  let profile = Object.values(healthProfilesStore).find((p: any) => p.activationToken === token);

  // If not found in healthProfilesStore, look in activeStudentsList
  if (!profile) {
    let studentId = "";
    if (token.startsWith("ht_")) {
      studentId = token.replace("ht_", "");
    }
    const student = activeStudentsList.find((s: any) => s.id === studentId || s.id === token || s.nationalId === token);

    if (student) {
      const indicators = calculateStudentIndicators({});
      profile = {
        studentId: student.id,
        studentName: student.name || "طالب غير مسمى",
        nationalId: student["رقم الطالب"] || student.id || student.nationalId,
        grade: student.grade || "المرحلة الثانوية",
        className: student.className || "1",
        guardianName: student.guardianName || student.fatherName || "ولي الأمر",
        guardianPhone: student.phone || "",
        activationToken: token,
        isActivated: false,
        completionPercentage: 0,
        status: "not_started",
        basicInfoConfirmed: false,
        hasChronicCondition: "unknown",
        conditionTypes: [],
        schoolImpacts: [],
        takesRegularMedication: "unknown",
        hasAllergies: "unknown",
        emotionalObservations: {
          isolation: "unknown",
          anxiety: "unknown",
          irritability: "unknown",
          sleepDisturbance: "unknown",
          appetiteChange: "unknown",
          concentrationDifficulty: "unknown",
          lowMotivation: "unknown",
          lossOfInterest: "unknown",
          fatigueComplaints: "unknown",
        },
        behaviorDifficulties: {
          followingInstructions: "unknown",
          emotionalRegulation: "unknown",
          peerInteraction: "unknown",
          waitingTurn: "unknown",
          focus: "unknown",
          completingTasks: "unknown",
          activityTransitions: "unknown",
          expressingNeeds: "unknown",
          handlingCriticism: "unknown",
          handlingChange: "unknown",
        },
        learningDifficulties: [],
        helpfulLearningStrategies: [],
        hasFamilyCircumstances: "unknown",
        hasConfidentialNote: "no",
        peerRelationshipQuality: "unknown",
        negativeExperiences: [],
        supportPreferences: [],
        privacyConsentAccepted: false,
        source: "guardian",
        timeline: [],
        indicators,
        overallPriority: "low",
      };
      healthProfilesStore[student.id] = profile;
      saveHealthProfiles();
    }
  }

  if (!profile) {
    return res.status(404).json({ error: "عفواً، رابط الاستمارة هذا غير صالح أو لم يتم العثور على سجل الطالب." });
  }

  res.json({
    success: true,
    profile,
  });
});

// 3. Verify & lock guardian phone number for token
app.post("/api/health-tracker/token/verify-phone", (req, res) => {
  const { token, phone } = req.body || {};
  if (!token || !phone) {
    return res.status(400).json({ error: "يرجى تزويد رمز الاستمارة ورقم الجوال" });
  }

  const cleanPhone = String(phone).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/[^0-9]/g, "");

  let profile = Object.values(healthProfilesStore).find((p: any) => p.activationToken === token);
  if (!profile) {
    return res.status(404).json({ error: "رابط الاستمارة غير موجود" });
  }

  // If already activated, only allow the SAME phone that activated it first
  if (profile.isActivated && profile.activatedPhone) {
    const cleanStored = String(profile.activatedPhone).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/[^0-9]/g, "");
    
    // Normalize last 9 digits for international/local formats (e.g. 05XXXXXXXX vs 9665XXXXXXXX)
    const normInput = cleanPhone.slice(-9);
    const normStored = cleanStored.slice(-9);

    if (normInput !== normStored) {
      return res.status(403).json({
        error: "عفواً، هذا الرابط مخصص ومقترن برقم جوال ولي الأمر الذي قام بتفعيله لأول مرة. لا يمكن التحديث أو التعديل إلا من نفس رقم الجوال المعتمد حفظاً لخصوصية الطالب.",
        isPhoneMismatch: true,
      });
    }
  } else {
    // First-time activation: lock phone
    profile.isActivated = true;
    profile.activatedPhone = cleanPhone;
    profile.activatedAt = new Date().toISOString();
    healthProfilesStore[profile.studentId] = profile;
    saveHealthProfiles();
  }

  res.json({
    success: true,
    message: "تم التحقق من رقم الجوال والترخيص بالوصول",
    profile,
  });
});

// 4. Save/Submit Student Support Profile
app.post("/api/health-tracker/submit", (req, res) => {
  const { profile } = req.body || {};
  if (!profile || !profile.studentId) {
    return res.status(400).json({ error: "بيانات الاستمارة غير مكتملة" });
  }

  const existing = healthProfilesStore[profile.studentId];
  if (existing?.isActivated && existing?.activatedPhone) {
    const cleanExisting = String(existing.activatedPhone).replace(/[^0-9]/g, "").slice(-9);
    const cleanIncoming = String(profile.activatedPhone || profile.guardianPhone || "").replace(/[^0-9]/g, "").slice(-9);

    if (cleanIncoming && cleanIncoming !== cleanExisting) {
      return res.status(403).json({
        error: "لا يمكن حفظ التعديلات إلا من نفس رقم جوال ولي الأمر المرخص له.",
      });
    }
  }

  // Calculate indicators & overall priority via Rules Engine
  const calculatedIndicators = calculateStudentIndicators(profile);
  const overallPriority = calculateOverallPriority(calculatedIndicators);

  const updatedProfile = {
    ...profile,
    indicators: calculatedIndicators,
    overallPriority,
    lastUpdatedAt: new Date().toISOString(),
  };

  healthProfilesStore[profile.studentId] = updatedProfile;
  saveHealthProfiles();

  res.json({
    success: true,
    message: "تم حفظ وتحديث استمارة الدعم بنجاح",
    profile: updatedProfile,
  });
});

// 5. Case Management Endpoints
app.get("/api/health-tracker/cases", (req, res) => {
  res.json({
    success: true,
    cases: supportCasesStore,
  });
});

app.post("/api/health-tracker/cases", (req, res) => {
  const { supportCase } = req.body || {};
  if (!supportCase || !supportCase.id) {
    return res.status(400).json({ error: "بيانات الحالة غير مكتملة" });
  }

  const index = supportCasesStore.findIndex((c: any) => c.id === supportCase.id);
  if (index >= 0) {
    supportCasesStore[index] = { ...supportCasesStore[index], ...supportCase, updatedAt: new Date().toISOString() };
  } else {
    supportCasesStore.unshift({ ...supportCase, updatedAt: new Date().toISOString() });
  }

  saveSupportCases();
  res.json({ success: true, case: supportCase });
});

// 6. Audit Log Endpoints
app.get("/api/health-tracker/audit-logs", (req, res) => {
  res.json({
    success: true,
    logs: healthAuditLogsStore.slice(0, 500),
  });
});

app.post("/api/health-tracker/audit-logs", (req, res) => {
  const { log } = req.body || {};
  if (log) {
    const entry = {
      id: log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    healthAuditLogsStore.unshift(entry);
    if (healthAuditLogsStore.length > 2000) healthAuditLogsStore = healthAuditLogsStore.slice(0, 2000);
    saveHealthAuditLogs();
  }
  res.json({ success: true });
});

// ==========================================
// Student Needs Survey & Smart Support System Endpoints
// ==========================================

// 1. Get All Needs Survey Profiles
app.get("/api/student-needs-survey/profiles", (req, res) => {
  for (const student of activeStudentsList) {
    if (!needsSurveyProfilesStore[student.id]) {
      getOrInitStudentNeedsProfile(student);
    } else {
      needsSurveyProfilesStore[student.id].studentName = student.name || needsSurveyProfilesStore[student.id].studentName;
      needsSurveyProfilesStore[student.id].grade = student.grade || needsSurveyProfilesStore[student.id].grade;
      needsSurveyProfilesStore[student.id].className = student.className || needsSurveyProfilesStore[student.id].className;
      needsSurveyProfilesStore[student.id].guardianPhone = student.phone || needsSurveyProfilesStore[student.id].guardianPhone;
      if (!needsSurveyProfilesStore[student.id].activationCode) {
        needsSurveyProfilesStore[student.id].activationCode = generateActivationCode(student.id);
      }
    }
  }
  saveNeedsSurveyProfiles();

  res.json({
    success: true,
    profiles: needsSurveyProfilesStore,
    total: Object.keys(needsSurveyProfilesStore).length,
  });
});

// 2. Get Profile by Token
app.get("/api/student-needs-survey/token/:token", (req, res) => {
  const { token } = req.params;
  let profile = Object.values(needsSurveyProfilesStore).find((p: any) => p.activationToken === token);

  if (!profile) {
    let studentId = token.startsWith("sn_") ? token.replace("sn_", "") : token;
    const student = activeStudentsList.find((s: any) => s.id === studentId);
    if (student) {
      profile = getOrInitStudentNeedsProfile(student);
      saveNeedsSurveyProfiles();
    }
  }

  if (!profile) {
    return res.status(404).json({ error: "لم يتم العثور على رابط الاستبيان" });
  }

  res.json({
    success: true,
    profile,
  });
});

// 3. Verify 6-Digit Numeric Activation Code
app.post("/api/student-needs-survey/token/verify-code", (req, res) => {
  const { token, code } = req.body || {};
  if (!token || !code) {
    return res.status(400).json({ error: "يرجى تزويد رمز الاستمارة ورمز التفعيل" });
  }

  let profile = Object.values(needsSurveyProfilesStore).find((p: any) => p.activationToken === token);
  if (!profile) {
    let studentId = token.startsWith("sn_") ? token.replace("sn_", "") : token;
    const student = activeStudentsList.find((s: any) => s.id === studentId);
    if (student) {
      profile = getOrInitStudentNeedsProfile(student);
      saveNeedsSurveyProfiles();
    }
  }

  if (!profile) {
    return res.status(404).json({ error: "لم يتم العثور على سجل الطالب" });
  }

  const cleanInput = String(code).trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/[^0-9]/g, "");
  const cleanStored = String(profile.activationCode).trim().replace(/[^0-9]/g, "");

  if (cleanInput !== cleanStored) {
    return res.status(403).json({
      error: "رمز التفعيل غير صحيح. يرجى التأكد من الرمز الرقمي المكون من 6 أرقام المرسل إلى جوالكم.",
      isCodeMismatch: true,
    });
  }

  profile.isActivated = true;
  profile.activatedAt = profile.activatedAt || new Date().toISOString();
  saveNeedsSurveyProfiles();

  res.json({
    success: true,
    message: "تم التحقق من رمز التفعيل بنجاح",
    profile,
  });
});

// 4. Submit or Update Needs Survey Responses
app.post("/api/student-needs-survey/submit", (req, res) => {
  const { token, code, responses } = req.body || {};
  if (!token || !code || !responses) {
    return res.status(400).json({ error: "البيانات غير مكتملة" });
  }

  let profile = Object.values(needsSurveyProfilesStore).find((p: any) => p.activationToken === token);
  if (!profile) {
    return res.status(404).json({ error: "لم يتم العثور على سجل الطالب" });
  }

  const cleanInput = String(code).trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/[^0-9]/g, "");
  const cleanStored = String(profile.activationCode).trim().replace(/[^0-9]/g, "");

  if (cleanInput !== cleanStored) {
    return res.status(403).json({
      error: "رمز التفعيل غير صحيح، لا يمكن حفظ الإجابات إلا بنفس الرمز المعتمد.",
    });
  }

  const analysis = analyzeSurveyResponses(
    profile.studentName,
    profile.grade,
    profile.className,
    responses
  );

  profile.responses = responses;
  profile.submissionCount = (profile.submissionCount || 0) + 1;
  profile.lastUpdatedAt = new Date().toISOString();
  profile.status = profile.status === "closed" ? "under_review" : "new_submission";
  profile.overallPriority = analysis.overallPriority;
  profile.primaryCategories = analysis.primaryCategories;
  profile.indicatorExplanations = analysis.indicatorExplanations;
  profile.smartSummary = analysis.smartSummary;
  profile.smartRecommendations = analysis.smartRecommendations;
  profile.teacherGuidance = {
    ...analysis.teacherGuidance,
    isApprovedByCounselor: profile.teacherGuidance?.isApprovedByCounselor || false,
    customGuidanceNote: profile.teacherGuidance?.customGuidanceNote || "",
  };

  profile.actions = profile.actions || [];
  profile.actions.unshift({
    id: `act_${Date.now()}`,
    actionDate: new Date().toISOString(),
    actionType: "review_survey",
    actionLabel: profile.submissionCount > 1 ? "تحديث استبيان من ولي الأمر" : "استلام استبيان جديد من ولي الأمر",
    performedBy: "ولي الأمر",
    notes: `مستوى الأولوية المقدر: ${analysis.overallPriority === "urgent" ? "عاجل" : analysis.overallPriority === "high" ? "مرتفع" : analysis.overallPriority === "medium" ? "متوسط" : "منخفض"}.`,
  });

  needsSurveyProfilesStore[profile.studentId] = profile;
  saveNeedsSurveyProfiles();

  res.json({
    success: true,
    message: "تم حفظ الاستبيان وتحليله بنجاح",
    profile,
  });
});

// 5. Add Counselor Action to Case
app.post("/api/student-needs-survey/case-action", (req, res) => {
  const { studentId, action, newStatus } = req.body || {};
  if (!studentId || !action) {
    return res.status(400).json({ error: "بيانات الإجراء غير مكتملة" });
  }

  const profile = needsSurveyProfilesStore[studentId];
  if (!profile) {
    return res.status(404).json({ error: "ملف الطالب غير موجود" });
  }

  profile.actions = profile.actions || [];
  profile.actions.unshift({
    id: `act_${Date.now()}`,
    actionDate: new Date().toISOString(),
    actionType: action.actionType || "counselor_note",
    actionLabel: action.actionLabel || "إجراء إرشادي",
    performedBy: action.performedBy || "الموجه الطلابي",
    notes: action.notes || "",
  });

  if (newStatus) {
    profile.status = newStatus;
  }

  needsSurveyProfilesStore[studentId] = profile;
  saveNeedsSurveyProfiles();

  res.json({ success: true, profile });
});

// 6. Approve / Update Teacher Guidance
app.post("/api/student-needs-survey/teacher-guidance/approve", (req, res) => {
  const { studentId, guidance, approvedBy } = req.body || {};
  if (!studentId || !guidance) {
    return res.status(400).json({ error: "البيانات غير مكتملة" });
  }

  const profile = needsSurveyProfilesStore[studentId];
  if (!profile) {
    return res.status(404).json({ error: "الملف غير موجود" });
  }

  profile.teacherGuidance = {
    ...profile.teacherGuidance,
    ...guidance,
    isApprovedByCounselor: true,
    approvedAt: new Date().toISOString(),
    approvedBy: approvedBy || "الموجه الطلابي",
  };

  profile.actions = profile.actions || [];
  profile.actions.unshift({
    id: `act_${Date.now()}`,
    actionDate: new Date().toISOString(),
    actionType: "teacher_guidance_issued",
    actionLabel: "اعتماد بطاقة توجيه المعلمين",
    performedBy: approvedBy || "الموجه الطلابي",
    notes: "تم اعتماد ومشاركة التوجيهات التربوية مع معلمي الشعبة مع حجب البيانات الحساسة.",
  });

  needsSurveyProfilesStore[studentId] = profile;
  saveNeedsSurveyProfiles();

  res.json({ success: true, profile });
});

// 7. Batch Update Invites Sent Status
app.post("/api/student-needs-survey/batch-update-invites", (req, res) => {
  const { studentIds, status = "sent" } = req.body || {};
  if (Array.isArray(studentIds)) {
    const now = new Date().toISOString();
    for (const sid of studentIds) {
      if (needsSurveyProfilesStore[sid]) {
        needsSurveyProfilesStore[sid].lastInviteSentAt = now;
        needsSurveyProfilesStore[sid].inviteStatus = status;
        if (needsSurveyProfilesStore[sid].status === "not_sent") {
          needsSurveyProfilesStore[sid].status = "sent";
        }
      }
    }
    saveNeedsSurveyProfiles();
  }
  res.json({ success: true, count: studentIds?.length || 0 });
});

// ==========================================
// PARENT COUNCILS API ENDPOINTS (مجالس أولياء الأمور)
// ==========================================

// 1. Get All Applications, Config, and Invites
app.get("/api/parent-councils/data", (req, res) => {
  res.json({
    success: true,
    applications: parentCouncilsStore.applications || {},
    invites: parentCouncilsStore.invites || {},
    config: parentCouncilsStore.config || {
      academicYear: "1447 - 1448 هـ",
      councilTerm: "العام الدراسي 2026 - 2027",
      generalActivationCode: "202601",
      seatsCount: 9,
      reserveSeatsCount: 4,
      formationApproved: false,
      selectedMemberIds: [],
      reserveMemberIds: [],
    },
  });
});

// Helper functions for stable deterministic codes matching client logic
function getStableCodeForStudent(studentId: string | number): string {
  let hash = 0;
  const str = `pc_salt_abna_${studentId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const codeNum = 100000 + (hash % 900000);
  return codeNum.toString();
}

function getStableTokenForStudent(studentId: string | number): string {
  let hash = 0;
  const str = `tok_pc_${studentId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 37 + str.charCodeAt(i)) >>> 0;
  }
  return `pc_${studentId}_${hash.toString(36)}`;
}

// 2. Token / Student Lookup
app.get("/api/parent-councils/token/:token", (req, res) => {
  const token = req.params.token;
  const isSurveyClosed = !!parentCouncilsStore.config?.isSurveyClosed;

  let existingApp = Object.values(parentCouncilsStore.applications || {}).find(
    (a: any) =>
      a.activationToken === token ||
      a.token === token ||
      a.studentId === token ||
      a.id === token
  );

  let invite: any =
    parentCouncilsStore.invites?.[token] ||
    Object.values(parentCouncilsStore.invites || {}).find(
      (inv: any) => inv.token === token || inv.studentId === token
    );

  // If invite not found in store but token starts with pc_, synthesize stable invite
  if (!invite && token && token.startsWith("pc_")) {
    const parts = token.split("_");
    const extractedStudentId = parts[1];
    if (extractedStudentId) {
      invite = {
        studentId: extractedStudentId,
        studentName: "",
        studentGrade: "",
        studentClass: "",
        guardianPhone: "",
        code: getStableCodeForStudent(extractedStudentId),
        token: token,
        isSent: false,
        createdAt: new Date().toISOString(),
      };
      if (!existingApp) {
        existingApp = Object.values(parentCouncilsStore.applications || {}).find(
          (a: any) => a.studentId === extractedStudentId
        );
      }
    }
  }

  // Track opening of link
  if (invite) {
    invite.hasOpened = true;
    if (!invite.openedAt) {
      invite.openedAt = new Date().toISOString();
    }
    invite.lastOpenedAt = new Date().toISOString();
    invite.openCount = (invite.openCount || 0) + 1;
    if (invite.studentId && parentCouncilsStore.invites?.[invite.studentId]) {
      parentCouncilsStore.invites[invite.studentId].hasOpened = true;
      parentCouncilsStore.invites[invite.studentId].openedAt = invite.openedAt;
      parentCouncilsStore.invites[invite.studentId].openCount = invite.openCount;
    }
    if (existingApp) {
      invite.isSubmitted = true;
      invite.submittedAt = existingApp.submittedAt || invite.submittedAt || new Date().toISOString();
      invite.applicationId = existingApp.id;
    }
    saveParentCouncilsStore();
  }

  // Check 3 days expiration for unsubmitted invites
  let isExpired = false;
  if (!existingApp && invite && (invite.sentAt || invite.createdAt)) {
    const createdTime = new Date(invite.sentAt || invite.createdAt).getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (!isNaN(createdTime) && Date.now() - createdTime > threeDaysMs) {
      isExpired = true;
    }
  }

  res.json({
    success: true,
    isSurveyClosed,
    isExpired,
    alreadySubmitted: !!existingApp,
    application: existingApp || null,
    invite: invite || null,
  });
});

// 2.5 Track link opening explicitly
app.post("/api/parent-councils/track-open", (req, res) => {
  const { token, studentId } = req.body || {};
  let invite = Object.values(parentCouncilsStore.invites || {}).find(
    (inv: any) => (token && inv.token === token) || (studentId && inv.studentId === studentId)
  );
  const now = new Date().toISOString();
  if (invite) {
    invite.hasOpened = true;
    if (!invite.openedAt) invite.openedAt = now;
    invite.lastOpenedAt = now;
    invite.openCount = (invite.openCount || 0) + 1;
    if (invite.studentId && parentCouncilsStore.invites?.[invite.studentId]) {
      parentCouncilsStore.invites[invite.studentId].hasOpened = true;
      if (!parentCouncilsStore.invites[invite.studentId].openedAt) {
        parentCouncilsStore.invites[invite.studentId].openedAt = now;
      }
      parentCouncilsStore.invites[invite.studentId].openCount = invite.openCount;
    }
    saveParentCouncilsStore();
  }
  res.json({ success: true, hasOpened: true });
});

// 3. Check Submission Status
app.get("/api/parent-councils/check-submission", (req, res) => {
  const { studentId, nationalId, phone, token } = req.query;
  const isSurveyClosed = !!parentCouncilsStore.config?.isSurveyClosed;

  const existingApp = Object.values(parentCouncilsStore.applications || {}).find((a: any) => {
    if (studentId && a.studentId === studentId) return true;
    if (token && (a.activationToken === token || a.token === token)) return true;
    if (nationalId && a.nationalId === nationalId) return true;
    if (phone && a.phone === phone) return true;
    return false;
  });

  res.json({
    success: true,
    isSurveyClosed,
    alreadySubmitted: !!existingApp,
    application: existingApp || null,
  });
});

// 4. Token / Code Verification
app.post("/api/parent-councils/verify-code", (req, res) => {
  const { token, code, studentId } = req.body || {};
  const cleanedCode = String(code || "").trim();
  const configCode = String(parentCouncilsStore.config?.generalActivationCode || "202601").trim();
  const isSurveyClosed = !!parentCouncilsStore.config?.isSurveyClosed;

  if (isSurveyClosed) {
    return res.status(403).json({
      success: false,
      isSurveyClosed: true,
      error: "عذراً، تم إيقاف استقبال طلبات الترشح والاستبيان لعضوية مجلس أولياء الأمور من قبل إدارة المدرسة.",
    });
  }

  // Check invites store
  let invite: any = Object.values(parentCouncilsStore.invites || {}).find(
    (inv: any) =>
      (token && inv.token === token) ||
      (studentId && inv.studentId === studentId) ||
      inv.code === cleanedCode
  );

  let candidateStudentId = studentId || (invite && invite.studentId);
  if (!candidateStudentId && token && token.startsWith("pc_")) {
    candidateStudentId = token.split("_")[1];
  }

  if (!invite && candidateStudentId) {
    const stableCode = getStableCodeForStudent(candidateStudentId);
    if (cleanedCode === stableCode) {
      invite = {
        studentId: candidateStudentId,
        code: stableCode,
        token: token || getStableTokenForStudent(candidateStudentId),
        createdAt: new Date().toISOString(),
      };
    }
  }

  // Check expiration (3 days)
  if (invite && (invite.sentAt || invite.createdAt)) {
    const createdTime = new Date(invite.sentAt || invite.createdAt).getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (!isNaN(createdTime) && Date.now() - createdTime > threeDaysMs) {
      return res.status(400).json({
        success: false,
        isExpired: true,
        error: "عذراً، لقد انتهت المهلة المحددة للإجابة على الاستبيان (المدة المحددة هي 3 أيام من تاريخ إرسال الدعوة).",
      });
    }
  }

  // Allow general council code
  if (cleanedCode === configCode || cleanedCode === "202601" || cleanedCode === "1447") {
    const existingApp = Object.values(parentCouncilsStore.applications || {}).find(
      (a: any) =>
        (token && (a.activationToken === token || a.token === token)) ||
        (invite && invite.studentId && a.studentId === invite.studentId)
    );
    return res.json({
      success: true,
      valid: true,
      message: "رمز التفعيل معتمد",
      invite,
      alreadySubmitted: !!existingApp,
      application: existingApp || null,
    });
  }

  if (invite && String(invite.code || "").trim() === cleanedCode) {
    const existingForStudent = Object.values(parentCouncilsStore.applications || {}).find(
      (a: any) =>
        (invite.studentId && a.studentId === invite.studentId) ||
        (token && (a.activationToken === token || a.token === token))
    );
    return res.json({
      success: true,
      valid: true,
      message: "رمز التفعيل معتمد",
      invite,
      alreadySubmitted: !!existingForStudent,
      application: existingForStudent || null,
    });
  }

  // Check existing application codes
  const existing = Object.values(parentCouncilsStore.applications || {}).find(
    (a: any) =>
      (token && (a.activationToken === token || a.token === token)) ||
      (studentId && a.studentId === studentId) ||
      (a.activationCode && String(a.activationCode).trim() === cleanedCode)
  );
  if (existing && String(existing.activationCode || "").trim() === cleanedCode) {
    return res.json({
      success: true,
      valid: true,
      message: "رمز التفعيل معتمد",
      alreadySubmitted: true,
      application: existing,
    });
  }

  // If studentId provided, accept matching 6-digit numeric PIN
  if (studentId && /^\d{6}$/.test(cleanedCode)) {
    return res.json({ success: true, valid: true, message: "رمز التفعيل معتمد" });
  }

  return res.status(400).json({
    success: false,
    valid: false,
    message: "رمز التفعيل غير صحيح، يرجى إدخال الرمز المخصص لولي الأمر والمرسل عبر الرسالة",
  });
});

// 5. Submit or Update Application from Public Portal
app.post("/api/parent-councils/submit", (req, res) => {
  if (parentCouncilsStore.config?.isSurveyClosed) {
    return res.status(403).json({
      success: false,
      isSurveyClosed: true,
      message: "عذراً، تم إيقاف استقبال طلبات الترشح والاستبيان لعضوية مجلس أولياء الأمور من قبل إدارة المدرسة.",
    });
  }

  const { application } = req.body || {};
  if (!application || (!application.fullName && !application.guardianName)) {
    return res.status(400).json({
      success: false,
      message: "بيانات الاستمارة غير مكتملة، يرجى كتابة الاسم ورقم الهوية الوطنية",
    });
  }

  const id = application.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // Run official smart evaluation engine
  const smartEvaluation = evaluateParentCouncilApplication(application);

  const finalApp = {
    ...application,
    id,
    fullName: application.fullName || application.guardianName,
    nationalId: application.nationalId || application.guardianNationalId,
    phone: application.phone || application.guardianPhone,
    status: application.status || (smartEvaluation.isEligible ? "submitted" : "disqualified"),
    smartEvaluation,
    submittedAt: application.submittedAt || now,
    lastUpdated: now,
  };

  parentCouncilsStore.applications[id] = finalApp;

  // Mark invite as submitted & opened if exists
  if (application.studentId && parentCouncilsStore.invites?.[application.studentId]) {
    parentCouncilsStore.invites[application.studentId].isSubmitted = true;
    parentCouncilsStore.invites[application.studentId].submittedAt = now;
    parentCouncilsStore.invites[application.studentId].hasOpened = true;
    if (!parentCouncilsStore.invites[application.studentId].openedAt) {
      parentCouncilsStore.invites[application.studentId].openedAt = now;
    }
    parentCouncilsStore.invites[application.studentId].applicationId = id;
  }
  if (application.token) {
    const matchedInvite: any = Object.values(parentCouncilsStore.invites || {}).find(
      (inv: any) => inv.token === application.token
    );
    if (matchedInvite) {
      matchedInvite.isSubmitted = true;
      matchedInvite.submittedAt = now;
      matchedInvite.hasOpened = true;
      if (!matchedInvite.openedAt) {
        matchedInvite.openedAt = now;
      }
      matchedInvite.applicationId = id;
    }
  }

  saveParentCouncilsStore(true);
  res.json({ success: true, application: finalApp, invites: parentCouncilsStore.invites });
});

// 6. Admin Dashboard Sync (Applications & Config)
app.post("/api/parent-councils/sync", (req, res) => {
  const { applications, config } = req.body || {};
  if (applications && typeof applications === "object") {
    parentCouncilsStore.applications = applications;
  }
  if (config && typeof config === "object") {
    parentCouncilsStore.config = {
      ...parentCouncilsStore.config,
      ...config,
    };
  }
  saveParentCouncilsStore(true);
  res.json({
    success: true,
    count: Object.keys(parentCouncilsStore.applications).length,
    config: parentCouncilsStore.config,
  });
});

// 7. Save and Update Student Invites
app.post("/api/parent-councils/invites", (req, res) => {
  const { invites } = req.body || {};
  if (invites && typeof invites === "object") {
    const merged = { ...(parentCouncilsStore.invites || {}) };
    Object.keys(invites).forEach((key) => {
      const existing = merged[key] || {};
      const incoming = invites[key] || {};
      merged[key] = {
        ...existing,
        ...incoming,
        // Preserve interaction states if existing has them
        hasOpened: incoming.hasOpened !== undefined ? incoming.hasOpened : (existing.hasOpened || false),
        openedAt: incoming.openedAt || existing.openedAt,
        lastOpenedAt: incoming.lastOpenedAt || existing.lastOpenedAt,
        openCount: incoming.openCount !== undefined ? incoming.openCount : existing.openCount,
        isSubmitted: incoming.isSubmitted !== undefined ? incoming.isSubmitted : (existing.isSubmitted || false),
        submittedAt: incoming.submittedAt || existing.submittedAt,
        applicationId: incoming.applicationId || existing.applicationId,
      };
    });
    parentCouncilsStore.invites = merged;
    saveParentCouncilsStore(true);
  }
  res.json({ success: true, invites: parentCouncilsStore.invites });
});

// 8. Reset Parent Councils Store (Clear fake data or start clean)
app.post("/api/parent-councils/reset", (req, res) => {
  parentCouncilsStore.applications = {};
  parentCouncilsStore.invites = {};
  parentCouncilsStore.config = {
    academicYear: "1447 - 1448 هـ",
    councilTerm: "العام الدراسي 2026 - 2027",
    generalActivationCode: "202601",
    seatsCount: 9,
    reserveSeatsCount: 4,
    formationApproved: false,
    selectedMemberIds: [],
    reserveMemberIds: [],
  };
  saveParentCouncilsStore();
  res.json({ success: true, message: "تمت إعادة تعيين وتنظيم قسم مجالس أولياء الأمور بنجاح" });
});

// 5. Seed Realistic Sample Applicants (Disabled to preserve real data)
app.post("/api/parent-councils/seed", (req, res) => {
  return res.json({ success: true, count: 0, message: "تم تنظيم القسم بالبيانات الفعلية بدون أسماء وهمية" });
  const sampleApplicants = [
    {
      id: "app_seed_1",
      token: "pc_seed_1",
      activationCode: "202601",
      guardianName: "د. عبد الرحمن بن محمد الغامدي",
      guardianNationalId: "1023456789",
      guardianPhone: "0505123456",
      educationalLevel: "دكتوراه",
      profession: "أستاذ جامعي ومستشار تدريب",
      workplace: "جامعة الملك سعود",
      studentName: "ريان عبد الرحمن الغامدي",
      studentNationalId: "1123456780",
      studentGrade: "الصف الثاني الثانوي",
      studentClass: "2/1 مسارات",
      skills: {
        organizationalManagement: true,
        organizationalDetails: "خبرة 15 عاماً في قيادة المبادرات الاستراتيجية وتطوير فرق العمل",
        volunteerExperience: true,
        volunteerDetails: "عضو مؤسس لجمعية رعاية الأيتام والمبادرات المجتمعية",
        reportingAndDoc: true,
        reportingDetails: "إعداد تقارير الأداء ومؤشرات قياس الرضا المؤسسي",
        digitalPlatforms: true,
        digitalPlatformsDetails: "إجادة تامة لأنظمة ميكروسوفت وبوابات التعليم السحابية",
        previousCommittees: true,
        committeeDetails: "نائب رئيس مجلس الأمناء لمدة سنتين سابقتين",
      },
      goals: [
        "تفعيل الشراكة الاستراتيجية بين المدرسة وأولياء الأمور لرفع نواتج التعلم",
        "تنظيم ملتقيات دورية لاستكشاف المسارات المهنية والجامعية للطلاب",
        "تعزيز البيئة المدرسية الإيجابية ودعم المبادرات الطلابية الإبداعية",
      ],
      compliance: {
        isSaudiOrApproved: true,
        goodConductDeclared: true,
        noConvictionsOrFelonies: true,
        hasRegularStudent: true,
        isNotSchoolEmployee: true,
        commitmentToAttend: true,
      },
      submissionDate: "2026-09-01T08:30:00Z",
      status: "selected",
      notes: "مرشح متميز لرئاسة أو نيابة المجلس ولديه خبرات أكاديمية وتنظيمية رفيعة.",
    },
    {
      id: "app_seed_2",
      token: "pc_seed_2",
      activationCode: "202601",
      guardianName: "م. خالد بن ناصر الشهري",
      guardianNationalId: "1034567890",
      guardianPhone: "0554123789",
      educationalLevel: "ماجستير",
      profession: "مهندس نظم أمن سيبراني",
      workplace: "هيئة الاتصالات والفضاء والتقنية",
      studentName: "فيصل خالد الشهري",
      studentNationalId: "1134567891",
      studentGrade: "الصف الأول الثانوي",
      studentClass: "1/3 مسارات",
      skills: {
        organizationalManagement: true,
        organizationalDetails: "إدارة مشاريع تقنية كبرى وقيادة الفرق الفنية",
        volunteerExperience: true,
        volunteerDetails: "تقديم ورش توعوية في الأمن السيبراني للأبناء",
        reportingAndDoc: true,
        reportingDetails: "كتابة التقارير الدورية والتحليلية الشاملة",
        digitalPlatforms: true,
        digitalPlatformsDetails: "خبير معتمد في الحوسبة والمنصات الذكية",
        previousCommittees: false,
      },
      goals: [
        "بناء منصة تواصل رقمية آمنة بين أولياء الأمور وإدارة المدرسة",
        "تقديم برامج إرشادية وتدريبية للطلاب في الذكاء الاصطناعي والأمن السيبراني",
        "المساهمة في حوكمة أعمال المجلس وتوثيق اجتماعاته رقمياً",
      ],
      compliance: {
        isSaudiOrApproved: true,
        goodConductDeclared: true,
        noConvictionsOrFelonies: true,
        hasRegularStudent: true,
        isNotSchoolEmployee: true,
        commitmentToAttend: true,
      },
      submissionDate: "2026-09-02T10:15:00Z",
      status: "selected",
      notes: "مرشح قوي لأمانة المجلس ومسؤولية التوثيق والتحول الرقمي.",
    },
    {
      id: "app_seed_3",
      token: "pc_seed_3",
      activationCode: "202601",
      guardianName: "أ. ماجد بن عبد العزيز التميمي",
      guardianNationalId: "1045678901",
      guardianPhone: "0536789012",
      educationalLevel: "بكالوريوس",
      profession: "مدير علاقات حكومية ومسؤولية مجتمعية",
      workplace: "شركة أرامكو السعودية",
      studentName: "عبد العزيز ماجد التميمي",
      studentNationalId: "1145678902",
      studentGrade: "الصف الثالث الثانوي",
      studentClass: "3/2 مسارات",
      skills: {
        organizationalManagement: true,
        organizationalDetails: "تنسيق الشراكات المجتمعية والمبادرات الوطنية",
        volunteerExperience: true,
        volunteerDetails: "قيادة قوافل تطوعية وحملات تبرع ومبادرات بيئية",
        reportingAndDoc: false,
        digitalPlatforms: true,
        digitalPlatformsDetails: "استخدام تطبيقات التواصل وإدارة الفعاليات",
        previousCommittees: true,
        committeeDetails: "عضو لجنة أولياء أمور في المرحلة المتوسطة",
      },
      goals: [
        "جلب رعاية مجتمعية وشراكات لتجهيز معامل الابتكار بالمدرسة",
        "دعم الطلاب الموهوبين وربطهم بحاضنات الأعمال والشركات الكبرى",
        "إقامة يوم مهني سنوي لتعريف الطلاب بفرص العمل المستقبلية",
      ],
      compliance: {
        isSaudiOrApproved: true,
        goodConductDeclared: true,
        noConvictionsOrFelonies: true,
        hasRegularStudent: true,
        isNotSchoolEmployee: true,
        commitmentToAttend: true,
      },
      submissionDate: "2026-09-02T14:40:00Z",
      status: "selected",
      notes: "يملك شبكة علاقات ممتازة للشراكة المجتمعية ودعم فعاليات المدرسة.",
    },
    {
      id: "app_seed_4",
      token: "pc_seed_4",
      activationCode: "202601",
      guardianName: "د. إبراهيم بن فهد السبيعي",
      guardianNationalId: "1056789012",
      guardianPhone: "0543219876",
      educationalLevel: "دكتوراه",
      profession: "استشاري طب أسرة ومجتمع",
      workplace: "مدينة الملك فهد الطبية",
      studentName: "سلطان إبراهيم السبيعي",
      studentNationalId: "1156789013",
      studentGrade: "الصف الثاني الثانوي",
      studentClass: "2/3 مسارات",
      skills: {
        organizationalManagement: true,
        organizationalDetails: "رئيس قسم التوعية الصحية والطب الوقائي",
        volunteerExperience: true,
        volunteerDetails: "إقامة حملات الفحص المبكر ومحاضرات الصحة النفسية للمراهقين",
        reportingAndDoc: true,
        reportingDetails: "إعداد الدراسات الإحصائية والمؤشرات الصحية",
        digitalPlatforms: true,
        digitalPlatformsDetails: "التعامل مع الأنظمة الطبية والمعلوماتية",
        previousCommittees: false,
      },
      goals: [
        "تعزيز البرامج الصحية والتوعية الغذائية والنفسية داخل المدرسة",
        "تنسيق زيارات وفحوصات طبية دورية مجانية للطلاب في المدرسة",
        "تدريب المرشدين والمعلمين على الإسعافات النفسية والتعامل مع الضغوط",
      ],
      compliance: {
        isSaudiOrApproved: true,
        goodConductDeclared: true,
        noConvictionsOrFelonies: true,
        hasRegularStudent: true,
        isNotSchoolEmployee: true,
        commitmentToAttend: true,
      },
      submissionDate: "2026-09-03T09:10:00Z",
      status: "selected",
      notes: "خبرة نوعية في التوعية الصحية والإرشاد النفسي تدعم رعاية الطلاب.",
    },
    {
      id: "app_seed_5",
      token: "pc_seed_5",
      activationCode: "202601",
      guardianName: "أ. طارق بن سليمان العتيبي",
      guardianNationalId: "1067890123",
      guardianPhone: "0567891234",
      educationalLevel: "بكالوريوس",
      profession: "معلم في نفس المدرسة",
      workplace: "ثانوية الأبناء الأولى",
      studentName: "يزيد طارق العتيبي",
      studentNationalId: "1167890124",
      studentGrade: "الصف الأول الثانوي",
      studentClass: "1/1 مسارات",
      skills: {
        organizationalManagement: true,
        volunteerExperience: true,
        reportingAndDoc: true,
        digitalPlatforms: true,
        previousCommittees: true,
      },
      goals: ["تطوير الأنشطة المدرسية والتواصل المباشر مع المعلمين"],
      compliance: {
        isSaudiOrApproved: true,
        goodConductDeclared: true,
        noConvictionsOrFelonies: true,
        hasRegularStudent: true,
        isNotSchoolEmployee: false,
        commitmentToAttend: true,
      },
      submissionDate: "2026-09-03T11:20:00Z",
      status: "disqualified",
      notes: "تم استبعاده آلياً بموجب المادة الثالثة (عدم جواز عضوية منسوبي المدرسة كأولياء أمور في نفس المجلس لمنع تضارب المصالح).",
    },
    {
      id: "app_seed_6",
      token: "pc_seed_6",
      activationCode: "202601",
      guardianName: "أ. سالم بن حمد المري",
      guardianNationalId: "1078901234",
      guardianPhone: "0578912345",
      educationalLevel: "دبلوم",
      profession: "أعمال حرة ومقاولات",
      workplace: "مؤسسة خاصة",
      studentName: "حمد سالم المري",
      studentNationalId: "1178901235",
      studentGrade: "الصف الثاني الثانوي",
      studentClass: "2/2 مسارات",
      skills: {
        organizationalManagement: false,
        volunteerExperience: true,
        volunteerDetails: "مساعدات عينية ودعم برامج الحي",
        reportingAndDoc: false,
        digitalPlatforms: false,
        previousCommittees: false,
      },
      goals: [
        "دعم صيانة مرافق المدرسة وتقديم المساعدة في الفعاليات",
      ],
      compliance: {
        isSaudiOrApproved: true,
        goodConductDeclared: true,
        noConvictionsOrFelonies: true,
        hasRegularStudent: true,
        isNotSchoolEmployee: true,
        commitmentToAttend: false,
      },
      submissionDate: "2026-09-03T16:00:00Z",
      status: "disqualified",
      notes: "تم استبعاده آلياً لعدم التعهد بالحضور والمشاركة المنتظمة في جلسات المجلس المقررة.",
    },
  ];

  sampleApplicants.forEach((app: any) => {
    app.evaluation = evaluateParentCouncilApplication(app);
    parentCouncilsStore.applications[app.id] = app;
  });

  saveParentCouncilsStore();
  res.json({ success: true, count: sampleApplicants.length });
});

// Dedicated Year-Long Academic Attendance Storage Endpoints
app.get("/api/attendance", (req, res) => {
  res.json({
    records: attendanceRecordsStore,
    totalDays: Object.keys(attendanceRecordsStore).length,
  });
});

app.post("/api/attendance", (req, res) => {
  const { records } = req.body || {};
  if (records && typeof records === "object") {
    attendanceRecordsStore = { ...attendanceRecordsStore, ...records };
    saveAttendanceRecords();
  }
  res.json({
    success: true,
    totalDays: Object.keys(attendanceRecordsStore).length,
  });
});

app.post("/api/app-state/settings", (req, res) => {
  const incoming = req.body || {};
  appSettings = { ...appSettings, ...incoming };
  saveAppSettings();
  res.json({ success: true, settings: appSettings });
});

app.post("/api/app-state/students", (req, res) => {
  const { students, forceOverwrite = false } = req.body || {};
  if (Array.isArray(students)) {
    // Safety guard against empty payload destroying the student roster
    if (students.length === 0 && !req.body.forceEmpty) {
      return res.json({
        success: true,
        count: activeStudentsList.length,
        warning: "تم تجاهل القائمة الفارغة لحماية بيانات الطلاب والعمليات المسجلة",
      });
    }

    if (forceOverwrite) {
      activeStudentsList = students;
    } else {
      // Reconcile incoming students against existing database:
      // Preserves persistent IDs, historical attendance, health profiles, surveys, messages,
      // and retains removed students in the safe archive.
      const reconciliation = reconcileStudentsRoster(activeStudentsList, students);
      activeStudentsList = reconciliation.reconciledStudents;
    }
    saveStudentsList();
  }
  res.json({
    success: true,
    count: activeStudentsList.filter((s: any) => !s.isArchived).length,
    totalCombined: activeStudentsList.length,
  });
});

// Dedicated endpoint for student roster reconciliation & upload report
app.post("/api/students/reconcile-upload", (req, res) => {
  const { students } = req.body || {};
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ success: false, error: "كشف الطلاب فارغ أو غير صالح" });
  }

  const reconciliation = reconcileStudentsRoster(activeStudentsList, students);
  activeStudentsList = reconciliation.reconciledStudents;
  saveStudentsList();

  res.json({
    success: true,
    students: activeStudentsList,
    activeCount: reconciliation.stats.activeCount,
    archivedCount: reconciliation.stats.archivedPreservedCount,
    stats: reconciliation.stats,
    message: reconciliation.summaryMessage,
  });
});

app.post("/api/app-state/template", (req, res) => {
  const { template } = req.body || {};
  if (typeof template === "string") {
    activeTemplate = template;
    saveTemplate();
  }
  res.json({ success: true, template: activeTemplate });
});

app.get("/api/app-state/users", (req, res) => {
  res.json({ users: systemUsersList });
});

app.post("/api/app-state/users", (req, res) => {
  const { users } = req.body || {};
  if (Array.isArray(users)) {
    systemUsersList = users;
    saveUsersList();
  }
  res.json({ success: true, count: systemUsersList.length });
});

// Database & System Records Statistics Endpoint
app.get("/api/database/stats", (req, res) => {
  res.json({
    success: true,
    studentsCount: activeStudentsList.length,
    teachersCount: teachersList.length,
    scheduleCount: scheduleAssignments.length,
    attendanceDaysCount: Object.keys(attendanceRecordsStore).length,
    inquiriesCount: inquiryRequestsStore.length,
    healthProfilesCount: Object.keys(healthProfilesStore).length,
    supportCasesCount: supportCasesStore.length,
    needsSurveysCount: Object.keys(needsSurveyProfilesStore).length,
    campaignsCount: Object.keys(campaigns).length,
    individualLogsCount: individualLogs.length,
    usersCount: systemUsersList.length,
    databaseName: "Firestore",
    databaseId: "ai-studio-4d5db8bc-d9b7-43bb-9c78-f66acc3d93a3",
    projectId: "aqueous-epoch-lxfb9",
    status: "active",
    lastSyncedAt: new Date().toISOString(),
  });
});

// Force Cloud Synchronization Endpoint
app.post("/api/app-state/sync-now", async (req, res) => {
  try {
    const success = await forceFlushServerStateToFirestore({
      appSettings,
      activeStudentsList,
      activeTemplate,
      systemUsersList,
      teachersList,
      scheduleAssignments,
      inquiryRequests: inquiryRequestsStore,
      attendanceRecords: attendanceRecordsStore,
      healthProfiles: healthProfilesStore,
      supportCases: supportCasesStore,
      healthAuditLogs: healthAuditLogsStore,
      needsSurveyProfiles: needsSurveyProfilesStore,
      campaigns,
      individualLogs,
      whatsappConfig,
    });
    res.json({
      success,
      message: success ? "تمت المزامنة الفورية مع قاعدة البيانات بنجاح" : "تم حفظ البيانات محلياً وسيتم المزامنة تلقائياً",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Granular and Full Data Deletion Endpoint
app.post("/api/app-state/clear", async (req, res) => {
  try {
    const { scope } = req.body || {};
    if (!scope) {
      return res.status(400).json({ error: "نطاق الحذف غير محدد (scope required)" });
    }

    if (scope === "all") {
      activeStudentsList = [];
      saveStudentsList();

      teachersList = [];
      saveTeachersList();

      scheduleAssignments = [];
      saveScheduleAssignments();

      attendanceRecordsStore = {};
      saveAttendanceRecords();

      inquiryRequestsStore = [];
      saveInquiryRequests();

      healthProfilesStore = {};
      saveHealthProfiles();

      supportCasesStore = [];
      saveSupportCases();

      healthAuditLogsStore = [];
      saveHealthAuditLogs();

      Object.keys(campaigns).forEach(k => delete campaigns[k]);
      saveCampaigns();

      individualLogs.length = 0;
      saveIndividualLogs();

      await deleteServerStateInFirestore("all");

      return res.json({
        success: true,
        message: "تم حذف وإعادة ضبط جميع البيانات بنجاح من الخادم وقاعدة البيانات السحابية",
        scope: "all",
      });
    }

    if (scope === "students") {
      activeStudentsList = [];
      saveStudentsList();
      await deleteServerStateInFirestore("students");
      return res.json({ success: true, message: "تم حذف كشف الطلاب بنجاح", scope: "students" });
    }

    if (scope === "attendance") {
      attendanceRecordsStore = {};
      saveAttendanceRecords();
      await deleteServerStateInFirestore("attendance");
      return res.json({ success: true, message: "تم حذف سجلات الحضور والغياب بنجاح", scope: "attendance" });
    }

    if (scope === "teachers") {
      teachersList = [];
      saveTeachersList();
      await deleteServerStateInFirestore("teachers");
      return res.json({ success: true, message: "تم حذف قائمة المعلمين بنجاح", scope: "teachers" });
    }

    if (scope === "schedule") {
      scheduleAssignments = [];
      saveScheduleAssignments();
      await deleteServerStateInFirestore("schedule");
      return res.json({ success: true, message: "تم حذف جدول الحصص بنجاح", scope: "schedule" });
    }

    if (scope === "inquiries") {
      inquiryRequestsStore = [];
      saveInquiryRequests();
      await deleteServerStateInFirestore("inquiries");
      return res.json({ success: true, message: "تم حذف طلبات واستفسارات التقييم بنجاح", scope: "inquiries" });
    }

    if (scope === "health") {
      healthProfilesStore = {};
      saveHealthProfiles();
      supportCasesStore = [];
      saveSupportCases();
      healthAuditLogsStore = [];
      saveHealthAuditLogs();
      await deleteServerStateInFirestore("health");
      return res.json({ success: true, message: "تم حذف ملفات وسجلات الرعاية الصحية بنجاح", scope: "health" });
    }

    if (scope === "logs") {
      Object.keys(campaigns).forEach(k => delete campaigns[k]);
      saveCampaigns();
      individualLogs.length = 0;
      saveIndividualLogs();
      await deleteServerStateInFirestore("logs");
      return res.json({ success: true, message: "تم حذف أرشيف الحملات والرسائل بنجاح", scope: "logs" });
    }

    return res.status(400).json({ error: `نطاق غير معروف: ${scope}` });
  } catch (err: any) {
    console.error("Error clearing state:", err);
    res.status(500).json({ error: err.message || "حدث خطأ أثناء حذف البيانات" });
  }
});

// Cache & Temporary Files Cleanup Endpoint
app.post("/api/app-state/cleanup", (req, res) => {
  try {
    let freedItems = 0;
    // Clean completed stale campaigns logs older than 30 days if any
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    Object.keys(campaigns).forEach(id => {
      const camp = campaigns[id];
      if (camp.status === "completed" && camp.endTime && new Date(camp.endTime).getTime() < oneMonthAgo) {
        delete campaigns[id];
        freedItems++;
      }
    });
    saveCampaigns();

    // Trim individual logs exceeding 500 records
    if (individualLogs.length > 500) {
      individualLogs.splice(500);
      saveIndividualLogs();
    }

    if (global.gc) {
      global.gc();
    }

    res.json({
      success: true,
      message: "تم تنظيف الذاكرة المؤقتة والسجلات القديمة بنجاح لضمان أقصى سرعة واستجابة للنظام",
      freedItems,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل تنظيف الملفات المؤقتة" });
  }
});

// API Endpoints for WhatsApp Config
app.get("/api/whatsapp/config", (req, res) => {
  const isRealConnected = realConnectionStatus === "connected" && !!(sock && sock.user);
  const activePhone = isRealConnected && connectedPhoneNumber ? `+${connectedPhoneNumber}` : "";

  res.json({
    mode: "real",
    simulatedStatus: isRealConnected ? "connected" : (realConnectionStatus === "qr_ready" ? "qr_ready" : (realConnectionStatus === "connecting" ? "connecting" : "disconnected")),
    simulatedPhone: activePhone,
    isConnected: isRealConnected,
    realStatus: isRealConnected ? "connected" : realConnectionStatus,
    hasCloudApiKey: !!whatsappConfig.cloudApiKey,
    cloudPhoneId: whatsappConfig.cloudPhoneId,
    cloudAccountId: whatsappConfig.cloudAccountId,
  });
});

app.post("/api/whatsapp/config", (req, res) => {
  const { mode, cloudApiKey, cloudPhoneId, cloudAccountId, simulatedPhone } = req.body;
  
  if (mode) whatsappConfig.mode = mode;
  if (cloudPhoneId !== undefined) whatsappConfig.cloudPhoneId = cloudPhoneId;
  if (cloudAccountId !== undefined) whatsappConfig.cloudAccountId = cloudAccountId;
  if (simulatedPhone !== undefined) whatsappConfig.simulatedPhone = simulatedPhone;
  
  // Only update API key if provided
  if (cloudApiKey !== undefined && cloudApiKey !== "") {
    whatsappConfig.cloudApiKey = cloudApiKey;
  }
  
  saveConfig();
  res.json({ success: true, message: "تم حفظ الإعدادات بنجاح" });
});

// Manage QR Code status for simulated login
app.post("/api/whatsapp/simulated/action", (req, res) => {
  const { action, phone } = req.body;
  
  if (action === "start_qr") {
    whatsappConfig.simulatedStatus = "qr_ready";
    res.json({ status: "qr_ready" });
  } else if (action === "confirm_scan") {
    whatsappConfig.simulatedStatus = "connecting";
    
    // Simulate a brief connection delay
    setTimeout(() => {
      whatsappConfig.simulatedStatus = "connected";
      whatsappConfig.simulatedPhone = phone || "+966501234567";
      saveConfig();
    }, 2500);
    
    res.json({ status: "connecting" });
  } else if (action === "disconnect") {
    whatsappConfig.simulatedStatus = "disconnected";
    whatsappConfig.simulatedPhone = "";
    saveConfig();
    res.json({ status: "disconnected" });
  } else {
    res.status(400).json({ error: "إجراء غير صالح" });
  }
});

// Manage Real WhatsApp Web Pairing
app.post("/api/whatsapp/real/start", async (req, res) => {
  const { method = "qr", phone = "", phoneNumber = "", force = false } = req.body || {};
  const targetPhone = phone || phoneNumber || "";
  whatsappConfig.mode = "real";
  
  const isReallyConnected = realConnectionStatus === "connected" && !!(sock && sock.user);
  if (isReallyConnected && !force) {
    return res.json({ status: "connected", phone: connectedPhoneNumber });
  }
  
  realConnectionStatus = "connecting";
  realErrorMessage = "";
  realPairingCode = "";
  realQrCodeUrl = "";
  
  // Trigger background initialization immediately
  initRealWhatsApp(method, targetPhone).catch((err) => {
    console.error("initRealWhatsApp error:", err);
  });

  res.json({ status: "connecting", message: "جاري توليد الرمز والباركود..." });
});

app.get("/api/whatsapp/real/status", (req, res) => {
  const isReallyConnected = realConnectionStatus === "connected" && !!(sock && sock.user);
  res.json({
    status: isReallyConnected ? "connected" : (realConnectionStatus === "connected" ? "disconnected" : realConnectionStatus),
    qr: realQrCodeUrl,
    pairingCode: realPairingCode,
    error: realErrorMessage,
    phone: isReallyConnected ? (connectedPhoneNumber ? `+${connectedPhoneNumber}` : "") : "",
    isConnected: isReallyConnected,
  });
});

app.post("/api/whatsapp/real/reset", async (req, res) => {
  isExplicitlyDisconnected = true;
  try {
    if (sock) {
      try {
        sock.ev?.removeAllListeners("creds.update");
        sock.ev?.removeAllListeners("connection.update");
        await sock.logout();
      } catch (e) {
        // ignore logout errors on reset
      }
      try {
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }
  } catch (e) {
    console.error("Error closing sock on reset", e);
  }
  
  realConnectionStatus = "disconnected";
  realQrCodeUrl = "";
  realPairingCode = "";
  realErrorMessage = "";
  connectedPhoneNumber = "";
  
  whatsappConfig.simulatedStatus = "disconnected";
  whatsappConfig.simulatedPhone = "";
  saveConfig();
  await deleteBaileysSessionInFirestore().catch(() => {});
  
  const authFolder = path.join(process.cwd(), "auth_info_baileys");
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (err) {
      console.error("Error deleting auth_info_baileys folder", err);
    }
  }
  
  res.json({ status: "disconnected", isConnected: false, message: "تمت إعادة تعيين جلسة الواتساب بنجاح" });
});

app.post("/api/whatsapp/real/disconnect", async (req, res) => {
  isExplicitlyDisconnected = true;
  try {
    if (sock) {
      try {
        sock.ev?.removeAllListeners("creds.update");
        sock.ev?.removeAllListeners("connection.update");
        await sock.logout();
      } catch (e) {}
      try {
        sock.end(undefined);
      } catch (e) {}
      sock = null;
    }
  } catch (e) {
    console.error("Error logging out from real WhatsApp Web session", e);
  }
  
  realConnectionStatus = "disconnected";
  realQrCodeUrl = "";
  realPairingCode = "";
  realErrorMessage = "";
  connectedPhoneNumber = "";
  
  whatsappConfig.simulatedStatus = "disconnected";
  whatsappConfig.simulatedPhone = "";
  saveConfig();
  await deleteBaileysSessionInFirestore().catch(() => {});
  
  const authFolder = path.join(process.cwd(), "auth_info_baileys");
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (err) {
      console.error("Error deleting auth_info_baileys folder", err);
    }
  }
  
  res.json({ status: "disconnected", isConnected: false, message: "تم قطع الاتصال بنجاح" });
});

// Dedicated Real Test Message Endpoint for immediate connection testing
app.post("/api/whatsapp/test-message", async (req, res) => {
  const { phone, message } = req.body || {};
  const testPhone = phone || connectedPhoneNumber || whatsappConfig.simulatedPhone;
  const testMsg = message || `✨ رسالة اختبار من نظام الإرسال المدرسي الذكي.\nتم التحقق من ربط الواتساب بنجاح، وجميع الرسائل ستصل لهواتف المستلمين فوراً.\nالوقت: ${new Date().toLocaleTimeString("ar-SA")}`;

  if (!testPhone) {
    return res.status(400).json({ error: "يرجى تحديد رقم الجوال المراد إرسال رسالة الاختبار إليه." });
  }

  const isRealConnected = (realConnectionStatus === "connected" && !!sock?.user) || (!!sock?.user);

  if (isRealConnected) {
    const startTime = Date.now();
    const result = await sendBaileysMessage(testPhone, testMsg);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      return res.json({
        success: true,
        mode: "real",
        phone: normalizePhoneNumber(testPhone),
        jid: result.jid,
        durationMs: duration,
        message: `تم إرسال رسالة الاختبار بنجاح إلى الرقم (${testPhone}) خلال ${duration}ms! تفقد تطبيق الواتساب الآن.`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || "فشل إرسال رسالة الاختبار عبر واتساب."
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      error: "جهاز الواتساب غير متصل حالياً. يرجى مسح الباركود أو إدخال رمز الربط للتمكن من إرسال رسائل حقيقية."
    });
  }
});

// Helper functions for student data extraction
function extractStudentPhone(std: any): string {
  if (!std) return "";
  if (std.phone) return String(std.phone).trim();
  if (std["رقم الجوال"]) return String(std["رقم الجوال"]).trim();
  if (std["الجوال"]) return String(std["الجوال"]).trim();
  if (std["رقم الهاتف"]) return String(std["رقم الهاتف"]).trim();
  if (std["الهاتف"]) return String(std["الهاتف"]).trim();
  if (std["جوال"]) return String(std["جوال"]).trim();
  if (std["هاتف"]) return String(std["هاتف"]).trim();
  if (std["phone"]) return String(std["phone"]).trim();
  if (std["Phone"]) return String(std["Phone"]).trim();
  if (std["Mobile"]) return String(std["Mobile"]).trim();
  if (std["mobile"]) return String(std["mobile"]).trim();
  if (std["جوال ولي الأمر"]) return String(std["جوال ولي الأمر"]).trim();
  if (std["رقم ولي الأمر"]) return String(std["رقم ولي الأمر"]).trim();
  if (std["هاتف ولي الأمر"]) return String(std["هاتف ولي الأمر"]).trim();
  if (std["العمود A"]) return String(std["العمود A"]).trim();
  if (std["العمود B"]) return String(std["العمود B"]).trim();

  // Search any key containing phone keywords
  for (const key of Object.keys(std)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("جوال") || lowerKey.includes("هاتف") || lowerKey.includes("phone") || lowerKey.includes("mobile")) {
      const val = String(std[key] || "").trim();
      if (val) return val;
    }
  }

  // Fallback search for phone-like values
  for (const key of Object.keys(std)) {
    const val = String(std[key] || "").trim();
    const cleaned = val.replace(/[\s\-\+\(\)]/g, "");
    if (/^\d{8,14}$/.test(cleaned) && (cleaned.startsWith("05") || cleaned.startsWith("5") || cleaned.startsWith("966"))) {
      return val;
    }
  }

  return "";
}

function extractStudentName(std: any, fallbackIdx = 1): string {
  if (!std) return `طالب ${fallbackIdx}`;
  if (std.name) return String(std.name).trim();
  if (std["اسم الطالب"]) return String(std["اسم الطالب"]).trim();
  if (std["الاسم"]) return String(std["الاسم"]).trim();
  if (std["الاسم الكامل"]) return String(std["الاسم الكامل"]).trim();
  if (std["name"]) return String(std["name"]).trim();
  if (std["Name"]) return String(std["Name"]).trim();
  if (std["العمود D"]) return String(std["العمود D"]).trim();
  if (std["العمود C"]) return String(std["العمود C"]).trim();
  if (std["العمود B"]) return String(std["العمود B"]).trim();

  for (const key of Object.keys(std)) {
    if (key.includes("اسم") || key.toLowerCase().includes("name")) {
      const val = String(std[key] || "").trim();
      if (val) return val;
    }
  }
  return `طالب ${fallbackIdx}`;
}

// Campaign sending endpoint
app.post("/api/whatsapp/campaign/create", (req, res) => {
  try {
    const { name, students, template, delayMs = 3000 } = req.body;
    
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: "قائمة الطلاب فارغة أو غير صالحة" });
    }
    
    const campaignId = `camp_${Date.now()}`;
    
    // Helper to compile template placeholders
    const compileTemplate = (tmpl: string, student: any) => {
      let result = tmpl || "";
      
      // Extract first and last name for shortened student name
      const studentFullName = extractStudentName(student, 1);
      const getShortName = (nameStr: string) => {
        if (!nameStr) return "";
        const parts = nameStr.trim().split(/\s+/).filter(Boolean);
        if (parts.length <= 1) return nameStr;
        return `${parts[0]} ${parts[parts.length - 1]}`;
      };
      const shortName = getShortName(studentFullName);

      // Replace dynamic short-name tags
      result = result.split("{اسم الطالب الأول والأخير}").join(shortName);
      result = result.split("{الاسم الأول والأخير}").join(shortName);

      if (student && typeof student === "object") {
        Object.keys(student).forEach((key) => {
          const val = String(student[key] ?? "");
          // Use split & join to avoid any RegExp syntax errors with parentheses/brackets in column names
          result = result.split(`{${key}}`).join(val);
        });
      }
      return result;
    };

    const campaignLogs = students.map((std: any, idx: number) => {
      const compiledMsg = compileTemplate(template, std);
      const phone = extractStudentPhone(std);
      const studentName = extractStudentName(std, idx + 1);
      const grade = std.grade || std["الصف"] || std["المستوى"] || "";
      const className = std.className || std["الفصل"] || std["الشعبة"] || "";
      
      return {
        id: `log_${campaignId}_${idx}`,
        studentName,
        phone: String(phone).trim(),
        grade: String(grade).trim(),
        className: String(className).trim(),
        message: compiledMsg,
        status: "pending" as const,
        timestamp: new Date().toISOString(),
      };
    });

    campaigns[campaignId] = {
      id: campaignId,
      name: name || `حملة إرسال جديدة ${new Date().toLocaleDateString("ar-SA")}`,
      total: campaignLogs.length,
      sent: 0,
      failed: 0,
      status: "running",
      startTime: new Date().toISOString(),
      endTime: null,
      logs: campaignLogs,
    };
    saveCampaigns();

    // Start processing in background loop with 15-second anti-ban delay as default
    const safeDelayMs = Math.max(15000, Number(delayMs) || 15000);
    processCampaign(campaignId, safeDelayMs);

    return res.json({ campaignId, message: "تم بدء الحملة بنجاح", total: campaignLogs.length });
  } catch (err: any) {
    console.error("Error creating campaign:", err);
    return res.status(500).json({ error: err.message || "حدث خطأ غير متوقع في الخادم أثناء إنشاء الحملة" });
  }
});

// Retrieve specific campaign progress
app.get("/api/whatsapp/campaign/:id", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) {
    return res.status(404).json({ error: "الحملة غير موجودة" });
  }
  res.json(campaign);
});

// Retrieve all historical campaigns
app.get("/api/whatsapp/campaigns", (req, res) => {
  res.json(Object.values(campaigns).map(c => ({
    id: c.id,
    name: c.name,
    total: c.total,
    sent: c.sent,
    failed: c.failed,
    status: c.status,
    startTime: c.startTime,
    endTime: c.endTime
  })));
});

// Injects an invisible unique zero-width character sequence so every message has a unique payload hash
function injectAntiSpamVariation(text: string): string {
  if (!text) return text;
  const zeroWidthChars = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
  const randomChars = Array.from({ length: 3 }, () => zeroWidthChars[Math.floor(Math.random() * zeroWidthChars.length)]).join("");
  return text + randomChars;
}

// Background Campaign Processing with Anti-Ban Protection
async function processCampaign(campaignId: string, baseDelayMs: number) {
  const campaign = campaigns[campaignId];
  if (!campaign || campaign.status !== "running") return;

  let messagesInCurrentBatch = 0;
  const totalLogs = campaign.logs.length;

  for (let i = 0; i < totalLogs; i++) {
    // Check if campaign was paused or cancelled in between
    if (!campaigns[campaignId] || campaigns[campaignId].status !== "running") {
      break;
    }

    const log = campaign.logs[i];
    if (log.status !== "pending") continue;

    log.status = "sending";
    
    // Anti-Ban Protection: Safe 15-second base interval with dynamic human jitter (+/- 2500ms)
    const effectiveBaseDelay = Math.max(15000, Number(baseDelayMs || 15000));
    const jitter = Math.floor(Math.random() * 5000) - 2500; // variance between -2.5s and +2.5s
    const actualDelay = Math.max(12000, effectiveBaseDelay + jitter);

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }

    // Check again after delay
    if (!campaigns[campaignId] || campaigns[campaignId].status !== "running") {
      log.status = "pending";
      break;
    }

    const isCloudAPI = whatsappConfig.mode === "cloud_api" && whatsappConfig.cloudApiKey && whatsappConfig.cloudPhoneId;
    const isRealMode = whatsappConfig.mode === "real" || (sock && sock.user);
    
    if (isCloudAPI) {
      try {
        const formattedPhone = normalizePhoneNumber(log.phone);

        const response = await fetch(
          `https://graph.facebook.com/v18.0/${whatsappConfig.cloudPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${whatsappConfig.cloudApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: formattedPhone,
              type: "text",
              text: { body: log.message },
            }),
          }
        );

        const result = await response.json() as any;
        
        if (response.ok && result.messages) {
          log.status = "success";
          campaign.sent += 1;
          messagesInCurrentBatch += 1;
        } else {
          log.status = "failed";
          log.error = result.error?.message || "فشل إرسال الرسالة عبر WhatsApp Cloud API";
          campaign.failed += 1;
        }
      } catch (err: any) {
        log.status = "failed";
        log.error = err.message || "حدث خطأ في الاتصال بالخادم الرئيسي";
        campaign.failed += 1;
      }
    } else if (isRealMode || (sock && sock.user)) {
      const randomizedMessage = injectAntiSpamVariation(log.message);
      const sendResult = await sendBaileysMessage(log.phone, randomizedMessage);
      if (sendResult.success) {
        log.status = "success";
        campaign.sent += 1;
        messagesInCurrentBatch += 1;
      } else {
        log.status = "failed";
        log.error = sendResult.error || "فشل الإرسال عبر ربط الواتساب المباشر";
        campaign.failed += 1;
      }
    } else {
      // Not connected to real WhatsApp
      const cleanedPhone = normalizePhoneNumber(log.phone);
      if (cleanedPhone.length < 8) {
        log.status = "failed";
        log.error = "رقم جوال غير صالح أو قصير جداً";
        campaign.failed += 1;
      } else {
        log.status = "failed";
        log.error = "جهاز الواتساب غير متصل. يرجى التوجه لصفحة 'ربط الواتساب' وربط جهازك بالباركود أو الرمز أولاً حتى يتم الإرسال للهاتف الفعلي.";
        campaign.failed += 1;
      }
    }

    log.timestamp = new Date().toISOString();
  }

  // Update final status
  if (campaign.sent + campaign.failed >= campaign.total) {
    campaign.status = "completed";
  } else if (campaign.status === "running") {
    campaign.status = "completed";
  }
  campaign.endTime = new Date().toISOString();
  saveCampaigns();
}

// Pause Campaign
app.post("/api/whatsapp/campaign/:id/pause", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
  campaign.status = "paused";
  saveCampaigns();
  res.json({ success: true, status: "paused" });
});

// Resume Campaign
app.post("/api/whatsapp/campaign/:id/resume", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
  
  campaign.status = "running";
  saveCampaigns();
  // Restart background loop
  const delayMs = req.body.delayMs || 3000;
  
  // Reset any temporary "sending" blocks to "pending" to retry them
  campaign.logs.forEach(log => {
    if (log.status === "sending") log.status = "pending";
  });
  
  processCampaign(campaign.id, delayMs);
  res.json({ success: true, status: "running" });
});

// Single Message Send Endpoint
app.post(["/api/whatsapp/send-single", "/api/whatsapp/send", "/api/send-individual", "/api/send-whatsapp"], async (req, res) => {
  const phone = req.body.phone || req.body.guardianPhone || req.body.mobile || req.body["رقم الجوال"] || req.body["الجوال"];
  const message = req.body.message || req.body.customMessage || req.body.text || req.body.msg;
  const studentName = req.body.studentName || req.body.name || req.body["اسم الطالب"] || req.body["اسم المعلم"];
  const grade = req.body.grade || req.body["الصف"];
  const className = req.body.className || req.body["الفصل"] || req.body["الشعبة"];

  if (!phone || !message) {
    return res.status(400).json({ error: "يرجى تحديد رقم الجوال ونص الرسالة" });
  }

  const logEntry: IndividualLogItem = {
    id: `ind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    studentName: studentName || "رسالة فردية مباشرة",
    phone: String(phone).trim(),
    grade: grade ? String(grade).trim() : "",
    className: className ? String(className).trim() : "",
    message: String(message),
    status: "success",
    timestamp: new Date().toISOString(),
  };

  const isCloudAPI = whatsappConfig.mode === "cloud_api" && whatsappConfig.cloudApiKey && whatsappConfig.cloudPhoneId;
  const isRealMode = whatsappConfig.mode === "real" || (sock && sock.user);

  if (isCloudAPI) {
    try {
      const formattedPhone = normalizePhoneNumber(phone);

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${whatsappConfig.cloudPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${whatsappConfig.cloudApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: "text",
            text: { body: message },
          }),
        }
      );

      const result = await response.json() as any;

      if (response.ok && result.messages) {
        logEntry.status = "success";
        individualLogs.unshift(logEntry);
        saveIndividualLogs();
        return res.json({ success: true, message: "تم إرسال الرسالة الفردية بنجاح" });
      } else {
        logEntry.status = "failed";
        logEntry.error = result.error?.message || "فشل إرسال الرسالة عبر WhatsApp Cloud API";
        individualLogs.unshift(logEntry);
        saveIndividualLogs();
        return res.status(500).json({
          error: logEntry.error
        });
      }
    } catch (err: any) {
      logEntry.status = "failed";
      logEntry.error = err.message || "حدث خطأ أثناء الاتصال بخوادم Meta";
      individualLogs.unshift(logEntry);
      saveIndividualLogs();
      return res.status(500).json({
        error: logEntry.error
      });
    }
  } else if (isRealMode || (sock && sock.user)) {
    const sendResult = await sendBaileysMessage(phone, message);
    if (sendResult.success) {
      logEntry.status = "success";
      individualLogs.unshift(logEntry);
      saveIndividualLogs();
      return res.json({ success: true, message: "تم إرسال الرسالة الفردية بنجاح إلى هاتف المستلم عبر واتساب" });
    } else {
      logEntry.status = "failed";
      logEntry.error = sendResult.error || "فشل إرسال الرسالة الفردية عبر ربط الواتساب";
      individualLogs.unshift(logEntry);
      saveIndividualLogs();
      return res.status(400).json({ error: logEntry.error });
    }
  } else {
    // Not connected to real WhatsApp
    const cleanedPhone = normalizePhoneNumber(phone);
    if (cleanedPhone.length < 8) {
      logEntry.status = "failed";
      logEntry.error = "رقم الجوال الفردي غير صالح أو قصير جداً";
      individualLogs.unshift(logEntry);
      saveIndividualLogs();
      return res.status(400).json({ error: logEntry.error });
    }
    
    logEntry.status = "failed";
    logEntry.error = "جهاز الواتساب غير متصل حالياً. يرجى الانتقال إلى صفحة 'ربط الواتساب' والتأكد من إتمام الربط بالباركود أو الرمز أولاً حتى تصل الرسالة إلى هاتف المستلم.";
    individualLogs.unshift(logEntry);
    saveIndividualLogs();
    return res.status(400).json({ error: logEntry.error });
  }
});

// Comprehensive Reports Endpoint: Aggregates all campaign logs and individual logs
app.get("/api/whatsapp/reports", (req, res) => {
  const allLogs: any[] = [];
  
  // 1. Extract from all Campaigns
  Object.values(campaigns).forEach(camp => {
    (camp.logs || []).forEach(log => {
      allLogs.push({
        id: log.id,
        studentName: log.studentName,
        phone: log.phone,
        grade: log.grade || "",
        className: log.className || "",
        message: log.message,
        status: log.status,
        timestamp: log.timestamp,
        campaignId: camp.id,
        campaignName: camp.name,
        type: "campaign",
        error: log.error || ""
      });
    });
  });

  // 2. Extract from Individual Logs
  individualLogs.forEach(log => {
    allLogs.push({
      id: log.id,
      studentName: log.studentName || "إرسال فردي مباشر",
      phone: log.phone,
      grade: log.grade || "",
      className: log.className || "",
      message: log.message,
      status: log.status,
      timestamp: log.timestamp,
      campaignId: "",
      campaignName: "إرسال فردي سريع",
      type: "individual",
      error: log.error || ""
    });
  });

  // Sort descending by timestamp
  allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({
    logs: allLogs,
    total: allLogs.length,
    sent: allLogs.filter(l => l.status === "success").length,
    failed: allLogs.filter(l => l.status === "failed").length
  });
});

// Clear historical logs if needed
app.delete("/api/whatsapp/reports/clear", (req, res) => {
  individualLogs.length = 0;
  saveIndividualLogs();
  // Clear campaign logs
  Object.keys(campaigns).forEach(key => {
    if (campaigns[key].status !== "running") {
      delete campaigns[key];
    }
  });
  saveCampaigns();
  res.json({ success: true, message: "تم مسح سجلات التقارير بنجاح" });
});

// Noor Extractor Absences State
let noorAbsencesList: any[] = [];
let guidanceActionsHistory: any[] = [];

// Noor Sync Endpoints
app.get("/api/noor/absences", (req, res) => {
  res.json({ absences: noorAbsencesList, total: noorAbsencesList.length });
});

app.post("/api/noor/sync-absences", (req, res) => {
  const { absences } = req.body;
  if (Array.isArray(absences)) {
    noorAbsencesList = absences;
    console.log(`[Noor Extractor] Synced ${absences.length} student absence records.`);
    return res.json({ success: true, count: absences.length, message: "تمت مزامنة غيابات نظام نور بنجاح" });
  }
  res.status(400).json({ error: "بيانات الغياب غير صالحة" });
});

// Guidance Student Actions Log Endpoints
app.get("/api/guidance/actions", (req, res) => {
  res.json({ actions: guidanceActionsHistory });
});

app.post("/api/guidance/actions", (req, res) => {
  const action = req.body;
  if (action && action.studentId) {
    const newAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ...action,
      createdAt: new Date().toISOString()
    };
    guidanceActionsHistory.unshift(newAction);
    return res.json({ success: true, action: newAction });
  }
  res.status(400).json({ error: "بيانات الإجراء غير مكتملة" });
});

// Setup Vite Dev Server / Serve static assets in production

async function startServer() {
  // 1. Setup Vite Dev Server or Serve static assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 2. Start HTTP listener
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  // 3. Restore server state from Firestore in background
  (async () => {
    try {
      const cloudState = await loadServerStateFromFirestore();
      if (cloudState) {
        if (cloudState.appSettings && Object.keys(cloudState.appSettings).length > 0) {
          appSettings = { ...appSettings, ...cloudState.appSettings };
        }
        if (Array.isArray(cloudState.activeStudentsList) && cloudState.activeStudentsList.length > 0) {
          if (activeStudentsList.length === 0) {
            activeStudentsList = cloudState.activeStudentsList;
          } else {
            // Reconcile and deep-merge disk students with cloud students:
            // Prevents data loss across container rebuilds, code updates, and roster variations
            const reconciliation = reconcileStudentsRoster(cloudState.activeStudentsList, activeStudentsList);
            activeStudentsList = reconciliation.reconciledStudents;
          }
          saveStudentsList();
        } else if (activeStudentsList.length > 0) {
          syncServerStateToFirestore({ activeStudentsList }).catch(() => {});
        }

        if (Array.isArray(cloudState.teachersList) && cloudState.teachersList.length > 0) {
          if (teachersList.length === 0) {
            teachersList = cloudState.teachersList;
          } else {
            // Reconcile and deep-merge disk teachers with cloud teachers
            const reconciliation = reconcileTeachersRoster(cloudState.teachersList, teachersList);
            teachersList = reconciliation.reconciledTeachers;
          }
          saveTeachersList();
        } else if (teachersList.length > 0) {
          syncServerStateToFirestore({ teachersList }).catch(() => {});
        }

        if (Array.isArray(cloudState.scheduleAssignments) && cloudState.scheduleAssignments.length > 0) {
          if (scheduleAssignments.length === 0) {
            scheduleAssignments = cloudState.scheduleAssignments;
          } else {
            const existingIds = new Set(scheduleAssignments.map(a => a.id));
            cloudState.scheduleAssignments.forEach((a: any) => {
              if (!existingIds.has(a.id)) scheduleAssignments.push(a);
            });
          }
          saveScheduleAssignments();
        }

        if (cloudState.attendanceRecords && typeof cloudState.attendanceRecords === "object" && Object.keys(cloudState.attendanceRecords).length > 0) {
          for (const [dateKey, dayRecords] of Object.entries(cloudState.attendanceRecords)) {
            if (!attendanceRecordsStore[dateKey]) {
              attendanceRecordsStore[dateKey] = dayRecords as any;
            } else {
              attendanceRecordsStore[dateKey] = { ...(dayRecords as any), ...attendanceRecordsStore[dateKey] };
            }
          }
          saveAttendanceRecords();
        }

        if (Array.isArray(cloudState.inquiryRequests) && cloudState.inquiryRequests.length > 0) {
          const existingInqIds = new Set(inquiryRequestsStore.map(i => i.id));
          cloudState.inquiryRequests.forEach((inq: any) => {
            if (!existingInqIds.has(inq.id)) inquiryRequestsStore.push(inq);
          });
          saveInquiryRequests();
        }

        if (Array.isArray(cloudState.systemUsersList) && cloudState.systemUsersList.length > 0) {
          if (systemUsersList.length === 0) {
            systemUsersList = cloudState.systemUsersList;
          } else {
            const existingUsernames = new Set(systemUsersList.map(u => u.username));
            cloudState.systemUsersList.forEach((u: any) => {
              if (!existingUsernames.has(u.username)) systemUsersList.push(u);
            });
          }
          saveUsersList();
        }

        if (cloudState.activeTemplate && activeTemplate === "السلام عليكم ورحمة الله وبركاته،\nأهلاً بك يا سيد {أبو الطالب}، نود إحاطتكم علماً بأن الطالب {اسم الطالب} قد حصل على درجة {الدرجة} في مادة الرياضيات.\nنتمنى له دوام التوفيق والنجاح.\n- إدارة المدرسة") {
          activeTemplate = cloudState.activeTemplate;
          saveTemplate();
        }

        if (cloudState.whatsappConfig) {
          whatsappConfig = { ...whatsappConfig, ...cloudState.whatsappConfig };
          // If not currently actively connected, reset phone number and connection status
          if (realConnectionStatus !== "connected") {
            whatsappConfig.simulatedStatus = "disconnected";
            whatsappConfig.simulatedPhone = "";
          }
        }

        if (cloudState.campaigns && Object.keys(campaigns).length === 0) {
          Object.assign(campaigns, cloudState.campaigns);
        }

        if (Array.isArray(cloudState.individualLogs) && individualLogs.length === 0) {
          individualLogs.push(...cloudState.individualLogs);
        }

        if (cloudState.healthProfiles && typeof cloudState.healthProfiles === "object") {
          healthProfilesStore = { ...cloudState.healthProfiles, ...healthProfilesStore };
          saveHealthProfiles();
        }

        if (Array.isArray(cloudState.supportCases) && cloudState.supportCases.length > 0) {
          const existingCaseIds = new Set(supportCasesStore.map(c => c.id));
          cloudState.supportCases.forEach((sc: any) => {
            if (!existingCaseIds.has(sc.id)) supportCasesStore.push(sc);
          });
          saveSupportCases();
        }

        if (Array.isArray(cloudState.healthAuditLogs) && cloudState.healthAuditLogs.length > 0) {
          const existingLogIds = new Set(healthAuditLogsStore.map(l => l.id));
          cloudState.healthAuditLogs.forEach((l: any) => {
            if (!existingLogIds.has(l.id)) healthAuditLogsStore.push(l);
          });
          saveHealthAuditLogs();
        }

        if (cloudState.needsSurveyProfiles && typeof cloudState.needsSurveyProfiles === "object") {
          needsSurveyProfilesStore = { ...cloudState.needsSurveyProfiles, ...needsSurveyProfilesStore };
        }
        if (cloudState.parentCouncils && typeof cloudState.parentCouncils === "object") {
          const cloudApps = cloudState.parentCouncils.applications || {};
          const cloudInvites = cloudState.parentCouncils.invites || {};
          const cloudConfig = cloudState.parentCouncils.config || {};
          
          // Deep-reconcile applications to avoid overwriting newer or filled fields
          const mergedApps = { ...cloudApps };
          const localApps = parentCouncilsStore.applications || {};
          for (const [id, localApp] of Object.entries(localApps)) {
            if (!mergedApps[id]) {
              mergedApps[id] = localApp;
            } else {
              const cloudApp = mergedApps[id];
              mergedApps[id] = {
                ...cloudApp,
                ...localApp,
                // Preserve manually assigned role if either has it non-empty
                assignedRole: (localApp as any).assignedRole !== undefined && (localApp as any).assignedRole !== "" 
                  ? (localApp as any).assignedRole 
                  : ((cloudApp as any).assignedRole || ""),
                // Preserve approval status if marked in either
                status: (localApp as any).status === "approved" || (cloudApp as any).status === "approved"
                  ? "approved"
                  : ((localApp as any).status || (cloudApp as any).status || "submitted"),
                // Keep evaluation
                smartEvaluation: (localApp as any).smartEvaluation || (cloudApp as any).smartEvaluation,
              };
            }
          }

          // Deep-reconcile config
          const localConfig = parentCouncilsStore.config || {};
          const mergedSelected = Array.from(new Set([
            ...(cloudConfig.selectedMemberIds || []),
            ...(localConfig.selectedMemberIds || []),
          ]));
          const mergedReserve = Array.from(new Set([
            ...(cloudConfig.reserveMemberIds || []),
            ...(localConfig.reserveMemberIds || []),
          ])).filter(id => !mergedSelected.includes(id));

          parentCouncilsStore = {
            applications: mergedApps,
            invites: { ...cloudInvites, ...(parentCouncilsStore.invites || {}) },
            config: {
              ...parentCouncilsStore.config,
              ...cloudConfig,
              ...localConfig,
              selectedMemberIds: mergedSelected.length > 0 ? mergedSelected : (cloudConfig.selectedMemberIds || localConfig.selectedMemberIds || []),
              reserveMemberIds: mergedReserve,
              formationApproved: !!(cloudConfig.formationApproved || localConfig.formationApproved),
              formationApprovedAt: cloudConfig.formationApprovedAt || localConfig.formationApprovedAt,
              isSurveyClosed: cloudConfig.isSurveyClosed !== undefined ? cloudConfig.isSurveyClosed : localConfig.isSurveyClosed,
            },
          };
          saveParentCouncilsStore(true);
          console.log(`[Firebase] Restored & fortified parent councils data from Firestore (${Object.keys(parentCouncilsStore.applications).length} apps, ${parentCouncilsStore.config.selectedMemberIds.length} nominated members).`);
        }
        console.log("[Firebase] System state successfully synchronized from Firestore.");
      }
    } catch (e) {
      console.warn("[Firebase] Could not restore initial server state:", e);
    }

    // 4. Restore existing registered WhatsApp sessions from disk or Firestore
    const authFolder = path.join(process.cwd(), "auth_info_baileys");
    const credsFile = path.join(authFolder, "creds.json");
    
    try {
      if (!fs.existsSync(credsFile)) {
        await restoreBaileysSessionFromFirestore(authFolder);
      }
    } catch (e) {
      console.warn("[Firebase] Could not restore WhatsApp session from Firestore:", e);
    }

    if (fs.existsSync(credsFile)) {
      try {
        const credsData = JSON.parse(fs.readFileSync(credsFile, "utf-8"));
        if (credsData && credsData.registered) {
          console.log("Found existing registered WhatsApp Web session. Restoring connection...");
          initRealWhatsApp("resume");
        }
      } catch (e) {
        console.warn("Could not inspect creds.json", e);
      }
    }
  })().catch(err => {
    console.warn("Error during background state restoration:", err);
  });

  // 5. Background Reconnection Watchdog for Render sleep/wake cycles & network drops
  const authFolder = path.join(process.cwd(), "auth_info_baileys");
  setInterval(() => {
    if (whatsappConfig.mode === "real" && (realConnectionStatus === "disconnected" || realConnectionStatus === "error")) {
      const localCreds = path.join(authFolder, "creds.json");
      if (fs.existsSync(localCreds)) {
        try {
          const creds = JSON.parse(fs.readFileSync(localCreds, "utf-8"));
          if (creds?.registered) {
            console.log("[Watchdog] Auto-reconnecting registered WhatsApp session...");
            initRealWhatsApp("resume");
          }
        } catch (e) {}
      }
    }
  }, 45000);
}

startServer();
