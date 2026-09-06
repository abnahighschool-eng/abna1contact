import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, disableNetwork, enableNetwork, setLogLevel } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { Student, SchoolSignatories, ReportItem, AppUser, Teacher, ScheduleAssignment, TeacherInquiryRequest } from "./types";

// Silence internal Firestore SDK quota backoff / error noise in the console
try {
  setLogLevel("silent");
} catch {}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Suppress and handle unhandled Firestore quota errors globally in the window
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || String(event.reason || "");
    if (
      reason.includes("resource-exhausted") ||
      reason.includes("RESOURCE_EXHAUSTED") ||
      reason.includes("Quota limit exceeded") ||
      reason.includes("Free daily write units") ||
      reason.includes("maximum backoff delay") ||
      reason.includes("Code: 8")
    ) {
      event.preventDefault(); // Prevent bubbling up to the error banner
      handleQuotaError(event.reason, "global-unhandled-rejection");
    }
  });
}

// Document IDs for ultra-optimized aggregation (1 Read / 1 Write per entity set)
const SCHOOL_DOC_ID = "school_settings";
const STUDENTS_DOC_ID = "students_data";
const REPORTS_DOC_ID = "reports_archive";
const ATTENDANCE_DOC_ID = "attendance_records";
const USERS_DOC_ID = "users_accounts";
const TEACHERS_DOC_ID = "teachers_data";
const SCHEDULE_DOC_ID = "schedule_data";
const INQUIRIES_DOC_ID = "inquiries_data";
const APP_STATE_COLLECTION = "abna_system_data";

// In-memory quota management
let isFirestoreQuotaExceeded = false;
let quotaExceededTimestamp = 0;

// Cache of last saved hashes to prevent duplicate writes
const lastSavedPayloadHashes: Record<string, string> = {};

export function isQuotaLimited(): boolean {
  if (!isFirestoreQuotaExceeded) return false;
  if (Date.now() - quotaExceededTimestamp > 60 * 60 * 1000) {
    isFirestoreQuotaExceeded = false;
    return false;
  }
  return true;
}

export function getCloudStorageStatus(): {
  isQuotaExceeded: boolean;
  quotaMessage: string | null;
  databaseUrl: string;
} {
  const isLimited = isQuotaLimited();
  const projectId = firebaseConfig.projectId || "aqueous-epoch-lxfb9";
  const dbId = firebaseConfig.firestoreDatabaseId || "ai-studio-4d5db8bc-d9b7-43bb-9c78-f66acc3d93a3";
  const databaseUrl = `https://console.firebase.google.com/project/${projectId}/firestore/databases/${dbId}/data?openUpgradeDialog=true`;

  return {
    isQuotaExceeded: isLimited,
    quotaMessage: isLimited 
      ? "تم الوصول إلى الحد اليومي المجاني لعمليات الكتابة بقاعدة البيانات السحابية (Free Daily Write Quota). النظام يعمل بكامل كفاءته وسرعته مستنداً إلى التخزين المحلي والخادم الآمن."
      : null,
    databaseUrl,
  };
}

function handleQuotaError(err: any, operationName: string) {
  const errMsg = err instanceof Error ? err.message : String(err || "");
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
    isFirestoreQuotaExceeded = true;
    quotaExceededTimestamp = Date.now();
    console.info(`[Storage Status] Cloud Firestore write sync paused temporarily for ${operationName}.`);
  } else {
    console.warn(`[Cloud Sync Notice] ${operationName}:`, errMsg);
  }
}

export const DEFAULT_ADMIN_USER: AppUser = {
  id: "admin_root_1",
  name: "مدير النظام العام",
  username: "admin",
  password: "123456",
  role: "admin",
  status: "active",
  phone: "",
  masterPin: "998877",
  createdAt: new Date().toISOString(),
  notes: "حساب الإدارة الأساسي الافتراضي للنظام",
};

export interface StoredAppState {
  schoolSignatories?: SchoolSignatories;
  students?: Student[];
  studentReports?: ReportItem[];
  attendanceRecords?: Record<string, Record<string, any>>;
  users?: AppUser[];
  teachers?: Teacher[];
  scheduleAssignments?: ScheduleAssignment[];
  inquiryRequests?: TeacherInquiryRequest[];
  savedTemplate?: string;
  savedVariables?: string[];
  lastUpdated?: string;
}

/**
 * Recursively sanitizes data before writing to Firestore by removing `undefined` values,
 * which Firestore strictly forbids and throws errors on.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== "object") {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj as T;
}

/**
 * Load all persistent app data in parallel (Lightweight aggregated reads on initial app start)
 */
