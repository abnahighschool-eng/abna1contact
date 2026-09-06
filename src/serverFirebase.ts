import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, disableNetwork, enableNetwork, setLogLevel } from "firebase/firestore";
import fs from "fs";
import path from "path";
import firebaseConfig from "../firebase-applet-config.json";

// Silence internal Firestore SDK quota backoff / error noise in the console
try {
  setLogLevel("silent");
} catch {}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

const APP_STATE_COLLECTION = "abna_system_data";
const WHATSAPP_SESSION_DOC = "whatsapp_baileys_session";
const SERVER_DATA_DOC = "server_system_state";
const QUOTA_FILE = path.join(process.cwd(), ".firestore_quota.json");
const SERVER_QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown instead of 24h
const MIN_SESSION_BACKUP_INTERVAL_MS = 60 * 1000; // 1 minute interval

let isServerQuotaExceeded = false;
let serverQuotaExceededTimestamp = 0;
let lastSessionBackupTime = 0;
let lastSessionBackupHash = "";

function isServerQuotaLimited(): boolean {
  if (!isServerQuotaExceeded) return false;
  if (Date.now() - serverQuotaExceededTimestamp > SERVER_QUOTA_COOLDOWN_MS) {
    isServerQuotaExceeded = false;
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
    errMsg.includes("Code: 8") ||
    errMsg.includes("429");

  if (isQuota) {
    isServerQuotaExceeded = true;
    serverQuotaExceededTimestamp = Date.now();
    console.info(`[Server Storage] Firestore quota notice for ${opName}: paused temporarily.`);
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
 * Flush server state immediately to Firestore (no debounce)
 */
export async function forceFlushServerStateToFirestore(additionalState?: Record<string, any>): Promise<boolean> {
  try {
    if (additionalState) {
      Object.assign(pendingServerState, additionalState);
    }
    const payload = sanitizePayload({
      ...pendingServerState,
      lastUpdated: new Date().toISOString(),
    });
    await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), payload, { merge: true });
    lastSyncedServerHash = JSON.stringify(payload);
    pendingServerState = {};
    return true;
  } catch (err: any) {
    handleServerQuotaError(err, "forceFlushServerStateToFirestore");
    return false;
  }
}

/**
 * Sync server state to Firestore (Debounced)
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
  healthProfiles?: any;
  supportCases?: any[];
  healthAuditLogs?: any[];
  needsSurveyProfiles?: any;
}): Promise<void> {
  // Merge state into pending payload
  Object.assign(pendingServerState, state);

  if (serverSyncTimeout) clearTimeout(serverSyncTimeout);

  serverSyncTimeout = setTimeout(async () => {
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
  }, 1500); // 1.5 seconds debounce for responsive syncing
}

/**
 * Delete specific or all data from Firestore
 */
export async function deleteServerStateInFirestore(scope: "all" | "students" | "attendance" | "teachers" | "schedule" | "inquiries" | "health" | "logs"): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    
    if (scope === "all") {
      // Reset server_system_state with blank records and update individual collections
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        activeStudentsList: [],
        teachersList: [],
        scheduleAssignments: [],
        attendanceRecords: {},
        inquiryRequests: [],
        healthProfiles: {},
        supportCases: [],
        healthAuditLogs: [],
        needsSurveyProfiles: {},
        campaigns: {},
        individualLogs: [],
        lastUpdated: timestamp,
      }, { merge: true });

      await Promise.all([
        setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "students_data"), { students: [], totalCount: 0, lastUpdated: timestamp }),
        setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "teachers_data"), { teachers: [], totalTeachers: 0, lastUpdated: timestamp }),
        setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "schedule_data"), { scheduleAssignments: [], totalAssignments: 0, lastUpdated: timestamp }),
        setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "attendance_records"), { attendanceRecords: {}, lastUpdated: timestamp }),
        setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "inquiries_data"), { inquiryRequests: [], totalInquiries: 0, lastUpdated: timestamp }),
        setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "reports_archive"), { studentReports: [], totalReports: 0, lastUpdated: timestamp }),
      ]);
      return true;
    }

    if (scope === "students") {
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        activeStudentsList: [],
        lastUpdated: timestamp,
      }, { merge: true });
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "students_data"), {
        students: [],
        totalCount: 0,
        lastUpdated: timestamp,
      }, { merge: true });
      return true;
    }

    if (scope === "attendance") {
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        attendanceRecords: {},
        lastUpdated: timestamp,
      }, { merge: true });
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "attendance_records"), {
        attendanceRecords: {},
        lastUpdated: timestamp,
      }, { merge: true });
      return true;
    }

    if (scope === "teachers") {
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        teachersList: [],
        lastUpdated: timestamp,
      }, { merge: true });
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "teachers_data"), {
        teachers: [],
        totalTeachers: 0,
        lastUpdated: timestamp,
      }, { merge: true });
      return true;
    }

    if (scope === "schedule") {
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        scheduleAssignments: [],
        lastUpdated: timestamp,
      }, { merge: true });
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "schedule_data"), {
        scheduleAssignments: [],
        totalAssignments: 0,
        lastUpdated: timestamp,
      }, { merge: true });
      return true;
    }

    if (scope === "inquiries") {
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        inquiryRequests: [],
        lastUpdated: timestamp,
      }, { merge: true });
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, "inquiries_data"), {
        inquiryRequests: [],
        totalInquiries: 0,
        lastUpdated: timestamp,
      }, { merge: true });
      return true;
    }

    if (scope === "health") {
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        healthProfiles: {},
        supportCases: [],
        healthAuditLogs: [],
        lastUpdated: timestamp,
      }, { merge: true });
      return true;
    }

    if (scope === "logs") {
      await setDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC), {
        campaigns: {},
        individualLogs: [],
        lastUpdated: timestamp,
      }, { merge: true });
      return true;
    }

    return false;
  } catch (err: any) {
    handleServerQuotaError(err, "deleteServerStateInFirestore");
    return false;
  }
}

