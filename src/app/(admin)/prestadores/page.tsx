"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, updateDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Briefcase, Search, Check, X, ShieldCheck, Clock, XCircle, Phone, User } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function PrestadoresPage() {
  const { showToast } = useToast();
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPrestadores = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "prestadores"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setPrestadores(data);
    } catch (e) {
      console.error(e);
      showToast("Erro ao carregar prestadores.", "erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrestadores();
  }, []);

  const handleAprovar = async (id: string, name: string) => {
    if (!confirm(`Deseja aprovar o credenciamento de "${name}"?`)) return;
    try {
      await updateDoc(doc(db, "prestadores", id), {
        status: "Ativo"
      });
      showToast("Credenciamento aprovado com sucesso!", "sucesso");
      setPrestadores(prev => prev.map(p => p.id === id ? { ...p, status: "Ativo" } : p));
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      showToast("Erro ao aprovar credenciamento.", "erro");
    }
  };

  const handleRecusar = async (id: string, name: string) => {
    if (!confirm(`Deseja recusar o credenciamento de "${name}"?`)) return;
    try {
      await updateDoc(doc(db, "prestadores", id), {
        status: "Recusado"
      });
      showToast("Credenciamento recusado.", "sucesso");
      setPrestadores(prev => prev.map(p => p.id === id ? { ...p, status: "Recusado" } : p));
    } catch (error) {
      console.error("Erro ao recusar:", error);
      showToast("Erro ao recusar credenciamento.", "erro");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Ativo" ? "Inativo" : "Ativo";
    if (!confirm(`Tem certeza que deseja mudar o status para ${newStatus}?`)) return;

    try {
      await updateDoc(doc(db, "prestadores", id), {
        status: newStatus
      });
      showToast(`Status atualizado para ${newStatus}!`, "sucesso");
      setPrestadores(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      showToast("Erro ao alterar status.", "erro");
    }
  };

  const filteredPrestadores = prestadores.filter(p => 
    p.razaoSocial?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cnpj?.replace(/\D/g, "").includes(searchTerm.replace(/\D/g, ""))
  );

  // Métricas
  const totalPrestadores = prestadores.length;
  const ativosCount = prestadores.filter(p => p.status === "Ativo").length;
  const pendentesCount = prestadores.filter(p => p.status === "Pendente").length;
  const inativosCount = prestadores.filter(p => p.status === "Inativo" || p.status === "Recusado").length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Prestadores de Serviço</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Analise e gerencie as solicitações de credenciamento das empresas parceiras.</p>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Empresas</p>
            <h3 className="text-2xl font-black text-blue-600 mt-1">{totalPrestadores}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ativos / Homologados</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{ativosCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md relative overflow-hidden">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Novos Pedidos</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{pendentesCount}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl relative">
            <Clock className="w-5 h-5" />
            {pendentesCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inativos / Recusados</p>
            <h3 className="text-2xl font-black text-slate-500 mt-1">{inativosCount}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabela de Credenciamento */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Toolbar de Busca */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por empresa ou CNPJ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-2.5 w-full border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-white placeholder-slate-400 shadow-sm transition-all focus:outline-none"
            />
          </div>
          {searchTerm && (
            <div className="text-xs font-bold text-slate-400 bg-slate-150/60 px-3 py-1 rounded-full">
              Filtro: {filteredPrestadores.length} encontrados
            </div>
          )}
        </div>

        {/* Lista */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4.5">Razão Social / Credencial</th>
                <th className="px-6 py-4.5">CNPJ</th>
                <th className="px-6 py-4.5">Contato do Parceiro</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-center">Decisão do Credenciamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      Carregando credenciamentos...
                    </div>
                  </td>
                </tr>
              ) : filteredPrestadores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-full text-slate-400">
                        <Briefcase className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">Nenhum prestador encontrado</h3>
                      <p className="text-xs text-slate-450 font-medium max-w-xs leading-relaxed">
                        {searchTerm ? "Nenhum resultado corresponde à sua pesquisa." : "Nenhuma empresa solicitou credenciamento pelo portal corporativo até o momento."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPrestadores.map((p) => {
                  const statusColors = {
                    Ativo: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
                    Pendente: "bg-amber-50 text-amber-700 border-amber-250/60 animate-pulse",
                    Inativo: "bg-slate-100 text-slate-500 border-slate-200",
                    Recusado: "bg-rose-50 text-rose-700 border-rose-200/60"
                  };

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Empresa */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors shrink-0">
                            {p.razaoSocial?.charAt(0).toUpperCase() || <Briefcase className="w-4.5 h-4.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-800 text-sm leading-snug truncate max-w-[200px] sm:max-w-none">{p.razaoSocial}</p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Empresa Parceira</span>
                          </div>
                        </div>
                      </td>

                      {/* CNPJ */}
                      <td className="px-6 py-5 font-mono text-xs font-bold text-slate-500">
                        {p.cnpj || "Não informado"}
                      </td>

                      {/* Contato */}
                      <td className="px-6 py-5 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.contatoNome || p.contato || "---"}</span>
                        </div>
                        {p.contatoTelefone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-450 font-bold">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{p.contatoTelefone}</span>
                          </div>
                        )}
                      </td>


                      {/* Status */}
                      <td className="px-6 py-5">
                        <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${statusColors[p.status as keyof typeof statusColors] || "bg-slate-50 text-slate-600"}`}>
                          {p.status || "Pendente"}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          {p.status === "Pendente" ? (
                            <>
                              <button 
                                onClick={() => handleAprovar(p.id, p.razaoSocial)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all cursor-pointer"
                                title="Aprovar credenciamento"
                              >
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Aprovar</span>
                              </button>
                              <button 
                                onClick={() => handleRecusar(p.id, p.razaoSocial)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 hover:border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                title="Recusar credenciamento"
                              >
                                <X className="w-3.5 h-3.5 shrink-0" />
                                <span>Recusar</span>
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => handleToggleStatus(p.id, p.status)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                p.status === "Ativo" 
                                  ? "bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200 hover:border-rose-200" 
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/60"
                              }`}
                            >
                              {p.status === "Ativo" ? (
                                <>
                                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Desativar</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5 shrink-0" />
                                  <span>Reativar</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
