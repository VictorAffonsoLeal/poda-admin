"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, User, MapPin, Mail, Phone, Calendar, FileText, Eye, ExternalLink, Inbox, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";

function ClienteDetalhesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { showToast } = useToast();
  
  const [cliente, setCliente] = useState<any>(null);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"abertos" | "finalizados" | "todos">("abertos");

  useEffect(() => {
    if (!id) return;
    const fetchDados = async () => {
      try {
        // 1. Buscar os dados do cliente
        const docRef = doc(db, "usuarios", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setCliente({ id: docSnap.id, ...docSnap.data() });
        } else {
          showToast("Cliente não encontrado.", "erro");
          router.push("/clientes");
          return;
        }

        // 2. Buscar todas as solicitações deste cliente
        const q = query(
          collection(db, "solicitacoes"), 
          where("userId", "==", id),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        
        const solicitacoesArray: any[] = [];
        snapshot.forEach((doc) => {
          solicitacoesArray.push({ id: doc.id, ...doc.data() });
        });
        setSolicitacoes(solicitacoesArray);

      } catch (e) {
        console.error("Erro ao buscar dados: ", e);
      } finally {
        setLoading(false);
      }
    };

    fetchDados();
  }, [id, router, showToast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Criado": return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "Em Análise": return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "Aprovado": return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      case "Recusado": return "bg-rose-50 text-rose-700 border-rose-200/60";
      case "Concluído": return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getSolicitacaoDate = (sol: any) => {
    if (sol.createdAt) {
      try {
        return new Date(sol.createdAt).toLocaleDateString('pt-BR');
      } catch (e) {}
    }
    if (sol.historico && sol.historico.length > 0) {
      return sol.historico[0].data || "---";
    }
    return "---";
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return "---";
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Carregando detalhes do cliente...</p>
      </div>
    );
  }

  if (!cliente) return null;

  let dataCadastro = "Data não disponível";
  if (cliente.createdAt) {
    try {
      dataCadastro = new Date(cliente.createdAt).toLocaleDateString('pt-BR');
    } catch (e) {}
  }

  // Filtragem de solicitações para as abas
  const solicitacoesAbertas = solicitacoes.filter(s => s.status === "Criado" || s.status === "Em Análise");
  const solicitacoesFinalizadas = solicitacoes.filter(s => s.status === "Aprovado" || s.status === "Concluído" || s.status === "Recusado");
  
  const getFilteredSolicitacoes = () => {
    if (activeTab === "abertos") return solicitacoesAbertas;
    if (activeTab === "finalizados") return solicitacoesFinalizadas;
    return solicitacoes;
  };

  const listToShow = getFilteredSolicitacoes();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Barra superior de navegação */}
      <div className="flex items-center gap-4">
        <Link 
          href="/clientes" 
          className="text-slate-500 hover:text-emerald-600 hover:border-emerald-200 bg-white p-2.5 rounded-xl shadow-sm border border-slate-200 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Administração</div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Ficha do Cliente</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Coluna Esquerda: Informações do Cliente */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card de Perfil */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden transition-all hover:shadow-md">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 flex flex-col items-center justify-center text-white relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent)] pointer-events-none"></div>
              <div className="h-24 w-24 rounded-full bg-white/15 flex items-center justify-center text-4xl font-extrabold mb-4 shadow-xl border-4 border-white/20 backdrop-blur-sm">
                {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : <User className="w-12 h-12" />}
              </div>
              <h2 className="text-xl font-bold text-center tracking-tight leading-tight">{cliente.nome || "Não informado"}</h2>
              <p className="text-emerald-100/90 text-xs font-semibold uppercase tracking-wider mt-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                Cidadão cadastrado
              </p>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-slate-50 text-slate-500 rounded-lg border border-slate-100">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CPF / Documento</p>
                  <p className="text-slate-800 font-semibold text-sm mt-0.5">{formatCPF(cliente.cpf)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-slate-50 text-slate-500 rounded-lg border border-slate-100">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail</p>
                  <p className="text-slate-800 font-semibold text-sm mt-0.5 truncate">{cliente.email || "---"}</p>
                </div>
              </div>

              {cliente.telefone && (
                <div className="flex items-start gap-3.5">
                  <div className="p-2 bg-slate-50 text-slate-500 rounded-lg border border-slate-100">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telefone</p>
                    <p className="text-slate-800 font-semibold text-sm mt-0.5">{cliente.telefone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-slate-50 text-slate-500 rounded-lg border border-slate-100">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Membro Desde</p>
                  <p className="text-slate-800 font-semibold text-sm mt-0.5">{dataCadastro}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de Endereço */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden transition-all hover:shadow-md">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <MapPin className="w-4.5 h-4.5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Endereço de Cadastro
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {cliente.endereco ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CEP</p>
                      <p className="text-slate-800 font-medium mt-0.5">{cliente.endereco.cep || "---"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bairro</p>
                      <p className="text-slate-800 font-medium mt-0.5 truncate">{cliente.endereco.bairro || "---"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logradouro</p>
                    <p className="text-slate-800 font-medium mt-0.5">
                      {cliente.endereco.logradouro || "---"}{cliente.endereco.numero ? `, ${cliente.endereco.numero}` : ""}
                    </p>
                  </div>
                  
                  {cliente.geolocalizacao && (
                    <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Localização Geográfica</p>
                      <a 
                        href={`https://www.google.com/maps?q=${cliente.geolocalizacao.lat},${cliente.geolocalizacao.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/40 hover:border-emerald-200 px-4 py-2.5 rounded-xl transition-all duration-200 w-full shadow-sm"
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        Ver no Google Maps
                        <ExternalLink className="w-3 h-3 text-emerald-500 shrink-0 ml-0.5" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-400 italic text-sm">Nenhum endereço registrado.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Solicitações por Abas */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden transition-all hover:shadow-md">
            {/* Header com Abas */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Histórico de Solicitações</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Acompanhe as solicitações abertas pelo cidadão.</p>
                </div>
                
                {/* Abas */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start sm:self-center">
                  <button
                    onClick={() => setActiveTab("abertos")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "abertos" 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Em Aberto
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      activeTab === "abertos" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"
                    }`}>
                      {solicitacoesAbertas.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("finalizados")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "finalizados" 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Finalizados
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      activeTab === "finalizados" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}>
                      {solicitacoesFinalizadas.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("todos")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "todos" 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Inbox className="w-3.5 h-3.5" />
                    Todos
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      activeTab === "todos" ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {solicitacoes.length}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Lista de Chamados */}
            <div className="p-6 divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {listToShow.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-full text-slate-400">
                    <Inbox className="w-8 h-8" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">
                    {activeTab === "abertos" && "Nenhum chamado em aberto para este cliente."}
                    {activeTab === "finalizados" && "Nenhum chamado finalizado para este cliente."}
                    {activeTab === "todos" && "Este cliente ainda não abriu nenhuma solicitação."}
                  </p>
                </div>
              ) : (
                listToShow.map((solicitacao) => {
                  const dataFormatada = getSolicitacaoDate(solicitacao);

                  return (
                    <div 
                      key={solicitacao.id} 
                      className="py-4.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                            #{solicitacao.id.substring(0, 8)}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusColor(solicitacao.status)}`}>
                            {solicitacao.status}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-800 tracking-tight leading-snug">
                          {solicitacao.type || "Poda de Árvore"}
                        </h4>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {dataFormatada}
                          </span>
                          {solicitacao.address && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="w-3.5 h-3.5" />
                              {solicitacao.address}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center shrink-0">
                        <Link 
                          href={`/solicitacoes/detalhe?id=${solicitacao.id}`}
                          className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-2 font-bold text-xs border border-emerald-200/30 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalhes do Pedido
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClienteDetalhesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Carregando detalhes do cliente...</p>
      </div>
    }>
      <ClienteDetalhesContent />
    </Suspense>
  );
}
