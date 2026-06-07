import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("salon_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("salon_token");
  });

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleLogin = (newUser: User, newToken: string) => {
    queryClient.clear();
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem("salon_user", JSON.stringify(newUser));
    localStorage.setItem("salon_token", newToken);
    
    // Redirect based on role
    if (newUser.role === "customer") setLocation("/customer");
    else if (newUser.role === "barber") setLocation("/barber");
    else if (newUser.role === "admin") setLocation("/admin");
  };

  const handleLogout = () => {
    queryClient.clear();
    setUser(null);
    setToken(null);
    localStorage.removeItem("salon_user");
    localStorage.removeItem("salon_token");
    setLocation("/login");
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem("salon_user", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        login: handleLogin,
        logout: handleLogout,
        updateUser: handleUpdateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
