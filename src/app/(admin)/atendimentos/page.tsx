"use client";

import { useState, useEffect, useRef } from "react";
import {
  collection, query, orderBy, onSnapshot, doc,
  addDoc, updateDoc, serverTimestamp, increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Send, CheckCircle, MessageCircle, Clock, Search, ChevronLeft, Mail, AlertCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function AtendimentosPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatAberto, setChatAberto] = useState<any | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [texto, setTexto] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lista de todos os chats
  useEffect(() => {
    const q = query(collection(db, "chats"), orderBy("ultimaAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChats(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Mensagens do chat aberto
  useEffect(() => {
    if (!chatAberto) {
      setMensagens([]);
      return;
    }

    const msgsRef = collection(db, "chats", chatAberto.id, "mensagens");
    const q = query(msgsRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMensagens(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [chatAberto]);

  // Scroll ao final
  useEffect(() => {
    if (chatAberto) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [mensagens, chatAberto]);

  // Marcar msgs do user como lidas quando admin abre o chat
  useEffect(() => {
    if (!chatAberto || mensagens.length === 0) return;

    const unread = mensagens.filter((m) => m.remetente === "user" && !m.lida);
    if (unread.length === 0) return;

    unread.forEach(async (m) => {
      try {
        await updateDoc(doc(db, "chats", chatAberto.id, "mensagens", m.id), { lida: true });
      } catch (_) {}
    });

    try {
      updateDoc(doc(db, "chats", chatAberto.id), { naoLidoAdmin: 0 });
    } catch (_) {}

    setTimeout(() => inputRef.current?.focus(), 200);
  }, [chatAberto, mensagens.length]);

  const abrirChat = (chat: any) => {
    setChatAberto(chat);
  };

  const fecharChat = () => {
    setChatAberto(null);
    setTexto("");
  };

  const enviarResposta = async () => {
    if (!texto.trim() || !chatAberto || isSending) return;

    setIsSending(true);
    const msg = texto.trim();
    setTexto("");

    try {
      await addDoc(collection(db, "chats", chatAberto.id, "mensagens"), {
        conteudo: msg,
        remetente: "admin",
        timestamp: serverTimestamp(),
        lida: false,
      });

      await updateDoc(doc(db, "chats", chatAberto.id), {
        ultimaMensagem: msg,
        ultimaAt: serverTimestamp(),
        naoLidoUser: increment(1),
      });
    } catch (e) {
      console.error("Erro ao enviar resposta:", e);
      showToast("Erro ao enviar resposta.", "erro");
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const fecharAtendimento = async () => {
    if (!chatAberto) return;
    if (!confirm("Tem certeza que deseja fechar este atendimento?")) return;
    try {
      await updateDoc(doc(db, "chats", chatAberto.id), { status: "fechado" });
      await addDoc(collection(db, "chats", chatAberto.id, "mensagens"), {
        conteudo: "✅ Atendimento encerrado pela equipe. Obrigado pelo contato!",
        remetente: "admin",
        timestamp: serverTimestamp(),
        lida: false,
      });
      fecharChat();
      showToast("Atendimento encerrado com sucesso!", "sucesso");
    } catch (e) {
      console.error("Erro ao fechar atendimento:", e);
      showToast("Erro ao fechar atendimento.", "erro");
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalNaoLidos = chats.reduce((sum, c) => sum + (c.naoLidoAdmin || 0), 0);

  const filteredChats = chats.filter((c) =>
    c.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-9.5rem)] flex gap-6 animate-fadeIn">
      {/* ── COLUNA DA ESQUERDA: LISTA DE CHATS ── */}
      <div className={`w-full lg:w-1/3 flex flex-col bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden shrink-0 ${
        chatAberto ? "hidden lg:flex" : "flex"
      }`}>
        {/* Header Lista */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              <h1 className="font-extrabold text-slate-800 text-base">Atendimentos</h1>
            </div>
            {totalNaoLidos > 0 && (
              <span className="bg-red-50 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                {totalNaoLidos} pendente{totalNaoLidos !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cidadão..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 text-slate-900 bg-white placeholder-slate-400 transition-all focus:outline-none"
            />
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-450 font-medium">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Carregando conversas...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <MessageCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-500 font-bold text-xs">Nenhuma conversa</p>
              <p className="text-[10px] text-slate-400">Mensagens dos cidadãos aparecerão aqui.</p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const hasUnread = (chat.naoLidoAdmin || 0) > 0;
              const isClosed = chat.status === "fechado";
              const isSelected = chatAberto?.id === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => abrirChat(chat)}
                  className={`px-4 py-3.5 flex items-center gap-3.5 cursor-pointer transition-all border-l-3 ${
                    isSelected
                      ? "bg-emerald-50/20 border-emerald-500"
                      : hasUnread
                      ? "bg-amber-50/20 border-amber-400 hover:bg-slate-50"
                      : "border-transparent hover:bg-slate-50/60"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                    isClosed
                      ? "bg-slate-50 text-slate-400 border-slate-200/50"
                      : hasUnread
                      ? "bg-amber-50 text-amber-700 border-amber-250/50"
                      : "bg-emerald-50 text-emerald-700 border-emerald-250/50"
                  }`}>
                    {chat.userName?.charAt(0)?.toUpperCase() || "?"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate font-extrabold ${hasUnread ? "text-slate-900" : "text-slate-700"}`}>
                        {chat.userName || "Usuário"}
                      </p>
                      {chat.ultimaAt && (
                        <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                          {formatTime(chat.ultimaAt).split(" ")[1] || formatTime(chat.ultimaAt).split(" ")[0]}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${hasUnread ? "text-slate-800 font-semibold" : "text-slate-450"}`}>
                      {chat.ultimaMensagem || "Sem mensagens"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isClosed ? (
                        <span className="text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          Encerrado
                        </span>
                      ) : (
                        <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200/40">
                          Ativo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  {hasUnread && (
                    <span className="w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shrink-0">
                      {chat.naoLidoAdmin}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── COLUNA DA DIREITA: CONVERSA SELECIONADA ── */}
      <div className={`w-full lg:w-2/3 flex flex-col bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden ${
        chatAberto ? "flex" : "hidden lg:flex items-center justify-center bg-slate-50/50 border-dashed"
      }`}>
        {chatAberto ? (
          <>
            {/* Header Conversa */}
            <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={fecharChat}
                  className="lg:hidden text-slate-500 hover:text-emerald-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center font-bold text-emerald-700 text-sm shrink-0">
                  {chatAberto.userName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm leading-snug">{chatAberto.userName || "Cidadão"}</h3>
                  <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3" />
                    {chatAberto.userEmail}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  chatAberto.status === "fechado"
                    ? "bg-slate-50 text-slate-500 border-slate-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                }`}>
                  {chatAberto.status === "fechado" ? "Encerrado" : "Aberto"}
                </span>

                {chatAberto.status !== "fechado" && (
                  <button
                    onClick={fecharAtendimento}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 hover:border-rose-200 rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Concluir</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 min-h-0">
              {mensagens.map((m) => {
                const isAdmin = m.remetente === "admin";
                return (
                  <div
                    key={m.id}
                    className={`flex items-end gap-2.5 ${isAdmin ? "justify-end" : "justify-start"}`}
                  >
                    {!isAdmin && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-350 flex items-center justify-center shrink-0 text-xs font-black text-slate-600 shadow-sm">
                        {chatAberto.userName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5 max-w-[70%]">
                      <div className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                        isAdmin
                          ? "bg-emerald-600 text-white rounded-br-sm"
                          : "bg-white text-slate-700 rounded-bl-sm border border-slate-200/60"
                      }`}>
                        {m.conteudo}
                      </div>
                      {m.timestamp && (
                        <p className={`text-[9px] text-slate-400 font-medium ${isAdmin ? "text-right" : "text-left"}`}>
                          {formatTime(m.timestamp)}
                          {isAdmin && (
                            <span className={`ml-1 font-bold ${m.lida ? "text-emerald-500" : "text-slate-350"}`}>
                              {m.lida ? "✓ lida" : "✓ enviado"}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Campo de Resposta */}
            <div className="bg-white border-t border-slate-100 p-4 shrink-0">
              {chatAberto.status === "fechado" ? (
                <div className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-50 border border-slate-150 rounded-xl text-slate-400 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Este atendimento foi encerrado.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviarResposta();
                      }
                    }}
                    placeholder="Digite sua resposta..."
                    className="flex-1 px-4 py-3 text-xs sm:text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all placeholder:text-slate-450"
                  />
                  <button
                    onClick={enviarResposta}
                    disabled={isSending || !texto.trim()}
                    className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 shadow-sm cursor-pointer"
                  >
                    <Send className="w-4.5 h-4.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center p-8 space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 mx-auto shadow-inner">
              <MessageCircle className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">Nenhum Atendimento Selecionado</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mx-auto">
              Selecione uma conversa na lista lateral para visualizar o histórico de mensagens e responder ao cidadão.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
