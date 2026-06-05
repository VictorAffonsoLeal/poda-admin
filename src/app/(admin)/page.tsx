"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Download, 
  Calendar, 
  Search, 
  Filter, 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  MapPin, 
  ArrowRight,
  TrendingDown
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("tudo"); // 7d, 30d, mes, tudo, personalizado
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterRisco, setFilterRisco] = useState("todos");

  // Interatividade nos gráficos
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [hoveredStatus, setHoveredStatus] = useState<any>(null);

  // Buscar todos os dados
  useEffect(() => {
    const fetchSolicitacoes = async () => {
      try {
        const q = query(collection(db, "solicitacoes"));
        const snapshot = await getDocs(q);
        const data: any[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setSolicitacoes(data);
      } catch (error) {
        console.error("Erro ao buscar solicitações no dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSolicitacoes();
  }, []);

  // Helper para converter datas do Firebase ou strings
  const parseDate = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val.toDate === "function") {
      return val.toDate();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // Extrair o bairro a partir do endereço formatado (padrão brasileiro)
  const getBairro = (address: string) => {
    if (!address) return "Não informado";
    const parts = address.split("-");
    if (parts.length > 1) {
      const bairroCity = parts[1].split(",");
      if (bairroCity.length > 0) {
        return bairroCity[0].trim();
      }
    }
    return "Centro";
  };

  // Filtragem dos dados em memória
  const filteredData = useMemo(() => {
    return solicitacoes.filter((item) => {
      // 1. Filtro de Busca (protocolo, tipo ou endereço)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const addressMatch = (item.address || "").toLowerCase().includes(term);
        const idMatch = (item.id || "").toLowerCase().includes(term);
        const typeMatch = (item.type || "").toLowerCase().includes(term);
        if (!addressMatch && !idMatch && !typeMatch) return false;
      }

      // 2. Filtro de Status
      if (filterStatus !== "todos" && item.status !== filterStatus) return false;

      // 3. Filtro de Risco
      const temRisco = item.risco && item.risco !== "Nenhum risco aparente";
      if (filterRisco === "com_risco" && !temRisco) return false;
      if (filterRisco === "sem_risco" && temRisco) return false;

      // 4. Filtro de Data
      const itemDate = parseDate(item.createdAt);
      if (!itemDate) return true; // Mantém caso não tenha data para evitar perda

      const now = new Date();
      if (filterPeriod === "7d") {
        const limit = new Date();
        limit.setDate(now.getDate() - 7);
        if (itemDate < limit) return false;
      } else if (filterPeriod === "30d") {
        const limit = new Date();
        limit.setDate(now.getDate() - 30);
        if (itemDate < limit) return false;
      } else if (filterPeriod === "mes") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (itemDate < startOfMonth) return false;
      } else if (filterPeriod === "personalizado") {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) return false;
        }
      }

      return true;
    });
  }, [solicitacoes, searchTerm, filterStatus, filterRisco, filterPeriod, startDate, endDate]);

  // Cálculos de Estatísticas (Cards)
  const stats = useMemo(() => {
    const total = filteredData.length;
    let aguardando = 0;
    let concluido = 0;
    let recusado = 0;
    let riscoCritico = 0;

    filteredData.forEach((item) => {
      if (item.status === "Criado" || item.status === "Em Análise") {
        aguardando++;
      }
      if (item.status === "Concluído") {
        concluido++;
      }
      if (item.status === "Recusado") {
        recusado++;
      }
      
      const temRisco = item.risco && item.risco !== "Nenhum risco aparente";
      if (temRisco && item.status !== "Concluído" && item.status !== "Recusado") {
        riscoCritico++;
      }
    });

    const taxaExecucao = total > 0 ? Math.round((concluido / total) * 100) : 0;
    const taxaRecusa = total > 0 ? Math.round((recusado / total) * 100) : 0;

    return {
      total,
      aguardando,
      concluido,
      riscoCritico,
      taxaExecucao,
      taxaRecusa
    };
  }, [filteredData]);

  // Preparar dados para o Gráfico Temporal (Evolução de Solicitações)
  const temporalChartData = useMemo(() => {
    const groups: { [key: string]: number } = {};
    const now = new Date();
    const dateList: string[] = [];

    // Preencher as datas conforme o filtro selecionado para evitar buracos com 0
    if (filterPeriod === "7d") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        groups[key] = 0;
        dateList.push(key);
      }
    } else if (filterPeriod === "30d") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        groups[key] = 0;
        dateList.push(key);
      }
    } else if (filterPeriod === "mes") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const temp = new Date(startOfMonth);
      while (temp <= now) {
        const key = temp.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        groups[key] = 0;
        dateList.push(key);
        temp.setDate(temp.getDate() + 1);
      }
    }

    filteredData.forEach((item) => {
      const d = parseDate(item.createdAt);
      if (!d) return;
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      
      if (groups[key] !== undefined) {
        groups[key]++;
      } else if (filterPeriod === "tudo" || filterPeriod === "personalizado") {
        groups[key] = (groups[key] || 0) + 1;
      }
    });

    let labels = Object.keys(groups);
    if (filterPeriod === "tudo" || filterPeriod === "personalizado") {
      labels.sort((a, b) => {
        const [da, ma] = a.split("/").map(Number);
        const [db, mb] = b.split("/").map(Number);
        return ma - mb || da - db;
      });
    } else {
      labels = dateList;
    }

    const values = labels.map((l) => groups[l] || 0);

    return { labels, values };
  }, [filteredData, filterPeriod]);

  // Preparar dados para o Gráfico de Rosca (Doughnut) de Status
  const doughnutChartData = useMemo(() => {
    const counts = {
      Criado: 0,
      "Em Análise": 0,
      Aprovado: 0,
      Recusado: 0,
      Concluído: 0,
    };

    filteredData.forEach((item) => {
      const s = item.status;
      if (counts[s as keyof typeof counts] !== undefined) {
        counts[s as keyof typeof counts]++;
      }
    });

    const statusColors = {
      Criado: "#64748b",      // slate-500
      "Em Análise": "#f97316", // orange-500
      Aprovado: "#10b981",     // emerald-500
      Recusado: "#ef4444",     // red-500
      Concluído: "#3b82f6",    // blue-500
    };

    const statusLabels = {
      Criado: "Aguardando",
      "Em Análise": "Em Vistoria",
      Aprovado: "Aprovado",
      Recusado: "Recusado",
      Concluído: "Concluído",
    };

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const radius = 50;
    const circumference = 2 * Math.PI * radius; // ~314.16
    let accumulatedPercent = 0;

    const segments = Object.entries(counts).map(([status, count]) => {
      const percent = total > 0 ? (count / total) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += percent;

      return {
        status,
        count,
        percent: Math.round(percent),
        strokeDasharray,
        strokeDashoffset,
        color: statusColors[status as keyof typeof statusColors],
        label: statusLabels[status as keyof typeof statusLabels],
      };
    });

    return { total, segments };
  }, [filteredData]);

  // Preparar dados para o Gráfico de Tipo de Serviço (Poda vs Supressão)
  const serviceTypeData = useMemo(() => {
    const counts = {
      Poda: 0,
      Supressão: 0,
      Outros: 0,
    };

    filteredData.forEach((item) => {
      const rawType = (item.type || "").trim().toLowerCase();
      // Remove acentos para comparação robusta (ex: supressão -> supressao)
      const normalizedType = rawType.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (normalizedType.includes("poda")) {
        counts.Poda++;
      } else if (normalizedType.includes("supressao") || normalizedType.includes("corte")) {
        counts.Supressão++;
      } else {
        counts.Outros++;
      }
    });

    return counts;
  }, [filteredData]);

  // Ranking dos top 5 Bairros
  const topBairros = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredData.forEach((item) => {
      const bairro = getBairro(item.address);
      counts[bairro] = (counts[bairro] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [filteredData]);

  // Exportar dados como CSV
  const handleExportCSV = () => {
    const headers = [
      "Protocolo",
      "Data Criacao",
      "Tipo Servico",
      "Status",
      "Endereco",
      "CEP",
      "Bairro",
      "Nivel de Risco",
      "Empresa Terceirizada",
      "Area"
    ];

    const rows = filteredData.map((item) => {
      const date = parseDate(item.createdAt)?.toLocaleDateString("pt-BR") || "N/A";
      const risk = item.risco && item.risco !== "Nenhum risco aparente" ? item.risco : "Sem Risco";
      const bairro = getBairro(item.address);
      
      return [
        `#${item.id}`,
        date,
        item.type || "N/A",
        item.status || "N/A",
        `"${(item.address || "").replace(/"/g, '""')}"`,
        item.cep || "N/A",
        bairro,
        risk,
        item.prestadorNome || "Nenhum",
        item.tipoArea || "Urbana"
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
    link.setAttribute("download", `solicitacoes_filtradas_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Últimas 5 solicitações
  const recentSolicitacoes = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => {
        const da = parseDate(a.createdAt) || new Date(0);
        const db = parseDate(b.createdAt) || new Date(0);
        return db.getTime() - da.getTime();
      })
      .slice(0, 5);
  }, [filteredData]);

  // Construção de Coordenadas do Gráfico de Área (SVG)
  const lineChartSVG = useMemo(() => {
    const { labels, values } = temporalChartData;
    const maxVal = Math.max(...values, 5);
    const width = 600;
    const height = 240;
    const paddingX = 40;
    const paddingY = 35;
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;

    const points = values.map((val, idx) => {
      const x = paddingX + (idx / (values.length - 1 || 1)) * usableW;
      const y = height - paddingY - (val / maxVal) * usableH;
      return { x, y, value: val, label: labels[idx] };
    });

    const linePath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = points.length > 0 
      ? `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
      : "";

    return { width, height, paddingX, paddingY, usableW, usableH, points, linePath, areaPath, maxVal };
  }, [temporalChartData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-600">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-semibold text-lg animate-pulse">Carregando painel analítico...</p>
      </div>
    );
  }

  const defaultHoveredStatus = doughnutChartData.segments.find(s => s.count > 0) || { label: "Nenhum", count: 0, percent: 0, color: "#cbd5e1" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Visão Geral</h1>
          <p className="text-slate-500 mt-1">Estatísticas, relatórios geográficos e gerador de relatórios do município.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filteredData.length === 0}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          <span>Exportar Dados (CSV)</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold">
          <Filter className="w-5 h-5 text-emerald-600" />
          <span>Filtros do Dashboard</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Busca por texto */}
          <div className="relative">
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Busca</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Endereço, protocolo..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-800 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Filtro de Período */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Período</label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-700 bg-slate-50/50"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="mes">Este Mês</option>
              <option value="tudo">Todo o período</option>
              <option value="personalizado">Personalizado...</option>
            </select>
          </div>

          {/* Filtro de Status */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-700 bg-slate-50/50"
            >
              <option value="todos">Todos os Status</option>
              <option value="Criado">Criado (Aguardando)</option>
              <option value="Em Análise">Em Análise (Vistoria)</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Concluído">Concluído</option>
              <option value="Recusado">Recusado</option>
            </select>
          </div>

          {/* Filtro de Risco */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Nível de Risco</label>
            <select
              value={filterRisco}
              onChange={(e) => setFilterRisco(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-700 bg-slate-50/50"
            >
              <option value="todos">Todos os Riscos</option>
              <option value="com_risco">🚨 Apenas com Risco Iminente</option>
              <option value="sem_risco">Sem Risco Declarado</option>
            </select>
          </div>
        </div>

        {/* Inputs personalizados de data */}
        {filterPeriod === "personalizado" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Data Início</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-700 bg-slate-50/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Data Fim</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-700 bg-slate-50/50"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card Total */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/70 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Filtrado</p>
            <p className="text-3xl font-extrabold text-slate-800">{stats.total}</p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              Solicitações no período
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl text-blue-600">
            <FileText className="w-8 h-8" />
          </div>
        </div>

        {/* Card Pendentes */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/70 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Aguardando Vistoria</p>
            <p className="text-3xl font-extrabold text-slate-800">{stats.aguardando}</p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              Criados e Em Análise
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-xl text-orange-600">
            <Clock className="w-8 h-8" />
          </div>
        </div>

        {/* Card Executados */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/70 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1 w-full mr-2">
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Concluídos</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-slate-800">{stats.concluido}</p>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {stats.taxaExecucao}%
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
              <div style={{ width: `${stats.taxaExecucao}%` }} className="bg-emerald-500 h-full rounded-full transition-all duration-500" />
            </div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600 shrink-0">
            <CheckCircle className="w-8 h-8" />
          </div>
        </div>

        {/* Card Risco */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/70 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Prioridades Críticas</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-extrabold text-slate-800">{stats.riscoCritico}</p>
              {stats.riscoCritico > 0 && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              Casos urgentes pendentes
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl text-red-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Seção de Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Evolução Temporal */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-slate-800">Evolução das Solicitações</h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">Total de Chamados Diários</span>
          </div>

          <div className="relative flex-1 min-h-[220px]">
            {filteredData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 italic text-sm">
                Sem solicitações no período selecionado.
              </div>
            ) : (
              <>
                {/* SVG Area Chart */}
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox={`0 0 ${lineChartSVG.width} ${lineChartSVG.height}`}
                  preserveAspectRatio="none"
                  className="overflow-visible"
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const gridY = lineChartSVG.paddingY + (idx / 3) * lineChartSVG.usableH;
                    const valueLabel = Math.round(lineChartSVG.maxVal - (idx / 3) * lineChartSVG.maxVal);
                    return (
                      <g key={idx} className="opacity-30">
                        <line 
                          x1={lineChartSVG.paddingX} 
                          y1={gridY} 
                          x2={lineChartSVG.width - lineChartSVG.paddingX} 
                          y2={gridY} 
                          stroke="#94a3b8" 
                          strokeWidth="1" 
                          strokeDasharray="4 4" 
                        />
                        <text 
                          x={lineChartSVG.paddingX - 10} 
                          y={gridY + 4} 
                          fill="#475569" 
                          fontSize="10" 
                          className="font-bold text-right"
                          textAnchor="end"
                        >
                          {valueLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  {lineChartSVG.areaPath && (
                    <path d={lineChartSVG.areaPath} fill="url(#areaGradient)" />
                  )}

                  {/* Line path */}
                  {lineChartSVG.linePath && (
                    <path 
                      d={lineChartSVG.linePath} 
                      fill="none" 
                      stroke="#10b981" 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                  )}

                  {/* Interactive Dots */}
                  {lineChartSVG.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPoint?.label === p.label ? 6 : 4}
                      fill={hoveredPoint?.label === p.label ? "#10b981" : "#ffffff"}
                      stroke="#10b981"
                      strokeWidth={hoveredPoint?.label === p.label ? 3.5 : 2}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}
                </svg>

                {/* Custom Tooltip */}
                {hoveredPoint && (
                  <div 
                    style={{ 
                      left: `${(hoveredPoint.x / lineChartSVG.width) * 100}%`, 
                      top: `${(hoveredPoint.y / lineChartSVG.height) * 100 - 15}%` 
                    }}
                    className="absolute z-10 bg-slate-900 text-white text-[11px] font-bold p-2.5 rounded-lg shadow-xl -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none transition-all duration-100 border border-slate-800"
                  >
                    <span>{hoveredPoint.label}</span>
                    <span className="text-emerald-400 mt-0.5">{hoveredPoint.value} Chamado(s)</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Status */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-slate-800">Status dos Chamados</h3>
            </div>
          </div>

          {doughnutChartData.total === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 italic text-sm">
              Sem dados.
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-40 h-40">
                <svg width="100%" height="100%" viewBox="0 0 160 160" className="transform -rotate-90">
                  {doughnutChartData.segments.map((seg, idx) => {
                    if (seg.count === 0) return null;
                    const isHovered = (hoveredStatus?.status === seg.status) || (!hoveredStatus && idx === 0);
                    return (
                      <circle
                        key={idx}
                        cx="80"
                        cy="80"
                        r="50"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth={isHovered ? 20 : 16}
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredStatus(seg)}
                        onMouseLeave={() => setHoveredStatus(null)}
                      />
                    );
                  })}
                </svg>
                
                {/* Center Stats overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    {hoveredStatus ? hoveredStatus.label : defaultHoveredStatus.label}
                  </p>
                  <p className="text-2xl font-black text-slate-800 mt-0.5">
                    {hoveredStatus ? hoveredStatus.count : defaultHoveredStatus.count}
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    {hoveredStatus ? `${hoveredStatus.percent}%` : `${defaultHoveredStatus.percent}%`}
                  </p>
                </div>
              </div>

              {/* Legend List */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full text-xs font-bold pt-2">
                {doughnutChartData.segments.map((seg) => (
                  <div key={seg.status} className="flex items-center gap-1.5 text-slate-600">
                    <span 
                      style={{ backgroundColor: seg.color }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    />
                    <span className="truncate">{seg.label}</span>
                    <span className="text-slate-400 font-medium ml-auto">({seg.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seção de Gráficos Secundários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 3: Tipo de Serviço */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-5">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-slate-800">Tipos de Serviço Solicitados</h3>
          </div>

          <div className="space-y-6">
            {Object.entries(serviceTypeData).map(([type, count]) => {
              const maxVal = Math.max(...Object.values(serviceTypeData), 1);
              const percentage = Math.round((count / maxVal) * 100);
              const percentOfTotal = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              
              // Color settings
              const barColor = type === "Poda" ? "bg-emerald-500" : type === "Supressão" ? "bg-blue-500" : "bg-slate-400";
              const bgColor = type === "Poda" ? "bg-emerald-50" : type === "Supressão" ? "bg-blue-50" : "bg-slate-50";
              
              return (
                <div key={type} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${type === "Poda" ? "bg-emerald-500" : type === "Supressão" ? "bg-blue-500" : "bg-slate-400"}`} />
                      <span className="font-bold text-slate-700">{type}</span>
                    </div>
                    <div className="flex items-center gap-2 font-black text-slate-800">
                      <span>{count}</span>
                      <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {percentOfTotal}% do total
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex">
                    <div 
                      style={{ width: `${percentage}%` }}
                      className={`${barColor} h-full rounded-full transition-all duration-500 shadow-inner`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico 4: Top Bairros */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-5">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-slate-800">Regiões com Maior Demanda</h3>
          </div>

          {topBairros.length === 0 ? (
            <div className="text-center text-slate-400 italic text-sm py-8">
              Nenhuma solicitação localizada.
            </div>
          ) : (
            <div className="space-y-4">
              {topBairros.map(([bairro, count], idx) => {
                const maxVal = topBairros[0]?.[1] || 1;
                const percentage = Math.round((count / maxVal) * 100);
                return (
                  <div key={bairro} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-black text-slate-400 text-center shrink-0">
                      {idx + 1}º
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span className="truncate max-w-[200px]">{bairro}</span>
                        <span>{count} Chamado(s)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${percentage}%` }} 
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Solicitações Recentes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-extrabold text-slate-800">Atividades Recentes</h3>
          <Link 
            href="/solicitacoes" 
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline"
          >
            <span>Ver todas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/70 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Protocolo / Data</th>
                <th className="px-6 py-4">Serviço</th>
                <th className="px-6 py-4">Localidade</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSolicitacoes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                    Nenhuma atividade recente no filtro selecionado.
                  </td>
                </tr>
              ) : (
                recentSolicitacoes.map((item) => {
                  const date = parseDate(item.createdAt)?.toLocaleDateString("pt-BR") || "N/A";
                  
                  // Color codes
                  const statusColors = {
                    Criado: "bg-slate-100 text-slate-800 border-slate-200",
                    "Em Análise": "bg-orange-100 text-orange-800 border-orange-200",
                    Aprovado: "bg-emerald-100 text-emerald-800 border-emerald-200",
                    Recusado: "bg-red-100 text-red-800 border-red-200",
                    Concluído: "bg-blue-100 text-blue-800 border-blue-200",
                  };

                  const risk = item.risco && item.risco !== "Nenhum risco aparente";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-slate-700">#{item.id.substring(0, 8)}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{date}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-xs">{item.type}</span>
                          {risk && (
                            <span className="bg-red-100 text-red-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-red-200 tracking-wider">
                              Risco
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600 truncate max-w-[240px]">
                        {item.address}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${statusColors[item.status as keyof typeof statusColors] || "bg-slate-100"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link 
                          href={`/solicitacoes/detalhe?id=${item.id}`}
                          className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          Ver
                        </Link>
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

