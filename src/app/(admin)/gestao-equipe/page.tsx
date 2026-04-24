"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

// Usamos as mesmas variáveis de ambiente para a instância secundária
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export default function GestaoEquipePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && role !== "master") {
      router.push("/");
    }
  }, [loading, role, router]);

  const fetchAdmins = async () => {
    setIsLoadingAdmins(true);
    try {
      const snapshot = await getDocs(collection(db, "admins"));
      const adminsList: any[] = [];
      snapshot.forEach(doc => {
        adminsList.push({ id: doc.id, ...doc.data() });
      });
      setAdmins(adminsList);
    } catch (e) {
      console.error("Erro ao buscar equipe", e);
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  useEffect(() => {
    if (role === "master") {
      fetchAdmins();
    }
  }, [role]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // 1. Inicializa uma instância secundária do Firebase para não deslogar o Master atual
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Cria a conta no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
      const newUserId = userCredential.user.uid;

      // 3. Desloga a instância secundária
      await secondaryAuth.signOut();

      // 4. Salva no banco de dados Firestore
      await setDoc(doc(db, "admins", newUserId), {
        nome,
        email,
        cpf,
        telefone,
        role: "admin", // Novos criados sempre são admin
        createdAt: new Date().toISOString()
      });

      alert("Membro da equipe cadastrado com sucesso!");
      setNome(""); setEmail(""); setSenha(""); setCpf(""); setTelefone("");
      fetchAdmins();

    } catch (error: any) {
      console.error("Erro ao criar admin", error);
      alert("Erro ao criar membro: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading || role !== "master") return <div className="p-8">Verificando permissões...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestão de Equipe</h1>
        <p className="text-slate-500">Cadastre e gerencie os funcionários com acesso ao painel (Nível: Administrador).</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Cadastrar Novo Administrador</h2>
        <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600">Nome Completo</label>
            <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">Senha</label>
            <input type="password" required value={senha} onChange={e => setSenha(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">CPF</label>
            <input type="text" required value={cpf} onChange={e => setCpf(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">Telefone</label>
            <input type="text" required value={telefone} onChange={e => setTelefone(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white" />
          </div>
          <div className="md:col-span-2 flex justify-end mt-4">
            <button type="submit" disabled={isCreating} className="bg-emerald-600 text-white py-2 px-6 rounded-md hover:bg-emerald-700 font-semibold disabled:opacity-50">
              {isCreating ? "Cadastrando..." : "Cadastrar Membro"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-700">Membros da Equipe</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Cargo</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingAdmins ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center">Carregando equipe...</td></tr>
              ) : admins.map(admin => (
                <tr key={admin.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{admin.nome}</td>
                  <td className="px-6 py-4">{admin.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                      admin.role === 'master' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                      {admin.role === 'master' ? 'Master' : 'Admin'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
