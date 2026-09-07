/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Zap, Send } from "lucide-react";

export interface CampaignLaunchButtonsProps {
  count: number;
  recipientLabel?: string; // "طالب" | "معلم" | "ولي أمر" | "مستلم"
  intervalSeconds?: number; // default: 15
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

/**
 * Standardized dual-action campaign dispatch buttons across the entire platform:
 * 1. Option 1: Live Interactive Batch Send with anti-ban delay & countdown progress modal (Image 1)
 * 2. Option 2: Launch into Official Background Campaign System in Campaign Monitor (Image 2 & 3)
 */
export default function CampaignLaunchButtons({
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
      {/* Option 1: Batch Send with Time Interval & Live Popup Modal */}
      <button
        type="button"
        onClick={onLaunchModal}
        disabled={isActionDisabled}
        className="flex-1 lg:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        id={modalButtonId || "btn-batch-send-interval-modal"}
        title={`إرسال فوري مع نافذة حساب الرسائل والوقت وفاصل زمني ${intervalSeconds} ثانية لحماية الرقم من الحظر`}
      >
        <Zap className="w-4 h-4 text-emerald-200 shrink-0" />
        <span>
          {customModalLabel ||
            `إرسال حملة جماعية (${count} ${recipientLabel}) - بفاصل ${intervalSeconds} ثانية`}
        </span>
      </button>

      {/* Option 2: Launch as Official Campaign into Campaign Monitor */}
      <button
        type="button"
        onClick={onLaunchOfficialCampaign}
        disabled={isActionDisabled}
        className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
        id={officialButtonId || "btn-batch-send-official-campaign"}
        title="إطلاق كحملة رسمية في نظام الرسائل مع شريط تقدم وتتبع خلفي"
      >
        <Send className="w-4 h-4 rotate-180 text-emerald-400 shrink-0" />
        <span>{customOfficialLabel || "نظام الحملات الجماعية"}</span>
      </button>
    </div>
  );
}
