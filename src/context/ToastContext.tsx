"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "warning" | "info" | "sucesso" | "erro" | "alerta";

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info"; visible: boolean } | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    let normalizedType: "success" | "error" | "warning" | "info" = "info";
    if (type === "success" || type === "sucesso") normalizedType = "success";
    else if (type === "error" || type === "erro") normalizedType = "error";
    else if (type === "warning" || type === "alerta") normalizedType = "warning";

    setToast({ message, type: normalizedType, visible: true });

    const id = setTimeout(() => {
      setToast((prev) => prev ? { ...prev, visible: false } : null);
    }, duration);

    setTimeoutId(id);
  }, [timeoutId]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div 
          style={{ zIndex: 99999 }}
          className={`fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm bg-white/95 border border-slate-200/70 p-4 rounded-2xl shadow-xl flex items-start gap-3 transition-all duration-300 ease-out border-l-4 ${
            toast.type === "success" 
              ? "border-l-emerald-500" 
              : toast.type === "error" 
              ? "border-l-rose-500" 
              : toast.type === "warning" 
              ? "border-l-amber-500" 
              : "border-l-blue-500"
          } ${
            toast.visible 
              ? "translate-y-0 opacity-100 scale-100" 
              : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
          }`}
        >
          {toast.type === "success" && (
            <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {toast.type === "error" && (
            <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {toast.type === "warning" && (
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {toast.type === "info" && (
            <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}

          <div className="flex-1 min-w-0 font-sans">
            <p className="text-xs font-bold text-slate-800 leading-tight">
              {toast.type === "success" 
                ? "Sucesso" 
                : toast.type === "error" 
                ? "Erro" 
                : toast.type === "warning" 
                ? "Aviso" 
                : "Informação"}
            </p>
            <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed break-words">
              {toast.message}
            </p>
          </div>

          <button 
            type="button"
            onClick={() => setToast(prev => prev ? { ...prev, visible: false } : null)}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5 rounded-lg hover:bg-slate-105 shrink-0 self-start mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
