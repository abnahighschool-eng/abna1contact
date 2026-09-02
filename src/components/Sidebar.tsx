import React, { useState } from "react";
import { 
  Home, 
  MessageSquareText, 
  UserX, 
  ChevronLeft, 
  ChevronRight,
  School,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Users,
  Menu,
  X,
  UserCheck
} from "lucide-react";
import { AppUser } from "../types";

export type MainSectionType = "home" | "messages" | "attendance" | "inquiry" | "admin";

interface SidebarProps {
  currentSection: MainSectionType;
  onSelectSection: (section: MainSectionType) => void;
  studentsCount: number;
  isWhatsAppConnected: boolean;
  currentUser?: AppUser | null;
  schoolName?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  currentSection,
  onSelectSection,
  studentsCount,
  isWhatsAppConnected,
  currentUser,
  schoolName = "ثانوية الأبناء الأولى",
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalOnToggleCollapse,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed;
  const toggleCollapse = () => {
    if (externalOnToggleCollapse) {
      externalOnToggleCollapse();
    } else {
      setInternalCollapsed(prev => !prev);
    }
  };

  interface MenuItem {
    id: MainSectionType;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    badge: string | null;
    badgeColor?: string;
    statusDot?: string;
  }

  const menuItems: MenuItem[] = [
    {
      id: "home" as MainSectionType,
      label: "الرئيسية",
      shortLabel: "الرئيسية",
      icon: Home,
      description: "لوحة التحكم العامة",
      badge: null,
    },
    {
      id: "messages" as MainSectionType,
      label: "نظام الرسائل",
      shortLabel: "الرسائل",
      icon: MessageSquareText,
      description: "إرسال رسائل وتنبيهات واتساب والتقارير",
      badge: studentsCount > 0 ? `${studentsCount} طالب` : null,
      statusDot: isWhatsAppConnected ? "bg-emerald-500" : "bg-amber-400",
    },
    {
      id: "attendance" as MainSectionType,
      label: "الغياب والتأخر",
      shortLabel: "الغياب",
      icon: UserX,
      description: "رصد الحضور والغياب اليومي والتقارير",
      badge: null,
      statusDot: isWhatsAppConnected ? "bg-emerald-500" : "bg-amber-400",
    },
    {
      id: "inquiry" as MainSectionType,
      label: "الاستعلام عن طالب",
      shortLabel: "الاستعلام",
      icon: UserCheck,
      description: "إرسال طلبات تقييم واستعلام المعلمين عن الطلاب",
      badge: null,
      statusDot: isWhatsAppConnected ? "bg-emerald-500" : "bg-amber-400",
    },
  ];

  // If the user has admin role, add the "إدارة" section
  if (currentUser?.role === "admin") {
    menuItems.push({
      id: "admin" as MainSectionType,
      label: "إدارة النظام",
      shortLabel: "الإدارة",
      icon: ShieldCheck,
      description: "إدارة المستخدمين والصلاحيات",
      badge: "مشرف",
      badgeColor: "bg-purple-50 text-purple-700 border border-purple-200",
    });
  }

