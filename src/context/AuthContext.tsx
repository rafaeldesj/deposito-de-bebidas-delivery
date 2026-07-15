import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { supabase } from '../config/supabase';
import type { UserDocument } from '../types/user';

interface AuthContextType {
  user: User | null;
  userData: UserDocument | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string, phoneNumber?: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePhoneNumber: (phone: string) => Promise<void>;
  completeRegistration: (name: string, phone: string) => Promise<void>;
}

export const mapUserFromDb = (row: any): UserDocument => {
  return {
    uid: row.uid,
    email: row.email,
    name: row.name,
    role: row.role,
    phoneNumber: row.phone_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cpf: row.cpf,
    clientAddress: row.client_address,
    pagbank_customer_id: row.pagbank_customer_id,
    pagbank_card_token: row.pagbank_card_token,
    pagbank_card_brand: row.pagbank_card_brand,
    pagbank_card_last_digits: row.pagbank_card_last_digits,
    staffFunctions: row.staff_functions,
    tempPassword: row.temp_password,
  };
};

export const mapUserToDb = (user: Partial<UserDocument>) => {
  const dbData: any = {};
  if (user.uid !== undefined) dbData.uid = user.uid;
  if (user.email !== undefined) dbData.email = user.email;
  if (user.name !== undefined) dbData.name = user.name;
  if (user.role !== undefined) dbData.role = user.role;
  if (user.phoneNumber !== undefined) dbData.phone_number = user.phoneNumber;
  if (user.createdAt !== undefined) dbData.created_at = user.createdAt;
  if (user.updatedAt !== undefined) dbData.updated_at = user.updatedAt;
  if (user.cpf !== undefined) dbData.cpf = user.cpf;
  if (user.clientAddress !== undefined) dbData.client_address = user.clientAddress;
  if (user.pagbank_customer_id !== undefined) dbData.pagbank_customer_id = user.pagbank_customer_id;
  if (user.pagbank_card_token !== undefined) dbData.pagbank_card_token = user.pagbank_card_token;
  if (user.pagbank_card_brand !== undefined) dbData.pagbank_card_brand = user.pagbank_card_brand;
  if (user.pagbank_card_last_digits !== undefined) dbData.pagbank_card_last_digits = user.pagbank_card_last_digits;
  if (user.staffFunctions !== undefined) dbData.staff_functions = user.staffFunctions;
  if (user.tempPassword !== undefined) dbData.temp_password = user.tempPassword;
  return dbData;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Busca o perfil do usuário no Supabase
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('uid', currentUser.uid)
            .maybeSingle();

          if (profile) {
            setUserData(mapUserFromDb(profile));
          } else {
            // Se o documento não existir, busca pré-cadastro por email
            let foundPreRegistration = false;
            if (currentUser.email) {
              const { data: preRegs } = await supabase
                .from('users')
                .select('*')
                .eq('email', currentUser.email)
                .limit(1);
                
              if (preRegs && preRegs.length > 0) {
                const preRegData = mapUserFromDb(preRegs[0]);
                const finalUserData: UserDocument = {
                  ...preRegData,
                  uid: currentUser.uid,
                  updatedAt: new Date().toISOString(),
                };
                
                await supabase.from('users').upsert(mapUserToDb(finalUserData));
                
                if (preRegData.uid !== currentUser.uid) {
                  await supabase.from('users').delete().eq('uid', preRegData.uid);
                }
                
                setUserData(finalUserData);
                foundPreRegistration = true;
              }
            }

            if (!foundPreRegistration) {
              setUserData(null);
            }
          }
        } catch (err) {
          console.error("Erro ao buscar dados do usuário no Supabase:", err);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile && !isLocalhost) {
      try {
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        console.warn("signInWithPopup falhou no celular, tentando redirect...", err);
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
          await signInWithRedirect(auth, provider);
        } else {
          throw err;
        }
      }
    } else {
      await signInWithPopup(auth, provider);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (email: string, password: string, name: string, phoneNumber?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const currentUser = userCredential.user;
    
    await updateProfile(currentUser, { displayName: name });
    
    const newUserData: UserDocument = {
      uid: currentUser.uid,
      email: currentUser.email || '',
      name: name,
      role: 'client',
      phoneNumber: phoneNumber || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const { error } = await supabase.from('users').upsert(mapUserToDb(newUserData));
    if (error) throw error;
    setUserData(newUserData);
  };

  const updatePhoneNumber = async (phone: string) => {
    if (!user) return;
    const { error } = await supabase.from('users').update(mapUserToDb({
      phoneNumber: phone,
      updatedAt: new Date().toISOString()
    })).eq('uid', user.uid);
    
    if (error) throw error;
    setUserData(prev => prev ? { ...prev, phoneNumber: phone } : null);
  };

  const completeRegistration = async (name: string, phone: string) => {
    if (!user) return;
    
    const { data: existingRow } = await supabase.from('users').select('*').eq('uid', user.uid).maybeSingle();
    const existingData = existingRow ? mapUserFromDb(existingRow) : null;
    
    const finalUserData: UserDocument = {
      uid: user.uid,
      email: user.email || '',
      name: name,
      role: existingData?.role || 'client',
      phoneNumber: phone,
      createdAt: existingData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(existingData || {})
    };
    
    const { error } = await supabase.from('users').upsert(mapUserToDb(finalUserData));
    if (error) throw error;
    setUserData(finalUserData);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, loginWithGoogle, loginWithEmail, registerWithEmail, logout, updatePhoneNumber, completeRegistration }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
