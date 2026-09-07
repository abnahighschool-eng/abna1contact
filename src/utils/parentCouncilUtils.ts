/**
 * Utility functions for Parent Councils (مجالس أولياء الأمور)
 * - Unique Activation Code Generation
 * - Validation for National ID, Phone (05xxxxxxxx, 10 digits), and Email
 * - URL tokens and link construction
 */

import { Student } from "../types";

// Convert Arabic-Indic numerals (٠-٩) to standard English numerals (0-9) and strip whitespace
export function normalizeDigits(input?: string): string {
  if (!input) return "";
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  return String(input)
    .trim()
    .replace(/[٠-٩]/g, (d) => arabicIndic.indexOf(d).toString())
    .replace(/\s+/g, "");
}

// Clean phone to exactly digits
export function cleanPhoneNumber(phone?: string): string {
  const digits = normalizeDigits(phone).replace(/\D/g, "");
  return digits;
}

// Check if Phone is exactly 10 digits and starts with 05
export function isValidSaudiPhone(phone?: string): boolean {
  const clean = cleanPhoneNumber(phone);
  return /^05\d{8}$/.test(clean);
}
export const validateSaudiPhone = isValidSaudiPhone;

// Format Saudi phone to clean standard 05xxxxxxxx
export function formatSaudiPhone(phone?: string): string {
  const clean = cleanPhoneNumber(phone);
  if (clean.startsWith("9665") && clean.length === 12) {
    return "0" + clean.slice(3);
  }
  return clean;
}

// Check if National ID is exactly 10 digits
export function isValidNationalId(nationalId?: string): boolean {
  const clean = normalizeDigits(nationalId).replace(/\D/g, "");
  return /^\d{10}$/.test(clean);
}
export const validateNationalId = isValidNationalId;

// Check if Email is valid format
export function isValidEmail(email?: string): boolean {
  if (!email || !email.trim()) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}
export const validateEmail = isValidEmail;

// Generate a deterministic unique 6-digit numeric activation code for a student
export function generateStudentActivationCode(studentId?: string, studentName?: string, phone?: string): string {
  const seed = `${studentId || ""}_${studentName || ""}_${cleanPhoneNumber(phone)}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const codeNum = Math.abs(hash) % 900000 + 100000;
  return codeNum.toString();
}

// Generate a unique access token for the council form URL
export function generateStudentCouncilToken(studentId?: string): string {
  const cleanId = String(studentId || "student").replace(/[^a-zA-Z0-9]/g, "");
  return `pc_${cleanId}_${Date.now().toString(36)}`;
}

// Format direct link for a parent
export function buildParentCouncilUrl(
  origin: string,
  params: {
    token?: string;
    studentId?: string;
    code?: string;
    studentName?: string;
    grade?: string;
    className?: string;
    phone?: string;
    guardian?: string;
  }
): string {
  const query = new URLSearchParams();
  query.set("page", "parent_council_portal");
  query.set("parent_council", "true");
  if (params.token) {
    query.set("council_token", params.token);
    query.set("token", params.token);
  }
  if (params.code) {
    query.set("council_code", params.code);
    query.set("code", params.code);
  }
  if (params.studentId) query.set("student_id", params.studentId);
  if (params.studentName) query.set("student_name", params.studentName);
  if (params.grade) query.set("grade", params.grade);
  if (params.className) query.set("class", params.className);
  if (params.phone) query.set("phone", params.phone);
  if (params.guardian) query.set("guardian", params.guardian);
  return `${origin}?${query.toString()}`;
}
