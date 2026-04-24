"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Briefcase, Search, Plus, X } from "lucide-react";

export default function PrestadoresPage() {
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [valorMedioCorte, setValorMedioCorte] = useState("");

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrestadores();
  }, []);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "prestadores"), {
        razaoSocial,
        cnpj,
        contatoNome,
        contatoTelefone,
        valorMedioCorte: valorMedioCorte ? parseFloat(valorMedioCorte.replace(',', '.')) : 0,
        status: "Ativo",
        createdAt: serverTimestamp()
      });
      alert("Prestador cadastrado com sucesso!");
      setShowModal(false);
      setRazaoSocial(""); setCnpj(""); setContatoNome(""); setContatoTelefone(""); setValorMedioCorte("");
      fetchPrestadores();
    } catch (e) {
      console.error(e);
      alert("Erro ao cadastrar prestador.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    let newStatus = currentStatus === "Ativo" ? "Inativo" : "Ativo";
    
    // Se estiver pendente, aprovar vira Ativo
    if (currentStatus === "Pendente") {
      if (confirm(`Aprovar credenciamento desta empresa?`)) {
        newStatus = "Ativo";
      } else {
        return;
      }
    } else {
      if (!confirm(`Tem certeza que deseja mudar o status para ${newStatus}?`)) return;
    }

    try {
      await updateDoc(doc(db, "prestadores", id), {
        status: newStatus
      });
      setPrestadores(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      alert("Erro ao alterar status.");
    }
  };

  const filteredPrestadores = prestadores.filter(p => 
    p.razaoSocial?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cnpj?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-600" />
            Prestadores de Serviço
          </h1>
          <p className="text-slate-500">Gerencie as empresas terceirizadas responsáveis pela execução da poda.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors">
          <Plus className="w-5 h-5" />
          Novo Prestador
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-bold text-slate-800 text-lg">Cadastrar Terceirizada</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-700"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCadastrar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social / Nome da Empresa</label>
                <input type="text" required value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                <input type="text" required value={cnpj} onChange={e => setCnpj(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" placeholder="00.000.000/0000-00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pessoa de Contato</label>
                  <input type="text" required value={contatoNome} onChange={e => setContatoNome(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input type="text" required value={contatoTelefone} onChange={e => setContatoTelefone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Médio de Corte (Opcional)</label>
                <input type="number" step="0.01" value={valorMedioCorte} onChange={e => setValorMedioCorte(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" placeholder="Ex: 150.00" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-md">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50">
                  {isSubmitting ? "Salvando..." : "Salvar Cadastro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por empresa, CNPJ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 bg-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Empresa / Equipe</th>
                <th className="px-6 py-4">CNPJ</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Valor Médio</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center">Carregando...</td></tr>
              ) : filteredPrestadores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Briefcase className="w-12 h-12 text-slate-300 mb-4" />
                      <h3 className="text-lg font-medium text-slate-900">Nenhum prestador encontrado</h3>
                      <p className="text-slate-500 mt-1 max-w-sm">
                        Adicione as equipes ou empresas que ficarão responsáveis pela execução das podas deferidas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPrestadores.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{p.razaoSocial}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{p.cnpj}</td>
                    <td className="px-6 py-4">
                      <div>{p.contatoNome || p.contato}</div>
                      <div className="text-xs text-slate-400">{p.contatoTelefone}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {p.valorMedioCorte ? `R$ ${Number(p.valorMedioCorte).toFixed(2).replace('.', ',')}` : "---"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        p.status === "Ativo" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                        p.status === "Pendente" ? "bg-orange-100 text-orange-800 border-orange-200" :
                        "bg-red-100 text-red-800 border-red-200"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleToggleStatus(p.id, p.status)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          p.status === "Ativo" ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" : 
                          "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
                        }`}
                      >
                        {p.status === "Ativo" ? "Desativar" : p.status === "Pendente" ? "Aprovar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
