"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { Users, UserPlus, Shield, Mail, Phone, Lock, FileText, CheckCircle, Award } from "lucide-react";

const formatCPFOrCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return digits
      .substring(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
};

// Usamos as mesmas variáveis de ambiente para a instância secundária
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export default function GestaoEquipePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && role !== "master") {
      router.push("/");
    }
  }, [loading, role, router]);

  const fetchAdmins = async () => {
    setIsLoadingAdmins(true);
    try {
      const snapshot = await getDocs(collection(db, "admins"));
      const adminsList: any[] = [];
      snapshot.forEach(doc => {
        adminsList.push({ id: doc.id, ...doc.data() });
      });
      setAdmins(adminsList);
    } catch (e) {
      console.error("Erro ao buscar equipe", e);
      showToast("Erro ao buscar membros da equipe.", "erro");
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  useEffect(() => {
    if (role === "master") {
      fetchAdmins();
    }
  }, [role]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // 1. Inicializa uma instância secundária do Firebase para não deslogar o Master atual
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Cria a conta no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
      const newUserId = userCredential.user.uid;

      // 3. Desloga a instância secundária
      await secondaryAuth.signOut();

      // 4. Salva no banco de dados Firestore
      await setDoc(doc(db, "admins", newUserId), {
        nome,
        email,
        cpf,
        telefone,
        role: "admin", // Novos criados sempre são admin
        createdAt: new Date().toISOString()
      });

      showToast("Membro da equipe cadastrado com sucesso!", "sucesso");
      setNome(""); setEmail(""); setSenha(""); setCpf(""); setTelefone("");
      fetchAdmins();

    } catch (error: any) {
      console.error("Erro ao criar admin", error);
      showToast("Erro ao criar membro: " + error.message, "erro");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading || role !== "master") return <div className="p-8">Verificando permissões...</div>;

  // Métricas
  const totalEquipe = admins.length;
  const masterCount = admins.filter(a => a.role === "master").length;
  const adminCount = admins.filter(a => a.role === "admin" || !a.role).length;

  const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none rounded-xl text-slate-900 text-sm font-medium transition-all placeholder-slate-400";

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Equipe</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Cadastre e gerencie os funcionários com acesso administrativo ao painel de controle.</p>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Membros da Equipe</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{totalEquipe}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Administradores Master</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1">{masterCount}</h3>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operadores Administrativos</p>
            <h3 className="text-2xl font-black text-blue-600 mt-1">{adminCount}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Formulário de Cadastro (Esquerda) */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
          <div>
            <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Novo Administrador
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">Insira os dados cadastrais do novo operador do sistema.</p>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <label className={labelClass}>Nome Completo</label>
              <input 
                type="text" 
                required 
                placeholder="Ex: João Silva"
                value={nome} 
                onChange={e => setNome(e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>E-mail</label>
              <input 
                type="email" 
                required 
                placeholder="Ex: joao@email.com"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>Senha</label>
              <input 
                type="password" 
                required 
                placeholder="Mínimo 6 caracteres"
                value={senha} 
                onChange={e => setSenha(e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CPF</label>
                <input 
                  type="text" 
                  required 
                  placeholder="000.000.000-00"
                  value={cpf} 
                  onChange={e => setCpf(formatCPFOrCNPJ(e.target.value))} 
                  maxLength={14} 
                  className={inputClass} 
                />
              </div>
              <div>
                <label className={labelClass}>Telefone</label>
                <input 
                  type="text" 
                  required 
                  placeholder="(17) 99999-9999"
                  value={telefone} 
                  onChange={e => setTelefone(e.target.value)} 
                  className={inputClass} 
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isCreating} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer text-sm mt-4 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {isCreating ? "Cadastrando..." : "Cadastrar Operador"}
            </button>
          </form>
        </div>

        {/* Tabela de Membros (Direita) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/30">
            <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
              <Shield className="w-5 h-5 text-emerald-600" />
              Equipe Ativa
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Lista de funcionários credenciados para operar o painel administrativo.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4.5">Nome / Operador</th>
                  <th className="px-6 py-4.5">Identidade (CPF)</th>
                  <th className="px-6 py-4.5">Contato</th>
                  <th className="px-6 py-4.5 text-center">Nível / Cargo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoadingAdmins ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        Carregando equipe...
                      </div>
                    </td>
                  </tr>
                ) : admins.map(admin => (
                  <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors shrink-0">
                          {admin.nome?.charAt(0).toUpperCase() || <Users className="w-4.5 h-4.5" />}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800 text-sm leading-snug">{admin.nome}</p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Membro Administrativo</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono text-xs font-bold text-slate-500">
                      {admin.cpf || "---"}
                    </td>
                    <td className="px-6 py-5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{admin.email}</span>
                      </div>
                      {admin.telefone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-450 font-bold">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{admin.telefone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                        admin.role === 'master' 
                          ? 'bg-purple-50 text-purple-700 border-purple-200/60' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                      }`}>
                        {admin.role === 'master' ? 'Master' : 'Administrador'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
