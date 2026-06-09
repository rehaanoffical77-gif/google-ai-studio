import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, getRedirectResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  loginWithRedirect: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string, phone: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  redirectError: string | null;
  setRedirectError: (err: string | null) => void;
  verifyAndLoginAdminPasscode: (passcode: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isSecretAdmin') === 'true';
  });
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("Successfully logged in via redirect:", result.user);
        }
      })
      .catch((error) => {
        console.error("Firebase auth redirect error:", error);
        setRedirectError(error.code || error.message);
      });
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (localStorage.getItem('isSecretAdmin') === 'true') {
        setIsAdmin(true);
        setLoading(false);
        return;
      }
      if (user) {
        try {
          const { doc, getDoc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          let userData = userDoc.data();
          if (!userDoc.exists()) {
            userData = {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              createdAt: new Date(),
              role: 'user'
            };
            await setDoc(userDocRef, userData);
          }
          
          // Check for hardcoded admin emails or 'admin' role
          const adminEmails = ['rehaanoffical77@gmail.com', 'capcutrehaan@gmail.com', 'rehaanhacker4@gmai.com'];
          setIsAdmin(userData?.role === 'admin' || adminEmails.includes(user.email || '') || localStorage.getItem('isSecretAdmin') === 'true');
        } catch (error) {
          console.error("Error fetching user role:", error);
          setIsAdmin(localStorage.getItem('isSecretAdmin') === 'true');
        }
      } else {
        setIsAdmin(localStorage.getItem('isSecretAdmin') === 'true');
      }
      setLoading(false);
    });
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isInAppBrowser = /FBAN|FBAV|Instagram|Twitter|Line|WhatsApp/i.test(navigator.userAgent);

      if (isMobile || isInAppBrowser) {
        await signInWithRedirect(auth, provider);
      } else {
        try {
          await signInWithPopup(auth, provider);
        } catch (innerError: any) {
          if (innerError.code === 'auth/cancelled-popup-request' || innerError.code === 'auth/popup-closed-by-user') {
            return;
          }
          if (innerError.code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, provider);
            return;
          }
          throw innerError;
        }
      }
    } catch (error: any) {
      throw error;
    }
  };

  const loginWithRedirect = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signupWithEmail = async (email: string, pass: string, name: string, phone: string) => {
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: name });
    
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      email,
      displayName: name,
      phone,
      createdAt: new Date(),
      role: 'user'
    });
  };

  const resetPassword = async (email: string) => {
    const { sendPasswordResetEmail } = await import('firebase/auth');
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    localStorage.removeItem('isSecretAdmin');
    setIsAdmin(false);
    await signOut(auth);
  };

  const verifyAndLoginAdminPasscode = async (passcode: string) => {
    const validCodes = ['rehaan77', 'rehaan7788', '7788', '9900'];
    if (validCodes.includes(passcode.toLowerCase().trim())) {
      localStorage.setItem('isSecretAdmin', 'true');
      setIsAdmin(true);

      if (auth.currentUser) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          await setDoc(doc(db, 'admins', auth.currentUser.uid), {
            uid: auth.currentUser.uid,
            secret: passcode.toLowerCase().trim(),
            email: auth.currentUser.email || '',
            assignedAt: new Date().toISOString()
          });
          console.log("Registered admin passcode bypass entry in cloud Firestore");
        } catch (e) {
          console.error("Failed to register admin passcode in cloud Firestore:", e);
        }
      }
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin,
      loading, 
      login, 
      loginWithRedirect,
      loginWithEmail, 
      signupWithEmail, 
      resetPassword, 
      logout,
      redirectError,
      setRedirectError,
      verifyAndLoginAdminPasscode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
