"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc, arrayUnion, collection, getDocs, query, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  Edit, 
  FileText, 
  Camera, 
  X, 
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Briefcase,
  ClipboardCheck,
  Info,
  Download,
  Eye
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";

const getUploadUrl = () => {
  if (typeof window !== "undefined") {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocal && process.env.NEXT_PUBLIC_UPLOAD_URL) {
      return process.env.NEXT_PUBLIC_UPLOAD_URL;
    }
  }
  return "https://poda-app.nivl.com.br/api/upload.php";
};

function SolicitacaoDetalhesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { showToast } = useToast();
  
  const [solicitacao, setSolicitacao] = useState<any>(null);
  const [cidadao, setCidadao] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState("dados"); // "dados" | "laudo" | "acao" | "historico"
  
  // Image Lightbox State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Form states
  const [novoStatus, setNovoStatus] = useState("");
  const [observacao, setObservacao] = useState("");
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [selectedPrestador, setSelectedPrestador] = useState("");
  const [prazoDias, setPrazoDias] = useState("");
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState("");
  


  const fetchDados = async () => {
    if (!id) return;
    try {
      const docRef = doc(db, "solicitacoes", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setSolicitacao({ id: docSnap.id, ...data });
        setNovoStatus(data.status);
        if (data.tecnicoId) {
          setSelectedTecnico(data.tecnicoId);
        }

        if (data.userId) {
          const userSnap = await getDoc(doc(db, "usuarios", data.userId));
          if (userSnap.exists()) {
            setCidadao(userSnap.data());
          }
        }
      } else {
        showToast("Solicitação não encontrada.", "erro");
        router.push("/solicitacoes");
      }

      // Buscar Prestadores para o dropdown
      const prestadoresSnap = await getDocs(query(collection(db, "prestadores")));
      const pData: any[] = [];
      prestadoresSnap.forEach(pDoc => pData.push({ id: pDoc.id, ...pDoc.data() }));
      setPrestadores(pData);

      // Buscar Técnicos para o dropdown
      const tecnicosSnap = await getDocs(query(collection(db, "tecnicos")));
      const tData: any[] = [];
      tecnicosSnap.forEach(tDoc => tData.push({ id: tDoc.id, ...tDoc.data() }));
      setTecnicos(tData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, [id, router]);

  // Listener do teclado para fechar o lightbox com Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAssignTecnico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTecnico || selectedTecnico === (solicitacao.tecnicoId || "")) return;
    
    setIsUpdating(true);
    try {
      const docRef = doc(db, "solicitacoes", id!);
      const tecnicoObj = tecnicos.find(t => t.id === selectedTecnico);
      if (!tecnicoObj) return;

      const payload: any = {
        tecnicoId: tecnicoObj.id,
        tecnicoNome: tecnicoObj.nome,
        status: "Em Análise"
      };

      setNovoStatus("Em Análise");
      let historicoDescricao = `Designado para o técnico: ${tecnicoObj.nome}. Status alterado para Em Análise.`;

      const historicoEntry = {
        data: new Date().toLocaleDateString('pt-BR'),
        status: "Em Análise",
        descricao: historicoDescricao.trim()
      };

      payload.historico = arrayUnion(historicoEntry);

      await updateDoc(docRef, payload);
      showToast("Designado para vistoria com sucesso!", "sucesso");
      fetchDados();
    } catch (err) {
      console.error(err);
      showToast("Erro ao designar técnico.", "erro");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoStatus || (novoStatus === solicitacao.status && !observacao)) return;
    
    if (novoStatus === "Aprovado" && !solicitacao.laudoTecnico) {
      showToast("Não é possível aprovar uma solicitação sem o laudo técnico do vistoriador.", "erro");
      return;
    }

    setIsUpdating(true);
    try {
      const docRef = doc(db, "solicitacoes", id!);
      const payload: any = { status: novoStatus };
      
      let historicoDescricao = observacao ? `Status alterado para ${novoStatus}. Observação: ${observacao}` : `Status alterado para ${novoStatus}`;
      
      if (novoStatus === "Aprovado" && selectedPrestador) {
        const prestadorObj = prestadores.find(p => p.id === selectedPrestador);
        if (prestadorObj) {
          payload.prestadorId = prestadorObj.id;
          payload.prestadorNome = prestadorObj.razaoSocial;
          payload.prazoDias = prazoDias || "Não definido";
          historicoDescricao = `Solicitação Aprovada e encaminhada para a prestadora: ${prestadorObj.razaoSocial}. Prazo: ${payload.prazoDias} dias. ${observacao ? 'Observação: ' + observacao : ''}`;
        }
      }

      const historicoEntry = {
        data: new Date().toLocaleDateString('pt-BR'),
        status: novoStatus,
        descricao: historicoDescricao
      };

      payload.historico = arrayUnion(historicoEntry);

      await updateDoc(docRef, payload);

      showToast("Status atualizado com sucesso!", "sucesso");
      setObservacao("");
      fetchDados(); // Atualiza a tela
    } catch (e) {
      console.error(e);
      showToast("Erro ao atualizar status.", "erro");
    } finally {
      setIsUpdating(false);
    }
  };

  // Upload de Foto pelo Admin
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      // 1. Enviar para a Hostinger via PHP
      const formDataUpload = new FormData();
      formDataUpload.append("userId", solicitacao.userId || "anonimo");
      formDataUpload.append("files[]", file);

      const resUpload = await fetch(getUploadUrl(), {
        method: "POST",
        body: formDataUpload,
      });
      const dataUpload = await resUpload.json();

      if (!dataUpload.urls || dataUpload.urls.length === 0) {
        const errorMsg = dataUpload.errors && dataUpload.errors.length > 0 
          ? dataUpload.errors.join(", ") 
          : "Erro desconhecido no servidor de arquivos.";
        throw new Error(errorMsg);
      }

      const downloadUrl = dataUpload.urls[0];

      // 2. Adicionar ao array de fotos no Firestore
      const photoObj = {
        url: downloadUrl,
        autor: "admin",
        data: new Date().toLocaleDateString('pt-BR')
      };

      const docRef = doc(db, "solicitacoes", id);
      await updateDoc(docRef, {
        fotos: arrayUnion(photoObj)
      });

      showToast("Foto anexada com sucesso!", "sucesso");
      fetchDados(); // Atualizar informações na tela
    } catch (err: any) {
      console.error("Erro ao fazer upload da foto:", err);
      showToast("Erro ao anexar imagem: " + err.message, "erro");
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Criado": return "bg-slate-100 text-slate-800 border-slate-200";
      case "Em Análise": return "bg-orange-100 text-orange-800 border-orange-200";
      case "Aprovado": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Recusado": return "bg-red-100 text-red-800 border-red-200";
      case "Concluído": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getSecureUrl = (urlStr: string) => {
    if (urlStr && urlStr.startsWith("http://")) {
      return urlStr.replace("http://", "https://");
    }
    return urlStr;
  };

  if (loading) return <div className="p-8">Carregando detalhes...</div>;
  if (!solicitacao) return null;

  const dataCriacaoFormatada = solicitacao.createdAt?.toDate().toLocaleDateString("pt-BR") || "Data não disponível";

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Top Breadcrumb & Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-4">
          <Link href="/solicitacoes" className="text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Protocolo</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">#{solicitacao.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 mt-1">{solicitacao.type || "Solicitação"}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {solicitacao.treeId && (
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
              🌳 ID Censo: {solicitacao.treeId}
            </span>
          )}
          {solicitacao.documentoAnuencia ? (
            <a 
              href={getSecureUrl(solicitacao.documentoAnuencia)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold border bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-200/50 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Visualizar documento de anuência do proprietário"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Ver Anuência</span>
            </a>
          ) : (
            solicitacao.imovelAlugado && (
              <span 
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1 transition-colors shadow-sm"
                title="Imóvel alugado, mas o documento de anuência não foi anexado."
              >
                ⚠️ Sem Doc. Anuência
              </span>
            )
          )}
          <span className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border ${getStatusColor(solicitacao.status)}`}>
            {solicitacao.status}
          </span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-white rounded-xl p-1.5 shadow-sm border border-slate-200/80 gap-1">
        <button
          onClick={() => setActiveTab("dados")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === "dados"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <FileText className="w-4.5 h-4.5" />
          <span>Dados e Fotos</span>
        </button>
        <button
          onClick={() => setActiveTab("designar")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === "designar"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <User className="w-4.5 h-4.5" />
          <span>Enviar para Técnico</span>
        </button>
        <button
          onClick={() => setActiveTab("laudo")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === "laudo"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Briefcase className="w-4.5 h-4.5" />
          <span>Laudo Técnico</span>
        </button>
        <button
          onClick={() => setActiveTab("acao")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === "acao"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Edit className="w-4.5 h-4.5" />
          <span>Ação do Servidor</span>
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === "historico"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Clock className="w-4.5 h-4.5" />
          <span>Histórico</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="transition-all duration-300">
        
        {/* TAB 1: Dados e Fotos */}
        {activeTab === "dados" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Coluna Principal: Informações Gerais */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Avisos Importantes */}
              {solicitacao.solicitantesAdicionais && solicitacao.solicitantesAdicionais.length > 0 && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="text-3xl text-amber-500 shrink-0">⚠️</div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-amber-900">Múltiplas Solicitações Identificadas!</h4>
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      Este chamado foi reforçado por <strong>{solicitacao.solicitantesAdicionais.length}</strong> outro(s) cidadão(s)/órgão(s). 
                      O sistema bloqueou a duplicação e unificou os pedidos neste protocolo.
                    </p>
                  </div>
                </div>
              )}

              {solicitacao.risco && solicitacao.risco !== "Nenhum risco aparente" && (
                <div className="bg-red-50 border border-red-200/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="text-3xl shrink-0">🚨</div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-red-800">Prioridade Máxima: Risco Iminente</h4>
                    <p className="text-sm font-bold text-red-700">Motivo alegado: {solicitacao.risco}</p>
                  </div>
                </div>
              )}

              {solicitacao.tipoArea === "APP / Rural" && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="text-3xl shrink-0">🛑</div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-amber-900 uppercase tracking-wider">Área Especial: CETESB Requerida</h4>
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      Localizado em <strong>APP ou Zona Rural</strong>. Solicite e anexe a licença ambiental estadual antes de qualquer deferimento.
                    </p>
                  </div>
                </div>
              )}

              {/* Informações Principais */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    Ficha de Dados do Chamado
                  </h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Serviço</span>
                      <span className="text-slate-800 font-extrabold text-sm">{solicitacao.type}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Área</span>
                      <span className="text-slate-800 font-extrabold text-sm">{solicitacao.tipoArea || "Urbana"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Abertura do Protocolo</span>
                      <span className="text-slate-800 font-medium text-sm flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {dataCriacaoFormatada}
                      </span>
                    </div>
                    {solicitacao.prazoDias && solicitacao.prazoDias !== "Não definido" && (
                      <div>
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Prazo Técnico</span>
                        <span className="text-orange-700 font-extrabold bg-orange-50 border border-orange-100 px-2 py-0.5 rounded text-xs inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {solicitacao.prazoDias} dias
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Endereço e Localização */}
                  <div className="pt-5 border-t border-slate-100 space-y-3">
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Endereço do Local</span>
                      <div className="flex items-start gap-2.5 text-slate-700 text-sm">
                        <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{solicitacao.address}</p>
                          {solicitacao.referencia && (
                            <p className="text-xs text-slate-400 mt-1"><span className="font-bold text-slate-500">Ref:</span> {solicitacao.referencia}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {solicitacao.geolocalizacao && (
                      <div className="mt-3 pl-7">
                        <a 
                          href={`https://www.google.com/maps?q=${solicitacao.geolocalizacao.lat},${solicitacao.geolocalizacao.lng}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ver no Google Maps ({solicitacao.geolocalizacao.lat.toFixed(4)}, {solicitacao.geolocalizacao.lng.toFixed(4)})</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Declarações Adicionais */}
                  {(solicitacao.imovelAlugado || solicitacao.cienteCompensacao) && (
                    <div className="pt-5 border-t border-slate-100 space-y-2.5">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Declarações Legais</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                        {solicitacao.imovelAlugado && (
                          <div className="flex items-center justify-between gap-3 text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-500 text-sm">✔️</span> 
                              <span>Imóvel alugado com autorização do proprietário</span>
                            </div>
                            {solicitacao.documentoAnuencia && (
                              <div className="flex items-center gap-2 shrink-0">
                                {solicitacao.documentoAnuencia.toLowerCase().includes(".pdf") || solicitacao.documentoAnuencia.toLowerCase().split('?')[0].endsWith(".pdf") ? (
                                  <a 
                                    href={getSecureUrl(solicitacao.documentoAnuencia)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold shadow-sm transition-all"
                                  >
                                    <ExternalLink className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Ver PDF</span>
                                  </a>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => setSelectedImage(getSecureUrl(solicitacao.documentoAnuencia))}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Ver Foto</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {solicitacao.cienteCompensacao && (
                          <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                            <span className="text-emerald-500 text-sm">✔️</span> 
                            <span>Ciente da obrigação de Compensação Ambiental</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Documento de Anuência do Proprietário */}
                  {solicitacao.documentoAnuencia && (
                    <div className="pt-5 border-t border-slate-100 space-y-3">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Documentos do Solicitante</span>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">Autorização / Anuência do Proprietário</p>
                            <p className="text-xs text-slate-400 mt-0.5 font-medium">
                              {solicitacao.documentoAnuencia.toLowerCase().includes(".pdf") || solicitacao.documentoAnuencia.toLowerCase().split('?')[0].endsWith(".pdf")
                                ? "Documento formato PDF" 
                                : "Documento digitalizado (Imagem)"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                          {solicitacao.documentoAnuencia.toLowerCase().includes(".pdf") || solicitacao.documentoAnuencia.toLowerCase().split('?')[0].endsWith(".pdf") ? (
                            <a 
                              href={getSecureUrl(solicitacao.documentoAnuencia)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Visualizar PDF
                            </a>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => setSelectedImage(getSecureUrl(solicitacao.documentoAnuencia))}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualizar Foto
                            </button>
                          )}
                          
                          <a 
                            href={getSecureUrl(solicitacao.documentoAnuencia)} 
                            download={`Anuencia_Protocolo_${solicitacao.id.substring(0, 8)}.pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0" />
                            Baixar
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empresa Prestadora */}
                  {solicitacao.prestadorNome && (
                    <div className="pt-5 border-t border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Empresa Prestadora Escalada</span>
                      <span className="text-slate-800 font-bold bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 inline-block text-xs">
                        {solicitacao.prestadorNome}
                      </span>
                    </div>
                  )}

                  {/* Descrição Inicial */}
                  {solicitacao.historico && solicitacao.historico[0] && (
                    <div className="pt-5 border-t border-slate-100 space-y-2">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Justificativa Inicial do Solicitante</span>
                      <div className="bg-slate-50/70 p-4 rounded-2xl text-slate-700 border border-slate-100 italic text-sm leading-relaxed">
                        "{solicitacao.historico[0].descricao.replace('Solicitação criada. Justificativa: ', '')}"
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Galeria de Fotos */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
                    <Camera className="w-5 h-5 text-emerald-600" />
                    Fotos do Local
                  </h3>
                  <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {solicitacao.fotos ? solicitacao.fotos.length : 0} fotos
                  </span>
                </div>
                <div className="p-6 space-y-6">
                  {/* Visualização de Fotos */}
                  {solicitacao.fotos && solicitacao.fotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {solicitacao.fotos.map((fotoItem: any, idx: number) => {
                        const isObject = typeof fotoItem === "object" && fotoItem !== null;
                        const url = isObject ? fotoItem.url : fotoItem;
                        const autor = isObject ? fotoItem.autor : "usuario";
                        const dataEnvio = isObject ? fotoItem.data : "";
                        const secureUrl = getSecureUrl(url);

                        const autorLabels = {
                          usuario: "Cidadão",
                          tecnico: "Técnico",
                          admin: "Administrador"
                        };

                        const autorColors = {
                          usuario: "bg-blue-50 text-blue-700 border-blue-100",
                          tecnico: "bg-orange-50 text-orange-700 border-orange-100",
                          admin: "bg-emerald-50 text-emerald-700 border-emerald-100"
                        };

                        return (
                          <div key={idx} className="relative group border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex flex-col justify-between shadow-sm">
                            <div 
                              onClick={() => setSelectedImage(secureUrl)}
                              className="cursor-pointer relative aspect-square overflow-hidden bg-slate-200 flex items-center justify-center border-b border-slate-200/50"
                            >
                              <img 
                                src={secureUrl} 
                                alt={`Foto ${idx}`} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Imagem+Indispon%C3%ADvel";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white">
                                <span className="bg-black/50 px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm">Ampliar</span>
                              </div>
                            </div>
                            <div className="p-3 flex flex-col gap-1 bg-slate-50 text-[10px] font-bold text-slate-500">
                              <div className="flex justify-between items-center">
                                <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${autorColors[autor as keyof typeof autorColors] || "bg-slate-100 text-slate-800"}`}>
                                  {autorLabels[autor as keyof typeof autorLabels] || "Cidadão"}
                                </span>
                                {dataEnvio && <span className="text-slate-400 font-normal">{dataEnvio}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 italic text-sm">
                      Nenhuma foto foi anexada a esta solicitação.
                    </div>
                  )}

                  {/* Formulário de Upload */}
                  <div className="pt-6 border-t border-slate-100">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Adicionar Nova Foto ao Chamado</span>
                    <label className="flex items-center justify-center gap-2.5 px-4 py-4 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl bg-slate-50/50 hover:bg-emerald-50/10 cursor-pointer transition-all duration-200 text-slate-500 hover:text-emerald-700">
                      {uploading ? (
                        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Camera className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <span className="text-sm font-semibold">{uploading ? "Fazendo upload..." : "Selecionar foto para anexar como Admin"}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleUploadPhoto} 
                        disabled={uploading}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Lateral: Dados do Cidadão */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden sticky top-20">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
                    <User className="w-5 h-5 text-emerald-600" />
                    Dados do Solicitante
                  </h3>
                </div>
                <div className="p-6 text-sm space-y-5">
                  {cidadao ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                          {cidadao.nome?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-slate-800 truncate">{cidadao.nome}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Cidadão</p>
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">CPF</span>
                        <span className="text-slate-800 font-semibold">{cidadao.cpf || "Não informado"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">E-mail</span>
                        <span className="text-slate-800 font-semibold break-all">{cidadao.email || "Não informado"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Endereço Residencial</span>
                        <span className="text-slate-700 text-xs font-semibold leading-relaxed block bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {cidadao.endereco ? `${cidadao.endereco.logradouro}, ${cidadao.endereco.numero} - ${cidadao.endereco.bairro}` : "Não informado"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-xs">Dados do cidadão indisponíveis.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Enviar para Técnico */}
        {activeTab === "designar" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-2xl mx-auto overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 bg-emerald-50/40">
              <h3 className="font-extrabold text-emerald-800 flex items-center gap-2 text-md">
                <User className="w-5 h-5 text-emerald-700" />
                Designar Técnico Vistoriador
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {solicitacao.tecnicoNome && (
                <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <span>📌</span>
                  <span>Atribuído ao técnico: <strong className="text-emerald-950">{solicitacao.tecnicoNome}</strong></span>
                </div>
              )}

              <form onSubmit={handleAssignTecnico} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Selecione o Técnico Responsável pela Vistoria</label>
                  <select 
                    value={selectedTecnico}
                    onChange={(e) => setSelectedTecnico(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-700 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-semibold"
                  >
                    <option value="">-- Selecione um Técnico --</option>
                    {tecnicos.map(t => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.registro})</option>
                    ))}
                  </select>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isUpdating || selectedTecnico === (solicitacao.tecnicoId || "")}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isUpdating ? "Enviando..." : solicitacao.tecnicoId ? "Reatribuir Técnico" : "Enviar para Vistoria"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: Laudo Técnico (Dados Enviados pelo Técnico de Campo) */}
        {activeTab === "laudo" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-4xl mx-auto overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 bg-emerald-50/30 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="font-extrabold text-emerald-800 text-md">
                Laudo de Vistoria Técnica
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {solicitacao.laudoTecnico ? (
                <>
                  {/* Identificação do Técnico */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pb-6 border-b border-slate-100">
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Técnico Responsável</span>
                      <span className="text-slate-800 font-extrabold text-sm">{solicitacao.laudoTecnico.tecnicoNome}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Registro Profissional</span>
                      <span className="text-slate-850 font-semibold text-sm">{solicitacao.laudoTecnico.registroProfissional}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assinatura / ART-CREA</span>
                      <span className="text-slate-850 font-semibold text-xs italic">{solicitacao.laudoTecnico.assinaturaCrea}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Data da Vistoria</span>
                      <span className="text-slate-800 font-medium text-xs">{solicitacao.laudoTecnico.dataEmissao}</span>
                    </div>
                  </div>

                  {/* Fotos da Vistoria Técnica */}
                  {(() => {
                    const fotosTecnico = solicitacao.fotos?.filter((f: any) => typeof f === "object" && f !== null && f.autor === "tecnico") || [];
                    if (fotosTecnico.length === 0) return null;
                    return (
                      <div className="space-y-3 pb-6 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fotos da Vistoria Técnica</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {fotosTecnico.map((fotoItem: any, idx: number) => {
                            const secureUrl = getSecureUrl(fotoItem.url);
                            return (
                              <div key={idx} className="relative group border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex flex-col justify-between shadow-sm">
                                <div 
                                  onClick={() => setSelectedImage(secureUrl)}
                                  className="cursor-pointer relative aspect-square overflow-hidden bg-slate-200 flex items-center justify-center border-b border-slate-200/50"
                                >
                                  <img 
                                    src={secureUrl} 
                                    alt={`Foto Vistoria ${idx}`} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Imagem+Indispon%C3%ADvel";
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white">
                                    <span className="bg-black/50 px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm">Ampliar</span>
                                  </div>
                                </div>
                                <div className="p-2 bg-slate-50 text-[10px] text-slate-500 flex justify-between font-bold">
                                  <span>Foto #{idx + 1}</span>
                                  {fotoItem.data && <span>{fotoItem.data}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Características da Árvore */}
                  <div className="space-y-3 pb-6 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Características do Espécime</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Espécie</span>
                        <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.especie || "Não informada"}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">DAP (Diâmetro)</span>
                        <span className="text-slate-800 font-extrabold text-xs">{solicitacao.laudoTecnico.dap ? `${solicitacao.laudoTecnico.dap} cm` : "N/A"}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Altura Estimada</span>
                        <span className="text-slate-800 font-extrabold text-xs">{solicitacao.laudoTecnico.altura ? `${solicitacao.laudoTecnico.altura} m` : "N/A"}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Inclinação</span>
                        <span className="text-slate-800 font-extrabold text-xs">{solicitacao.laudoTecnico.inclinacao !== undefined ? `${solicitacao.laudoTecnico.inclinacao}°` : "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Questionário Fitossanitário */}
                  <div className="space-y-3 pb-6 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avaliação Fitossanitária e de Riscos</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-700">Fiação elétrica próxima ou em conflito:</span>
                        <span className={`px-2.5 py-0.5 rounded font-black border text-[10px] ${solicitacao.laudoTecnico.fiacaoProxima ? "bg-red-50 text-red-700 border-red-250" : "bg-emerald-50 text-emerald-700 border-emerald-250"}`}>
                          {solicitacao.laudoTecnico.fiacaoProxima ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-700">Danos estruturais (muros/calçada/rede):</span>
                        <span className={`px-2.5 py-0.5 rounded font-black border text-[10px] ${solicitacao.laudoTecnico.danosEstruturais ? "bg-red-50 text-red-700 border-red-250" : "bg-emerald-50 text-emerald-700 border-emerald-250"}`}>
                          {solicitacao.laudoTecnico.danosEstruturais ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-700">Infestação de pragas ou cupins ativos:</span>
                        <span className={`px-2.5 py-0.5 rounded font-black border text-[10px] ${solicitacao.laudoTecnico.pragasCupins ? "bg-red-50 text-red-700 border-red-250" : "bg-emerald-50 text-emerald-700 border-emerald-250"}`}>
                          {solicitacao.laudoTecnico.pragasCupins ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-700">Tronco oco, cavidades ou podridão interna:</span>
                        <span className={`px-2.5 py-0.5 rounded font-black border text-[10px] ${solicitacao.laudoTecnico.troncoOco ? "bg-red-50 text-red-700 border-red-250" : "bg-emerald-50 text-emerald-700 border-emerald-250"}`}>
                          {solicitacao.laudoTecnico.troncoOco ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-700">Árvore morta ou em declínio biológico severo:</span>
                        <span className={`px-2.5 py-0.5 rounded font-black border text-[10px] ${solicitacao.laudoTecnico.arvoreMorta ? "bg-red-50 text-red-700 border-red-250" : "bg-emerald-50 text-emerald-700 border-emerald-250"}`}>
                          {solicitacao.laudoTecnico.arvoreMorta ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-700">Grau de Risco de Queda Avaliado:</span>
                        <span className={`px-2.5 py-0.5 rounded font-black border text-[10px] ${
                          solicitacao.laudoTecnico.grauRisco === "Alto" || solicitacao.laudoTecnico.grauRisco === "Iminente"
                            ? "bg-red-50 text-red-750 border-red-250"
                            : solicitacao.laudoTecnico.grauRisco === "Médio"
                            ? "bg-orange-50 text-orange-700 border-orange-250"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {solicitacao.laudoTecnico.grauRisco || "Baixo"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Deliberação e Parecer Conclusivo */}
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Parecer / Deliberação do Laudo</span>
                      <span className="text-emerald-800 font-extrabold text-sm bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl inline-block">
                        {solicitacao.laudoTecnico.decisaoFinal}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Justificativa Técnica do Parecer</span>
                      <div className="bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
                        {solicitacao.laudoTecnico.parecerTecnico}
                      </div>
                    </div>

                    {solicitacao.laudoTecnico.compensacaoAmbiental && (
                      <div className="space-y-1.5">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Compensação Ambiental Recomendada</span>
                        <div className="bg-emerald-50/30 p-4 rounded-xl text-emerald-800 border border-emerald-100 text-xs font-bold leading-relaxed">
                          🌱 {solicitacao.laudoTecnico.compensacaoAmbiental}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 flex flex-col items-center justify-center">
                  <div className="text-4xl mb-3">🕒</div>
                  <h4 className="text-base font-extrabold text-slate-800">Aguardando Laudo Técnico</h4>
                  {solicitacao.tecnicoNome ? (
                    <div className="mt-2 text-xs text-slate-500 max-w-sm leading-relaxed">
                      Esta vistoria está designada para o técnico: <strong className="text-slate-700">{solicitacao.tecnicoNome}</strong>.
                      <p className="mt-1 text-[11px] text-slate-400 font-medium">Aguardando preenchimento do laudo no aplicativo de campo.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                      Nenhum técnico vistoriador foi designado para este chamado ainda. Vá na aba <strong className="text-emerald-700">Enviar para Técnico</strong> para designar um técnico.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Ação do Servidor */}
        {activeTab === "acao" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-3xl mx-auto overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 bg-emerald-50/40">
              <h3 className="font-extrabold text-emerald-800 flex items-center gap-2 text-md">
                <Edit className="w-5 h-5" />
                Ação do Servidor (Despacho / OS)
              </h3>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleUpdateStatus} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Alterar Status</label>
                  <select 
                    value={novoStatus}
                    onChange={(e) => setNovoStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-700 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-semibold"
                  >
                    <option value="">-- Selecione o Despacho --</option>
                    <option value="Aprovado" disabled={!solicitacao.laudoTecnico}>
                      Aprovado (Autorizado e Encaminhar OS) {!solicitacao.laudoTecnico && " - Requer Laudo"}
                    </option>
                    <option value="Recusado">Recusado (Indeferido / Documentação Incorreta)</option>
                  </select>
                </div>

                {!solicitacao.laudoTecnico && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-900 text-xs">
                    <Info className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-amber-950">Aprovação Bloqueada (Requer Laudo Técnico)</h4>
                      <p className="mt-1 leading-relaxed font-semibold">
                        Esta solicitação ainda não possui um **Laudo Técnico** emitido pelo vistoriador. 
                        A aprovação só é habilitada após a realização da vistoria de campo. 
                        No entanto, você pode **Recusar (Indeferir)** o pedido imediatamente se houver problemas na documentação.
                      </p>
                    </div>
                  </div>
                )}

                {novoStatus === "Aprovado" && (
                  <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100 mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-emerald-800 mb-2">Despachar para Qual Empresa?</label>
                      {prestadores.length === 0 ? (
                        <p className="text-xs text-red-655 font-bold">Nenhum prestador cadastrado no sistema.</p>
                      ) : (
                        <select 
                          value={selectedPrestador}
                          onChange={(e) => setSelectedPrestador(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl text-slate-700 bg-white text-sm font-semibold"
                        >
                          <option value="">-- Selecione uma empresa terceirizada --</option>
                          {prestadores.filter(p => p.status === "Ativo").map(p => (
                            <option key={p.id} value={p.id}>{p.razaoSocial} (CNPJ: {p.cnpj})</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-800 mb-1.5">Prazo para Execução (em dias)</label>
                      <input 
                        type="number"
                        min="1"
                        placeholder="Ex: 15"
                        value={prazoDias}
                        onChange={(e) => setPrazoDias(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-emerald-200 rounded-xl text-slate-700 bg-white text-sm font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Observação Interna / Parecer</label>
                  <textarea 
                    rows={4}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Adicione observações, parecer técnico ou justificativas para o histórico..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm leading-relaxed"
                  ></textarea>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isUpdating || novoStatus === solicitacao.status}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isUpdating ? "Salvando..." : "Salvar Atualização"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: Histórico */}
        {activeTab === "historico" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-3xl mx-auto overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-md">
                <Clock className="w-5 h-5 text-emerald-600" />
                Histórico de Atualizações
              </h3>
            </div>
            <div className="p-8">
              {solicitacao.historico && solicitacao.historico.length > 0 ? (
                <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-8">
                  {[...solicitacao.historico].reverse().map((hist: any, index: number) => {
                    const isLatest = index === 0;
                    return (
                      <div key={index} className="relative">
                        <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center ${
                          isLatest ? "bg-emerald-500 shadow-md shadow-emerald-500/20" : "bg-slate-300"
                        }`} />
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{hist.data}</p>
                          <p className={`text-sm font-black ${isLatest ? "text-emerald-700" : "text-slate-800"}`}>{hist.status}</p>
                          <p className="text-slate-600 text-xs font-medium leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100 inline-block w-full">{hist.descricao}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 italic text-sm">
                  Nenhum histórico registrado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors duration-150 cursor-pointer shadow-lg"
            title="Fechar (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div 
            className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-1 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={selectedImage} 
              alt="Foto Ampliada" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SolicitacaoDetalhesAdminPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando detalhes...</div>}>
      <SolicitacaoDetalhesContent />
    </Suspense>
  );
}
