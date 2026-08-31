import React, { useState } from "react";
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Send, 
  Trash2, 
  Edit3, 
  Ban, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Sparkles, 
  Smartphone, 
  Clock, 
  RefreshCw,
  Share2,
  X
} from "lucide-react";
import { AppUser, SchoolSignatories } from "../types";

interface UserManagementProps {
  users: AppUser[];
  currentUser: AppUser | null;
  signatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onSaveUsers: (users: AppUser[]) => void;
}

export default function UserManagement({
  users,
  currentUser,
  signatories,
  isWhatsAppConnected,
  onSaveUsers,
}: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "user">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "blocked">("all");

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    password: string;
    role: "admin" | "user";
    phone: string;
    status: "active" | "blocked";
    notes: string;
  }>({
    name: "",
    username: "",
    password: "",
    role: "user",
    phone: "",
    status: "active",
    notes: "",
  });

  const [showModalPassword, setShowModalPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendSuccessToast, setSendSuccessToast] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<string | null>(null);

  // Quick Password Generator
  const generateStrongPassword = () => {
    const prefixes = ["Abna", "Sch", "Edu", "User", "Pass", "King", "Noor"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const symbols = ["#", "!", "@", "$", "*"];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    return `${prefix}${symbol}${randomNum}`;
  };

  // Quick Username Generator
  const generateUsernameFromName = (name: string) => {
    if (!name || name.trim().length === 0) {
      return `user_${Math.floor(1000 + Math.random() * 9000)}`;
    }
    // Remove titles like أ. / د. / الشيخ / الأستاذ
    const cleanName = name.replace(/^(أ\.?|د\.?|الاستاذ|الأستاذ|الشيخ|المعلم|الوكيل|المدير)\s+/gi, "").trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      // Create transliterated or standard slug
      const p1 = parts[0];
      const p2 = parts[parts.length - 1];
      const randomDigits = Math.floor(10 + Math.random() * 89);
      return `u_${randomDigits}_${Date.now().toString().slice(-3)}`;
    }
    return `user_${Math.floor(100 + Math.random() * 899)}`;
  };

  const handleOpenAddModal = () => {
    const initialPass = generateStrongPassword();
    const initialUser = `user_${Math.floor(1000 + Math.random() * 9000)}`;
    setEditingUserId(null);
    setFormData({
      name: "",
      username: initialUser,
      password: initialPass,
      role: "user",
      phone: "",
      status: "active",
      notes: "",
    });
    setShowModalPassword(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AppUser) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      password: user.password,
      role: user.role,
      phone: user.phone || "",
      status: user.status,
      notes: user.notes || "",
    });
    setShowModalPassword(false);
    setIsModalOpen(true);
  };

  const handleSaveUser = (sendViaWhatsAppOnSave = false) => {
    if (!formData.name.trim() || !formData.username.trim() || !formData.password.trim()) {
      alert("يرجى تعبئة اسم الشخص واسم المستخدم وكلمة المرور");
      return;
    }

    const cleanUsername = formData.username.trim().toLowerCase();

    // Check username uniqueness if adding new or changing username
    const duplicate = users.find(
      (u) => u.username.toLowerCase() === cleanUsername && u.id !== editingUserId
    );
    if (duplicate) {
      alert("اسم المستخدم هذا مسجل مسبقاً لمستخدم آخر. يرجى اختيار اسم مستخدم مختلف.");
      return;
    }

    let updatedUsers: AppUser[];

    if (editingUserId) {
      // Update existing
      updatedUsers = users.map((u) => {
        if (u.id === editingUserId) {
          return {
            ...u,
            name: formData.name.trim(),
            username: cleanUsername,
            password: formData.password.trim(),
            role: formData.role,
            phone: formData.phone.trim(),
            status: formData.status,
            notes: formData.notes.trim(),
          };
        }
        return u;
      });
    } else {
      // Add new
      const newUser: AppUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: formData.name.trim(),
        username: cleanUsername,
        password: formData.password.trim(),
        role: formData.role,
        phone: formData.phone.trim(),
        status: formData.status,
        notes: formData.notes.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedUsers = [newUser, ...users];

      if (sendViaWhatsAppOnSave && newUser.phone) {
        sendCredentialsMessage(newUser);
      }
    }

    onSaveUsers(updatedUsers);
    setIsModalOpen(false);
  };

  const handleToggleStatus = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    // Prevent blocking the currently logged in admin user
    if (currentUser && currentUser.id === userId && targetUser.status === "active") {
      alert("لا يمكنك حظر حسابك الحالي الذي تستخدمه لتسجيل الدخول!");
      return;
    }

    const newStatus = targetUser.status === "active" ? "blocked" : "active";
    const updated = users.map((u) => (u.id === userId ? { ...u, status: newStatus as "active" | "blocked" } : u));
    onSaveUsers(updated);
  };

  const handleDeleteUser = (userId: string) => {
    if (currentUser && currentUser.id === userId) {
      alert("لا يمكنك حذف الحساب الحالي المسجل دخولك به!");
      return;
    }

    // Ensure at least one admin remains
    const remainingAdmins = users.filter((u) => u.id !== userId && u.role === "admin" && u.status === "active");
    if (remainingAdmins.length === 0) {
      alert("لا يمكن حذف هذا المستخدم؛ يجب بقاء مسؤول نظام واحد فعال على الأقل!");
      return;
    }

    const updated = users.filter((u) => u.id !== userId);
    onSaveUsers(updated);
    setDeleteConfirmId(null);
  };

  // Generate formatted credentials card
  const getFormattedCredentialsText = (user: AppUser) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const roleTitle = user.role === "admin" ? "مسؤول نظام كامل (Admin)" : "مستخدم / موظف (User)";
    return `السلام عليكم ورحمة الله وبركاته
أهلاً بك أ. ${user.name}،
تم إنشاء وتفعيل حسابك في نظام ${signatories.schoolName || "ثانوية الأبناء الأولى"}.

📌 بيانات الدخول الخاصة بك:
🔗 رابط النظام: ${origin}
👤 اسم المستخدم: ${user.username}
🔑 كلمة المرور: ${user.password}
🛡️ نوع الصلاحية: ${roleTitle}

يرجى الاحتفاظ بهذه البيانات وعدم مشاركتها مع الغير.
- إدارة المدرسة`;
  };

  const handleCopyCredentials = (user: AppUser) => {
    const text = getFormattedCredentialsText(user);
    navigator.clipboard.writeText(text);
    setCopiedId(user.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const sendCredentialsMessage = async (user: AppUser) => {
    if (!user.phone) {
      alert("يرجى إضافة رقم جوال/واتساب لهذا المستخدم أولاً لتتمكن من إرسال البيانات له.");
      return;
    }

    setIsSendingWhatsApp(user.id);
    const message = getFormattedCredentialsText(user);

    try {
      // 1. Try sending via backend WhatsApp API if connected
      const res = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: user.phone,
          message,
          studentName: user.name,
        }),
      });

      if (res.ok) {
        setSendSuccessToast(`تم إرسال بيانات الدخول إلى رقم ${user.phone} عبر واتساب بنجاح!`);
        setTimeout(() => setSendSuccessToast(null), 3500);
      } else {
        // Fallback: Open WhatsApp Web / WhatsApp Direct URL
        const cleanPhone = user.phone.replace(/[^0-9]/g, "");
        const formattedPhone = cleanPhone.startsWith("05") ? `966${cleanPhone.slice(1)}` : cleanPhone;
        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
        setSendSuccessToast("تم فتح محادثة واتساب لإرسال البيانات.");
        setTimeout(() => setSendSuccessToast(null), 3000);
      }
    } catch {
      // Fallback
      const cleanPhone = user.phone.replace(/[^0-9]/g, "");
      const formattedPhone = cleanPhone.startsWith("05") ? `966${cleanPhone.slice(1)}` : cleanPhone;
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");
    } finally {
      setIsSendingWhatsApp(null);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));

    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchStatus = filterStatus === "all" || u.status === filterStatus;

    return matchSearch && matchRole && matchStatus;
  });

  const totalAdmins = users.filter((u) => u.role === "admin").length;
  const totalActive = users.filter((u) => u.status === "active").length;
  const totalBlocked = users.filter((u) => u.status === "blocked").length;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn text-slate-800" id="user-management-section">
      
      {/* Toast notification */}
      {sendSuccessToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500/30 animate-fadeIn text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{sendSuccessToast}</span>
        </div>
      )}

      {/* Main Header & Actions Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                إدارة المستخدمين وصلاحيات الدخول
              </h2>
              <p className="text-xs text-slate-500">
                توليد حسابات الموظفين والمعلمين، تخصيص كلمات المرور، تفعيل أو حظر المستخدمين، وإرسال البيانات عبر واتساب
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center active:scale-95"
          id="btn-add-new-user"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Metrics Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي الحسابات</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900">{users.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 block">حسابات نشطة (مفعلة)</span>
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-700">{totalActive}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-600 block">حسابات محظورة</span>
            <span className="text-xl sm:text-2xl font-extrabold text-rose-700">{totalBlocked}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Ban className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-600 block">مدراء النظام</span>
            <span className="text-xl sm:text-2xl font-extrabold text-blue-800">{totalAdmins}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، اسم المستخدم، أو الجوال..."
            className="w-full text-xs font-medium pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          
          {/* Role Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterRole("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterRole === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              الكل ({users.length})
            </button>
            <button
              onClick={() => setFilterRole("admin")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterRole === "admin" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              المدراء ({totalAdmins})
            </button>
            <button
              onClick={() => setFilterRole("user")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterRole === "user" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              المستخدمين ({users.length - totalAdmins})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterStatus === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              جميع الحالات
            </button>
            <button
              onClick={() => setFilterStatus("active")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterStatus === "active" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              المفعلين ({totalActive})
            </button>
            <button
              onClick={() => setFilterStatus("blocked")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterStatus === "blocked" ? "bg-white text-rose-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              المحظورين ({totalBlocked})
            </button>
          </div>

        </div>

      </div>

      {/* Users List Table & Cards */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Users className="w-12 h-12 text-slate-300 mb-2 stroke-1" />
            <p className="text-sm font-bold text-slate-600">لا توجد حسابات تطابق معايير البحث أو الفلتر</p>
            <p className="text-xs text-slate-400 mt-1">يمكنك إضافة مستخدم جديد عبر الزر أعلاه</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/90 text-slate-500 font-bold">
                  <th className="py-3.5 px-4">اسم الشخص / الموظف</th>
                  <th className="py-3.5 px-4">اسم المستخدم</th>
                  <th className="py-3.5 px-4">كلمة المرور</th>
                  <th className="py-3.5 px-4">الصلاحية</th>
                  <th className="py-3.5 px-4">الجوال / واتساب</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">إجراءات التحكم</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  const isPassVisible = visiblePasswords[user.id] || false;
                  const isCopied = copiedId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            user.role === "admin"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {user.name.charAt(0) || "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">{user.name}</span>
                              {isCurrent && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-200">
                                  أنت
                                </span>
                              )}
                            </div>
                            {user.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-48">{user.notes}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dir-ltr text-right">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                          {user.username}
                        </span>
                      </td>

                      {/* Password with View Toggle */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 dir-ltr text-right">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                          <span className="text-xs font-bold text-slate-900">
                            {isPassVisible ? user.password : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setVisiblePasswords(prev => ({ ...prev, [user.id]: !isPassVisible }))}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title={isPassVisible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            مسؤول نظام
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <Users className="w-3 h-3 text-slate-500" />
                            مستخدم
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 dir-ltr text-right">
                        {user.phone ? (
                          <span className="text-xs">{user.phone}</span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-sans">غير مسجل</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {user.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            مفعل (نشط)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            محظور
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1">
                          
                          {/* Toggle Active / Blocked */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user.id)}
                            disabled={isCurrent}
                            title={user.status === "active" ? "حظر هذا الحساب" : "تفعيل هذا الحساب"}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                              user.status === "active"
                                ? "text-slate-500 hover:text-rose-700 hover:bg-rose-50 border-slate-200"
                                : "text-emerald-700 hover:text-emerald-900 bg-emerald-50 border-emerald-200"
                            }`}
                          >
                            {user.status === "active" ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>

                          {/* Send Credentials via WhatsApp */}
                          <button
                            type="button"
                            onClick={() => sendCredentialsMessage(user)}
                            disabled={isSendingWhatsApp === user.id}
                            title="إرسال بيانات الدخول عبر واتساب"
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            {isSendingWhatsApp === user.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            ) : (
                              <Send className="w-3.5 h-3.5 rotate-180" />
                            )}
                          </button>

                          {/* Copy Credentials Card */}
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(user)}
                            title="نسخ بيانات الدخول"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          {/* Edit User */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            title="تعديل بيانات المستخدم"
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(user.id)}
                            disabled={isCurrent}
                            title="حذف المستخدم"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

      </div>

      {/* ADD / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn" id="user-modal-overlay">
          
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-100 relative animate-scaleUp text-right" id="user-modal-card">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingUserId ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد للنظام"}
                  </h3>
                  <p className="text-xs text-slate-500">توليد بيانات الدخول وتحديد الصلاحية</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              
              {/* Person Real Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الشخص / المعلم / الموظف <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name: newName,
                      // auto suggest username if new user and not customized
                      username: editingUserId ? prev.username : generateUsernameFromName(newName),
                    }));
                  }}
                  placeholder="مثال: أ. محمد العتيبي - وكيل الشؤون"
                  className="w-full text-xs font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>

              {/* Username + Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    اسم المستخدم <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, username: generateUsernameFromName(prev.name) }))}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="اسم المستخدم للدخول"
                  dir="ltr"
                  className="w-full text-left font-mono text-xs font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900"
                />
              </div>

              {/* Password + Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, password: generateStrongPassword() }))}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>توليد كلمة مرور قوية</span>
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showModalPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full text-left font-mono text-xs font-bold pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showModalPassword ? "إخفاء" : "إظهار"}
                  >
                    {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع الحساب والصلاحية
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, role: "user" }))}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === "user"
                        ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-950 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-bold">مستخدم / موظف</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      صلاحيات الإرسال ورصد الحضور دون قسم الإدارة
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, role: "admin" }))}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === "admin"
                        ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 text-blue-950 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-bold">مسؤول نظام (Admin)</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      صلاحيات كاملة تشمل إدارة الحسابات والإعدادات
                    </div>
                  </button>
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الجوال / واتساب لإرسال بيانات الدخول
                </label>
                <div className="relative flex items-center">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    className="w-full text-left font-mono text-xs pr-9 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900"
                  />
                </div>
              </div>

              {/* Status & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة الحساب</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as "active" | "blocked" }))}
                    className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-slate-800"
                  >
                    <option value="active">مفعل (نشط)</option>
                    <option value="blocked">محظور (معطل)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة / المسمى</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="مثال: معلم لغة عربية"
                    className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-slate-800"
                  />
                </div>
              </div>

            </div>

            {/* Actions Buttons in Modal */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
              
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                إلغاء
              </button>

              {formData.phone && (
                <button
                  type="button"
                  onClick={() => handleSaveUser(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Send className="w-3.5 h-3.5 rotate-180 text-emerald-600" />
                  <span>حفظ وإرسال بالواتساب</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSaveUser(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                id="btn-save-user-modal"
              >
                {editingUserId ? "حفظ التعديلات" : "حفظ المستخدم"}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-scaleUp">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">تأكيد حذف المستخدم</h4>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              هل أنت متأكد من رغبتك في حذف هذا الحساب؟ لن يتمكن المستخدم من تسجيل الدخول للنظام بعد الحذف.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmId)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
