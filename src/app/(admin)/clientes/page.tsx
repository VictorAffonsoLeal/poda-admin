"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Eye, Users, TrendingUp, MapPin, UserCheck, Calendar } from "lucide-react";
import Link from "next/link";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const q = query(collection(db, "usuarios"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        const clientesArray: any[] = [];
        snapshot.forEach((doc) => {
          clientesArray.push({ id: doc.id, ...doc.data() });
        });
        setClientes(clientesArray);
      } catch (error) {
        console.error("Erro ao buscar clientes: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, []);

  // Filtragem dos clientes
  const filteredClientes = clientes.filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cpf?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Estatísticas baseadas nos dados reais
  const totalClientes = clientes.length;
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const novosClientes = clientes.filter(c => {
    if (!c.createdAt) return false;
    try {
      return new Date(c.createdAt) >= thirtyDaysAgo;
    } catch {
      return false;
    }
  }).length;

  const comEndereco = clientes.filter(c => c.endereco && c.endereco.logradouro).length;

  // Função para formatar o CPF
  const formatCPF = (cpf?: string) => {
    if (!cpf) return "---";
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-emerald-600/10 text-emerald-600 rounded-xl inline-flex">
              <Users className="w-7 h-7" />
            </span>
            Clientes (Cidadãos)
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm sm:text-base">
            Gerencie e visualize as informações cadastrais dos usuários do aplicativo.
          </p>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total de Clientes</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{loading ? "..." : totalClientes}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Últimos 30 Dias</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{loading ? "..." : novosClientes}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Endereço Completo</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{loading ? "..." : comEndereco}</p>
          </div>
        </div>
      </div>

      {/* Tabela e Busca */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail ou CPF..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-2.5 w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-white placeholder-slate-400 shadow-sm transition-all focus:outline-none"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
            <span className="font-bold text-slate-800">{filteredClientes.length}</span> registros encontrados
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
                <th className="px-6 py-4.5 font-bold">Cliente</th>
                <th className="px-6 py-4.5 font-bold">CPF</th>
                <th className="px-6 py-4.5 font-bold">E-mail</th>
                <th className="px-6 py-4.5 font-bold">Data de Cadastro</th>
                <th className="px-6 py-4.5 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      Carregando dados dos cidadãos...
                    </div>
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Nenhum cliente encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => {
                  let dataCadastro = "Não informada";
                  if (cliente.createdAt) {
                    try {
                      dataCadastro = new Date(cliente.createdAt).toLocaleDateString('pt-BR');
                    } catch (e) {
                      dataCadastro = cliente.createdAt;
                    }
                  }

                  const initial = cliente.nome ? cliente.nome.charAt(0).toUpperCase() : "?";

                  return (
                    <tr 
                      key={cliente.id} 
                      className="group hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                              {cliente.nome || "Não informado"}
                            </div>
                            <div className="text-xs text-slate-400">
                              ID: #{cliente.id.substring(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        {formatCPF(cliente.cpf)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {cliente.email || "---"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {dataCadastro}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link 
                          href={`/clientes/detalhe?id=${cliente.id}`}
                          className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 font-semibold text-xs border border-emerald-200/30 hover:border-emerald-200 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Ficha
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
