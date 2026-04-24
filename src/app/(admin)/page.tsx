"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Clock, CheckCircle, AlertTriangle, FileText } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    total: 0,
    emAnalise: 0,
    aprovados: 0,
    recusados: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const q = query(collection(db, "solicitacoes"));
        const snapshot = await getDocs(q);
        
        let emAnalise = 0;
        let aprovados = 0;
        let recusados = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === "Em Análise" || data.status === "Criado") emAnalise++;
          if (data.status === "Aprovado") aprovados++;
          if (data.status === "Recusado") recusados++;
        });

        setStats({
          total: snapshot.size,
          emAnalise,
          aprovados,
          recusados
        });
      } catch (error) {
        console.error("Erro ao buscar estatísticas", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="p-8">Calculando estatísticas...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Visão Geral</h1>
        <p className="text-slate-500">Resumo das solicitações de poda e supressão no município.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Solicitado</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Aguardando/Em Análise</p>
            <p className="text-2xl font-bold text-slate-800">{stats.emAnalise}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Aprovados</p>
            <p className="text-2xl font-bold text-slate-800">{stats.aprovados}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-lg text-red-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Recusados</p>
            <p className="text-2xl font-bold text-slate-800">{stats.recusados}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