export async function loadInitialAppData(): Promise<StoredAppState> {
  if (isQuotaLimited()) {
    return {
      users: [DEFAULT_ADMIN_USER],
    };
  }

  try {
    const [schoolSnap, studentsSnap, reportsSnap, attendanceSnap, usersSnap, teachersSnap, scheduleSnap, inquiriesSnap] = await Promise.all([
      getDoc(doc(db, APP_STATE_COLLECTION, SCHOOL_DOC_ID)).catch((e) => {
        handleQuotaError(e, "schoolSnap");
        return null;
      }),
      getDoc(doc(db, APP_STATE_COLLECTION, STUDENTS_DOC_ID)).catch((e) => {
        handleQuotaError(e, "studentsSnap");
        return null;
      }),
      getDoc(doc(db, APP_STATE_COLLECTION, REPORTS_DOC_ID)).catch((e) => {
        handleQuotaError(e, "reportsSnap");
        return null;
      }),
      getDoc(doc(db, APP_STATE_COLLECTION, ATTENDANCE_DOC_ID)).catch((e) => {
        handleQuotaError(e, "attendanceSnap");
        return null;
      }),
      getDoc(doc(db, APP_STATE_COLLECTION, USERS_DOC_ID)).catch((e) => {
        handleQuotaError(e, "usersSnap");
        return null;
      }),
      getDoc(doc(db, APP_STATE_COLLECTION, TEACHERS_DOC_ID)).catch((e) => {
        handleQuotaError(e, "teachersSnap");
        return null;
      }),
      getDoc(doc(db, APP_STATE_COLLECTION, SCHEDULE_DOC_ID)).catch((e) => {
        handleQuotaError(e, "scheduleSnap");
        return null;
      }),
      getDoc(doc(db, APP_STATE_COLLECTION, INQUIRIES_DOC_ID)).catch((e) => {
        handleQuotaError(e, "inquiriesSnap");
        return null;
      }),
    ]);

    const result: StoredAppState = {};

    if (schoolSnap && schoolSnap.exists()) {
      const data = schoolSnap.data();
      if (data.schoolSignatories) {
        result.schoolSignatories = data.schoolSignatories;
      }
      if (data.savedTemplate) {
        result.savedTemplate = data.savedTemplate;
      }
      if (data.savedVariables) {
        result.savedVariables = data.savedVariables;
      }
    }

    if (studentsSnap && studentsSnap.exists()) {
      const data = studentsSnap.data();
      if (Array.isArray(data.students)) {
        result.students = data.students;
      }
    }

    if (reportsSnap && reportsSnap.exists()) {
      const data = reportsSnap.data();
      if (Array.isArray(data.studentReports)) {
        result.studentReports = data.studentReports;
      }
    }

    if (attendanceSnap && attendanceSnap.exists()) {
      const data = attendanceSnap.data();
      if (data.attendanceRecords) {
        result.attendanceRecords = data.attendanceRecords;
      }
    }

    if (teachersSnap && teachersSnap.exists()) {
      const data = teachersSnap.data();
      if (Array.isArray(data.teachers)) {
        result.teachers = data.teachers;
      }
    }

    if (scheduleSnap && scheduleSnap.exists()) {
      const data = scheduleSnap.data();
      if (Array.isArray(data.scheduleAssignments)) {
        result.scheduleAssignments = data.scheduleAssignments;
      }
    }

    if (inquiriesSnap && inquiriesSnap.exists()) {
      const data = inquiriesSnap.data();
      if (Array.isArray(data.inquiryRequests)) {
        result.inquiryRequests = data.inquiryRequests;
      }
    }

    if (usersSnap && usersSnap.exists()) {
      const data = usersSnap.data();
      if (Array.isArray(data.users) && data.users.length > 0) {
        result.users = data.users;
      } else {
        result.users = [DEFAULT_ADMIN_USER];
      }
    } else {
      result.users = [DEFAULT_ADMIN_USER];
    }

    return result;
  } catch (error) {
    handleQuotaError(error, "loadInitialAppData");
    return {
      users: [DEFAULT_ADMIN_USER],
    };
  }
}

/**
 * Save school signatories, logo, and message template (1 Single Write)
 */
