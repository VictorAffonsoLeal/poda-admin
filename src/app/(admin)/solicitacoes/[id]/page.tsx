"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, arrayUnion, collection, getDocs, query, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, User, MapPin, Calendar, Clock, Edit, FileText } from "lucide-react";
import Link from "next/link";

export default function SolicitacaoDetalhesAdminPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [solicitacao, setSolicitacao] = useState<any>(null);
  const [cidadao, setCidadao] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const [observacao, setObservacao] = useState("");
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [selectedPrestador, setSelectedPrestador] = useState("");
  const [prazoDias, setPrazoDias] = useState("");
  
  // States para Censo
  const [catalogarCenso, setCatalogarCenso] = useState(false);
  const [censoRegiao, setCensoRegiao] = useState("");
  const [censoBairro, setCensoBairro] = useState("");

  const fetchDados = async () => {
    try {
      const docRef = doc(db, "solicitacoes", id as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setSolicitacao({ id: docSnap.id, ...data });
        setNovoStatus(data.status);

        if (data.userId) {
          const userSnap = await getDoc(doc(db, "usuarios", data.userId));
          if (userSnap.exists()) {
            setCidadao(userSnap.data());
          }
        }
      } else {
        alert("Solicitação não encontrada.");
        router.push("/solicitacoes");
      }

      // Buscar Prestadores para o dropdown
      const prestadoresSnap = await getDocs(query(collection(db, "prestadores")));
      const pData: any[] = [];
      prestadoresSnap.forEach(pDoc => pData.push({ id: pDoc.id, ...pDoc.data() }));
      setPrestadores(pData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, [id, router]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoStatus || novoStatus === solicitacao.status) return;
    
    setIsUpdating(true);
    try {
      const docRef = doc(db, "solicitacoes", id as string);
      
      let historicoDescricao = observacao ? `Status alterado para ${novoStatus}. Observação: ${observacao}` : `Status alterado para ${novoStatus}`;
      const payload: any = { status: novoStatus };

      if (novoStatus === "Aprovado" && selectedPrestador) {
        const prestadorObj = prestadores.find(p => p.id === selectedPrestador);
        if (prestadorObj) {
          payload.prestadorId = prestadorObj.id;
          payload.prestadorNome = prestadorObj.razaoSocial;
          payload.prazoDias = prazoDias || "Não definido";
          historicoDescricao = `Solicitação Aprovada e encaminhada para a prestadora: ${prestadorObj.razaoSocial}. Prazo: ${payload.prazoDias} dias. ${observacao ? 'Observação: ' + observacao : ''}`;
        }
      }

      // Lógica do Censo de Árvores
      let generatedTreeId = null;
      if (!solicitacao.treeId && catalogarCenso && censoRegiao && censoBairro) {
        await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, "counters", "arvores");
          const counterDoc = await transaction.get(counterRef);
          
          const counterKey = `${censoRegiao}-${censoBairro.toUpperCase()}`;
          let currentSeq = 0;
          
          if (counterDoc.exists() && counterDoc.data()[counterKey] !== undefined) {
            currentSeq = counterDoc.data()[counterKey];
          }
          
          const nextSeq = currentSeq + 1;
          const seqString = nextSeq.toString().padStart(5, '0');
          generatedTreeId = `${counterKey}-${seqString}`;
          
          transaction.set(counterRef, { [counterKey]: nextSeq }, { merge: true });
        });
        
        if (generatedTreeId) {
          payload.treeId = generatedTreeId;
          historicoDescricao += ` | Árvore catalogada no Censo Municipal sob o ID: ${generatedTreeId}`;
        }
      }

      const historicoEntry = {
        data: new Date().toLocaleDateString('pt-BR'),
        status: novoStatus,
        descricao: historicoDescricao
      };

      payload.historico = arrayUnion(historicoEntry);

      await updateDoc(docRef, payload);

      alert("Status atualizado com sucesso!");
      setObservacao("");
      fetchDados(); // Atualiza a tela
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Criado": return "bg-slate-100 text-slate-800 border-slate-200";
      case "Em Análise": return "bg-orange-100 text-orange-800 border-orange-200";
      case "Aprovado": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Recusado": return "bg-red-100 text-red-800 border-red-200";
      case "Concluído": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) return <div className="p-8">Carregando detalhes...</div>;
  if (!solicitacao) return null;

  const dataCriacaoFormatada = solicitacao.createdAt?.toDate().toLocaleDateString("pt-BR") || "Data não disponível";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/solicitacoes" className="text-slate-500 hover:text-emerald-600 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Protocolo #{solicitacao.id.substring(0, 8)}</h1>
          <p className="text-slate-500">Detalhes da solicitação e análise do pedido.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Informações */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Dados do Chamado
              </h2>
              <div className="flex items-center gap-2">
                {solicitacao.treeId && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                    Árvore ID: {solicitacao.treeId}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(solicitacao.status)}`}>
                  {solicitacao.status}
                </span>
              </div>
            </div>
            
            {solicitacao.solicitantesAdicionais && solicitacao.solicitantesAdicionais.length > 0 && (
              <div className="bg-orange-50 border-b border-orange-200 p-4 flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div>
                  <h4 className="text-sm font-bold text-orange-800">Atenção: Múltiplas Solicitações!</h4>
                  <p className="text-sm text-orange-700">Este chamado foi reforçado por <strong>{solicitacao.solicitantesAdicionais.length}</strong> outro(s) cidadão(s)/órgão(s). O sistema bloqueou a duplicação e unificou todos os pedidos aqui.</p>
                </div>
              </div>
            )}
            
            {solicitacao.risco && solicitacao.risco !== "Nenhum risco aparente" && (
              <div className="bg-red-50 border-b border-red-200 p-4 flex items-start gap-3">
                <div className="text-2xl mt-1">🚨</div>
                <div>
                  <h4 className="text-sm font-bold text-red-800 uppercase tracking-wider">Prioridade Alta: Risco Iminente</h4>
                  <p className="text-sm text-red-700 font-medium">Motivo alegado: <strong>{solicitacao.risco}</strong></p>
                </div>
              </div>
            )}

            {solicitacao.tipoArea === "APP / Rural" && (
              <div className="bg-red-50 border-b border-red-200 p-4 flex items-start gap-3">
                <div className="text-2xl mt-1">🛑</div>
                <div>
                  <h4 className="text-sm font-bold text-red-800 uppercase tracking-wider">Atenção Técnico: Competência Estadual (CETESB)</h4>
                  <p className="text-sm text-red-700 font-medium">O cidadão declarou que a árvore está em <strong>Área de Preservação Permanente (APP)</strong> ou zona <strong>Rural</strong>. Lembre-se que a autorização para este tipo de supressão/poda é de competência da CETESB. Exija a licença ambiental antes de deferir o pedido.</p>
                </div>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm font-medium text-slate-500 mb-1">Tipo de Serviço</span>
                  <span className="text-slate-800 font-medium">{solicitacao.type}</span>
                </div>
                <div>
                  <span className="block text-sm font-medium text-slate-500 mb-1">Tipo de Área</span>
                  <span className="text-slate-800 font-medium">{solicitacao.tipoArea || "Não informado"}</span>
                </div>
                <div>
                  <span className="block text-sm font-medium text-slate-500 mb-1">Data de Criação</span>
                  <span className="text-slate-800 font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {dataCriacaoFormatada}
                  </span>
                </div>
                {solicitacao.prazoDias && solicitacao.prazoDias !== "Não definido" && (
                  <div>
                    <span className="block text-sm font-medium text-slate-500 mb-1">Prazo Definido pelo Técnico</span>
                    <span className="text-orange-700 font-bold bg-orange-100 px-2 py-1 rounded flex items-center gap-2 w-max">
                      <Clock className="w-4 h-4" />
                      {solicitacao.prazoDias} dias
                    </span>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <span className="block text-sm font-medium text-slate-500 mb-1">Endereço do Local</span>
                <span className="text-slate-800 flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    {solicitacao.address}
                    {solicitacao.referencia && (
                      <div className="text-sm text-slate-500 mt-1"><span className="font-semibold">Ref:</span> {solicitacao.referencia}</div>
                    )}
                  </div>
                </span>
                {solicitacao.geolocalizacao && (
                  <div className="mt-3 pl-7">
                    <a 
                      href={`https://www.google.com/maps?q=${solicitacao.geolocalizacao.lat},${solicitacao.geolocalizacao.lng}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                    >
                      <MapPin className="w-4 h-4" /> Abrir no Mapa ({solicitacao.geolocalizacao.lat.toFixed(4)}, {solicitacao.geolocalizacao.lng.toFixed(4)})
                    </a>
                  </div>
                )}
              </div>

              {(solicitacao.imovelAlugado || solicitacao.cienteCompensacao) && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="block text-sm font-medium text-slate-500 mb-2">Declarações e Anuências do Cidadão</span>
                  <div className="space-y-2">
                    {solicitacao.imovelAlugado && (
                      <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-emerald-500">✔️</span> 
                        Declarou que o <strong>imóvel é alugado</strong> e possui a <strong>anuência do proprietário</strong>.
                      </div>
                    )}
                    {solicitacao.cienteCompensacao && (
                      <div className="flex items-center gap-2 text-sm text-slate-700 bg-emerald-50 p-2 rounded border border-emerald-100">
                        <span className="text-emerald-500">✔️</span> 
                        Declarou estar <strong>ciente da obrigatoriedade de compensação ambiental</strong> (doação/plantio de mudas).
                      </div>
                    )}
                  </div>
                </div>
              )}

              {solicitacao.prestadorNome && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="block text-sm font-medium text-slate-500 mb-1">Empresa Prestadora Escalada</span>
                  <span className="text-slate-800 font-medium bg-slate-100 px-3 py-1 rounded-md border border-slate-200 inline-block">
                    {solicitacao.prestadorNome}
                  </span>
                </div>
              )}

              {solicitacao.historico && solicitacao.historico[0] && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="block text-sm font-medium text-slate-500 mb-2">Justificativa Inicial do Cidadão</span>
                  <div className="bg-slate-50 p-4 rounded-lg text-slate-700 border border-slate-100 italic">
                    "{solicitacao.historico[0].descricao.replace('Solicitação criada. Justificativa: ', '')}"
                  </div>
                </div>
              )}

              {solicitacao.fotos && solicitacao.fotos.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="block text-sm font-medium text-slate-500 mb-2">Fotos Anexadas</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                    {solicitacao.fotos.map((fotoUrl: string, idx: number) => (
                      <a key={idx} href={fotoUrl} target="_blank" rel="noopener noreferrer" className="block relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors">
                        <img src={fotoUrl} alt={`Foto Anexo ${idx}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <User className="w-5 h-5" />
                Dados do Solicitante
              </h2>
            </div>
            <div className="p-6">
              {cidadao ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-sm font-medium text-slate-500 mb-1">Nome</span>
                    <span className="text-slate-800">{cidadao.nome || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-500 mb-1">CPF</span>
                    <span className="text-slate-800">{cidadao.cpf || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-500 mb-1">E-mail</span>
                    <span className="text-slate-800">{cidadao.email || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-500 mb-1">Endereço Pessoal</span>
                    <span className="text-slate-800 text-sm">
                      {cidadao.endereco ? `${cidadao.endereco.logradouro}, ${cidadao.endereco.numero} - ${cidadao.endereco.bairro}` : "Não informado"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 italic">Informações do cidadão não encontradas ou conta excluída.</p>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Ações e Histórico */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-emerald-50">
              <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Ação do Servidor
              </h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Alterar Status</label>
                  <select 
                    value={novoStatus}
                    onChange={(e) => setNovoStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white"
                  >
                    <option value="Criado">Criado (Aguardando)</option>
                    <option value="Em Análise">Em Análise (Vistoria)</option>
                    <option value="Aprovado">Aprovado (Autorizado e Encaminhar OS)</option>
                    <option value="Recusado">Recusado (Indeferido)</option>
                    <option value="Concluído">Concluído (Poda Executada)</option>
                  </select>
                </div>

                {!solicitacao.treeId && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="check-censo" 
                        checked={catalogarCenso} 
                        onChange={e => setCatalogarCenso(e.target.checked)} 
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                      />
                      <label htmlFor="check-censo" className="text-sm text-blue-900 font-bold cursor-pointer">
                        Catalogar árvore no Censo Municipal
                      </label>
                    </div>
                    {catalogarCenso && (
                      <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-blue-100">
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Região (Mapa SIG)</label>
                          <select 
                            value={censoRegiao}
                            onChange={(e) => setCensoRegiao(e.target.value)}
                            required={catalogarCenso}
                            className="w-full px-2 py-1.5 border border-blue-200 rounded text-sm text-slate-700 bg-white"
                          >
                            <option value="">Selecione...</option>
                            <option value="CEU">CEU</option>
                            <option value="BSQ">BOSQUE</option>
                            <option value="TAL">TALHADO</option>
                            <option value="PIN">PINHEIRINHO</option>
                            <option value="CDC">CIDADE DA CRIANÇA</option>
                            <option value="CEN">CENTRAL</option>
                            <option value="REP">REPRESA</option>
                            <option value="VTO">VILA TONINHO</option>
                            <option value="HB">HB</option>
                            <option value="SCH">SCHMITT</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Sigla Bairro (3-4 letras)</label>
                          <input 
                            type="text"
                            maxLength={4}
                            placeholder="Ex: BTV"
                            value={censoBairro}
                            onChange={(e) => setCensoBairro(e.target.value.toUpperCase())}
                            required={catalogarCenso}
                            className="w-full px-2 py-1.5 border border-blue-200 rounded text-sm text-slate-700 bg-white uppercase"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {novoStatus === "Aprovado" && (
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-emerald-800 mb-2">Despachar para Qual Empresa?</label>
                      {prestadores.length === 0 ? (
                        <p className="text-sm text-red-600 font-medium">Nenhum prestador cadastrado no sistema. Por favor, cadastre em Prestadores primeiro.</p>
                      ) : (
                        <select 
                          value={selectedPrestador}
                          onChange={(e) => setSelectedPrestador(e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-slate-700 bg-white"
                        >
                          <option value="">-- Selecione uma empresa terceirizada --</option>
                          {prestadores.filter(p => p.status === "Ativo").map(p => (
                            <option key={p.id} value={p.id}>{p.razaoSocial} (CNPJ: {p.cnpj})</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-emerald-800 mb-1">Prazo para Execução (em dias)</label>
                      <input 
                        type="number"
                        min="1"
                        placeholder="Ex: 15"
                        value={prazoDias}
                        onChange={(e) => setPrazoDias(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-slate-700 bg-white"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Observação Interna / Parecer</label>
                  <textarea 
                    rows={3}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Adicione um motivo ou parecer técnico..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 resize-none text-sm"
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  disabled={isUpdating || novoStatus === solicitacao.status}
                  className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isUpdating ? "Salvando..." : "Salvar Atualização"}
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Histórico
              </h2>
            </div>
            <div className="p-6">
              <div className="relative border-l border-slate-200 ml-3 space-y-6">
                {solicitacao.historico && [...solicitacao.historico].reverse().map((hist: any, index: number) => (
                  <div key={index} className="pl-6 relative">
                    <div className="absolute w-3 h-3 bg-emerald-500 rounded-full -left-[6.5px] top-1.5 ring-4 ring-white"></div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">{hist.data}</p>
                    <p className="text-sm font-bold text-slate-700 mb-1">{hist.status}</p>
                    <p className="text-sm text-slate-600">{hist.descricao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
