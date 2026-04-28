'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { getDocFromServer, doc, setDoc } from 'firebase/firestore';

interface FirebaseContextType {
  user: User | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  accessDenied: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  isAuthReady: false,
  isAdmin: false,
  isSuperAdmin: false,
  accessDenied: false,
  signIn: async () => {},
  signInWithEmail: async () => {},
  logOut: async () => {}
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (!currentUser) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        return;
      }

      // Reset accessDenied when a new user signs in
      setAccessDenied(false);

      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;

      const isSA = !!(
        (adminEmail && currentUser.email === adminEmail) ||
        (adminUid && currentUser.uid === adminUid)
      );

      if (isSA) {
        setIsSuperAdmin(true);
        setIsAdmin(true);
        setDoc(doc(db, 'users', currentUser.uid), {
          role: 'admin',
          email: currentUser.email
        }, { merge: true }).catch((e) => console.error("Failed to set admin role in DB", e));
      } else {
        setIsSuperAdmin(false);
        (async () => {
          try {
            const userDoc = await getDocFromServer(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              setIsAdmin(userDoc.data().role === 'admin');
            } else {
              // New user — check invitation
              const inviteDoc = await getDocFromServer(doc(db, 'invitations', currentUser.email!));
              if (inviteDoc.exists()) {
                await setDoc(doc(db, 'users', currentUser.uid), {
                  role: 'user',
                  email: currentUser.email
                }, { merge: true });
                setIsAdmin(false);
              } else {
                // Not invited — deny access
                setAccessDenied(true);
                await signOut(auth);
              }
            }
          } catch {
            setIsAdmin(false);
          }
        })();
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setAccessDenied(false);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in', error);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAccessDenied(false);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Error signing in with email', error);
      throw error;
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, isAuthReady, isAdmin, isSuperAdmin, accessDenied, signIn, signInWithEmail, logOut }}>
      {children}
    </FirebaseContext.Provider>
  );
}
