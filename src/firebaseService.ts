import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { Student, SchoolSignatories, ReportItem } from "./types";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Document IDs for ultra-optimized aggregation (1 Read / 1 Write per entity set)
const SCHOOL_DOC_ID = "school_settings";
const STUDENTS_DOC_ID = "students_data";
const REPORTS_DOC_ID = "reports_archive";
const ATTENDANCE_DOC_ID = "attendance_records";
const APP_STATE_COLLECTION = "abna_system_data";

export interface StoredAppState {
  schoolSignatories?: SchoolSignatories;
  students?: Student[];
  studentReports?: ReportItem[];
  attendanceRecords?: Record<string, Record<string, any>>;
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
 * Load all persistent app data in parallel (Only 4 reads max on initial app start!)
 */
export async function loadInitialAppData(): Promise<StoredAppState> {
  try {
    const [schoolSnap, studentsSnap, reportsSnap, attendanceSnap] = await Promise.all([
      getDoc(doc(db, APP_STATE_COLLECTION, SCHOOL_DOC_ID)),
      getDoc(doc(db, APP_STATE_COLLECTION, STUDENTS_DOC_ID)),
      getDoc(doc(db, APP_STATE_COLLECTION, REPORTS_DOC_ID)),
      getDoc(doc(db, APP_STATE_COLLECTION, ATTENDANCE_DOC_ID)),
    ]);

    const result: StoredAppState = {};

    if (schoolSnap.exists()) {
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

    if (studentsSnap.exists()) {
      const data = studentsSnap.data();
      if (Array.isArray(data.students)) {
        result.students = data.students;
      }
    }

    if (reportsSnap.exists()) {
      const data = reportsSnap.data();
      if (Array.isArray(data.studentReports)) {
        result.studentReports = data.studentReports;
      }
    }

    if (attendanceSnap.exists()) {
      const data = attendanceSnap.data();
      if (data.attendanceRecords) {
        result.attendanceRecords = data.attendanceRecords;
      }
    }

    return result;
  } catch (error) {
    console.error("Error loading app data from Firebase Firestore:", error);
    return {};
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
  try {
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
    return true;
  } catch (error) {
    console.error("Error saving school settings to Firestore:", error);
    return false;
  }
}

/**
 * Save students list (1 Single Write for all students)
 */
export async function saveStudentsDataToCloud(students: Student[]): Promise<boolean> {
  try {
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
    return true;
  } catch (error) {
    console.error("Error saving students list to Firestore:", error);
    return false;
  }
}

/**
 * Save reports archive (1 Single Write)
 */
export async function saveReportsDataToCloud(studentReports: ReportItem[]): Promise<boolean> {
  try {
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
    return true;
  } catch (error) {
    console.error("Error saving reports archive to Firestore:", error);
    return false;
  }
}

/**
 * Save attendance records (1 Single Write)
 */
export async function saveAttendanceDataToCloud(attendanceRecords: Record<string, Record<string, any>>): Promise<boolean> {
  try {
    const payload = sanitizeForFirestore({
      attendanceRecords,
      lastUpdated: new Date().toISOString(),
    });

    await setDoc(
      doc(db, APP_STATE_COLLECTION, ATTENDANCE_DOC_ID),
      payload,
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error("Error saving attendance records to Firestore:", error);
    return false;
  }
}

