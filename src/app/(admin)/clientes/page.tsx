"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Eye, Users } from "lucide-react";
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

  const filteredClientes = clientes.filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cpf?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Clientes (Cidadãos)
          </h1>
          <p className="text-slate-500">Cadastros realizados pelos usuários do aplicativo.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail ou CPF..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
            />
          </div>
          <div className="text-sm text-slate-500 font-medium">
            {filteredClientes.length} registros encontrados
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nome Completo</th>
                <th className="px-6 py-4">CPF</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Data de Cadastro</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando dados...</td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum cliente encontrado.</td>
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

                  return (
                    <tr key={cliente.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{cliente.nome || "---"}</td>
                      <td className="px-6 py-4">{cliente.cpf || "---"}</td>
                      <td className="px-6 py-4">{cliente.email || "---"}</td>
                      <td className="px-6 py-4">{dataCadastro}</td>
                      <td className="px-6 py-4 text-center">
                        <Link 
                          href={`/clientes/${cliente.id}`}
                          className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-xs font-medium">Ver</span>
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
