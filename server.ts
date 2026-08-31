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
} from "./src/serverFirebase";

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

function normalizePhoneNumber(input: string): string {
  if (!input) return "";
  let cleaned = input.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).replace(/[^0-9]/g, "");
  if (cleaned.startsWith("00966")) {
    cleaned = "966" + cleaned.substring(5);
  } else if (cleaned.startsWith("966")) {
    cleaned = cleaned;
  } else if (cleaned.startsWith("05")) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  return cleaned;
}

let sock: any = null;
let realQrCodeUrl: string = "";
let realPairingCode: string = "";
let realErrorMessage: string = "";
let realConnectionStatus: "disconnected" | "qr_ready" | "pairing_code_ready" | "connecting" | "connected" | "error" = "disconnected";
let connectedPhoneNumber: string = "";
let connectionTimeoutTimer: NodeJS.Timeout | null = null;
let firestoreSessionBackupTimer: NodeJS.Timeout | null = null;

function scheduleFirestoreSessionBackup(force = false) {
  if (firestoreSessionBackupTimer) clearTimeout(firestoreSessionBackupTimer);
  firestoreSessionBackupTimer = setTimeout(() => {
    const authFolder = path.join(process.cwd(), "auth_info_baileys");
    backupBaileysSessionToFirestore(authFolder, force).catch(() => {});
  }, 15000); // 15 seconds debounce
}

