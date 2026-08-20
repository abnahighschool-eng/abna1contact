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
const APP_STATE_COLLECTION = "abna_system_data";

export interface StoredAppState {
  schoolSignatories?: SchoolSignatories;
  students?: Student[];
  studentReports?: ReportItem[];
  savedTemplate?: string;
  savedVariables?: string[];
  lastUpdated?: string;
}

/**
 * Load all persistent app data in parallel (Only 3 reads max on initial app start!)
 */
export async function loadInitialAppData(): Promise<StoredAppState> {
  try {
    const [schoolSnap, studentsSnap, reportsSnap] = await Promise.all([
      getDoc(doc(db, APP_STATE_COLLECTION, SCHOOL_DOC_ID)),
      getDoc(doc(db, APP_STATE_COLLECTION, STUDENTS_DOC_ID)),
      getDoc(doc(db, APP_STATE_COLLECTION, REPORTS_DOC_ID)),
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
    await setDoc(
      doc(db, APP_STATE_COLLECTION, SCHOOL_DOC_ID),
      {
        schoolSignatories,
        savedTemplate: savedTemplate || "",
        savedVariables: savedVariables || [],
        lastUpdated: new Date().toISOString(),
      },
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
    await setDoc(
      doc(db, APP_STATE_COLLECTION, STUDENTS_DOC_ID),
      {
        students,
        totalCount: students.length,
        lastUpdated: new Date().toISOString(),
      },
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
    await setDoc(
      doc(db, APP_STATE_COLLECTION, REPORTS_DOC_ID),
      {
        studentReports,
        totalReports: studentReports.length,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error("Error saving reports archive to Firestore:", error);
    return false;
  }
}
