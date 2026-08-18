import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import * as BaileysModule from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

// Resilient resolution of makeWASocket and helpers across ESM/CJS environments
const baileysRaw: any = (BaileysModule as any).default || BaileysModule;
const makeWASocket = typeof baileysRaw === "function" 
  ? baileysRaw 
  : (baileysRaw.makeWASocket || (BaileysModule as any).makeWASocket || (BaileysModule as any).default);

const useMultiFileAuthState = (BaileysModule as any).useMultiFileAuthState || baileysRaw.useMultiFileAuthState;
const DisconnectReason = (BaileysModule as any).DisconnectReason || baileysRaw.DisconnectReason;
const fetchLatestBaileysVersion = (BaileysModule as any).fetchLatestBaileysVersion || baileysRaw.fetchLatestBaileysVersion;
const Browsers = (BaileysModule as any).Browsers || baileysRaw.Browsers;

// Initialize Express app
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory data store for WhatsApp states & Campaigns
let whatsappConfig = {
  mode: "simulated" as "simulated" | "real" | "cloud_api",
  simulatedStatus: "disconnected" as "disconnected" | "qr_ready" | "connecting" | "connected",
  simulatedPhone: "",
  cloudApiKey: "",
  cloudPhoneId: "",
  cloudAccountId: "",
};

let sock: any = null;
let realQrCodeUrl: string = "";
let realPairingCode: string = "";
let realErrorMessage: string = "";
let realConnectionStatus: "disconnected" | "qr_ready" | "pairing_code_ready" | "connecting" | "connected" | "error" = "disconnected";
let connectedPhoneNumber: string = "";
let connectionTimeoutTimer: NodeJS.Timeout | null = null;

