"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, User, MapPin, Mail, Phone, Calendar, FileText, Eye } from "lucide-react";
import Link from "next/link";

export default function ClienteDetalhesPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [cliente, setCliente] = useState<any>(null);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDados = async () => {
      try {
        // 1. Buscar os dados do cliente
        const docRef = doc(db, "usuarios", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setCliente({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert("Cliente não encontrado.");
          router.push("/clientes");
          return;
        }

        // 2. Buscar todas as solicitações deste cliente
        const q = query(
          collection(db, "solicitacoes"), 
          where("userId", "==", id as string),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        
        const solicitacoesArray: any[] = [];
        snapshot.forEach((doc) => {
          solicitacoesArray.push({ id: doc.id, ...doc.data() });
        });
        setSolicitacoes(solicitacoesArray);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchDados();
  }, [id, router]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Criado": return "bg-slate-100 text-slate-800 border-slate-200";
      case "Em Análise": return "bg-orange-100 text-orange-800 border-orange-200";
      case "Aprovado": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Recusado": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) return <div className="p-8">Carregando detalhes do cliente...</div>;
  if (!cliente) return null;

  let dataCadastro = "Data não disponível";
  if (cliente.createdAt) {
    try {
      dataCadastro = new Date(cliente.createdAt).toLocaleDateString('pt-BR');
    } catch (e) {}
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/clientes" className="text-slate-500 hover:text-emerald-600 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ficha do Cliente</h1>
          <p className="text-slate-500">Informações detalhadas e histórico de chamados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Informações do Cliente */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-emerald-600 p-6 flex flex-col items-center justify-center text-white">
              <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-4 shadow-inner">
                {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : <User className="w-10 h-10" />}
              </div>
              <h2 className="text-xl font-bold text-center">{cliente.nome || "Não informado"}</h2>
              <p className="text-emerald-100 text-sm mt-1">Cliente App</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF / CNPJ</p>
                  <p className="text-slate-800 font-medium">{cliente.cpf || "---"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</p>
                  <p className="text-slate-800 font-medium">{cliente.email || "---"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Membro Desde</p>
                  <p className="text-slate-800 font-medium">{dataCadastro}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço Cadastrado
              </h3>
            </div>
            <div className="p-6">
              {cliente.endereco ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CEP</p>
                    <p className="text-slate-800">{cliente.endereco.cep}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Logradouro</p>
                    <p className="text-slate-800">{cliente.endereco.logradouro}, {cliente.endereco.numero}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bairro</p>
                    <p className="text-slate-800">{cliente.endereco.bairro}</p>
                  </div>
                  {cliente.geolocalizacao && (
                    <div className="pt-3 mt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Geolocalização</p>
                      <a 
                        href={`https://www.google.com/maps?q=${cliente.geolocalizacao.lat},${cliente.geolocalizacao.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <MapPin className="w-4 h-4" /> Ver no Mapa ({cliente.geolocalizacao.lat.toFixed(4)}, {cliente.geolocalizacao.lng.toFixed(4)})
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 italic text-sm">Nenhum endereço cadastrado para este cliente.</p>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Solicitações */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Histórico de Solicitações</h2>
                <p className="text-sm text-slate-500">Todos os chamados abertos por este cliente.</p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-bold py-1 px-3 rounded-full text-sm">
                {solicitacoes.length}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Data / Protocolo</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {solicitacoes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                        Este cliente ainda não abriu nenhuma solicitação.
                      </td>
                    </tr>
                  ) : (
                    solicitacoes.map((solicitacao) => {
                      const data = solicitacao.historico && solicitacao.historico.length > 0 
                        ? solicitacao.historico[0].data 
                        : '---';

                      return (
                        <tr key={solicitacao.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-slate-800 font-medium">{data}</div>
                            <div className="text-xs text-slate-400">#{solicitacao.id.substring(0, 6)}</div>
                          </td>
                          <td className="px-6 py-4">{solicitacao.type}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(solicitacao.status)}`}>
                              {solicitacao.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Link 
                              href={`/solicitacoes/${solicitacao.id}`}
                              className="text-emerald-600 hover:text-emerald-800 font-medium text-xs bg-emerald-50 p-2 rounded-lg hover:bg-emerald-100 inline-flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-4 h-4" /> Ver Pedido
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
      </div>
    </div>
  );
}
