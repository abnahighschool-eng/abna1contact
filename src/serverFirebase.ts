import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, disableNetwork, enableNetwork } from "firebase/firestore";
import fs from "fs";
import path from "path";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

const APP_STATE_COLLECTION = "abna_system_data";
const WHATSAPP_SESSION_DOC = "whatsapp_baileys_session";
const SERVER_DATA_DOC = "server_system_state";
const QUOTA_FILE = path.join(process.cwd(), ".firestore_quota.json");
const SERVER_QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours cooldown for daily free tier write quota reset

let isServerQuotaExceeded = false;
let serverQuotaExceededTimestamp = 0;

// Load persisted server quota state from disk on startup
try {
  if (fs.existsSync(QUOTA_FILE)) {
    const raw = fs.readFileSync(QUOTA_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data?.timestamp && Date.now() - data.timestamp < SERVER_QUOTA_COOLDOWN_MS) {
      isServerQuotaExceeded = true;
      serverQuotaExceededTimestamp = data.timestamp;
      disableNetwork(firestoreDb).catch(() => {});
      console.info("[Server Storage] Initialized in local-disk mode (Firestore daily free quota limit cached).");
    }
  }
} catch (e) {
  // ignore quota file read errors
}

let lastSessionBackupHash = "";
let lastSessionBackupTime = 0;
const MIN_SESSION_BACKUP_INTERVAL_MS = 10 * 60 * 1000; // At most once every 10 minutes

function isServerQuotaLimited(): boolean {
  if (!isServerQuotaExceeded) return false;
  if (Date.now() - serverQuotaExceededTimestamp > SERVER_QUOTA_COOLDOWN_MS) {
    isServerQuotaExceeded = false;
    try {
      if (fs.existsSync(QUOTA_FILE)) fs.unlinkSync(QUOTA_FILE);
    } catch {}
    enableNetwork(firestoreDb).catch(() => {});
    return false;
  }
  return true;
}

function handleServerQuotaError(err: any, opName: string) {
  const errMsg = err?.message || String(err || "");
  const isQuota =
    errMsg.includes("resource-exhausted") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.includes("Quota limit exceeded") ||
    errMsg.includes("Quota exceeded") ||
    errMsg.includes("Free daily write units") ||
    errMsg.includes("Free daily read units") ||
    errMsg.includes("maximum backoff delay") ||
    errMsg.includes("Code: 8") ||
    errMsg.includes("429");

  if (isQuota) {
    isServerQuotaExceeded = true;
    serverQuotaExceededTimestamp = Date.now();
    try {
      fs.writeFileSync(QUOTA_FILE, JSON.stringify({ timestamp: serverQuotaExceededTimestamp }), "utf-8");
    } catch {}

    if (serverSyncTimeout) {
      clearTimeout(serverSyncTimeout);
      serverSyncTimeout = null;
    }
    // Shut down write stream immediately to avoid continuous backoff retry loops
    disableNetwork(firestoreDb).catch(() => {});
    console.info(`[Server Storage] Firestore cloud writes throttled (Daily quota reached). Server is storing all data reliably on local disk.`);
  } else {
    console.warn(`[Firebase Notice] ${opName}:`, errMsg);
  }
}

/**
 * Recursively removes undefined fields so Firestore doesn't throw errors
 */
function sanitizePayload(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.filter((item) => item !== undefined).map((item) => sanitizePayload(item));
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = sanitizePayload(v);
    }
  }
  return clean;
}

/**
 * Backs up all files in auth_info_baileys to Firestore (Throttled & deduplicated)
 */
export async function backupBaileysSessionToFirestore(authFolder: string, force = false): Promise<boolean> {
  if (isServerQuotaLimited()) return false;

  const now = Date.now();
  if (!force && now - lastSessionBackupTime < MIN_SESSION_BACKUP_INTERVAL_MS) {
    return false; // Skip redundant rapid backups
  }

  try {
    if (!fs.existsSync(authFolder)) return false;

    const fileNames = fs.readdirSync(authFolder);
    if (fileNames.length === 0) return false;

    const credsFile = path.join(authFolder, "creds.json");
    const credsExist = fs.existsSync(credsFile);
    if (!credsExist) return false;

    const credsContent = fs.readFileSync(credsFile, "utf-8");
    if (credsContent === lastSessionBackupHash && !force) {
      return true; // No change in credentials
    }

    const filesMap: Record<string, string> = {};
    for (const fileName of fileNames) {
      const filePath = path.join(authFolder, fileName);
      if (fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, "utf-8");
        const safeKey = Buffer.from(fileName).toString("base64url");
        filesMap[safeKey] = content;
      }
    }

    await setDoc(
      doc(firestoreDb, APP_STATE_COLLECTION, WHATSAPP_SESSION_DOC),
      {
        files: filesMap,
        filesCount: Object.keys(filesMap).length,
        hasCreds: credsExist,
        lastSynced: new Date().toISOString(),
      },
      { merge: true }
    );

    lastSessionBackupHash = credsContent;
    lastSessionBackupTime = now;
    console.log(`[Firebase] WhatsApp session backed up to Firestore (${Object.keys(filesMap).length} files)`);
    return true;
  } catch (err: any) {
    handleServerQuotaError(err, "backupBaileysSessionToFirestore");
    return false;
  }
}

