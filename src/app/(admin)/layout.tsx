"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, FileText, Users, LogOut, Menu, Briefcase, MessageCircle, X, Award, Shield, ChevronLeft, ChevronRight, HardHat } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [totalNaoLidos, setTotalNaoLidos] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Carrega o estado de recolhimento salvo
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed") === "true";
      setSidebarCollapsed(saved);
    }
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("sidebarCollapsed", String(next));
  };

  // Contador de mensagens não lidas no chat
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "chats"));
    const unsub = onSnapshot(q, (snap) => {
      const total = snap.docs.reduce((sum, d) => sum + (d.data().naoLidoAdmin || 0), 0);
      setTotalNaoLidos(total);
    }, () => {});
    return () => unsub();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Carregando painel...</p>
      </div>
    );
  }

  const navItems = [
    { name: "Painel Geral", href: "/", icon: LayoutDashboard },
    { name: "Solicitações", href: "/solicitacoes", icon: FileText },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Prestadores", href: "/prestadores", icon: Briefcase },
    { name: "Atendimentos", href: "/atendimentos", icon: MessageCircle, badge: totalNaoLidos },
  ];

  if (role === "master") {
    navItems.push({ name: "Gestão de Equipe", href: "/gestao-equipe", icon: Users });
    navItems.push({ name: "Gestão de Técnicos", href: "/tecnicos", icon: HardHat });
  }

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans">
      {/* ── SIDEBAR DESKTOP (EXPANSÍVEL) ── */}
      <aside className={`bg-slate-950 text-slate-400 flex flex-col hidden md:flex fixed h-full z-20 border-r border-slate-900 shadow-xl shadow-slate-950/20 transition-all duration-300 ${
        sidebarCollapsed ? "w-20" : "w-64"
      }`}>
        {/* Botão Flutuante de Toggle no Borda da Sidebar */}
        <button 
          onClick={toggleSidebar}
          className="absolute -right-3 top-16 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 p-1.5 rounded-full shadow-lg transition-all cursor-pointer z-20 hidden md:block"
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Logo Brand */}
        <div className={`p-5 flex items-center border-b border-slate-900/60 ${
          sidebarCollapsed ? "justify-center" : "gap-3"
        }`}>
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-500 p-2.5 rounded-xl text-white shadow-md shadow-emerald-500/20 shrink-0">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fadeIn">
              <h1 className="text-base font-black text-white leading-none tracking-tight">Poda Admin</h1>
              <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-0.5 block">Gestão Municipal</span>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                  sidebarCollapsed ? "justify-center p-3" : "gap-3.5 px-3.5 py-3"
                } ${
                  isActive 
                    ? "bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-950/20" 
                    : "hover:bg-slate-900 hover:text-white"
                }`}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <item.icon className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105 ${
                  isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                }`} />
                {!sidebarCollapsed && (
                  <span className="text-xs sm:text-sm font-semibold flex-1 animate-fadeIn">{item.name}</span>
                )}
                
                {/* Badge de Não Lidas */}
                {item.badge !== undefined && item.badge > 0 && (
                  sidebarCollapsed ? (
                    <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-md">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : (
                    <span className="min-w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-md shadow-red-500/10 animate-pulse">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )
                )}

                {/* Tooltip flutuante quando recolhido */}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-950 text-white text-[11px] font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-xl border border-slate-900 z-30">
                    {item.name}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Profile Card & Logout */}
        <div className="p-4 border-t border-slate-900/60 bg-slate-950/40 space-y-4">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-2"}`}>
            <div 
              className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 font-bold shadow-inner shrink-0" 
              title={user.email || ""}
            >
              {user.email?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1 animate-fadeIn">
                <p className="text-xs font-bold text-white truncate leading-tight">{user.email}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 tracking-wider flex items-center gap-1">
                  {role === "master" ? <Award className="w-3 h-3 text-purple-400 shrink-0" /> : <Shield className="w-3 h-3 text-blue-400 shrink-0" />}
                  {role === "master" ? "Master" : "Operador"}
                </p>
              </div>
            )}
          </div>

          <button 
            onClick={handleLogout}
            className={`flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-rose-950/20 hover:text-rose-450 border border-slate-900 hover:border-rose-900/30 text-slate-450 rounded-xl transition-all font-bold cursor-pointer shadow-sm ${
              sidebarCollapsed ? "p-3" : "px-4 py-2.5 text-xs"
            }`}
            title="Sair do Sistema"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="animate-fadeIn">Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      {/* ── MOBILE MENU DRAWER ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200" 
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel */}
          <div className="relative flex flex-col w-full max-w-xs bg-slate-950 text-slate-400 p-6 shadow-2xl animate-slideRight">
            <div className="flex items-center justify-between pb-6 border-b border-slate-900">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-emerald-500 to-teal-500 p-2 rounded-xl text-white shadow-md shadow-emerald-500/20">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-black text-white tracking-tight leading-none">Poda Admin</h1>
                  <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider mt-0.5 block">Gestão Municipal</span>
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <nav className="flex-1 py-6 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all group ${
                      isActive 
                        ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/20" 
                        : "hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-4.5 h-4.5 shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold flex-1">{item.name}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="min-w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-md shadow-red-500/10">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
            
            <div className="pt-4 border-t border-slate-900/60 space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 shadow-inner">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-white truncate leading-tight">{user.email}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 tracking-wider flex items-center gap-1">
                    {role === "master" ? <Award className="w-3 h-3 text-purple-400 shrink-0" /> : <Shield className="w-3 h-3 text-blue-400 shrink-0" />}
                    {role === "master" ? "Master" : "Operador"}
                  </p>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-4 py-2.5 w-full bg-slate-900 hover:bg-rose-950/20 hover:text-rose-450 border border-slate-900 hover:border-rose-900/30 text-slate-450 rounded-xl transition-all text-xs font-bold cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT AREA (ADAPTÁVEL) ── */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        sidebarCollapsed ? "md:pl-20" : "md:pl-64"
      }`}>
        {/* Top Header Navigation */}
        <header className="bg-white border-b border-slate-200/80 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10 shadow-sm">
          {/* Mobile menu trigger */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="ml-3 font-bold text-slate-800 text-lg tracking-tight">Poda Admin</h2>
          </div>
          
          <div className="hidden md:flex"></div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-extrabold text-slate-700">{user.email}</p>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">{role === "master" ? "Administrador Master" : "Operador Administrativo"}</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200/40 transition-colors shadow-sm">
              {user.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
