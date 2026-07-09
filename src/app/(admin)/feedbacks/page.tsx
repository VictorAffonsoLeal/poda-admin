"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { 
  HeartHandshake, 
  MessageSquare, 
  Eye, 
  X, 
  Calendar, 
  User, 
  Mail, 
  CheckCheck, 
  Clock, 
  Sparkles, 
  AlertOctagon 
} from "lucide-react";

// Secure download/upload assets parsing helper
const getSecureUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const baseUrl = isLocal ? "http://localhost:8000" : "https://poda-app.nivl.com.br";
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function FeedbacksAdminPage() {
  const { showToast } = useToast();
  
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [citizenName, setCitizenName] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFeedback) {
      setCitizenName(null);
      return;
    }
    
    if (selectedFeedback.userName && selectedFeedback.userName !== "Cidadão Identificado") {
      setCitizenName(selectedFeedback.userName);
      return;
    }

    if (selectedFeedback.userId && selectedFeedback.userId !== "anonimo") {
      const fetchUserName = async () => {
        try {
          const userDoc = await getDoc(doc(db, "usuarios", selectedFeedback.userId));
          if (userDoc.exists()) {
            setCitizenName(userDoc.data().nome || selectedFeedback.userName);
          } else {
            setCitizenName(selectedFeedback.userName);
          }
        } catch (e) {
          console.error("Erro ao buscar nome do usuario:", e);
          setCitizenName(selectedFeedback.userName);
        }
      };
      fetchUserName();
    } else {
      setCitizenName(selectedFeedback.userName || "Cidadão");
    }
  }, [selectedFeedback]);

  useEffect(() => {
    const q = query(
      collection(db, "feedbacks"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const fList: any[] = [];
      snap.forEach((docSnap) => {
        fList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setFeedbacks(fList);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar feedbacks:", error);
      showToast("Erro ao carregar feedbacks.", "erro");
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const updateFeedbackStatus = async (feedbackId: string, newStatus: string) => {
    try {
      const docRef = doc(db, "feedbacks", feedbackId);
      await updateDoc(docRef, { status: newStatus });
      showToast(`Status atualizado para ${newStatus}!`, "sucesso");
      if (selectedFeedback && selectedFeedback.id === feedbackId) {
        setSelectedFeedback((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error("Erro ao atualizar feedback:", err);
      showToast("Erro ao atualizar status.", "erro");
    }
  };

  const getTipoStyle = (tipo: string) => {
    switch (tipo) {
      case "Bug / Erro":
        return "bg-red-50 text-red-750 border-red-200";
      case "Sugestão":
        return "bg-orange-50 text-orange-750 border-orange-200";
      case "Elogio":
        return "bg-emerald-50 text-emerald-700 border-emerald-250";
      case "Dúvida":
        return "bg-blue-50 text-blue-755 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Novo":
        return "bg-purple-100 text-purple-800 border-purple-200 font-black animate-pulse";
      case "Lido":
        return "bg-blue-100 text-blue-800 border-blue-200 font-bold";
      case "Respondido":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const filteredFeedbacks = filtroStatus === "Todos" 
    ? feedbacks 
    : feedbacks.filter(f => f.status === filtroStatus);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full animate-fadeIn font-sans pb-12">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-7 h-7 text-emerald-600 shrink-0" />
            Ouvidoria e Feedbacks
          </h1>
          <p className="text-xs text-slate-500 font-medium">Veja as sugestões, reclamações, elogios e relatos de falhas enviados pelos munícipes</p>
        </div>
      </header>

      {/* Tabs Filter */}
      <div className="flex flex-wrap gap-2">
        {["Todos", "Novo", "Lido", "Respondido"].map((status) => (
          <button
            key={status}
            onClick={() => setFiltroStatus(status)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              filtroStatus === status
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-[1.02]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {status === "Todos" ? "Todos os Feedbacks" : status}
          </button>
        ))}
      </div>

      {/* Main Body List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/85 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 font-semibold animate-pulse flex items-center justify-center gap-2">
            <Clock className="w-5 h-5 animate-spin" /> Carregando feedbacks...
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-slate-700 text-sm sm:text-base">Nenhum feedback encontrado</h3>
            <p className="text-xs text-slate-550 max-w-xs mx-auto leading-relaxed">
              Nenhuma sugestão ou relato correspondente a esta aba no momento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Cidadão</th>
                  <th className="px-6 py-4">Assunto</th>
                  <th className="px-6 py-4">Data Envio</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredFeedbacks.map((fb) => {
                  const dataFormatada = fb.createdAt?.toDate().toLocaleDateString("pt-BR") || "N/A";
                  return (
                    <tr key={fb.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] border ${getStatusStyle(fb.status)}`}>
                          {fb.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded border text-[10px] font-black uppercase ${getTipoStyle(fb.tipo)}`}>
                          {fb.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{fb.userName || "Munícipe"}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{fb.userEmail}</p>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate font-semibold text-slate-700">
                        {fb.assunto}
                      </td>
                      <td className="px-6 py-4 text-slate-450 font-semibold flex items-center gap-1.5 pt-6">
                        <Calendar className="w-3.5 h-3.5 text-slate-350" />
                        {dataFormatada}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedFeedback(fb);
                            if (fb.status === "Novo") {
                              updateFeedbackStatus(fb.id, "Lido");
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/50 font-bold transition-all text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detalhar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Feedback Details */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl transition-all flex flex-col relative max-h-[90vh] animate-fadeIn">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedFeedback(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded border text-[10px] font-black uppercase ${getTipoStyle(selectedFeedback.tipo)}`}>
                  {selectedFeedback.tipo}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] border ${getStatusStyle(selectedFeedback.status)}`}>
                  {selectedFeedback.status}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-800 mt-2">{selectedFeedback.assunto}</h2>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              
              {/* User details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-250/20 p-4 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Enviado por</span>
                    <span className="font-bold text-slate-800">{citizenName || selectedFeedback.userName || "Cidadão"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">E-mail</span>
                    <span className="font-semibold text-slate-700 break-all">{selectedFeedback.userEmail}</span>
                  </div>
                </div>
              </div>

              {/* Message content */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Mensagem do Cidadão</span>
                <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl text-slate-700 font-medium leading-relaxed whitespace-pre-line shadow-inner text-xs sm:text-sm">
                  {selectedFeedback.mensagem}
                </div>
              </div>

              {/* Attachments */}
              {selectedFeedback.anexos && selectedFeedback.anexos.length > 0 && (
                <div className="space-y-3">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Prints / Anexos do Problema</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {selectedFeedback.anexos.map((url: string, idx: number) => {
                      const secureUrl = getSecureUrl(url);
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedImage(secureUrl)}
                          className="cursor-pointer border border-slate-200 hover:border-emerald-500 rounded-2xl overflow-hidden aspect-square relative group bg-slate-50 shadow-sm transition-all"
                        >
                          <img src={secureUrl} alt="Anexo do feedback" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <span className="bg-black/50 px-2.5 py-1 rounded-xl text-[10px] font-bold backdrop-blur-sm">Ampliar</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action buttons */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2.5 justify-between items-center">
              
              <div className="flex gap-2">
                {selectedFeedback.status !== "Respondido" && (
                  <button
                    onClick={() => updateFeedbackStatus(selectedFeedback.id, "Respondido")}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCheck className="w-4 h-4" /> Marcar como Respondido
                  </button>
                )}
                {selectedFeedback.status === "Novo" && (
                  <button
                    onClick={() => updateFeedbackStatus(selectedFeedback.id, "Lido")}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                  >
                    Marcar como Lido
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedFeedback(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Fullscreen image zoom */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-950/95 z-55 flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <span className="text-white text-xs font-bold bg-slate-900/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
              Visualizando Imagem
            </span>
            <button 
              type="button"
              onClick={() => setSelectedImage(null)} 
              className="text-white bg-slate-900/60 hover:bg-slate-900/80 p-2.5 rounded-full backdrop-blur-sm transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-w-full max-h-[85vh] flex items-center justify-center">
            <img src={selectedImage} alt="Anexo ampliado" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

    </div>
  );
}
