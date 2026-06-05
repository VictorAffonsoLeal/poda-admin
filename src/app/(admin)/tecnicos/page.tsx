"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, doc, setDoc, deleteDoc, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { getApps, getApp, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { Users, UserPlus, Mail, Phone, Lock, FileText, CheckCircle, HardHat, Trash2, Search, X, ShieldAlert } from "lucide-react";

// Usamos as mesmas variáveis de ambiente para a instância secundária
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export default function GestaoTecnicosPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [registro, setRegistro] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Delete modal confirmation states
  const [tecnicoToDelete, setTecnicoToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && role !== "master") {
      router.push("/");
    }
  }, [loading, role, router]);

  // Escutar a coleção 'tecnicos' em tempo real
  useEffect(() => {
    if (role !== "master") return;

    const q = query(collection(db, "tecnicos"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTecnicos(list);
      setIsLoading(false);
    }, (error) => {
      console.error("Erro ao buscar técnicos", error);
      showToast("Erro ao carregar técnicos da base de dados.", "erro");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [role, showToast]);

  const handleCreateTecnico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) {
      showToast("A senha deve conter pelo menos 6 caracteres.", "alerta");
      return;
    }
    setIsCreating(true);

    try {
      // 1. Inicializa uma instância secundária segura para não deslogar o Master atual
      const appName = "SecondaryAppTecnicos";
      let secondaryApp;
      if (getApps().find(app => app.name === appName)) {
        secondaryApp = getApp(appName);
      } else {
        secondaryApp = initializeApp(firebaseConfig, appName);
      }
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Cria o usuário de autenticação do técnico
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
      const newUserId = userCredential.user.uid;

      // 3. Desloga a instância secundária imediatamente
      await signOut(secondaryAuth);

      // 4. Cria o registro do técnico no Firestore com seu respectivo UID
      await setDoc(doc(db, "tecnicos", newUserId), {
        nome,
        email,
        registro,
        createdAt: new Date().toISOString()
      });

      showToast("Técnico cadastrado com sucesso!", "sucesso");
      setNome(""); 
      setEmail(""); 
      setSenha(""); 
      setRegistro("");
    } catch (error: any) {
      console.error("Erro ao cadastrar técnico", error);
      let errorMsg = error.message;
      if (error.code === "auth/email-already-in-use") {
        errorMsg = "Este endereço de e-mail já está em uso.";
      }
      showToast("Erro ao criar técnico: " + errorMsg, "erro");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTecnico = async () => {
    if (!tecnicoToDelete) return;
    setIsDeleting(true);

    try {
      // Remove o registro do Firestore. O acesso no aplicativo técnico é revogado
      // instantaneamente porque o middleware de autenticação verifica o documento na coleção.
      await deleteDoc(doc(db, "tecnicos", tecnicoToDelete.id));
      showToast("Acesso do técnico revogado e excluído com sucesso!", "sucesso");
      setTecnicoToDelete(null);
    } catch (error: any) {
      console.error("Erro ao deletar técnico", error);
      showToast("Erro ao excluir técnico: " + error.message, "erro");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || role !== "master") return <div className="p-8 font-sans font-medium text-slate-500">Verificando permissões...</div>;

  // Filtrar técnicos com base no termo de busca
  const filteredTecnicos = tecnicos.filter(t => 
    t.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.registro?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalTecnicos = tecnicos.length;

  const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none rounded-xl text-slate-900 text-sm font-medium transition-all placeholder-slate-400";

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fadeIn font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestão de Técnicos</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Cadastre, liste e gerencie os técnicos vistoriadores de campo que realizam as avaliações arbóreas.</p>
          </div>
        </div>
      </div>

      {/* Métricas & Busca */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Card Métrica */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md md:col-span-1">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Técnicos Credenciados</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{totalTecnicos}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <HardHat className="w-5 h-5" />
          </div>
        </div>

        {/* Busca */}
        <div className="md:col-span-2 relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar técnico por nome, e-mail ou número de registro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none rounded-2xl text-slate-900 text-sm font-medium transition-all shadow-sm placeholder-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Formulário de Cadastro (Esquerda) */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
          <div>
            <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Novo Técnico
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">Crie as credenciais de acesso ao aplicativo móvel do técnico.</p>
          </div>

          <form onSubmit={handleCreateTecnico} className="space-y-4">
            <div>
              <label className={labelClass}>Nome Completo</label>
              <input 
                type="text" 
                required 
                placeholder="Ex: Carlos Albuquerque"
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
                placeholder="Ex: carlos.tecnico@poda.com.br"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>Senha Provisória</label>
              <input 
                type="password" 
                required 
                placeholder="Mínimo 6 caracteres"
                value={senha} 
                onChange={e => setSenha(e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>Registro Profissional (CREA / CRBio)</label>
              <input 
                type="text" 
                required 
                placeholder="Ex: CREA-SP 5070211"
                value={registro} 
                onChange={e => setRegistro(e.target.value)} 
                className={inputClass} 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isCreating} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer text-sm mt-4 flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.98]"
            >
              <CheckCircle className="w-4 h-4" />
              {isCreating ? "Registrando..." : "Cadastrar Técnico"}
            </button>
          </form>
        </div>

        {/* Tabela de Técnicos (Direita) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/30">
            <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
              <HardHat className="w-5 h-5 text-emerald-600" />
              Técnicos Ativos
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Lista de profissionais vistoriadores cadastrados no sistema.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4.5">Técnico / Identificação</th>
                  <th className="px-6 py-4.5">Registro Profissional</th>
                  <th className="px-6 py-4.5">Contato</th>
                  <th className="px-6 py-4.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        Carregando técnicos registrados...
                      </div>
                    </td>
                  </tr>
                ) : filteredTecnicos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-semibold italic bg-slate-50/10">
                      Nenhum técnico encontrado correspondente à busca.
                    </td>
                  </tr>
                ) : filteredTecnicos.map(tecnico => (
                  <tr key={tecnico.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors shrink-0">
                          {tecnico.nome?.charAt(0).toUpperCase() || <HardHat className="w-4.5 h-4.5" />}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800 text-sm leading-snug">{tecnico.nome}</p>
                          <span className="text-[9px] font-bold text-emerald-600/90 uppercase tracking-wider">Avaliador de Campo</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-semibold text-xs text-slate-600">
                      {tecnico.registro || "Não informado"}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{tecnico.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button 
                        onClick={() => setTecnicoToDelete(tecnico)}
                        className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-slate-150/50 hover:border-rose-100"
                        title="Revogar acesso e excluir técnico"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {tecnicoToDelete && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-150/70 shadow-2xl space-y-6 animate-scaleIn">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800">Revogar Acesso do Técnico?</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Tem certeza que deseja remover o cadastro de <strong>{tecnicoToDelete.nome}</strong>?
                </p>
                <p className="text-[11px] text-rose-500 font-bold bg-rose-50/50 p-2 rounded-lg border border-rose-100/50 mt-2">
                  Esta ação excluirá o registro do banco de dados e bloqueará seu login no aplicativo de vistoria imediatamente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTecnicoToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 border border-slate-200 text-slate-550 text-xs font-extrabold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTecnico}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-rose-650 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 hover:shadow-lg active:scale-[0.98] flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Revogando..." : "Sim, Revogar Acesso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
