import * as XLSX from "xlsx";
import { NoorStudentAbsence, Student } from "../types";

export function getCurrentHijriDate(): string {
  try {
    const formatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return formatter.format(new Date());
  } catch (e) {
    return new Date().toLocaleDateString("ar-SA");
  }
}

export function parseNoorRawText(rawText: string): { success: boolean; absences: NoorStudentAbsence[]; message?: string } {
  if (!rawText.trim()) return { success: false, absences: [] };
  return { success: true, absences: [] };
}

export async function parseNoorExcelFile(file: File): Promise<{ success: boolean; absences: NoorStudentAbsence[]; message?: string }> {
  return { success: true, absences: [] };
}

export function enrichWithExistingStudents(absences: NoorStudentAbsence[], students: Student[]): NoorStudentAbsence[] {
  return absences;
}
