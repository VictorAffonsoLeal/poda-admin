"use client";

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Filter, Eye } from "lucide-react";
import Link from "next/link";

export default function SolicitacoesAdminPage() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterType, setFilterType] = useState("todos");
  const [filterRisco, setFilterRisco] = useState("todos");
  const [isGroupedByCep, setIsGroupedByCep] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "solicitacoes"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const solicitacoesArray: any[] = [];
      querySnapshot.forEach((doc) => {
        solicitacoesArray.push({ id: doc.id, ...doc.data() });
      });
      setSolicitacoes(solicitacoesArray);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar solicitacoes: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredSolicitacoes = solicitacoes.filter(s => {
    // 1. Busca textual
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const addressMatch = (s.address || "").toLowerCase().includes(term);
      const idMatch = (s.id || "").toLowerCase().includes(term);
      const typeMatch = (s.type || "").toLowerCase().includes(term);
      if (!addressMatch && !idMatch && !typeMatch) return false;
    }

    // 2. Filtro de Status
    if (filterStatus !== "todos" && s.status !== filterStatus) return false;

    // 3. Filtro de Tipo
    if (filterType !== "todos") {
      const typeText = (s.type || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (filterType === "poda" && !typeText.includes("poda")) return false;
      if (filterType === "supressao" && !typeText.includes("supressao") && !typeText.includes("corte")) return false;
      if (filterType === "fiscalizacao" && !typeText.includes("fiscalizacao")) return false;
    }

    // 4. Filtro de Risco
    const hasRisk = s.risco && s.risco !== "Nenhum risco aparente";
    if (filterRisco === "com_risco" && !hasRisk) return false;
    if (filterRisco === "sem_risco" && hasRisk) return false;

    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Criado": return "bg-slate-100 text-slate-800 border-slate-200";
      case "Em Análise": return "bg-orange-100 text-orange-800 border-orange-200";
      case "Aprovado": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Aguardando Validação": return "bg-purple-100 text-purple-800 border-purple-200";
      case "Recusado": return "bg-red-100 text-red-800 border-red-200";
      case "Concluído": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const hasActiveFilters = searchTerm !== "" || filterStatus !== "todos" || filterType !== "todos" || filterRisco !== "todos";

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterStatus("todos");
    setFilterType("todos");
    setFilterRisco("todos");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Solicitações</h1>
          <p className="text-slate-500">Gerencie todos os chamados abertos pelos cidadãos.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col gap-4 bg-slate-50">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Campo de Busca */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar endereço, protocolo..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
              />
            </div>
            
            {/* Ações */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
              <button 
                onClick={() => setIsGroupedByCep(!isGroupedByCep)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors cursor-pointer ${isGroupedByCep ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
              >
                <Filter className="w-4 h-4" />
                {isGroupedByCep ? "Desagrupar" : "Agrupar por CEP"}
              </button>
            </div>
          </div>

          {/* Filtros Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="todos">Todos os Status</option>
                <option value="Criado">Criado (Aguardando)</option>
                <option value="Em Análise">Em Análise (Vistoria)</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Aguardando Validação">Aguardando Validação (Corte Feito)</option>
                <option value="Concluído">Concluído</option>
                <option value="Recusado">Recusado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Serviço</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="todos">Todos os Serviços</option>
                <option value="poda">Poda</option>
                <option value="supressao">Supressão (Corte)</option>
                <option value="fiscalizacao">Fiscalização</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Risco Iminente</label>
              <select
                value={filterRisco}
                onChange={(e) => setFilterRisco(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="todos">Todos os Riscos</option>
                <option value="com_risco">🚨 Apenas com Risco</option>
                <option value="sem_risco">Sem Risco Aparente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Protocolo / Data</th>
                <th className="px-6 py-4">Tipo de Serviço</th>
                <th className="px-6 py-4">Endereço</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando dados...</td>
                </tr>
              ) : filteredSolicitacoes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhuma solicitação encontrada.</td>
                </tr>
              ) : (
                (() => {
                  if (isGroupedByCep) {
                    // Agrupar por CEP
                    const grupos: Record<string, any[]> = {};
                    filteredSolicitacoes.forEach(s => {
                      const cep = s.cep && s.cep !== "Não informado" ? s.cep : "Sem CEP Registrado";
                      if (!grupos[cep]) grupos[cep] = [];
                      grupos[cep].push(s);
                    });

                    return Object.entries(grupos).map(([cep, items]) => (
                      <React.Fragment key={cep}>
                        <tr className="bg-slate-100 border-y border-slate-200">
                          <td colSpan={5} className="px-6 py-3 font-bold text-slate-700">
                            📍 Região / CEP: {cep} <span className="ml-2 text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{items.length} chamado(s)</span>
                          </td>
                        </tr>
                        {items.map((solicitacao) => renderLinhaTabela(solicitacao))}
                      </React.Fragment>
                    ));
                  } else {
                    // Sem agrupamento
                    return filteredSolicitacoes.map(renderLinhaTabela);
                  }
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  function renderLinhaTabela(solicitacao: any) {
    const dataUltimaAtualizacao = solicitacao.historico && solicitacao.historico.length > 0 
        ? solicitacao.historico[0].data 
        : 'Data indisponível';

    return (
      <tr key={solicitacao.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td className="px-6 py-4">
          <div className="font-medium text-slate-800">#{solicitacao.id.substring(0, 6)}</div>
          <div className="text-xs text-slate-400 mt-1">{dataUltimaAtualizacao}</div>
        </td>
        <td className="px-6 py-4 font-medium text-slate-700">
          {solicitacao.type}
          {solicitacao.risco && solicitacao.risco !== "Nenhum risco aparente" && (
            <span title={`Risco: ${solicitacao.risco}`} className="ml-2 inline-flex items-center justify-center bg-red-100 text-red-600 rounded-full px-2 py-0.5 text-xs font-bold border border-red-200">
              🚨 Risco
            </span>
          )}
        </td>
        <td className="px-6 py-4 max-w-xs truncate">{solicitacao.address}</td>
        <td className="px-6 py-4">
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(solicitacao.status)}`}>
            {solicitacao.status}
          </span>
        </td>
        <td className="px-6 py-4 text-center">
          <Link 
            href={`/solicitacoes/detalhe?id=${solicitacao.id}`}
            className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg transition-colors inline-flex items-center gap-1"
          >
            <Eye className="w-4 h-4" />
            <span className="text-xs font-medium">Ver</span>
          </Link>
        </td>
      </tr>
    );
  }
}
