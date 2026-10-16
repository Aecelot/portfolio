import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'sonner';
import { auth, googleProvider } from '@/lib/firebase';
import { migrateLeadsWithCreatedBy } from '@/lib/firestore';
import type { User, AuthContextType } from '@/types/user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Check if user has example.com email domain
        if (!firebaseUser.email?.endsWith('@example.com')) {
          firebaseSignOut(auth);
          setUser(null);
          setLoading(false);
          toast.error('Access restricted to @example.com email addresses only.');
          return;
        }
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName || firebaseUser.email!,
          photoURL: firebaseUser.photoURL || undefined,
          role: 'member', // Default role, can be updated in Firestore
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };
        setUser(userData);

        // Run migration to add createdBy to existing leads
        migrateLeadsWithCreatedBy(firebaseUser.uid)
          .then(result => {
            if (result.updated > 0) {
              console.log(`Migration: Updated ${result.updated} leads with createdBy`);
            }
          })
          .catch(err => console.error('Migration error:', err));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Sign-in successful:', result.user.email);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string; customData?: { email?: string } };
      console.error('Sign-in error:', error);
      console.error('Error code:', firebaseError.code);
      console.error('Error message:', firebaseError.message);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      toast.error(`Sign-in failed: ${firebaseError.code || firebaseError.message}`);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      toast.error('Failed to sign out. Please try again.');
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};