async function initRealWhatsApp(method: "qr" | "pairing_code" | "resume" = "qr", targetPhone?: string) {
  try {
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

    // Set fallback timeout (60 seconds) in case WhatsApp servers do not respond
    connectionTimeoutTimer = setTimeout(() => {
      if (realConnectionStatus === "connecting") {
        realConnectionStatus = "error";
        realErrorMessage = "استغرق الاتصال بخوادم واتساب وقتاً أطول من المعتاد. يرجى تجربة رمز الربط بالهاتف أو إعادة التعيين.";
      }
    }, 60000);

    // Clean up previous socket instance if any
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
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Using stable tested WhatsApp multi-device version directly for instant initialization
    const waVersion = [2, 3000, 1043857760] as any;
    
    sock = makeWASocket({
      version: waVersion,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any,
      browser: ["Ubuntu", "Chrome", "22.04.4"],
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 30000,
      keepAliveIntervalMs: 25000,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      fireInitQueries: false,
      emitOwnEvents: false,
      getMessage: async () => undefined,
      shouldIgnoreJid: (jid: string) => !jid || jid.includes("@broadcast") || jid.endsWith("@newsletter"),
    });
    
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
          realQrCodeUrl = await QRCode.toDataURL(qr);
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
        connectedPhoneNumber = userJid.split(":")[0];
        
        // Update general config
        whatsappConfig.simulatedStatus = "connected";
        whatsappConfig.simulatedPhone = "+" + connectedPhoneNumber;
        saveConfig();
        scheduleFirestoreSessionBackup();
        console.log(`Real WhatsApp linked successfully: +${connectedPhoneNumber}`);
      }
      
      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason?.loggedOut && statusCode !== 401 && statusCode !== 403;
        
        console.log(`Real WhatsApp connection closed. StatusCode: ${statusCode}. ShouldReconnect: ${shouldReconnect}`);
        
        if (statusCode === DisconnectReason?.loggedOut || statusCode === 401 || statusCode === 403) {
          realConnectionStatus = "disconnected";
          realQrCodeUrl = "";
          realPairingCode = "";
          connectedPhoneNumber = "";
          whatsappConfig.simulatedStatus = "disconnected";
          whatsappConfig.simulatedPhone = "";
          saveConfig();
          deleteBaileysSessionInFirestore().catch(() => {});
        } else if (shouldReconnect) {
          // Reconnect automatically on 515 (restartRequired) or temporary closed socket during handshake
          console.log("Automatically resuming Baileys socket handshake / session...");
          setTimeout(() => {
            initRealWhatsApp("resume", targetPhone);
          }, 1200);
        } else if (realConnectionStatus !== "connected") {
          realConnectionStatus = "error";
          realErrorMessage = "انقطع الاتصال بخوادم واتساب. يرجى الضغط على إعادة التعيين والمحاولة مجدداً.";
        }
      }
    });

    // Handle Pairing Code flow if requested
    if (method === "pairing_code" && targetPhone && !sock.authState?.creds?.registered) {
      const cleanPhone = normalizePhoneNumber(targetPhone);

      const tryRequestCode = async (attempt = 1) => {
        try {
          if (!sock || sock.authState?.creds?.registered) return;
          const code = await sock.requestPairingCode(cleanPhone);
          if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
          
          realPairingCode = code || "";
          realConnectionStatus = "pairing_code_ready";
          realErrorMessage = "";
          console.log(`WhatsApp pairing code generated for ${cleanPhone}: ${code}`);
        } catch (err: any) {
          if (attempt < 3 && !realPairingCode) {
            setTimeout(() => tryRequestCode(attempt + 1), 2000);
          } else {
            console.error("Error requesting WhatsApp pairing code:", err);
            realConnectionStatus = "error";
            realErrorMessage = err?.message || "فشل توليد رمز الربط لرقم الهاتف. تأكد من صحة الرقم ومفتاح الدولة.";
          }
        }
      };

      setTimeout(() => tryRequestCode(1), 2000);
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
    totalCampaigns: Object.keys(campaigns).length,
    totalIndividualLogs: individualLogs.length,
  });
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
  const { students } = req.body || {};
  if (Array.isArray(students)) {
    activeStudentsList = students;
    saveStudentsList();
  }
  res.json({ success: true, count: activeStudentsList.length });
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
  const isRealConnected = realConnectionStatus === "connected" || (sock && sock.user);
  const isConnected = isRealConnected || whatsappConfig.simulatedStatus === "connected";
  const activePhone = connectedPhoneNumber ? `+${connectedPhoneNumber}` : (whatsappConfig.simulatedPhone || "");

  res.json({
    mode: isRealConnected ? "real" : whatsappConfig.mode,
    simulatedStatus: isConnected ? "connected" : (realConnectionStatus === "qr_ready" ? "qr_ready" : (realConnectionStatus === "connecting" ? "connecting" : whatsappConfig.simulatedStatus)),
    simulatedPhone: activePhone,
    isConnected,
    realStatus: realConnectionStatus,
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
  const { method = "qr", phone = "", phoneNumber = "" } = req.body || {};
  const targetPhone = phone || phoneNumber || "";
  whatsappConfig.mode = "real";
  saveConfig();
  
  if (realConnectionStatus === "connected") {
    return res.json({ status: "connected", phone: connectedPhoneNumber });
  }
  
  realConnectionStatus = "connecting";
  await initRealWhatsApp(method, targetPhone);
  res.json({ status: "connecting" });
});

app.get("/api/whatsapp/real/status", (req, res) => {
  const isConnected = realConnectionStatus === "connected" || (sock && sock.user);
  res.json({
    status: isConnected ? "connected" : realConnectionStatus,
    qr: realQrCodeUrl,
    pairingCode: realPairingCode,
    error: realErrorMessage,
    phone: connectedPhoneNumber ? `+${connectedPhoneNumber}` : (whatsappConfig.simulatedPhone || ""),
    isConnected: !!isConnected,
  });
});

