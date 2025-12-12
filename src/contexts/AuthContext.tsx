import React, { createContext, useContext, useEffect, useState } from 'react';
// AuthContext: Manages user authentication and roles
import { type User, onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';

interface AuthContextType {
    currentUser: User | null;
    userRole: 'admin' | 'editor' | 'viewer' | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<'admin' | 'editor' | 'viewer' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for mock user in local storage
        const storedUser = localStorage.getItem('mockUser');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user as User);
            setUserRole(user.email?.includes('admin') ? 'admin' : 'viewer');
            setLoading(false);
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Real user found, clear mock user
                localStorage.removeItem('mockUser');
                setCurrentUser(user);

                // Fetch user role from Firestore
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        setUserRole(userDoc.data().role as 'admin' | 'editor' | 'viewer');
                    } else {
                        // Create new user profile with default 'viewer' role
                        await setDoc(userDocRef, {
                            email: user.email,
                            role: 'viewer',
                            createdAt: new Date().toISOString()
                        });
                        setUserRole('viewer');
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setUserRole('viewer'); // Fallback
                }
            } else if (!storedUser) {
                // No real user and no mock user
                setCurrentUser(null);
                setUserRole(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email: string, password: string) => {
        if (email.endsWith('@demo.com')) {
            // Mock Login
            const mockUser = {
                uid: 'demo-user-123',
                email: email,
                displayName: email.split('@')[0],
                emailVerified: true,
            } as unknown as User;

            setCurrentUser(mockUser);
            setUserRole(email.includes('admin') ? 'admin' : 'viewer');
            localStorage.setItem('mockUser', JSON.stringify(mockUser));
            return;
        }

        // Real Firebase Login
        localStorage.removeItem('mockUser');
        await signInWithEmailAndPassword(auth, email, password);
    };

    const loginWithGoogle = async () => {
        localStorage.removeItem('mockUser');
        await signInWithPopup(auth, googleProvider);
    };

    const logout = async () => {
        localStorage.removeItem('mockUser');
        try {
            await signOut(auth);
        } catch (e) {
            // Ignore firebase errors if we were just using mock auth
            setCurrentUser(null);
            setUserRole(null);
        }
    };

    const value = {
        currentUser,
        userRole,
        loading,
        login,
        loginWithGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