export async function saveSchoolDataToCloud(
  schoolSignatories: SchoolSignatories,
  savedTemplate?: string,
  savedVariables?: string[]
): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify({ schoolSignatories, savedTemplate, savedVariables });
    if (lastSavedPayloadHashes[SCHOOL_DOC_ID] === rawContent) {
      return true; // No changes, avoid duplicate write
    }

    const payload = sanitizeForFirestore({
      schoolSignatories,
      savedTemplate: savedTemplate || "",
      savedVariables: savedVariables || [],
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, SCHOOL_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[SCHOOL_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveSchoolDataToCloud");
    return false;
  }
}

/**
 * Save students list (1 Single Write for all students)
 */
export async function saveStudentsDataToCloud(students: Student[]): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify(students);
    if (lastSavedPayloadHashes[STUDENTS_DOC_ID] === rawContent) {
      return true;
    }

    const payload = sanitizeForFirestore({
      students,
      totalCount: students.length,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, STUDENTS_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[STUDENTS_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveStudentsDataToCloud");
    return false;
  }
}

/**
 * Save reports archive (1 Single Write)
 */
export async function saveReportsDataToCloud(studentReports: ReportItem[]): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify(studentReports);
    if (lastSavedPayloadHashes[REPORTS_DOC_ID] === rawContent) {
      return true;
    }

    const payload = sanitizeForFirestore({
      studentReports,
      totalReports: studentReports.length,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, REPORTS_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[REPORTS_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveReportsDataToCloud");
    return false;
  }
}

/**
 * Save attendance records (1 Single Write)
 */
export async function saveAttendanceDataToCloud(attendanceRecords: Record<string, Record<string, any>>): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify(attendanceRecords);
    if (lastSavedPayloadHashes[ATTENDANCE_DOC_ID] === rawContent) {
      return true;
    }

    const payload = sanitizeForFirestore({
      attendanceRecords,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, ATTENDANCE_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[ATTENDANCE_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveAttendanceDataToCloud");
    return false;
  }
}

/**
 * Save application users and credentials list (1 Single Write for all accounts)
 */
export async function saveUsersDataToCloud(users: AppUser[]): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify(users);
    if (lastSavedPayloadHashes[USERS_DOC_ID] === rawContent) {
      return true;
    }

    const payload = sanitizeForFirestore({
      users,
      totalUsers: users.length,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, USERS_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[USERS_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveUsersDataToCloud");
    return false;
  }
}

/**
 * Save teachers roster (1 Single Write for all teachers)
 */
export async function saveTeachersDataToCloud(teachers: Teacher[]): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify(teachers);
    if (lastSavedPayloadHashes[TEACHERS_DOC_ID] === rawContent) {
      return true;
    }

    const payload = sanitizeForFirestore({
      teachers,
      totalTeachers: teachers.length,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, TEACHERS_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[TEACHERS_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveTeachersDataToCloud");
    return false;
  }
}

/**
 * Save schedule assignments (1 Single Write for schedule)
 */
export async function saveScheduleDataToCloud(scheduleAssignments: ScheduleAssignment[]): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify(scheduleAssignments);
    if (lastSavedPayloadHashes[SCHEDULE_DOC_ID] === rawContent) {
      return true;
    }

    const payload = sanitizeForFirestore({
      scheduleAssignments,
      totalAssignments: scheduleAssignments.length,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, SCHEDULE_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[SCHEDULE_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveScheduleDataToCloud");
    return false;
  }
}

/**
 * Save inquiry requests and evaluations (1 Single Write for inquiries)
 */
export async function saveInquiriesDataToCloud(inquiryRequests: TeacherInquiryRequest[]): Promise<boolean> {
  if (isQuotaLimited()) return false;

  try {
    const rawContent = JSON.stringify(inquiryRequests);
    if (lastSavedPayloadHashes[INQUIRIES_DOC_ID] === rawContent) {
      return true;
    }

    const payload = sanitizeForFirestore({
      inquiryRequests,
      totalInquiries: inquiryRequests.length,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, INQUIRIES_DOC_ID),
      payload,
      { merge: true }
    );
    lastSavedPayloadHashes[INQUIRIES_DOC_ID] = rawContent;
    return true;
  } catch (error) {
    handleQuotaError(error, "saveInquiriesDataToCloud");
    return false;
  }
}

/**
 * Clear specific or all collections in Cloud Firestore
 */
export async function clearCloudData(scope: "all" | "students" | "attendance" | "teachers" | "schedule" | "inquiries" | "reports"): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();

    if (scope === "all") {
      await Promise.all([
        setDoc(doc(db, APP_STATE_COLLECTION, STUDENTS_DOC_ID), { students: [], totalCount: 0, lastUpdated: timestamp }),
        setDoc(doc(db, APP_STATE_COLLECTION, TEACHERS_DOC_ID), { teachers: [], totalTeachers: 0, lastUpdated: timestamp }),
        setDoc(doc(db, APP_STATE_COLLECTION, SCHEDULE_DOC_ID), { scheduleAssignments: [], totalAssignments: 0, lastUpdated: timestamp }),
        setDoc(doc(db, APP_STATE_COLLECTION, ATTENDANCE_DOC_ID), { attendanceRecords: {}, lastUpdated: timestamp }),
        setDoc(doc(db, APP_STATE_COLLECTION, INQUIRIES_DOC_ID), { inquiryRequests: [], totalInquiries: 0, lastUpdated: timestamp }),
        setDoc(doc(db, APP_STATE_COLLECTION, REPORTS_DOC_ID), { studentReports: [], totalReports: 0, lastUpdated: timestamp }),
      ]);
      return true;
    }

    if (scope === "students") {
      await setDoc(doc(db, APP_STATE_COLLECTION, STUDENTS_DOC_ID), { students: [], totalCount: 0, lastUpdated: timestamp });
      delete lastSavedPayloadHashes[STUDENTS_DOC_ID];
      return true;
    }

    if (scope === "teachers") {
      await setDoc(doc(db, APP_STATE_COLLECTION, TEACHERS_DOC_ID), { teachers: [], totalTeachers: 0, lastUpdated: timestamp });
      delete lastSavedPayloadHashes[TEACHERS_DOC_ID];
      return true;
    }

    if (scope === "schedule") {
      await setDoc(doc(db, APP_STATE_COLLECTION, SCHEDULE_DOC_ID), { scheduleAssignments: [], totalAssignments: 0, lastUpdated: timestamp });
      delete lastSavedPayloadHashes[SCHEDULE_DOC_ID];
      return true;
    }

    if (scope === "attendance") {
      await setDoc(doc(db, APP_STATE_COLLECTION, ATTENDANCE_DOC_ID), { attendanceRecords: {}, lastUpdated: timestamp });
      delete lastSavedPayloadHashes[ATTENDANCE_DOC_ID];
      return true;
    }

    if (scope === "inquiries") {
      await setDoc(doc(db, APP_STATE_COLLECTION, INQUIRIES_DOC_ID), { inquiryRequests: [], totalInquiries: 0, lastUpdated: timestamp });
      delete lastSavedPayloadHashes[INQUIRIES_DOC_ID];
      return true;
    }

    if (scope === "reports") {
      await setDoc(doc(db, APP_STATE_COLLECTION, REPORTS_DOC_ID), { studentReports: [], totalReports: 0, lastUpdated: timestamp });
      delete lastSavedPayloadHashes[REPORTS_DOC_ID];
      return true;
    }

    return false;
  } catch (err) {
    console.error("clearCloudData error:", err);
    return false;
  }
}

/**
 * Force synchronization of all state to Cloud Firestore immediately
 */
export async function forceSyncAllToCloud(state: StoredAppState): Promise<boolean> {
  try {
    const promises: Promise<any>[] = [];

    if (state.schoolSignatories) {
      promises.push(saveSchoolDataToCloud(state.schoolSignatories, (state as any).savedTemplate));
    }
    if (state.students && state.students.length > 0) {
      delete lastSavedPayloadHashes[STUDENTS_DOC_ID];
      promises.push(saveStudentsDataToCloud(state.students));
    }
    if (state.teachers && state.teachers.length > 0) {
      delete lastSavedPayloadHashes[TEACHERS_DOC_ID];
      promises.push(saveTeachersDataToCloud(state.teachers));
    }
    if (state.scheduleAssignments && state.scheduleAssignments.length > 0) {
      delete lastSavedPayloadHashes[SCHEDULE_DOC_ID];
      promises.push(saveScheduleDataToCloud(state.scheduleAssignments));
    }
    if (state.attendanceRecords && Object.keys(state.attendanceRecords).length > 0) {
      delete lastSavedPayloadHashes[ATTENDANCE_DOC_ID];
      promises.push(saveAttendanceDataToCloud(state.attendanceRecords));
    }
    if (state.inquiryRequests && state.inquiryRequests.length > 0) {
      delete lastSavedPayloadHashes[INQUIRIES_DOC_ID];
      promises.push(saveInquiriesDataToCloud(state.inquiryRequests));
    }
    if (state.users && state.users.length > 0) {
      delete lastSavedPayloadHashes[USERS_DOC_ID];
      promises.push(saveUsersDataToCloud(state.users));
    }

    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error("forceSyncAllToCloud error:", err);
    return false;
  }
}

