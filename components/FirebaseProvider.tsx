'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { getDocFromServer, doc } from 'firebase/firestore';

interface FirebaseContextType {
  user: User | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  isAuthReady: false,
  isAdmin: false,
  signIn: async () => {},
  signInWithEmail: async () => {},
  logOut: async () => {}
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
          
          // Check admin status
          if (currentUser.email === 'hello@danenso.com') {
            setIsAdmin(true);
          } else {
            const userDoc = await getDocFromServer(doc(db, 'users', currentUser.uid));
            setIsAdmin(userDoc.exists() && userDoc.data().role === 'admin');
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      } else {
        setIsAdmin(false);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in', error);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
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
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, isAuthReady, isAdmin, signIn, signInWithEmail, logOut }}>
      {children}
    </FirebaseContext.Provider>
  );
}