async function initRealWhatsApp(method: "qr" | "pairing_code" = "qr", targetPhone?: string) {
  try {
    if (connectionTimeoutTimer) {
      clearTimeout(connectionTimeoutTimer);
      connectionTimeoutTimer = null;
    }

    realErrorMessage = "";
    realPairingCode = "";
    realQrCodeUrl = "";
    realConnectionStatus = "connecting";

    // Set fallback timeout in case WhatsApp servers do not respond within 40 seconds
    connectionTimeoutTimer = setTimeout(() => {
      if (realConnectionStatus === "connecting") {
        realConnectionStatus = "error";
        realErrorMessage = "استغرق الاتصال بخوادم واتساب وقتاً طويلاً. يرجى تجربة خيار (الربط برمز التحقق عبر رقم الجوال) أو الضغط على إعادة المحاولة.";
      }
    }, 40000);

    const authFolder = path.join(process.cwd(), "auth_info_baileys");
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Fetch latest WhatsApp Web version to avoid outdated protocol rejections
    let waVersion = [2, 3000, 1015901307] as any;
    try {
      const { version } = await fetchLatestBaileysVersion();
      if (version) waVersion = version;
    } catch (e) {
      console.warn("Could not fetch latest Baileys version online, using fallback version", e);
    }
    
    sock = makeWASocket({
      version: waVersion,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any,
      browser: Browsers.ubuntu("Chrome"),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    
    sock.ev.on("creds.update", saveCreds);
    
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
        console.log(`Real WhatsApp linked successfully: +${connectedPhoneNumber}`);
      }
      
      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`Real WhatsApp connection closed. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);
        
        if (statusCode === DisconnectReason.loggedOut) {
          realConnectionStatus = "disconnected";
          realQrCodeUrl = "";
          realPairingCode = "";
          connectedPhoneNumber = "";
          whatsappConfig.simulatedStatus = "disconnected";
          whatsappConfig.simulatedPhone = "";
          saveConfig();
        } else if (realConnectionStatus !== "connected") {
          // If disconnected before full pairing, log error
          if (!shouldReconnect) {
            realConnectionStatus = "error";
            realErrorMessage = "فشل الاتصال بجلسة واتساب السابقة، يرجى إعادة تعيين الجلسة وتوليد رمز جديد.";
          }
        }
      }
    });

    // Handle Pairing Code flow if requested
    if (method === "pairing_code" && targetPhone && !sock.authState.creds.registered) {
      let cleanPhone = targetPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("05")) {
        cleanPhone = "966" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("5")) {
        cleanPhone = "966" + cleanPhone;
      }

      setTimeout(async () => {
        try {
          if (sock && !sock.authState.creds.registered) {
            const code = await sock.requestPairingCode(cleanPhone);
            if (connectionTimeoutTimer) clearTimeout(connectionTimeoutTimer);
            realPairingCode = code;
            realConnectionStatus = "pairing_code_ready";
            realErrorMessage = "";
            console.log(`WhatsApp pairing code requested for ${cleanPhone}: ${code}`);
          }
        } catch (err: any) {
          console.error("Error requesting WhatsApp pairing code:", err);
          realConnectionStatus = "error";
          realErrorMessage = err?.message || "فشل توليد رمز الربط لرقم الهاتف. تأكد من صحة الرقم ومفتاح الدولة.";
        }
      }, 3000);
    }
  } catch (err: any) {
    console.error("Error starting Baileys socket connection:", err);
    realConnectionStatus = "error";
    realErrorMessage = err?.message || "حدث خطأ أثناء تشغيل محرك الواتساب.";
  }
}

// Store campaign states
interface Campaign {
  id: string;
  name: string;
  total: number;
  sent: number;
  failed: number;
  status: "idle" | "running" | "completed" | "paused";
  startTime: string | null;
  endTime: string | null;
  logs: {
    id: string;
    studentName: string;
    phone: string;
    message: string;
    status: "pending" | "sending" | "success" | "failed";
    timestamp: string;
    error?: string;
  }[];
}

const campaigns: Record<string, Campaign> = {};

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
  } catch (e) {
    console.error("Error writing config file", e);
  }
};

// API Endpoints for WhatsApp Config
app.get("/api/whatsapp/config", (req, res) => {
  // Hide secret keys in response
  res.json({
    mode: whatsappConfig.mode,
    simulatedStatus: whatsappConfig.simulatedStatus,
    simulatedPhone: whatsappConfig.simulatedPhone,
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
  const { method = "qr", phone = "" } = req.body || {};
  whatsappConfig.mode = "real";
  saveConfig();
  
  if (realConnectionStatus === "connected") {
    return res.json({ status: "connected", phone: connectedPhoneNumber });
  }
  
  realConnectionStatus = "connecting";
  await initRealWhatsApp(method, phone);
  res.json({ status: "connecting" });
});

app.get("/api/whatsapp/real/status", (req, res) => {
  res.json({
    status: realConnectionStatus,
    qr: realQrCodeUrl,
    pairingCode: realPairingCode,
    error: realErrorMessage,
    phone: connectedPhoneNumber,
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

// Campaign sending endpoint
app.post("/api/whatsapp/campaign/create", (req, res) => {
  const { name, students, template, delayMs = 3000 } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "قائمة الطلاب فارغة أو غير صالحة" });
  }
  
  const campaignId = `camp_${Date.now()}`;
  
  // Helper to compile template placeholders
  const compileTemplate = (tmpl: string, student: any) => {
    let result = tmpl;
    
    // Extract first and last name for shortened student name
    const studentFullName = student["اسم الطالب"] || student["الاسم"] || student["الاسم الكامل"] || student["name"] || student["Name"] || "";
    const getShortName = (nameStr: string) => {
      if (!nameStr) return "";
      const parts = nameStr.trim().split(/\s+/).filter(Boolean);
      if (parts.length <= 1) return nameStr;
      return `${parts[0]} ${parts[parts.length - 1]}`;
    };
    const shortName = getShortName(studentFullName);

    // Replace dynamic short-name tags
    result = result.replace(/{اسم الطالب الأول والأخير}/g, shortName);
    result = result.replace(/{الاسم الأول والأخير}/g, shortName);

    Object.keys(student).forEach((key) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, "g"), student[key] || "");
    });
    return result;
  };

  const campaignLogs = students.map((std: any, idx: number) => {
    const compiledMsg = compileTemplate(template, std);
    // Find phone column
    const phone = std["الجوال"] || std["رقم الجوال"] || std["الهاتف"] || std["رقم الهاتف"] || std["phone"] || std["Phone"] || "";
    const studentName = std["الاسم"] || std["اسم الطالب"] || std["الاسم الكامل"] || std["name"] || std["Name"] || `طالب ${idx + 1}`;
    
    return {
      id: `log_${campaignId}_${idx}`,
      studentName,
      phone: String(phone).trim(),
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

  // Start processing in background loop (simulated or cloud api)
  processCampaign(campaignId, delayMs);

  res.json({ campaignId, message: "تم بدء الحملة بنجاح" });
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

// Background Campaign Processing
async function processCampaign(campaignId: string, delayMs: number) {
  const campaign = campaigns[campaignId];
  if (!campaign || campaign.status !== "running") return;

  for (let i = 0; i < campaign.logs.length; i++) {
    // Check if campaign was paused or cancelled in between
    if (campaigns[campaignId].status !== "running") {
      break;
    }

    const log = campaign.logs[i];
    if (log.status !== "pending") continue;

    log.status = "sending";
    
    // Simulate/Execute sending delay
    await new Promise(resolve => setTimeout(resolve, delayMs));

    const isCloudAPI = whatsappConfig.mode === "cloud_api" && whatsappConfig.cloudApiKey && whatsappConfig.cloudPhoneId;
    const isRealMode = whatsappConfig.mode === "real";
    
    if (isCloudAPI) {
      try {
        // Prepare phone number (requires country code, default to Saudi Arabia +966 if starts with 5 or 05)
        let formattedPhone = log.phone.replace(/[\s\-\(\)\+]/g, "");
        if (formattedPhone.startsWith("05")) {
          formattedPhone = "966" + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith("5")) {
          formattedPhone = "966" + formattedPhone;
        }

        // WhatsApp Cloud API sends template messages primarily for business initiated conversations.
        // We simulate a free-form message or trigger the Cloud API call:
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
    } else if (isRealMode) {
      try {
        if (!sock || realConnectionStatus !== "connected") {
          throw new Error("جهاز الواتساب الحقيقي غير متصل حالياً.");
        }
        
        let formattedPhone = log.phone.replace(/[\s\-\(\)\+]/g, "");
        if (formattedPhone.startsWith("05")) {
          formattedPhone = "966" + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith("5")) {
          formattedPhone = "966" + formattedPhone;
        }
        
        const jid = `${formattedPhone}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: log.message });
        
        log.status = "success";
        campaign.sent += 1;
      } catch (err: any) {
        log.status = "failed";
        log.error = err.message || "فشل الإرسال عبر ربط الواتساب المباشر";
        campaign.failed += 1;
      }
    } else {
      // Simulated sending
      // Add a tiny random chance of failure (e.g., 4% chance of invalid format if phone has letters or is too short)
      const cleanedPhone = log.phone.replace(/[^0-9]/g, "");
      if (cleanedPhone.length < 9) {
        log.status = "failed";
        log.error = "رقم جوال غير صالح أو قصير جداً";
        campaign.failed += 1;
      } else {
        log.status = "success";
        campaign.sent += 1;
      }
    }

    log.timestamp = new Date().toISOString();
  }

  // Update final status
  if (campaign.sent + campaign.failed === campaign.total) {
    campaign.status = "completed";
  } else {
    campaign.status = "paused";
  }
  campaign.endTime = new Date().toISOString();
}