app.post("/api/whatsapp/real/reset", async (req, res) => {
  try {
    if (sock) {
      try {
        await sock.logout();
      } catch (e) {
        // ignore logout errors on reset
      }
      sock.end(undefined);
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
  
  res.json({ status: "disconnected", message: "تمت إعادة تعيين جلسة الواتساب بنجاح" });
});

app.post("/api/whatsapp/real/disconnect", async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
      sock.end(undefined);
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
  
  res.json({ status: "disconnected" });
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
      try {
        if (!sock || (realConnectionStatus !== "connected" && !sock.user)) {
          throw new Error("جهاز الواتساب غير متصل حالياً. يرجى إتمام عملية الربط أولاً.");
        }
        
        const formattedPhone = normalizePhoneNumber(log.phone);
        if (!formattedPhone || formattedPhone.length < 8) {
          throw new Error("رقم جوال غير صالح أو غير مكتمل");
        }
        
        const jid = `${formattedPhone}@s.whatsapp.net`;
        
        // Quick presence update (non-blocking)
        try {
          sock.sendPresenceUpdate("available").catch(() => {});
        } catch (presenceErr) {}

        // Inject anti-spam zero-width hash variance to ensure unique payload hash
        const randomizedMessage = injectAntiSpamVariation(log.message);
        await sock.sendMessage(jid, { text: randomizedMessage });
        
        log.status = "success";
        campaign.sent += 1;
        messagesInCurrentBatch += 1;
      } catch (err: any) {
        log.status = "failed";
        log.error = err.message || "فشل الإرسال عبر ربط الواتساب المباشر";
        campaign.failed += 1;
      }
    } else {
      // Simulated sending
      const cleanedPhone = normalizePhoneNumber(log.phone);
      if (cleanedPhone.length < 8) {
        log.status = "failed";
        log.error = "رقم جوال غير صالح أو قصير جداً";
        campaign.failed += 1;
      } else {
        log.status = "success";
        campaign.sent += 1;
        messagesInCurrentBatch += 1;
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
app.post(["/api/whatsapp/send-single", "/api/whatsapp/send"], async (req, res) => {
  const { phone, message, studentName, grade, className } = req.body;
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
  } else if (isRealMode) {
    try {
      if (!sock || (realConnectionStatus !== "connected" && !sock.user)) {
        return res.status(400).json({ error: "جهاز الواتساب غير متصل حالياً. يرجى إتمام عملية الربط أولاً." });
      }

      const formattedPhone = normalizePhoneNumber(phone);
      if (!formattedPhone || formattedPhone.length < 8) {
        return res.status(400).json({ error: "رقم الجوال غير صالح أو غير مكتمل." });
      }

      const jid = `${formattedPhone}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: message });

      logEntry.status = "success";
      individualLogs.unshift(logEntry);
      saveIndividualLogs();
      return res.json({ success: true, message: "تم إرسال الرسالة الفردية بنجاح عبر واتساب" });
    } catch (err: any) {
      logEntry.status = "failed";
      logEntry.error = err.message || "فشل إرسال الرسالة الفردية عبر ربط الواتساب";
      individualLogs.unshift(logEntry);
      saveIndividualLogs();
      return res.status(500).json({ error: logEntry.error });
    }
  } else {
    // Simulated sending
    const cleanedPhone = normalizePhoneNumber(phone);
    if (cleanedPhone.length < 8) {
      logEntry.status = "failed";
      logEntry.error = "رقم الجوال الفردي غير صالح أو قصير جداً";
      individualLogs.unshift(logEntry);
      saveIndividualLogs();
      return res.status(400).json({ error: logEntry.error });
    }
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 800));
    logEntry.status = "success";
    individualLogs.unshift(logEntry);
    saveIndividualLogs();
    return res.json({ success: true, message: "تمت محاكاة إرسال الرسالة الفردية بنجاح" });
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
          if (activeStudentsList.length === 0) activeStudentsList = cloudState.activeStudentsList;
        }
        if (cloudState.activeTemplate && activeTemplate === "السلام عليكم ورحمة الله وبركاته،\nأهلاً بك يا سيد {أبو الطالب}، نود إحاطتكم علماً بأن الطالب {اسم الطالب} قد حصل على درجة {الدرجة} في مادة الرياضيات.\nنتمنى له دوام التوفيق والنجاح.\n- إدارة المدرسة") {
          activeTemplate = cloudState.activeTemplate;
        }
        if (cloudState.whatsappConfig) {
          whatsappConfig = { ...whatsappConfig, ...cloudState.whatsappConfig };
        }
        if (cloudState.campaigns && Object.keys(campaigns).length === 0) {
          Object.assign(campaigns, cloudState.campaigns);
        }
        if (Array.isArray(cloudState.individualLogs) && individualLogs.length === 0) {
          individualLogs.push(...cloudState.individualLogs);
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