  return (
    <>
      {/* 1. Mobile Quick Navigation Bar (< md viewports) */}
      <div className="md:hidden w-full bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xs sticky top-16 z-20 no-print">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
          {menuItems.map((item) => {
            const isActive = currentSection === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`
                  py-2.5 px-2 rounded-xl font-bold transition-all text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer relative min-h-[44px]
                  ${
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 bg-slate-50/60"
                  }
                `}
                id={`mobile-nav-${item.id}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="truncate">{item.shortLabel}</span>
                {item.statusDot && (
                  <span className={`w-1.5 h-1.5 rounded-full ${item.statusDot} absolute top-1.5 left-1.5`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Desktop & Tablet Sidebar (>= md viewports) */}
      <aside
        id="main-app-sidebar"
        className={`
          hidden md:block relative shrink-0 select-none transition-all duration-300 ease-in-out no-print
          ${isCollapsed ? "w-16 sm:w-20" : "w-64 lg:w-72 xl:w-80"}
        `}
      >
        {/* Box container styling */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs sticky top-20 transition-all duration-300">
          
          {/* Collapse/Expand Arrow Button */}
          <button
            onClick={toggleCollapse}
            id="btn-toggle-sidebar-collapse"
            title={isCollapsed ? "توسيع القائمة الجانبية" : "طوي القائمة لتوسيع مساحة العمل"}
            className="absolute -left-3.5 top-4.5 w-7 h-7 rounded-full bg-white border border-slate-300 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-transform active:scale-95 cursor-pointer z-30 group"
            aria-label={isCollapsed ? "توسيع القائمة" : "طوي القائمة"}
          >
            {isCollapsed ? (
              <ChevronLeft className="w-4 h-4 text-emerald-600 transition-transform group-hover:-translate-x-0.5" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-600 transition-transform group-hover:translate-x-0.5" />
            )}
          </button>

          {/* Header Title inside Sidebar */}
          <div className={`
            border-b border-slate-100 bg-slate-50/80 flex items-center transition-all duration-200
            ${isCollapsed ? "p-3 justify-center" : "px-4 py-3.5 justify-between"}
          `}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                <School className="w-4 h-4 text-emerald-400" />
              </div>
              {!isCollapsed && (
                <div className="text-right min-w-0">
                  <span className="text-xs font-extrabold text-slate-800 block whitespace-nowrap">
                    أقسام النظام
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block whitespace-nowrap truncate max-w-[150px]">
                    {schoolName}
                  </span>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                القائمة
              </span>
            )}
          </div>

          {/* Menu Items List */}
          <div className="divide-y divide-slate-100/90 p-2 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = currentSection === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-btn-${item.id}`}
                  onClick={() => onSelectSection(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`
                    w-full flex items-center rounded-xl font-bold transition-all duration-150 cursor-pointer text-right relative group
                    ${isCollapsed ? "justify-center p-2.5" : "justify-between px-3.5 py-3.5"}
                    ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                    }
                  `}
                >
                  {/* Active Indicator Strip */}
                  {isActive && (
                    <span className="absolute right-0 top-2 bottom-2 w-1.5 bg-emerald-400 rounded-l-full" />
                  )}

                  <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
                    <div
                      className={`
                        w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors relative
                        ${
                          isActive
                            ? "bg-white/10 text-emerald-400"
                            : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                        }
                      `}
                    >
                      <Icon className="w-4.5 h-4.5" />
                      
                      {/* Status dot in collapsed mode */}
                      {isCollapsed && item.statusDot && (
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${item.statusDot} animate-pulse`}
                        />
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="text-right min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold whitespace-nowrap leading-relaxed block">
                            {item.label}
                          </span>
                          {item.statusDot && (
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${item.statusDot} animate-pulse shrink-0`}
                              title={isWhatsAppConnected ? "واتساب متصل" : "واتساب غير متصل"}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Badges & Arrow */}
                  {!isCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0 mr-1">
                      {item.badge && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                            isActive
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : item.badgeColor || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ChevronLeft
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isActive ? "text-emerald-400 -translate-x-0.5" : "text-slate-300 group-hover:text-slate-500"
                        }`}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom WhatsApp status badge */}
          <div className={`
            border-t border-slate-100 text-xs bg-slate-50/80 transition-all duration-200
            ${isCollapsed ? "p-2.5 flex justify-center" : "p-3.5 flex items-center gap-2 text-slate-600"}
          `}>
            {isWhatsAppConnected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" title="واتساب متصل وجاهز" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" title="واتساب غير مرتبط" />
            )}

            {!isCollapsed && (
              <span className="font-semibold whitespace-nowrap text-xs">
                {isWhatsAppConnected ? "واتساب جاهز للإرسال" : "واتساب غير متصل"}
              </span>
            )}
          </div>

        </div>
      </aside>
    </>
  );
}
