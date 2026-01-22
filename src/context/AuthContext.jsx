import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import bcrypt from 'bcryptjs';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user from local storage", e);
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password, role) => {
        try {
            let table = '';
            if (role === 'agent') table = 'agents';
            else if (role === 'customer') table = 'customers';
            else if (role === 'admin') table = 'admins';
            else return { success: false, error: 'Invalid role' };

            const { data: user, error } = await supabase
                .from(table)
                .select('*')
                .eq('email', email)
                .single();

            if (error || !user) {
                return { success: false, error: 'User not found' };
            }

            // Fallback strategy for manual Supabase dashboard entries (plain text) vs hashed passwords
            let passwordIsValid = false;
            try {
                // Check if it's a bcrypt hash and compare
                if (user.password && user.password.startsWith('$2')) {
                    passwordIsValid = bcrypt.compareSync(password, user.password);
                } else {
                    // Fallback to plain text comparison
                    passwordIsValid = (password === user.password);
                }
            } catch (err) {
                // In case of any error parsing the hash, try plain text
                passwordIsValid = (password === user.password);
            }

            if (!passwordIsValid) {
                return { success: false, error: 'Invalid password' };
            }

            if (role === 'agent' && user.status !== 'Active') {
                return { success: false, error: 'Account is pending approval. Please contact admin.' };
            }

            const userData = { ...user, role };
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('role', role);

            setUser(userData);
            return { success: true };
        } catch (error) {
            console.error("Login Error:", error);
            return {
                success: false,
                error: 'Login failed'
            };
        }
    };

    const register = async (role, data) => {
        try {
            // If data is FormData (for agent registration with files), we need to handle multi-step.
            // For Option B, we'll try to convert FormData back to object for simple inserts, 
            // or use Supabase Storage if files are involved.

            let payload = {};
            if (data instanceof FormData) {
                data.forEach((value, key) => {
                    payload[key] = value;
                });
            } else {
                payload = data;
            }

            const hashedPassword = bcrypt.hashSync(payload.password || 'default', 8);
            payload.password = hashedPassword;

            let table = role === 'agent' ? 'agents' : 'customers';

            // Clean up payload fields that aren't in the DB schema if necessary
            delete payload.confirmPassword;
            if (role === 'agent') {
                payload.status = 'Pending';
                // Note: File handling for profile_photo/cnic_document would normally use Supabase Storage here.
                // For now, we'll store the filename or skip it for brevity in this initial refactor.
            }

            const { error } = await supabase.from(table).insert([payload]);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Registration Error:", error);
            return {
                success: false,
                error: error.message || 'Registration failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
