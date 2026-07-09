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
  const [statusVal, setStatusVal] = useState("");
  const [observacaoVal, setObservacaoVal] = useState("");
  const [concederCertificado, setConcederCertificado] = useState(true);
  


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
      
      if (solicitacao.status === "Aguardando Validação") {
        if (novoStatus === "Concluído") {
          historicoDescricao = `Execução homologada pelo administrador. Chamado concluído com sucesso. ${observacao ? 'Observação: ' + observacao : ''}`;
        } else if (novoStatus === "Aprovado") {
          historicoDescricao = `Fotos de comprovação rejeitadas pelo administrador. Retornado para o status Aprovado para correções do cidadão. ${observacao ? 'Motivo/Observação: ' + observacao : ''}`;
        }
      } else if (novoStatus === "Aprovado" && selectedPrestador) {
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

  const handleValidadePoda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusVal) return;

    setIsUpdating(true);
    try {
      const docRef = doc(db, "solicitacoes", id!);
      const payload: any = { status: statusVal };
      
      let historicoDescricao = "";
      if (statusVal === "Concluído") {
        historicoDescricao = `Poda homologada e aprovada pelo administrador. Chamado concluído com sucesso. Observações: ${observacaoVal || "Tudo em conformidade."}`;
        payload.concederCertificado = concederCertificado;
        payload.dataFinalizacao = new Date().toLocaleDateString('pt-BR');
      } else if (statusVal === "Aprovado") {
        historicoDescricao = `A COMPROVAÇÃO DA PODA FOI REPROVADA. Erros cometidos / Parecer: ${observacaoVal || "Fotos de comprovação insatisfatórias ou execução em desacordo com as orientações técnicas."}\n\n⚠️ ALERTA IMPORTANTE: A execução inadequada ou incorreta da poda/supressão sem a observância das exigências técnicas pode acarretar na aplicação de multa ambiental municipal de acordo com a legislação vigente. Se houver qualquer dúvida de como proceder para regularizar, acesse o chat de suporte da plataforma para tirá-las diretamente com a Secretaria de Meio Ambiente.`;
      }

      const historicoEntry = {
        data: new Date().toLocaleDateString('pt-BR'),
        status: statusVal,
        descricao: historicoDescricao
      };

      payload.historico = arrayUnion(historicoEntry);

      await updateDoc(docRef, payload);

      showToast(statusVal === "Concluído" ? "Poda homologada com sucesso!" : "Comprovação reprovada e cidadão notificado.", "sucesso");
      setObservacaoVal("");
      setStatusVal("");
      fetchDados();
    } catch (err) {
      console.error("Erro ao validar poda:", err);
      showToast("Erro ao enviar validação.", "erro");
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
      case "Aguardando Validação": return "bg-purple-100 text-purple-800 border-purple-200";
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
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">#{/^\d{14}$/.test(solicitacao.id) ? solicitacao.id : solicitacao.id.substring(0, 8).toUpperCase()}</span>
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
              title="Visualizar documento de anuência ou contrato de locação"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Ver Anuência/Contrato</span>
            </a>
          ) : (
            solicitacao.imovelAlugado && (
              <span 
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1 transition-colors shadow-sm"
                title="Imóvel alugado, mas a anuência ou contrato não foram anexados."
              >
                ⚠️ Sem Anuência/Contrato
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
          onClick={() => setActiveTab("validacao")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer relative ${
            activeTab === "validacao"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Camera className="w-4.5 h-4.5" />
          <span>Validar Poda</span>
          {solicitacao.status === "Aguardando Validação" && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-600"></span>
            </span>
          )}
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
                    {(solicitacao.qtdPodaSolicitada !== undefined || solicitacao.qtdSupressaoSolicitada !== undefined) && (
                      <>
                        <div>
                          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Qtd. Árvores para Poda</span>
                          <span className="text-slate-800 font-extrabold text-sm">{solicitacao.qtdPodaSolicitada ?? 0}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Qtd. Árvores para Supressão</span>
                          <span className="text-slate-800 font-extrabold text-sm">{solicitacao.qtdSupressaoSolicitada ?? 0}</span>
                        </div>
                      </>
                    )}
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

                  {/* Documento de Anuência / Contrato */}
                  {solicitacao.documentoAnuencia && (
                    <div className="pt-5 border-t border-slate-100 space-y-3">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Documentos do Solicitante</span>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">Autorização de Anuência / Contrato de Locação</p>
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
                            download={`Anuencia_Protocolo_${/^\d{14}$/.test(solicitacao.id) ? solicitacao.id : solicitacao.id.substring(0, 8)}.pdf`}
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

                  {/* Documento de Anuência do Vizinho */}
                  {solicitacao.arvoreNaDivisa && solicitacao.documentoVizinho && (
                    <div className="pt-5 border-t border-slate-100 space-y-3">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Anuência do Vizinho (Divisa)</span>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0 font-sans">
                            <p className="font-bold text-slate-800 text-sm truncate">Acordo de Divisa e Reposição</p>
                            <p className="text-xs text-slate-400 mt-0.5 font-medium">
                              Reposição acordada em: <span className="font-bold text-slate-700">{solicitacao.localReposicao || "Não especificado"}</span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                          {solicitacao.documentoVizinho.toLowerCase().includes(".pdf") || solicitacao.documentoVizinho.toLowerCase().split('?')[0].endsWith(".pdf") ? (
                            <a 
                              href={getSecureUrl(solicitacao.documentoVizinho)} 
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
                              onClick={() => setSelectedImage(getSecureUrl(solicitacao.documentoVizinho))}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-emerald-700 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualizar Foto
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Laudo de Caracterização Ambiental */}
                  {solicitacao.documentoCaracterizacao && (
                    <div className="pt-5 border-t border-slate-100 space-y-3">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Laudo de Caracterização Ambiental</span>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 font-sans">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-3 bg-amber-100 text-amber-800 rounded-xl border border-amber-200/50 shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">Laudo de Caracterização Ambiental obrigatório (&gt; 15 supressões)</p>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">Documento técnico exigido legalmente</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                          {solicitacao.documentoCaracterizacao.toLowerCase().includes(".pdf") || solicitacao.documentoCaracterizacao.toLowerCase().split('?')[0].endsWith(".pdf") ? (
                            <a 
                              href={getSecureUrl(solicitacao.documentoCaracterizacao)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-amber-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Visualizar PDF
                            </a>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => setSelectedImage(getSecureUrl(solicitacao.documentoCaracterizacao))}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-amber-100 text-amber-850 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualizar Foto
                            </button>
                          )}
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
                          usuario_corte: "Comprovação de Poda",
                          tecnico: "Técnico",
                          admin: "Administrador"
                        };

                        const autorColors = {
                          usuario: "bg-blue-50 text-blue-700 border-blue-100",
                          usuario_corte: "bg-purple-50 text-purple-700 border-purple-100",
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
                  {solicitacao.anonima ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold shrink-0">
                          🤫
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-slate-800 truncate">Denúncia Anônima</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Identidade Preservada</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                        O cidadão optou por registrar esta infração de forma anônima. Suas informações de contato foram ocultadas para preservar sua privacidade na Ouvidoria Pública.
                      </p>
                    </div>
                  ) : cidadao ? (
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
                      <span className="text-slate-800 font-semibold text-sm">{solicitacao.laudoTecnico.registroProfissional}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assinatura / ART-CREA</span>
                      <span className="text-slate-800 font-semibold text-xs italic">{solicitacao.laudoTecnico.assinaturaCrea}</span>
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

                  {/* Dados Gerais da Vistoria */}
                  {solicitacao.laudoTecnico.autorizacaoPara && (
                    <div className="space-y-3 pb-6 border-b border-slate-100 font-sans">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Dados Gerais da Vistoria ({solicitacao.laudoTecnico.formType === "privado" ? "Área Privada / Inst." : "Área Pública"})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Autorização para</span>
                          <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.autorizacaoPara}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Tipo de Imóvel</span>
                          <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.tipoImovel || "N/A"}</span>
                        </div>

                        {solicitacao.laudoTecnico.formType === "privado" ? (
                          <>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Requerente</span>
                              <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.requerenteTipo || "Requerente"}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-1 sm:col-span-2">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Nome do Requerente</span>
                              <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.requerenteNome || "N/A"}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Telefone</span>
                              <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.requerenteFone || "N/A"}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Local da Intervenção</span>
                              <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.localIntervencao || "N/A"}</span>
                            </div>
                            {solicitacao.laudoTecnico.podaDrasticaQtd && (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Qtd. Árvores Poda Drástica</span>
                                <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.podaDrasticaQtd}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Responsável</span>
                            <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.secretariaResponsavel || "N/A"}</span>
                          </div>
                        )}

                        {(solicitacao.laudoTecnico.qtdSupressao > 0 || solicitacao.laudoTecnico.qtdPoda > 0) && (
                          <>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Qtd. Supressões Autorizadas</span>
                              <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.qtdSupressao || 0}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Qtd. Podas Autorizadas</span>
                              <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.qtdPoda || 0}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Características da Árvore e Avaliações */}
                  {solicitacao.laudoTecnico.arvores && solicitacao.laudoTecnico.arvores.length > 0 ? (
                    <div className="space-y-6 pb-6 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Laudo por Espécime ({solicitacao.laudoTecnico.arvores.length})</h4>
                      <div className="space-y-5">
                        {solicitacao.laudoTecnico.arvores.map((tree: any, idx: number) => (
                          <div key={tree.id || idx} className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-200 space-y-4 font-sans text-xs">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <span className="font-extrabold text-slate-800 uppercase tracking-wider text-xs">{tree.identificador || `Árvore ${idx + 1}`}</span>
                              <span className={`px-2.5 py-0.5 rounded font-black border text-[10px] ${
                                tree.decisaoFinal?.includes("Supressão") 
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : tree.decisaoFinal?.includes("Poda")
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}>
                                {tree.decisaoFinal || "Sem recomendação"}
                              </span>
                            </div>

                            {/* Características Dendrométricas */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div className="bg-white p-2.5 rounded-xl border border-slate-150">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">Espécie</span>
                                <span className="text-slate-800 font-bold text-xs">{tree.especie || "Não informada"}</span>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-slate-150">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">DAP (Diâmetro)</span>
                                <span className="text-slate-800 font-extrabold text-xs">{tree.dap ? `${tree.dap} cm` : "N/A"}</span>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-slate-150">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">Altura</span>
                                <span className="text-slate-800 font-extrabold text-xs">{tree.altura ? `${tree.altura} m` : "N/A"}</span>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-slate-150">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">Inclinação / Risco</span>
                                <span className="text-slate-800 font-extrabold text-xs">
                                  {tree.inclinacao !== undefined ? `${tree.inclinacao}°` : "0°"} / {tree.grauRisco || "Baixo"}
                                </span>
                              </div>
                            </div>

                            {/* Questionário Fitossanitário */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                              <span className="block font-bold text-slate-500 uppercase text-[9px] mb-2.5 text-emerald-800 tracking-wider">Avaliação Fitossanitária e Conflitos</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-slate-650 font-medium">
                                <div className="flex justify-between items-center">
                                  <span>Fiação elétrica próxima:</span>
                                  <span className={`px-2 py-0.5 rounded font-black border text-[9px] ${tree.fiacaoProxima ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{tree.fiacaoProxima ? "Sim" : "Não"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>Danos estruturais:</span>
                                  <span className={`px-2 py-0.5 rounded font-black border text-[9px] ${tree.danosEstruturais ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{tree.danosEstruturais ? "Sim" : "Não"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>Presença de pragas/cupins:</span>
                                  <span className={`px-2 py-0.5 rounded font-black border text-[9px] ${tree.pragasCupins ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{tree.pragasCupins ? "Sim" : "Não"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>Tronco oco/podridão:</span>
                                  <span className={`px-2 py-0.5 rounded font-black border text-[9px] ${tree.troncoOco ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{tree.troncoOco ? "Sim" : "Não"}</span>
                                </div>
                                <div className="flex justify-between items-center sm:col-span-2 pt-1 border-t border-slate-100 mt-1">
                                  <span>Árvore morta / declínio severo:</span>
                                  <span className={`px-2 py-0.5 rounded font-black border text-[9px] ${tree.arvoreMorta ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{tree.arvoreMorta ? "Sim" : "Não"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Critérios Fitossanitários Detalhados */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-600">
                              <div className="space-y-1.5">
                                <span className="font-bold text-slate-400 block uppercase text-[9px] tracking-wider">Incompatibilidades</span>
                                {tree.incompatibilidadeCalcada && <div className="text-[10px] text-red-700 font-semibold">❌ Estragos na calçada</div>}
                                {tree.incompatibilidadeEsgotoAgua && <div className="text-[10px] text-red-700 font-semibold">❌ Rede de esgoto/água</div>}
                                {tree.incompatibilidadeDanosConstrucao && <div className="text-[10px] text-red-700 font-semibold">❌ Danos na construção</div>}
                                {tree.incompatibilidadePassagemPedestres && <div className="text-[10px] text-red-700 font-semibold">❌ Obstáculo a pedestres</div>}
                                {tree.incompatibilidadePorteEspecie && <div className="text-[10px] text-red-700 font-semibold">❌ Porte ou toxicidade inadequada</div>}
                                {!tree.incompatibilidadeCalcada && !tree.incompatibilidadeEsgotoAgua && !tree.incompatibilidadeDanosConstrucao && !tree.incompatibilidadePassagemPedestres && !tree.incompatibilidadePorteEspecie && <div className="text-[10px] text-slate-400 italic">Nenhuma incompatibilidade</div>}
                              </div>

                              <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                                <span className="font-bold text-slate-400 block uppercase text-[9px] tracking-wider">Estado Fitossanitário, Obras & Emergências</span>
                                {tree.fitossanitarioParasitas && <div className="text-[10px] text-amber-700 font-semibold">⚠️ Plantas parasitas</div>}
                                {tree.fitossanitarioApodrecimento && <div className="text-[10px] text-red-705 font-semibold">⚠️ Apodrecimento devido a doenças</div>}
                                {tree.fitossanitarioSenescente && <div className="text-[10px] text-amber-707 font-semibold">⚠️ Senescente / debilitada por podas</div>}
                                {tree.obrasImplantacao && <div className="text-[10px] text-slate-650 font-semibold">👷 Implantação de obras</div>}
                                {tree.obrasVeiculos && <div className="text-[10px] text-slate-650 font-semibold">🚗 Entrada/saída de veículos</div>}
                                {tree.emergenciaRiscoPop && <div className="text-[10px] text-red-800 font-black">🚨 Risco à vida/patrimônio</div>}
                                {tree.emergenciaGalhosCaindo && <div className="text-[10px] text-red-800 font-black">🚨 Galhos/árvores caindo</div>}
                                {!tree.fitossanitarioParasitas && !tree.fitossanitarioApodrecimento && !tree.fitossanitarioSenescente && !tree.obrasImplantacao && !tree.obrasVeiculos && !tree.emergenciaRiscoPop && !tree.emergenciaGalhosCaindo && <div className="text-[10px] text-slate-400 italic">Nenhum estado crítico ou emergência</div>}
                              </div>
                            </div>

                            {/* Especificações de Poda */}
                            {(tree.podaFormacaoConducao || tree.podaLimpeza || tree.podaAdequacao || tree.podaEmergencial || tree.podaLevantamentoCopa) && (
                              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                                <span className="font-bold text-slate-500 block uppercase text-[9px] text-emerald-800 tracking-wider">Especificações de Intervenção</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-600 font-semibold">
                                  {tree.podaFormacaoConducao && <div><strong>Formação/Condução:</strong> {tree.podaFormacaoConducao}</div>}
                                  {tree.podaLimpeza && <div><strong>Limpeza:</strong> {tree.podaLimpeza}</div>}
                                  {tree.podaAdequacao && <div><strong>Adequação:</strong> {tree.podaAdequacao}</div>}
                                  {tree.podaEmergencial && <div><strong>Emergencial:</strong> {tree.podaEmergencial}</div>}
                                  {tree.podaLevantamentoCopa && <div className="sm:col-span-2"><strong>Levantamento de Copa:</strong> {tree.podaLevantamentoCopa}</div>}
                                </div>
                              </div>
                            )}

                            {/* Parecer Específico */}
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                              <span className="font-bold text-slate-400 block uppercase text-[9px] mb-1">Parecer Individual da Árvore</span>
                              <p className="text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap">{tree.parecerTecnico || "Sem parecer específico."}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
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

                      {/* Especificações dos Tipos de Poda */}
                      {(solicitacao.laudoTecnico.podaFormacaoConducao || 
                        solicitacao.laudoTecnico.podaLimpeza || 
                        solicitacao.laudoTecnico.podaAdequacao || 
                        solicitacao.laudoTecnico.podaEmergencial || 
                        solicitacao.laudoTecnico.podaLevantamentoCopa) && (
                        <div className="space-y-3 pb-6 border-b border-slate-100 font-sans">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Especificações dos Tipos de Poda</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {solicitacao.laudoTecnico.podaFormacaoConducao && (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="font-semibold text-slate-500">Formação / Condução:</span>
                                <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.podaFormacaoConducao}</span>
                              </div>
                            )}
                            {solicitacao.laudoTecnico.podaLimpeza && (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="font-semibold text-slate-500">Limpeza:</span>
                                <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.podaLimpeza}</span>
                              </div>
                            )}
                            {solicitacao.laudoTecnico.podaAdequacao && (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="font-semibold text-slate-500">Adequação:</span>
                                <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.podaAdequacao}</span>
                              </div>
                            )}
                            {solicitacao.laudoTecnico.podaEmergencial && (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="font-semibold text-slate-500">Emergencial:</span>
                                <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.podaEmergencial}</span>
                              </div>
                            )}
                            {solicitacao.laudoTecnico.podaLevantamentoCopa && (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center col-span-1 sm:col-span-2">
                                <span className="font-semibold text-slate-500">Levantamento de Copa:</span>
                                <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.podaLevantamentoCopa}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

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

                      {/* Critérios Paisagísticos, Ecológicos, Fitossanitários e de Risco Detalhados */}
                      <div className="space-y-3 pb-6 border-b border-slate-100 font-sans">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critérios e Pareceres de Risco Detalhados</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-600">
                          {/* Incompatibilidade */}
                          <div className="space-y-2">
                            <span className="font-bold text-slate-500 block uppercase text-[10px]">1 - Incompatibilidades</span>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span>Calçada com estragos irreparáveis:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.incompatibilidadeCalcada ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.incompatibilidadeCalcada ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Rede de esgoto e/ou água afetada:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.incompatibilidadeEsgotoAgua ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.incompatibilidadeEsgotoAgua ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Danos na estrutura da construção:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.incompatibilidadeDanosConstrucao ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.incompatibilidadeDanosConstrucao ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Restrição na passagem de pedestres:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.incompatibilidadePassagemPedestres ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.incompatibilidadePassagemPedestres ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Porte/espécie inadequado ou tóxico:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.incompatibilidadePorteEspecie ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.incompatibilidadePorteEspecie ? "Sim" : "Não"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Estado Fitossanitário */}
                          <div className="space-y-2">
                            <span className="font-bold text-slate-500 block uppercase text-[10px]">2 - Estado Fitossanitário</span>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span>Pragas irremediáveis:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.pragasCupins ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.pragasCupins ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Atacada por plantas parasitas:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.fitossanitarioParasitas ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.fitossanitarioParasitas ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Apodrecimento devido a doenças:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.fitossanitarioApodrecimento ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.fitossanitarioApodrecimento ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Debilitada por podas/senescente:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.fitossanitarioSenescente ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.fitossanitarioSenescente ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Árvore morta:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.arvoreMorta ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.arvoreMorta ? "Sim" : "Não"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Obras */}
                          <div className="space-y-2">
                            <span className="font-bold text-slate-500 block uppercase text-[10px]">3 - Obras</span>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span>Implantação de obras/projetos:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.obrasImplantacao ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.obrasImplantacao ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Entrada e saída de veículos:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.obrasVeiculos ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.obrasVeiculos ? "Sim" : "Não"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Emergência */}
                          <div className="space-y-2">
                            <span className="font-bold text-slate-500 block uppercase text-[10px]">4 - Emergência</span>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span>Risco iminente à população/patrimônio:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.emergenciaRiscoPop ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.emergenciaRiscoPop ? "Sim" : "Não"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Galhos ou árvores caindo/caída:</span>
                                <span className={`font-bold ${solicitacao.laudoTecnico.emergenciaGalhosCaindo ? "text-red-700" : "text-slate-400"}`}>{solicitacao.laudoTecnico.emergenciaGalhosCaindo ? "Sim" : "Não"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Plano de Substituição / Plantio */}
                  {(solicitacao.laudoTecnico.supressaoQtdSubstituicao > 0 || 
                    solicitacao.laudoTecnico.substituicaoQtd > 0 || 
                    solicitacao.laudoTecnico.substituicaoPorte) && (
                    <div className="space-y-3 pb-6 border-b border-slate-100 font-sans">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plano de Substituição / Plantio</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Qtd. Árvores Suprimidas</span>
                          <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.supressaoQtdSubstituicao || 0}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Qtd. Mudas para Substituição</span>
                          <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.substituicaoQtd || 0}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Porte Recomendado</span>
                          <span className="text-slate-800 font-bold text-xs">{solicitacao.laudoTecnico.substituicaoPorte || "Não especificado"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Outras Observações de Campo */}
                  <div className="space-y-3 pb-6 border-b border-slate-100 font-sans">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outras Observações de Campo</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      {solicitacao.laudoTecnico.obsArvoreVizinho && <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">🌳 Árvore de vizinho</span>}
                      {solicitacao.laudoTecnico.obsArvoreDivisa && <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">🌳 Árvore na divisa</span>}
                      {solicitacao.laudoTecnico.obsAbelhasComFerrao && <span className="px-2.5 py-1 rounded bg-red-50 text-red-750 font-semibold border border-red-200">🐝 Abelhas com ferrão</span>}
                      {solicitacao.laudoTecnico.obsAbelhasSemFerrao && <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">🐝 Abelhas sem ferrão</span>}
                      {solicitacao.laudoTecnico.obsNinhoAguardar && <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">🪺 Ninho (aguardar desocupação)</span>}
                      {solicitacao.laudoTecnico.obsAumentarRecorteCalcada && <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">📐 Aumentar recorte da calçada</span>}
                      {solicitacao.laudoTecnico.obsEnderecoIncompleto && <span className="px-2.5 py-1 rounded bg-orange-50 text-orange-700 font-semibold border border-orange-200">📍 Endereço incompleto</span>}
                      {solicitacao.laudoTecnico.obsEnderecoErrado && <span className="px-2.5 py-1 rounded bg-orange-50 text-orange-700 font-semibold border border-orange-200">📍 Endereço errado</span>}
                      {solicitacao.laudoTecnico.obsEnderecoNaoEncontrado && <span className="px-2.5 py-1 rounded bg-orange-50 text-orange-700 font-semibold border border-orange-200">📍 Endereço não encontrado</span>}
                      {solicitacao.laudoTecnico.obsPodaDrastica && (
                         <span className="px-2.5 py-1 rounded bg-red-50 text-red-755 font-semibold border border-red-200">
                           ⚠️ Poda drástica de árvores
                           {solicitacao.laudoTecnico.podaDrasticaQtd ? ` (Qtd: ${solicitacao.laudoTecnico.podaDrasticaQtd})` : ""}
                         </span>
                       )}
                      {solicitacao.laudoTecnico.obsAguardarFlorescimento && <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">🌸 Aguardar floração</span>}
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
                      <div className="space-y-1.5 font-sans">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Compensação Ambiental Recomendada</span>
                        <div className="bg-emerald-50/30 p-4 rounded-xl text-emerald-800 border border-emerald-100 text-xs font-bold leading-relaxed">
                          🌱 {solicitacao.laudoTecnico.compensacaoAmbiental}
                        </div>
                      </div>
                    )}

                    {solicitacao.laudoTecnico.materialComplementarAnexo !== undefined && (
                      <div className="space-y-1.5 font-sans">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Material Complementar Anexo?</span>
                        <span className="text-slate-800 font-semibold text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded inline-block">
                          {solicitacao.laudoTecnico.materialComplementarAnexo ? "Sim" : "Não"}
                        </span>
                      </div>
                    )}

                    {(solicitacao.laudoTecnico.observacoesGerais || solicitacao.laudoTecnico.anotacoesCampo) && (
                      <div className="space-y-1.5 font-sans">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {solicitacao.laudoTecnico.formType === "privado" ? "Anotações de Campo" : "Observações Gerais do Laudo"}
                        </span>
                        <div className="bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-100 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                          {solicitacao.laudoTecnico.formType === "privado" ? solicitacao.laudoTecnico.anotacoesCampo : solicitacao.laudoTecnico.observacoesGerais}
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

                {solicitacao.status !== "Aguardando Validação" && !solicitacao.laudoTecnico && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-900 text-xs">
                    <Info className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-amber-955">Aprovação Bloqueada (Requer Laudo Técnico)</h4>
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

        {/* TAB: Validar Poda */}
        {activeTab === "validacao" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-4xl mx-auto overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 bg-emerald-50/40 flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-700" />
              <h3 className="font-extrabold text-emerald-800 text-md">
                Validação de Poda (Foto pós-poda)
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {(() => {
                const fotosComprovacao = solicitacao.fotos?.filter((f: any) => typeof f === "object" && f !== null && f.autor === "usuario_corte") || [];
                if (fotosComprovacao.length === 0) {
                  return (
                    <div className="text-center py-12 flex flex-col items-center justify-center">
                      <div className="text-4xl mb-3">🕒</div>
                      <h4 className="text-base font-extrabold text-slate-800">Aguardando Fotos de Comprovação</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                        O cidadão ainda não anexou as fotos pós-poda para comprovação da execução do serviço.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3 pb-6 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fotos pós-poda enviadas pelo Cidadão</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {fotosComprovacao.map((fotoItem: any, idx: number) => {
                        const secureUrl = getSecureUrl(fotoItem.url);
                        return (
                          <div key={idx} className="relative group border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 flex flex-col justify-between shadow-sm">
                            <div 
                              onClick={() => setSelectedImage(secureUrl)}
                              className="cursor-pointer relative aspect-square overflow-hidden bg-slate-200 flex items-center justify-center border-b border-slate-200/50"
                            >
                              <img 
                                src={secureUrl} 
                                alt={`Foto Comprovação ${idx}`} 
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
                              <span>Foto pós-corte #{idx + 1}</span>
                              {fotoItem.data && <span>{fotoItem.data}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleValidadePoda} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Decisão de Homologação</label>
                  <select 
                    value={statusVal}
                    onChange={(e) => setStatusVal(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-700 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-semibold"
                  >
                    <option value="">-- Selecione a Ação --</option>
                    <option value="Concluído">Homologar Execução (Concluir Chamado)</option>
                    <option value="Aprovado">Reprovar Poda (Solicitar Correção / Rejeitar Foto)</option>
                  </select>
                </div>

                {statusVal === "Concluído" && (
                  <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl flex items-start gap-3 mt-4 animate-fadeIn">
                    <input 
                      type="checkbox" 
                      id="check-conceder-certificado" 
                      checked={concederCertificado} 
                      onChange={e => setConcederCertificado(e.target.checked)} 
                      className="mt-1 w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500/20 cursor-pointer shrink-0" 
                    />
                    <label htmlFor="check-conceder-certificado" className="text-xs sm:text-sm text-emerald-955 font-bold cursor-pointer select-none leading-relaxed">
                      Conceder Certificado de Agradecimento Ambiental ao Cidadão
                      <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                        Selecione se a poda foi realizada em conformidade com as orientações ambientais, permitindo ao cidadão acessar seu Selo Verde.
                      </span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Descrição dos Erros Cometidos / Observação Técnica</label>
                  <textarea 
                    rows={4}
                    value={observacaoVal}
                    onChange={(e) => setObservacaoVal(e.target.value)}
                    placeholder="Se a poda for reprovada, descreva detalhadamente os erros cometidos para notificar o cidadão..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm leading-relaxed"
                  ></textarea>
                </div>

                {/* Caixa de Aviso de Multa e Chat */}
                <div className="bg-red-50/80 border border-red-200 p-4 rounded-xl flex gap-3 text-red-900 text-xs">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-650 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="font-extrabold text-red-955">Aviso Importante e Penalidades</h4>
                    <p className="mt-1 leading-relaxed font-semibold">
                      O cidadão será notificado sobre essa decisão de homologação. Ao reprovar a poda, o sistema sempre incluirá um aviso formal de que a execução incorreta ou em desconformidade pode resultar em **multas por infração ambiental** municipal. Também orientará o cidadão a entrar em contato pelo **chat de suporte** para sanar dúvidas.
                    </p>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isUpdating || !statusVal}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isUpdating ? "Enviando..." : "Enviar Decisão de Homologação"}
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
