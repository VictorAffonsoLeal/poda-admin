"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

import { useToast } from "@/context/ToastContext";

interface AuthContextType {
  user: User | null;
  adminData: any | null;
  role: "master" | "admin" | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, adminData: null, role: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminData, setAdminData] = useState<any | null>(null);
  const [role, setRole] = useState<"master" | "admin" | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Busca na coleção admins
          const adminDocRef = doc(db, "admins", currentUser.uid);
          const adminDoc = await getDoc(adminDocRef);
          
          if (adminDoc.exists()) {
            setAdminData(adminDoc.data());
            setRole(adminDoc.data().role as "master" | "admin");
          } else {
            // Se não existe na coleção admins, é um cidadão que tentou logar no painel
            console.error("Acesso negado: Usuário não é um administrador.");
            await signOut(auth);
            setAdminData(null);
            setRole(null);
            setUser(null);
            showToast("Acesso negado. Apenas administradores podem acessar este painel.", "erro");
            router.push("/login");
          }
        } catch (error) {
          console.error("Error fetching admin data:", error);
        }
      } else {
        setAdminData(null);
        setRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, adminData, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
