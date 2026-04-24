"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, FileText, Settings, Users, LogOut, Menu, Briefcase } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100">Carregando...</div>;
  }

  const navItems = [
    { name: "Painel Geral", href: "/", icon: LayoutDashboard },
    { name: "Solicitações", href: "/solicitacoes", icon: FileText },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Prestadores", href: "/prestadores", icon: Briefcase },
  ];

  if (role === "master") {
    navItems.push({ name: "Gestão de Equipe", href: "/gestao-equipe", icon: Users });
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex fixed h-full z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Poda Admin</h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? "bg-emerald-600/10 text-emerald-400" : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Header Mobile/Desktop */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
          <div className="flex items-center md:hidden">
            <button className="text-slate-500 hover:text-slate-700">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="ml-3 font-bold text-slate-800 text-lg">Poda Admin</h2>
          </div>
          <div className="hidden md:flex"></div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-700">{user.email}</p>
              <p className="text-xs text-slate-500">{role === "master" ? "Master" : "Administrador"}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
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
