/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Play,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { CampaignRecipientItem } from "../utils/campaignLauncher";

export interface ModalTransmissionLog {
  id: string;
  name: string;
  phone: string;
  status: "success" | "failed";
  message?: string;
  error?: string;
  time: string;
}

export interface UnifiedCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  recipients: CampaignRecipientItem[];
  recipientLabel?: string; // "طالب" | "معلم" | "ولي أمر"
  intervalSeconds?: number; // default: 15
  enableJitter?: boolean; // default: true (±2s)
  onSendSingle?: (
    recipient: CampaignRecipientItem
  ) => Promise<{ success: boolean; error?: string }>;
  onItemSuccess?: (
    recipient: CampaignRecipientItem
  ) => void | Promise<void>;
  onItemCompleted?: (
    recipient: CampaignRecipientItem,
    success: boolean
  ) => void | Promise<void>;
  onComplete?: () => void;
  onAllCompleted?: (summary: {
    sent: number;
    failed: number;
    total: number;
  }) => void;
  extraActionButton?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
}

export default function UnifiedCampaignModal({
  isOpen,
  onClose,
  title = "إرسال الرسائل عبر الواتساب",
  subtitle,
  recipients,
  recipientLabel = "طالب",
  intervalSeconds = 15,
  enableJitter = true,
  onSendSingle,
  onItemSuccess,
  onItemCompleted,
  onComplete,
  onAllCompleted,
  extraActionButton,
}: UnifiedCampaignModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [currentRecipient, setCurrentRecipient] = useState<CampaignRecipientItem | null>(null);
  const [logs, setLogs] = useState<ModalTransmissionLog[]>([]);

  const abortRef = useRef(false);
  const isRunningRef = useRef(false);
  const countdownTimerRef = useRef<any>(null);

  // Initialize and auto-start when modal opens
  useEffect(() => {
    if (isOpen) {
      abortRef.current = false;
      setIsPaused(false);
      setIsCompleted(false);
      setCurrentIndex(0);
      setSentCount(0);
      setFailedCount(0);
      setCountdownSeconds(0);
      setLogs([]);
      setCurrentRecipient(null);

      if (recipients.length > 0) {
        startSending(0, 0, 0, []);
      }
    } else {
      abortRef.current = true;
      isRunningRef.current = false;
      setIsRunning(false);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }

    return () => {
      abortRef.current = true;
      isRunningRef.current = false;
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [isOpen]);

  const defaultSendSingle = async (
    item: CampaignRecipientItem
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const messageText = item.customMessage || (item as any).message || (item as any).text || "";
      const phoneNum = item.phone || (item as any).guardianPhone || (item as any)["رقم الجوال"] || "";

      if (!phoneNum || !String(phoneNum).trim()) {
        return { success: false, error: "لا يوجد رقم جوال مسجل" };
      }
      if (!messageText || !String(messageText).trim()) {
        return { success: false, error: "نص الرسالة غير محدد" };
      }

      const res = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNum,
          message: messageText,
          customMessage: messageText,
          studentName: item.name,
          grade: item.grade,
          className: item.className,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || "تعذر تسليم الرسالة" };
    } catch (err: any) {
      return { success: false, error: err.message || "خطأ في الشبكة" };
    }
  };

  const startSending = async (
    startIdx: number,
    initialSent: number,
    initialFailed: number,
    existingLogs: ModalTransmissionLog[]
  ) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;

    let sent = initialSent;
    let failed = initialFailed;
    let currentLogs = [...existingLogs];

    for (let i = startIdx; i < recipients.length; i++) {
      if (abortRef.current) {
        setIsRunning(false);
        isRunningRef.current = false;
        setIsPaused(true);
        return;
      }

      const item = recipients[i];
      setCurrentRecipient(item);
      setCurrentIndex(i + 1);

      // Perform single send
      const senderFn = onSendSingle || defaultSendSingle;
      let sendSuccess = false;
      let sendError: string | undefined;

      try {
        const res = await senderFn(item);
        sendSuccess = res.success;
        sendError = res.error;
      } catch (err: any) {
        sendSuccess = false;
        sendError = err.message || "خطأ غير متوقع";
      }

      const timestamp = new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      if (sendSuccess) {
        sent += 1;
        setSentCount(sent);
      } else {
        failed += 1;
        setFailedCount(failed);
      }

      const newLog: ModalTransmissionLog = {
        id: `log_${Date.now()}_${i}`,
        name: item.name,
        phone: item.phone,
        status: sendSuccess ? "success" : "failed",
        error: sendError,
        message: sendSuccess ? "تم الإرسال بنجاح" : sendError,
        time: timestamp,
      };

      currentLogs = [newLog, ...currentLogs];
      setLogs(currentLogs);

      if (sendSuccess && onItemSuccess) {
        try {
          await onItemSuccess(item);
        } catch (e) {
          console.error("Error in onItemSuccess callback:", e);
        }
      }

      if (onItemCompleted) {
        try {
          await onItemCompleted(item, sendSuccess);
        } catch (e) {
          console.error("Error in onItemCompleted callback:", e);
        }
      }

      // If there are more recipients and not aborted, wait with countdown
      if (i < recipients.length - 1 && !abortRef.current) {
        // Calculate delay with optional human jitter (±2s)
        const jitter = enableJitter ? Math.floor(Math.random() * 5) - 2 : 0;
        const totalDelay = Math.max(8, intervalSeconds + jitter);

        setCountdownSeconds(totalDelay);

        let remainingSec = totalDelay;
        while (remainingSec > 0) {
          if (abortRef.current) {
            setIsRunning(false);
            isRunningRef.current = false;
            setIsPaused(true);
            setCountdownSeconds(0);
            return;
          }
          await new Promise((r) => setTimeout(r, 1000));
          remainingSec -= 1;
          setCountdownSeconds(remainingSec);
        }
        setCountdownSeconds(0);
      }
    }

    setIsRunning(false);
    isRunningRef.current = false;
    setIsCompleted(true);
    setIsPaused(false);
    setCountdownSeconds(0);

    if (onAllCompleted) {
      onAllCompleted({ sent, failed, total: recipients.length });
    }
    if (onComplete) {
      onComplete();
    }
  };

  const handlePause = () => {
    abortRef.current = true;
    isRunningRef.current = false;
    setIsRunning(false);
    setIsPaused(true);
    setCountdownSeconds(0);
  };

  const handleResume = () => {
    if (currentIndex < recipients.length) {
      startSending(currentIndex, sentCount, failedCount, logs);
    }
  };

  const handleClose = () => {
    if (isRunning) {
      if (confirm("الإرسال لا يزال جارياً. هل ترغب في إيقاف الإرسال وإغلاق النافذة؟")) {
        abortRef.current = true;
        isRunningRef.current = false;
        setIsRunning(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const total = recipients.length;
  const processed = currentIndex;
  const remaining = Math.max(0, total - processed);
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
      dir="rtl"
      id="unified-campaign-modal-backdrop"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 text-right border border-slate-200 relative overflow-hidden"
        id="unified-campaign-modal-container"
      >
        {/* Header (Status icon + Title + Subtitle + Close button) */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isCompleted
                  ? "bg-emerald-100 text-emerald-700"
                  : isPaused
                  ? "bg-amber-100 text-amber-700"
                  : isRunning
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isPaused ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : isRunning ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg">
                {title || (isCompleted
                  ? "تم إكمال عملية الإرسال بنجاح"
                  : isPaused
                  ? "تم إيقاف عملية الإرسال"
                  : "جاري إرسال الرسائل...")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {subtitle || (isCompleted
                  ? `تم إرسال الإشعارات لجميع الـ ${recipientLabel} بنجاح.`
                  : `تمت معالجة (${processed}) من أصل (${total}) ${recipientLabel}.`)}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Anti-Ban Smart Shield Banner (Dark Emerald styling matching Image 1) */}
        <div className="bg-[#062c1e] text-white rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-emerald-300 block">
                درع الحماية الذكي من حظر الواتساب نشط
              </span>
              <span className="text-[11px] text-emerald-100/85">
                فاصل أمان ({intervalSeconds} ثانية) مع تفاوت زمني بشري عشوائي لمنع كشف الرسائل المتتابعة.
              </span>
            </div>
          </div>

          {isRunning && countdownSeconds > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-1.5 font-mono text-xs font-black shrink-0 animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>انتظار: {countdownSeconds}ث</span>
            </div>
          )}
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span>
              التقدم الإجمالي ({processed} من {total})
            </span>
            <span className="font-mono text-emerald-700">{percentage}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full shadow-inner"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-2.5 sm:p-3 text-center">
            <div className="text-[11px] font-bold text-emerald-800">تم الإرسال بنجاح</div>
            <div className="text-lg sm:text-xl font-black text-emerald-700 font-mono mt-0.5">
              {sentCount}
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-2.5 sm:p-3 text-center">
            <div className="text-[11px] font-bold text-rose-800">تعذر الإرسال</div>
            <div className="text-lg sm:text-xl font-black text-rose-700 font-mono mt-0.5">
              {failedCount}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:p-3 text-center">
            <div className="text-[11px] font-bold text-slate-600">المتبقي</div>
            <div className="text-lg sm:text-xl font-black text-slate-800 font-mono mt-0.5">
              {remaining}
            </div>
          </div>
        </div>

        {/* Real-time Transmission Logs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>سجل الإرسال المباشر:</span>
            {currentRecipient && isRunning && (
              <span className="text-[11px] font-normal text-slate-500">
                جاري معالجة: <strong className="text-slate-800">{currentRecipient.name}</strong>
              </span>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
            {logs.length === 0 ? (
              <p className="text-center text-slate-400 py-4 font-medium">
                جاري بدء عملية الإرسال الآمنة...
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded-xl flex items-center justify-between text-right border transition-all ${
                    log.status === "success"
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                      : "bg-rose-50/80 border-rose-200 text-rose-950"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-bold truncate max-w-[140px] sm:max-w-[180px]">
                      {log.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0" dir="ltr">
                      {log.phone}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold ${
                        log.status === "success" ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {log.status === "success" ? "تم بنجاح" : log.error || "فشل"}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{log.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 justify-end">
          {isRunning ? (
            <button
              onClick={handlePause}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
              id="btn-pause-campaign-transmission"
            >
              <PauseCircle className="w-4 h-4" />
              <span>إيقاف الإرسال الآن</span>
            </button>
          ) : (
            <>
              {extraActionButton && (
                <button
                  onClick={extraActionButton.onClick}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
                  id="btn-extra-campaign-action"
                >
                  {extraActionButton.icon}
                  <span>{extraActionButton.label}</span>
                </button>
              )}

              {remaining > 0 && (
                <button
                  onClick={handleResume}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
                  id="btn-resume-campaign-transmission"
                >
                  <Play className="w-4 h-4" />
                  <span>استئناف الإرسال ({remaining})</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
                id="btn-close-campaign-modal"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>إغلاق والعودة</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export interface CampaignLaunchButtonsProps {
  count: number;
  recipientLabel?: string;
  intervalSeconds?: number;
  onLaunchModal: () => void;
  onLaunchOfficialCampaign: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  customModalLabel?: string;
  customOfficialLabel?: string;
  modalButtonId?: string;
  officialButtonId?: string;
  className?: string;
}

export function CampaignLaunchButtons({
  count,
  recipientLabel = "طالب",
  intervalSeconds = 15,
  onLaunchModal,
  onLaunchOfficialCampaign,
  disabled = false,
  isLoading = false,
  customModalLabel,
  customOfficialLabel,
  modalButtonId,
  officialButtonId,
  className = "",
}: CampaignLaunchButtonsProps) {
  const isActionDisabled = disabled || count === 0 || isLoading;

  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${className}`}
      dir="rtl"
    >
      <button
        type="button"
        onClick={onLaunchModal}
        disabled={isActionDisabled}
        className="flex-1 lg:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        id={modalButtonId || "btn-batch-send-interval-modal"}
        title={`إرسال فوري مع نافذة حساب الرسائل والوقت وفاصل زمني ${intervalSeconds} ثانية لحماية الرقم من الحظر`}
      >
        <span className="text-emerald-200">⚡</span>
        <span>
          {customModalLabel ||
            `إرسال حملة جماعية (${count} ${recipientLabel}) - بفاصل ${intervalSeconds} ثانية`}
        </span>
      </button>

      <button
        type="button"
        onClick={onLaunchOfficialCampaign}
        disabled={isActionDisabled}
        className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        id={officialButtonId || "btn-batch-send-official-campaign"}
        title="إطلاق كحملة رسمية في نظام الرسائل مع شريط تقدم وتتبع خلفي"
      >
        <span className="text-emerald-400">📤</span>
        <span>{customOfficialLabel || "نظام الحملات الجماعية"}</span>
      </button>
    </div>
  );
}

