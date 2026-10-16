export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'manager' | 'member';
  createdAt: any;
  lastLoginAt: any;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}