// Pause Campaign
app.post("/api/whatsapp/campaign/:id/pause", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
  campaign.status = "paused";
  res.json({ success: true, status: "paused" });
});

// Resume Campaign
app.post("/api/whatsapp/campaign/:id/resume", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "الحملة غير موجودة" });
  
  campaign.status = "running";
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
app.post("/api/whatsapp/send-single", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "يرجى تحديد رقم الجوال ونص الرسالة" });
  }

  const isCloudAPI = whatsappConfig.mode === "cloud_api" && whatsappConfig.cloudApiKey && whatsappConfig.cloudPhoneId;
  const isRealMode = whatsappConfig.mode === "real";

  if (isCloudAPI) {
    try {
      let formattedPhone = phone.replace(/[\s\-\(\)\+]/g, "");
      if (formattedPhone.startsWith("05")) {
        formattedPhone = "966" + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith("5")) {
        formattedPhone = "966" + formattedPhone;
      }

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
        return res.json({ success: true, message: "تم إرسال الرسالة الفردية بنجاح" });
      } else {
        return res.status(500).json({
          error: result.error?.message || "فشل إرسال الرسالة عبر WhatsApp Cloud API"
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        error: err.message || "حدث خطأ أثناء الاتصال بخوادم Meta"
      });
    }
  } else if (isRealMode) {
    try {
      if (!sock || realConnectionStatus !== "connected") {
        return res.status(400).json({ error: "جهاز الواتساب الحقيقي غير متصل حالياً. يرجى إتمام عملية الربط أولاً." });
      }

      let formattedPhone = phone.replace(/[\s\-\(\)\+]/g, "");
      if (formattedPhone.startsWith("05")) {
        formattedPhone = "966" + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith("5")) {
        formattedPhone = "966" + formattedPhone;
      }

      const jid = `${formattedPhone}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: message });

      return res.json({ success: true, message: "تم إرسال الرسالة الفردية الحقيقية بنجاح" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "فشل إرسال الرسالة الفردية عبر ربط الواتساب المباشر" });
    }
  } else {
    // Simulated sending
    const cleanedPhone = phone.replace(/[^0-9]/g, "");
    if (cleanedPhone.length < 9) {
      return res.status(400).json({ error: "رقم الجوال الفردي غير صالح أو قصير جداً" });
    }
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 1200));
    return res.json({ success: true, message: "تمت محاكاة إرسال الرسالة الفردية بنجاح" });
  }
});

// Setup Vite Dev Server / Serve static assets in production
async function startServer() {
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

  // Restore existing real WhatsApp sessions automatically on reboot
  const authFolder = path.join(process.cwd(), "auth_info_baileys");
  if (fs.existsSync(authFolder)) {
    console.log("Found existing real WhatsApp Web session folder. Restoring connection...");
    initRealWhatsApp();
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
