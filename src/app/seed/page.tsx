"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SeedMasterPage() {
  const [status, setStatus] = useState("");

  const criarMaster = async () => {
    setStatus("Criando conta no Auth...");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, "master@poda.com.br", "master123");
      const user = userCredential.user;

      setStatus("Conta criada! Salvando no Firestore na coleção admins...");
      await setDoc(doc(db, "admins", user.uid), {
        nome: "Administrador Master",
        email: "master@poda.com.br",
        cpf: "000.000.000-00",
        telefone: "(00) 00000-0000",
        role: "master",
        createdAt: new Date().toISOString()
      });

      setStatus("Sucesso! Conta Master criada. Você pode apagar esta página e fazer login.");
    } catch (e: any) {
      console.error(e);
      setStatus("Erro: " + e.message);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto mt-20 bg-white rounded-xl shadow-lg text-center">
      <h1 className="text-2xl font-bold mb-4 text-slate-800">Seed Database</h1>
      <p className="mb-6 text-slate-600">Clique para criar a conta master@poda.com.br</p>
      <button 
        onClick={criarMaster}
        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700"
      >
        Criar Usuário Master
      </button>
      {status && <p className="mt-4 p-3 bg-slate-100 rounded text-sm text-slate-700">{status}</p>}
    </div>
  );
}
