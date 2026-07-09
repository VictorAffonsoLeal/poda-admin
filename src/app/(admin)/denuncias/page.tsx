"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { 
  Search, 
  Eye, 
  AlertTriangle, 
  X, 
  ExternalLink, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  HardHat, 
  FileText, 
  CheckCircle,
  Download,
  AlertCircle,
  ShieldAlert
} from "lucide-react";

export default function DenunciasAdminPage() {
  const { showToast } = useToast();
  
  const [denuncias, setDenuncias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterType, setFilterType] = useState("todos");
  const [filterPrivacy, setFilterPrivacy] = useState("todos");

  // State for detail drawer
  const [selectedDenuncia, setSelectedDenuncia] = useState<any | null>(null);
  const [denunciante, setDenunciante] = useState<any | null>(null);
  const [loadingDenunciante, setLoadingDenunciante] = useState(false);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState("");
  const [novoStatus, setNovoStatus] = useState("");
  const [observacaoAdmin, setObservacaoAdmin] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Image Lightbox
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Load complaints (denúncias)
  useEffect(() => {
    const q = query(
      collection(db, "solicitacoes"),
      where("isDenuncia", "==", true)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const arr: any[] = [];
      querySnapshot.forEach((doc) => {
        arr.push({ id: doc.id, ...doc.data() });
      });

      const getMillis = (dateObj: any) => {
        if (!dateObj) return 0;
        if (typeof dateObj.toMillis === "function") return dateObj.toMillis();
        if (typeof dateObj.toDate === "function") return dateObj.toDate().getTime();
        if (dateObj instanceof Date) return dateObj.getTime();
        if (typeof dateObj === "string") return new Date(dateObj).getTime();
        if (typeof dateObj === "number") return dateObj;
        return 0;
      };

      // Sort in-memory desc
      arr.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

      setDenuncias(arr);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar denúncias: ", error);
      setLoading(false);
      showToast("Erro ao carregar denúncias em tempo real.", "erro");
    });

    return () => unsubscribe();
  }, [showToast]);

  // Load technicians list
  useEffect(() => {
    const fetchTecnicos = async () => {
      try {
        const snap = await getDocs(query(collection(db, "tecnicos")));
        const arr: any[] = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setTecnicos(arr);
      } catch (err) {
        console.error("Erro ao buscar técnicos:", err);
      }
    };
    fetchTecnicos();
  }, []);

  // Fetch citizen details if complaint is not anonymous
  useEffect(() => {
    if (!selectedDenuncia) {
      setDenunciante(null);
      return;
    }

    if (selectedDenuncia.anonima) {
      setDenunciante(null);
      return;
    }

    const fetchDenunciante = async () => {
      setLoadingDenunciante(true);
      try {
        const docRef = doc(db, "usuarios", selectedDenuncia.userId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setDenunciante(snap.data());
        }
      } catch (err) {
        console.error("Erro ao buscar dados do denunciante:", err);
      } finally {
        setLoadingDenunciante(false);
      }
    };
    fetchDenunciante();

    // Reset action fields
    setSelectedTecnico(selectedDenuncia.tecnicoId || "");
    setNovoStatus(selectedDenuncia.status || "");
    setObservacaoAdmin("");
  }, [selectedDenuncia]);

  // Filter complaints
  const filteredDenuncias = useMemo(() => {
    return denuncias.filter(d => {
      // 1. Text Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const addressMatch = (d.address || "").toLowerCase().includes(term);
        const idMatch = (d.id || "").toLowerCase().includes(term);
        const typeMatch = (d.type || "").toLowerCase().includes(term);
        if (!addressMatch && !idMatch && !typeMatch) return false;
      }

      // 2. Status Filter
      if (filterStatus !== "todos" && d.status !== filterStatus) return false;

      // 3. Privacy Filter
      if (filterPrivacy !== "todos") {
        if (filterPrivacy === "anonima" && !d.anonima) return false;
        if (filterPrivacy === "identificada" && d.anonima) return false;
      }

      // 4. Type Filter
      if (filterType !== "todos") {
        const typeNormalized = (d.type || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (filterType === "poda" && !typeNormalized.includes("poda")) return false;
        if (filterType === "supressao" && !typeNormalized.includes("supressao") && !typeNormalized.includes("corte")) return false;
        if (filterType === "risco" && !typeNormalized.includes("risco") && !typeNormalized.includes("queda")) return false;
      }

      return true;
    });
  }, [denuncias, searchTerm, filterStatus, filterType, filterPrivacy]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = denuncias.length;
    let pendentes = 0;
    let emAnalise = 0;
    let autuados = 0;
    let arquivadas = 0;

    denuncias.forEach(d => {
      if (d.status === "Criado") pendentes++;
      if (d.status === "Em Análise") emAnalise++;
      if (d.status === "Constatada / Autuado" || d.status === "Aprovado") autuados++;
      if (d.status === "Arquivada" || d.status === "Recusado") arquivadas++;
    });

    return { total, pendentes, emAnalise, autuados, arquivadas };
  }, [denuncias]);

  const handleAssignTecnico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDenuncia) return;
    if (!selectedTecnico) {
      showToast("Selecione um técnico para designar.", "alerta");
      return;
    }

    setIsUpdating(true);
    try {
      const docRef = doc(db, "solicitacoes", selectedDenuncia.id);
      const tecnicoObj = tecnicos.find(t => t.id === selectedTecnico);
      if (!tecnicoObj) return;

      const payload: any = {
        tecnicoId: tecnicoObj.id,
        tecnicoNome: tecnicoObj.nome,
        status: "Em Análise"
      };

      const historicoEntry = {
        data: new Date().toLocaleDateString('pt-BR'),
        status: "Em Análise",
        descricao: `Vistoriador designado para investigar infração: ${tecnicoObj.nome}. Status alterado para Em Análise.`
      };

      payload.historico = arrayUnion(historicoEntry);
      await updateDoc(docRef, payload);
      
      showToast(`Técnico ${tecnicoObj.nome} designado para investigar a denúncia!`, "sucesso");
      
      // Update local drawer state
      setSelectedDenuncia((prev: any) => ({
        ...prev,
        status: "Em Análise",
        tecnicoId: tecnicoObj.id,
        tecnicoNome: tecnicoObj.nome,
        historico: [historicoEntry, ...(prev.historico || [])]
      }));

    } catch (err) {
      console.error(err);
      showToast("Erro ao designar técnico para vistoria.", "erro");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDenuncia) return;
    if (!novoStatus) {
      showToast("Selecione um status.", "alerta");
      return;
    }

    setIsUpdating(true);
    try {
      const docRef = doc(db, "solicitacoes", selectedDenuncia.id);
      const payload: any = { status: novoStatus };
      
      const historicoEntry = {
        data: new Date().toLocaleDateString('pt-BR'),
        status: novoStatus,
        descricao: observacaoAdmin ? `Ocorrência fiscalizada. Obs Administrativa: ${observacaoAdmin}` : `Status da denúncia alterado para ${novoStatus}.`
      };

      payload.historico = arrayUnion(historicoEntry);
      await updateDoc(docRef, payload);

      showToast("Status da denúncia atualizado com sucesso!", "sucesso");
      setObservacaoAdmin("");

      // Update local state
      setSelectedDenuncia((prev: any) => ({
        ...prev,
        status: novoStatus,
        historico: [historicoEntry, ...(prev.historico || [])]
      }));
    } catch (err) {
      console.error(err);
      showToast("Erro ao atualizar status do chamado.", "erro");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Criado": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Em Análise": return "bg-orange-50 text-orange-700 border-orange-200";
      case "Constatada / Autuado":
      case "Aprovado": 
        return "bg-red-50 text-red-700 border-red-200";
      case "Arquivada":
      case "Recusado": 
        return "bg-slate-50 text-slate-650 border-slate-200";
      case "Concluído": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Protocolo",
      "Data Criacao",
      "Tipo de Infracao",
      "Status",
      "Endereco",
      "CEP",
      "Sigilo",
      "Tecnico Designado"
    ];

    const rows = filteredDenuncias.map((d) => {
      const date = d.createdAt?.toDate()?.toLocaleDateString("pt-BR") || "N/A";
      const privacy = d.anonima ? "Anônima" : "Identificada";
      
      return [
        `#${d.id}`,
        date,
        d.type || "N/A",
        d.status || "N/A",
        `"${(d.address || "").replace(/"/g, '""')}"`,
        d.cep || "N/A",
        privacy,
        d.tecnicoNome || "Não designado"
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `denuncias_ambientais_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-red-650" />
            Denúncias Ambientais
          </h1>
          <p className="text-slate-500 mt-1">Gerenciamento e ouvidoria de queixas de podas irregulares e infrações ambientais.</p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredDenuncias.length === 0}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm cursor-pointer transition-all shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Dados (CSV)</span>
        </button>
      </div>

      {/* Stats Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Relatado</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{stats.total}</p>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl text-slate-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aguardando Triagem</p>
            <p className="text-2xl font-extrabold text-blue-700 mt-1">{stats.pendentes}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Em Fiscalização</p>
            <p className="text-2xl font-extrabold text-orange-700 mt-1">{stats.emAnalise}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Infrações Autuadas</p>
            <p className="text-2xl font-extrabold text-red-700 mt-1">{stats.autuados}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-xl text-red-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arquivadas / Improcedentes</p>
            <p className="text-2xl font-extrabold text-slate-650 mt-1">{stats.arquivadas}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl text-slate-500">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Table & Filtering */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4.5 h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar endereço, protocolo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-350 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-350 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
              >
                <option value="todos">Todos os Status</option>
                <option value="Criado">Criado (Novo)</option>
                <option value="Em Análise">Em Vistoria</option>
                <option value="Constatada / Autuado">Constatada / Autuada</option>
                <option value="Arquivada">Arquivada</option>
                <option value="Concluído">Concluída</option>
              </select>
            </div>

            <div>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-350 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
              >
                <option value="todos">Tipo de Infração</option>
                <option value="poda">Poda Irregular</option>
                <option value="supressao">Supressão Ilegal</option>
                <option value="risco">Risco de Queda</option>
              </select>
            </div>

            <div>
              <select
                value={filterPrivacy}
                onChange={e => setFilterPrivacy(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-350 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
              >
                <option value="todos">Privacidade</option>
                <option value="anonima">Anônimas</option>
                <option value="identificada">Identificadas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-55 border-b border-slate-200 text-xs font-extrabold uppercase text-slate-450 tracking-wider">
              <tr>
                <th className="px-6 py-4">Protocolo / Data</th>
                <th className="px-6 py-4">Tipo de Infração</th>
                <th className="px-6 py-4">Localização da Irregularidade</th>
                <th className="px-6 py-4">Sigilo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-semibold animate-pulse">Carregando denúncias ambientais...</td>
                </tr>
              ) : filteredDenuncias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhuma denúncia registrada nos parâmetros selecionados.</td>
                </tr>
              ) : (
                filteredDenuncias.map((d) => {
                  const date = d.createdAt?.toDate()?.toLocaleDateString("pt-BR") || "N/A";
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-xs">#{/^\d{14}$/.test(d.id) ? d.id : d.id.substring(0, 8)}</div>
                        <div className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-350" /> {date}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-700 text-xs bg-rose-50 border border-rose-150 px-2 py-0.5 rounded inline-block">
                          {d.type?.replace("Denúncia: ", "") || "Denúncia"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-800 truncate max-w-xs">{d.address}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-semibold">CEP: {d.cep}</div>
                      </td>
                      <td className="px-6 py-4">
                        {d.anonima ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-150 rounded-full px-2 py-0.5" title="Os dados de contato do cidadão estão protegidos por lei.">
                            🤫 Anônima
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-150 rounded-full px-2 py-0.5">
                            👤 Identificada
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${getStatusColor(d.status)}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedDenuncia(d)}
                          className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1 font-bold text-xs cursor-pointer shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Analisar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* detail sliding panel (drawer) */}
      {selectedDenuncia && (
        <div className="fixed inset-0 z-40 flex justify-end">
          
          {/* Back shadow overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 cursor-pointer"
            onClick={() => setSelectedDenuncia(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl z-50 flex flex-col justify-between animate-slideRight">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-wider">
                    Fiscalização de Denúncia
                  </span>
                  <span className="text-xs font-extrabold text-slate-450">Protocolo #{/^\d{14}$/.test(selectedDenuncia.id) ? selectedDenuncia.id : selectedDenuncia.id.substring(0, 8)}</span>
                </div>
                <h2 className="text-md sm:text-lg font-black text-slate-800 mt-1">{selectedDenuncia.type}</h2>
              </div>

              <button
                onClick={() => setSelectedDenuncia(null)}
                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-450 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Status Badge alert */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 text-slate-700 text-xs font-bold">
                  <Clock className="w-4.5 h-4.5 text-slate-400" />
                  <span>Status do Processo:</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${getStatusColor(selectedDenuncia.status)}`}>
                  {selectedDenuncia.status}
                </span>
              </div>

              {/* Citizen reporting info */}
              <section className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <User className="w-4 h-4 text-slate-400" />
                  Privacidade do Denunciante
                </h3>

                {selectedDenuncia.anonima ? (
                  <div className="flex items-start gap-3 bg-purple-50/50 border border-purple-150 p-4 rounded-xl">
                    <span className="text-xl">🤫</span>
                    <div className="text-xs font-medium text-purple-900 leading-relaxed">
                      <h4 className="font-extrabold">Denúncia Anônima (Sigilo Preservado)</h4>
                      <p className="mt-1 text-[11px] text-purple-750">O cidadão escolheu permanecer anônimo. O painel ocultou CPF, e-mail e dados de contato de forma a proteger o denunciante contra possíveis represálias.</p>
                    </div>
                  </div>
                ) : loadingDenunciante ? (
                  <p className="text-xs text-slate-400 animate-pulse font-semibold">Carregando dados cadastrais...</p>
                ) : denunciante ? (
                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Nome do Denunciante</span>
                      <span className="text-slate-800 font-bold">{denunciante.nome || "Não informado"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">CPF</span>
                      <span className="text-slate-800">{denunciante.cpf || "Não informado"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">E-mail de Contato</span>
                      <span className="text-slate-800 break-all">{denunciante.email || "Não informado"}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Dados cadastrais do denunciante indisponíveis.</p>
                )}
              </section>

              {/* Occurrence Location */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Local da Ocorrência
                </h3>
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-xs font-semibold text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Endereço</span>
                    <span className="text-slate-800 font-bold">{selectedDenuncia.address}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">CEP</span>
                    <span className="text-slate-800">{selectedDenuncia.cep}</span>
                  </div>
                  {selectedDenuncia.referencia && (
                    <div className="sm:col-span-2">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Ponto de Referência</span>
                      <p className="text-slate-700 italic">"{selectedDenuncia.referencia}"</p>
                    </div>
                  )}
                </div>

                {selectedDenuncia.geolocalizacao && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                      <div className="text-[10px] font-semibold text-blue-900 leading-tight">
                        <p className="font-extrabold text-blue-950">GPS Capturado do Dispositivo</p>
                        <p className="text-[9px] text-blue-600 mt-0.5">Lat: {selectedDenuncia.geolocalizacao.lat.toFixed(5)} | Lng: {selectedDenuncia.geolocalizacao.lng.toFixed(5)}</p>
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${selectedDenuncia.geolocalizacao.lat},${selectedDenuncia.geolocalizacao.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-750 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 shadow-sm shrink-0"
                    >
                      <span>Maps</span> <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </section>

              {/* Description */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Descrição do Relato
                </h3>
                <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-2xl text-slate-700 italic text-sm leading-relaxed font-medium">
                  "{selectedDenuncia.descricao || "Sem observações detalhadas adicionais."}"
                </div>
              </section>

              {/* Evidence Photos */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                  <span>📸</span>
                  <span>Fotos de Evidência ({selectedDenuncia.fotos ? selectedDenuncia.fotos.length : 0})</span>
                </h3>
                {selectedDenuncia.fotos && selectedDenuncia.fotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedDenuncia.fotos.map((urlStr: string, index: number) => {
                      const secureUrl = urlStr.startsWith("http://") ? urlStr.replace("http://", "https://") : urlStr;
                      return (
                        <div 
                          key={index}
                          onClick={() => setSelectedImage(secureUrl)}
                          className="aspect-square border border-slate-200 rounded-xl overflow-hidden relative cursor-pointer group bg-slate-50"
                        >
                          <img 
                            src={secureUrl} 
                            alt={`Evidência ${index}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://placehold.co/300x300?text=Imagem+Indispon%C3%ADvel";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center text-white text-[10px] font-bold">
                            <span>Ampliar</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhuma imagem anexada a esta denúncia.</p>
                )}
              </section>

              {/* Assigned Technician if any */}
              {selectedDenuncia.tecnicoNome && (
                <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <HardHat className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Investigação a cargo do vistoriador: <strong className="text-emerald-950">{selectedDenuncia.tecnicoNome}</strong></span>
                </div>
              )}

              {/* Administrative Actions */}
              <section className="border-t border-slate-100 pt-6 space-y-6">
                <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                  Ações Administrativas e de Fiscalização
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Action 1: Assign Technician */}
                  <form onSubmit={handleAssignTecnico} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Designar Técnico Vistoriador</label>
                    <select
                      value={selectedTecnico}
                      onChange={e => setSelectedTecnico(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Selecionar Vistoriador...</option>
                      {tecnicos.map(t => (
                        <option key={t.id} value={t.id}>{t.nome} ({t.registro || "CREA-SP"})</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={isUpdating || selectedTecnico === (selectedDenuncia.tecnicoId || "")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                    >
                      Designar para Vistoria
                    </button>
                  </form>

                  {/* Action 2: Change Status */}
                  <form onSubmit={handleUpdateStatus} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">Alterar Status do Chamado</label>
                    <select
                      value={novoStatus}
                      onChange={e => setNovoStatus(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Criado">Criado (Aguardando)</option>
                      <option value="Em Análise">Em Vistoria / Análise</option>
                      <option value="Constatada / Autuado">Constatada / Autuado</option>
                      <option value="Arquivada">Arquivada / Improcedente</option>
                      <option value="Concluído">Concluída / Regularizada</option>
                    </select>
                    
                    <input 
                      type="text"
                      placeholder="Observação da Ouvidoria..."
                      value={observacaoAdmin}
                      onChange={e => setObservacaoAdmin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-emerald-500"
                    />

                    <button
                      type="submit"
                      disabled={isUpdating || (novoStatus === selectedDenuncia.status && !observacaoAdmin)}
                      className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                    >
                      Atualizar Status
                    </button>
                  </form>
                </div>
              </section>

              {/* Timeline History */}
              <section className="border-t border-slate-100 pt-6 space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Histórico de Trâmite
                </h3>

                <div className="relative pl-6 border-l-2 border-slate-200/80 space-y-5 py-2">
                  {selectedDenuncia.historico?.map((h: any, idx: number) => (
                    <div key={idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[30px] top-1 w-3.5 h-3.5 rounded-full bg-slate-300 border-2 border-white shadow-sm flex items-center justify-center" />
                      <div className="text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h.data}</span>
                        <h4 className="font-bold text-slate-800 mt-0.5">{h.status}</h4>
                        <p className="text-slate-500 mt-1 leading-relaxed">{h.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedDenuncia(null)}
                className="px-4 py-2 border border-slate-350 hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
              >
                Fechar Painel
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Image Lightbox Popover */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-950/95 z-55 flex flex-col items-center justify-center p-4 animate-fadeIn">
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
            <span className="text-white text-xs font-bold bg-slate-900/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
              Visualização de Evidência
            </span>
            <button 
              onClick={() => setSelectedImage(null)} 
              className="text-white bg-slate-900/60 hover:bg-slate-900/85 p-2.5 rounded-full backdrop-blur-sm transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="max-w-full max-h-[85vh] flex items-center justify-center">
            <img 
              src={selectedImage} 
              alt="Evidência ampliada" 
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://placehold.co/600x600?text=Erro+Imagem";
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
