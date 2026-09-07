/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CampaignRecipientItem {
  id: string;
  name: string;
  phone: string;
  grade?: string;
  className?: string;
  customMessage: string;
  [key: string]: any;
}

export interface LaunchOfficialCampaignParams {
  campaignName: string;
  recipients: CampaignRecipientItem[];
  delayMs?: number;
  onNavigateToMessages?: (tab?: string) => void;
  onSuccess?: (campaignId: string) => void;
}

/**
 * Standard launcher to dispatch any batch of messages as an official campaign
 * into the background Campaign Monitor system (Option 2).
 */
export async function launchOfficialCampaign({
  campaignName,
  recipients,
  delayMs = 15000,
  onNavigateToMessages,
  onSuccess,
}: LaunchOfficialCampaignParams): Promise<boolean> {
  if (!recipients || recipients.length === 0) {
    alert("لا يوجد مستلمين محددين لإطلاق الحملة لهم.");
    return false;
  }

  // Filter or warn about missing phones
  const validRecipients = recipients.filter((r) => !!r.phone && String(r.phone).trim().length >= 8);
  if (validRecipients.length === 0) {
    alert("⚠️ لا يوجد أي مستلم يمتلك رقم جوال مسجل في القائمة المحددة.");
    return false;
  }

  const campaignStudents = recipients.map((r, idx) => ({
    id: r.id || `rec_${idx}`,
    name: r.name,
    "اسم الطالب": r.name,
    "اسم المعلم": r.name,
    phone: r.phone,
    "رقم الجوال": r.phone,
    "الجوال": r.phone,
    grade: r.grade || "",
    "الصف": r.grade || "",
    className: r.className || "",
    "الفصل": r.className || "",
    customMessage: r.customMessage,
  }));

  try {
    const response = await fetch("/api/whatsapp/campaign/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaignName,
        students: campaignStudents,
        template: "{customMessage}",
        delayMs,
      }),
    });

    const data = await response.json();
    if (response.ok && data.campaignId) {
      localStorage.setItem("active_campaign_id", data.campaignId);

      alert(
        `🚀 تم إطلاق (${campaignName}) بنجاح لعدد (${recipients.length}) مستلم بفاصل أمان (${Math.round(delayMs / 1000)} ثانية).\nسيتم نقلك الآن لـ «نظام الحملات الجماعية» لمتابعة الإرسال المباشر وتتبع التسليم.`
      );

      if (onSuccess) {
        onSuccess(data.campaignId);
      }

      if (onNavigateToMessages) {
        onNavigateToMessages("send");
      }
      return true;
    } else {
      alert(`❌ تعذر إطلاق الحملة: ${data.error || "خطأ غير معروف"}`);
      return false;
    }
  } catch (err: any) {
    alert(`❌ خطأ في الاتصال بالخادم: ${err.message || ""}`);
    return false;
  }
}
