import React, { useState, useEffect } from "react";
import { User, Phone, MessageSquare, Send, CheckCircle2, XCircle, Loader2, History, AlertCircle, Link2, Smartphone } from "lucide-react";

interface IndividualSenderProps {
  isWhatsAppConnected: boolean;
  onNavigateToConnection?: () => void;
}

interface SentIndividualLog {
  id: string;
  phone: string;
  message: string;
  timestamp: string;
  status: "success" | "failed";
  error?: string;
}

export default function IndividualSender({ isWhatsAppConnected, onNavigateToConnection }: IndividualSenderProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; text: string }>({
    type: "idle",
    text: "",
  });
  const [history, setHistory] = useState<SentIndividualLog[]>([]);

  // Load local history
  useEffect(() => {
    const saved = localStorage.getItem("whatsapp_individual_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) {
      setStatus({ type: "error", text: "يرجى تعبئة رقم الجوال ونص الرسالة." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "idle", text: "" });

    try {
      const response = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: "success", text: "تم إرسال الرسالة إلى هاتف المستلم عبر واتساب بنجاح!" });
        setMessage(""); // Clear message
        
        // Add to history
        const newLog: SentIndividualLog = {
          id: `ind_${Date.now()}`,
          phone,
          message,
          timestamp: new Date().toLocaleTimeString("ar-SA") + " - " + new Date().toLocaleDateString("ar-SA"),
          status: "success",
        };
        const updatedHistory = [newLog, ...history];
        setHistory(updatedHistory);
        localStorage.setItem("whatsapp_individual_history", JSON.stringify(updatedHistory));
      } else {
        throw new Error(data.error || "فشل إرسال الرسالة عبر واتساب.");
      }
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "فشل الاتصال بالخادم." });
      
      // Add failed to history
      const newLog: SentIndividualLog = {
        id: `ind_${Date.now()}`,
        phone,
        message,
        timestamp: new Date().toLocaleTimeString("ar-SA") + " - " + new Date().toLocaleDateString("ar-SA"),
        status: "failed",
        error: err.message || "خطأ غير معروف",
      };
      const updatedHistory = [newLog, ...history];
      setHistory(updatedHistory);
      localStorage.setItem("whatsapp_individual_history", JSON.stringify(updatedHistory));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("whatsapp_individual_history");
  };

  return (
    <div className="flex flex-col gap-5 text-right" id="individual-sender">
      
      {/* Live Status Top Alert */}
      {isWhatsAppConnected ? (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>الواتساب متصل وجاهز للإرسال الفعلي المباشر</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ● نشط الآن
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                أي رسالة ترسلها الآن ستصل فوراً إلى هاتف المستلم الحقيقي عبر حساب الواتساب المرتبط.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-600/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>تنبيه: الواتساب غير مرتبط حالياً</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  غير متصل
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                لن تصل الرسائل إلى هواتف المستلمين حتى تقوم بربط جهازك بمسح الباركود أو إدخال الرمز أولاً.
              </p>
            </div>
          </div>
          {onNavigateToConnection && (
            <button
              type="button"
              onClick={onNavigateToConnection}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              ربط الواتساب الآن
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sender form */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="border-b border-slate-100 pb-5">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              إرسال رسالة فردية سريعة
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              أدخل رقم الهاتف لإرسال الإشعار أو التنبيه الفردي مباشرة إلى واتساب المستلم
            </p>
          </div>

          <form onSubmit={handleSend} className="flex flex-col gap-5">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  رقم جوال المستلم:
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  يقبل الصيغ: 05xxxxxxxx أو +9665xxxxxxxx
                </span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 0560599870 أو +966560599870"
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-left font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                id="input-ind-phone"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                نص الرسالة المخصصة:
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب نص الرسالة هنا..."
                className="border border-slate-200 rounded-xl p-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 h-40 resize-none leading-relaxed text-right"
                id="textarea-ind-message"
              />
            </div>

            {/* Send Action */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="text-xs font-medium text-slate-400">
                {isWhatsAppConnected ? "سيتم الإرسال فوراً لهاتف المستلم" : "يتطلب ربط الواتساب أولاً"}
              </div>
              
              <button
                type="submit"
                disabled={isLoading || !isWhatsAppConnected}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                id="btn-ind-send"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 rotate-180" />}
                إرسال الرسالة الفردية الآن
              </button>
            </div>

            {status.type === "success" && (
              <div className="bg-emerald-50 text-emerald-800 text-xs py-3 px-4 rounded-xl border border-emerald-100 text-center animate-fade-in flex items-center justify-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {status.text}
              </div>
            )}

            {status.type === "error" && (
              <div className="bg-rose-50 text-rose-800 text-xs py-3 px-4 rounded-xl border border-rose-100 text-center animate-fade-in flex items-center justify-center gap-2 font-bold">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {status.text}
              </div>
            )}

          </form>
        </div>

        {/* History Log Side */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              سجل الإرسال الفردي
            </h3>
            
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                id="btn-clear-ind-history"
              >
                مسح السجل
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[380px] pr-1">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 gap-3">
                <History className="w-10 h-10 text-slate-200" />
                <span className="text-xs">لم تقم بإرسال أي رسائل فردية في هذه الجلسة بعد.</span>
              </div>
            ) : (
              history.map((log) => (
                <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold font-mono">{log.timestamp}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      log.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {log.status === "success" ? "تم التسليم" : "فشل"}
                    </span>
                  </div>
                  
                  <div className="text-xs font-semibold text-slate-700 font-mono">
                    رقم المستلم: {log.phone}
                  </div>

                  <p className="text-xs text-slate-500 bg-white border border-slate-100/50 p-2 rounded-lg leading-relaxed break-words font-medium">
                    {log.message}
                  </p>

                  {log.error && (
                    <span className="text-[10px] text-rose-600 font-semibold">
                      السبب: {log.error}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