/**
 * Load server state from Firestore on initial startup
 * Combines server_system_state and individual documents to ensure zero data loss
 */
export async function loadServerStateFromFirestore(): Promise<any> {
  try {
    const combinedState: Record<string, any> = {};

    // 1. Fetch server_system_state
    try {
      const snap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, SERVER_DATA_DOC));
      if (snap.exists()) {
        Object.assign(combinedState, snap.data());
      }
    } catch (e) {
      console.warn("[Firebase] Could not fetch server_system_state:", e);
    }

    // 2. Fetch students_data if activeStudentsList is empty or missing
    if (!Array.isArray(combinedState.activeStudentsList) || combinedState.activeStudentsList.length === 0) {
      try {
        const studentsSnap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, "students_data"));
        if (studentsSnap.exists()) {
          const sData = studentsSnap.data();
          if (Array.isArray(sData.students) && sData.students.length > 0) {
            combinedState.activeStudentsList = sData.students;
          }
        }
      } catch (e) {}
    }

    // 3. Fetch teachers_data if teachersList is empty or missing
    if (!Array.isArray(combinedState.teachersList) || combinedState.teachersList.length === 0) {
      try {
        const teachersSnap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, "teachers_data"));
        if (teachersSnap.exists()) {
          const tData = teachersSnap.data();
          if (Array.isArray(tData.teachers) && tData.teachers.length > 0) {
            combinedState.teachersList = tData.teachers;
          }
        }
      } catch (e) {}
    }

    // 4. Fetch schedule_data if scheduleAssignments is empty or missing
    if (!Array.isArray(combinedState.scheduleAssignments) || combinedState.scheduleAssignments.length === 0) {
      try {
        const scheduleSnap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, "schedule_data"));
        if (scheduleSnap.exists()) {
          const scData = scheduleSnap.data();
          if (Array.isArray(scData.scheduleAssignments) && scData.scheduleAssignments.length > 0) {
            combinedState.scheduleAssignments = scData.scheduleAssignments;
          }
        }
      } catch (e) {}
    }

    // 5. Fetch attendance_records if attendanceRecords is empty or missing
    if (!combinedState.attendanceRecords || Object.keys(combinedState.attendanceRecords).length === 0) {
      try {
        const attSnap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, "attendance_records"));
        if (attSnap.exists()) {
          const attData = attSnap.data();
          if (attData.attendanceRecords && typeof attData.attendanceRecords === "object") {
            combinedState.attendanceRecords = attData.attendanceRecords;
          }
        }
      } catch (e) {}
    }

    // 6. Fetch inquiries_data if inquiryRequests is empty or missing
    if (!Array.isArray(combinedState.inquiryRequests) || combinedState.inquiryRequests.length === 0) {
      try {
        const inqSnap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, "inquiries_data"));
        if (inqSnap.exists()) {
          const inqData = inqSnap.data();
          if (Array.isArray(inqData.inquiryRequests) && inqData.inquiryRequests.length > 0) {
            combinedState.inquiryRequests = inqData.inquiryRequests;
          }
        }
      } catch (e) {}
    }

    // 7. Fetch school_settings if appSettings is empty or missing
    if (!combinedState.appSettings || Object.keys(combinedState.appSettings).length === 0) {
      try {
        const schoolSnap = await getDoc(doc(firestoreDb, APP_STATE_COLLECTION, "school_settings"));
        if (schoolSnap.exists()) {
          const scData = schoolSnap.data();
          if (scData.schoolSignatories) {
            combinedState.appSettings = scData.schoolSignatories;
          }
          if (scData.savedTemplate && !combinedState.activeTemplate) {
            combinedState.activeTemplate = scData.savedTemplate;
          }
        }
      } catch (e) {}
    }

    return Object.keys(combinedState).length > 0 ? combinedState : null;
  } catch (err: any) {
    handleServerQuotaError(err, "loadServerStateFromFirestore");
    return null;
  }
}