/**
 * Restores all files in auth_info_baileys from Firestore if local folder is empty/missing
 */
export async function restoreBaileysSessionFromFirestore(authFolder: string): Promise<boolean> {
  if (isServerQuotaLimited()) return false;

  try {
    const credsFile = path.join(authFolder, "creds.json");
    // If local creds already exist and are valid, we don't need to overwrite unless empty
    if (fs.existsSync(credsFile)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credsFile, "utf-8"));
        if (creds && creds.registered) {
          console.log("[Firebase] Local WhatsApp creds already present on disk.");
          return true;
        }
      } catch (e) {
        // file corrupt, continue to restore from Firestore
      }
    }

    console.log("[Firebase] Checking Firestore for saved WhatsApp session...");
    const snap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, WHATSAPP_SESSION_DOC));
    if (!snap.exists()) {
      console.log("[Firebase] No saved WhatsApp session found in Firestore.");
      return false;
    }

    const data = snap.data();
    const files = data?.files;
    if (!files || typeof files !== "object") {
      console.log("[Firebase] Saved session document is empty.");
      return false;
    }

    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    let restoredCount = 0;
    for (const [encodedKey, content] of Object.entries(files)) {
      try {
        const fileName = Buffer.from(encodedKey, "base64url").toString("utf-8");
        if (fileName && typeof content === "string") {
          fs.writeFileSync(path.join(authFolder, fileName), content, "utf-8");
          restoredCount++;
        }
      } catch (e) {
        console.warn(`[Firebase] Error restoring file ${encodedKey}:`, e);
      }
    }

    console.log(`[Firebase] Restored ${restoredCount} WhatsApp session files from Firestore to ${authFolder}`);
    return restoredCount > 0 && fs.existsSync(credsFile);
  } catch (err: any) {
    handleServerQuotaError(err, "restoreBaileysSessionFromFirestore");
    return false;
  }
}

/**
 * Clears WhatsApp session from Firestore
 */
export async function deleteBaileysSessionInFirestore(): Promise<void> {
  if (isServerQuotaLimited()) return;

  try {
    await deleteDoc(doc(firestoreDb, APP_STATE_COLLECTION, WHATSAPP_SESSION_DOC));
    console.log("[Firebase] Deleted WhatsApp session from Firestore.");
  } catch (err: any) {
    handleServerQuotaError(err, "deleteBaileysSessionInFirestore");
  }
}

let pendingServerState: Record<string, any> = {};
let serverSyncTimeout: NodeJS.Timeout | null = null;
let lastSyncedServerHash = "";

/**
 * Sync server state (settings, students, templates, campaigns, logs, config) to Firestore (Debounced & throttled)
 */
export async function syncServerStateToFirestore(state: {
  appSettings?: any;
  activeStudentsList?: any[];
  activeTemplate?: string;
  systemUsersList?: any[];
  campaigns?: any;
  individualLogs?: any[];
  whatsappConfig?: any;
  attendanceRecords?: any;
  teachersList?: any[];
  scheduleAssignments?: any[];
  inquiryRequests?: any[];
}): Promise<void> {
  if (isServerQuotaLimited()) return;

  // Merge state into pending payload
  Object.assign(pendingServerState, state);

  if (serverSyncTimeout) clearTimeout(serverSyncTimeout);

  serverSyncTimeout = setTimeout(async () => {
    if (isServerQuotaLimited()) return;

    try {
      const payload = sanitizePayload({
        ...pendingServerState,
        lastUpdated: new Date().toISOString(),
      });

      const hash = JSON.stringify(payload);
      if (hash === lastSyncedServerHash) return;

      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), payload, { merge: true });
      lastSyncedServerHash = hash;
      pendingServerState = {};
    } catch (err: any) {
      handleServerQuotaError(err, "syncServerStateToFirestore");
    }
  }, 10000); // 10 seconds debounce to bundle updates into 1 write
}

/**
 * Load server state from Firestore on initial startup
 */
export async function loadServerStateFromFirestore(): Promise<any> {
  if (isServerQuotaLimited()) return null;

  try {
    const snap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC));
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err: any) {
    handleServerQuotaError(err, "loadServerStateFromFirestore");
  }
  return null;
}
