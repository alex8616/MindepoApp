import React, { createContext, useContext, useEffect, useState } from 'react';
import { getUser, logout as logoutService } from '../services/authService';

interface User {
    id?: number;
    name?: string;
    email?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const loadUser = async () => {
        try {
            console.log('🔥 AUTH CONTEXT CARGADO');

            const userData = await getUser();

            console.log('📦 RAW USER:', userData);

            if (userData) {
                setUser(userData);
                console.log('✅ USER SET:', userData);
            } else {
                setUser(null);
                console.log('❌ SIN USER EN STORAGE');
            }

        } catch (error) {
            console.error('❌ ERROR AUTH:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUser();
    }, []);

    const logout = async () => {
        await logoutService();
        setUser(null);
    };

    const refreshUser = async () => {
        setLoading(true);
        await loadUser();
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            setUser,
            logout,
            refreshUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};