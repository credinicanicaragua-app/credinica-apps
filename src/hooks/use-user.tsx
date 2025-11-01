
'use client';

import * as React from 'react';
import type { AppUser } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface UserContextType {
  user: AppUser | null;
  loading: boolean;
  setUser: (user: AppUser | null) => void;
}

const UserContext = React.createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    async function getUserSession() {
      try {
        const response = await fetch('/api/me');
        
        if (response.ok) {
          const userData: AppUser = await response.json();
          if (userData && userData.id) {
            setUser(userData);
          } else {
            setUser(null);
          }
        } else {
          // If the API call fails, we assume no user is logged in.
          setUser(null);
        }
      } catch (error) {
        console.error("Error fetching user session:", error);
        setUser(null);
      } finally {
        // We set loading to false regardless of the outcome.
        setLoading(false);
      }
    }

    getUserSession();
  }, []);
  
  const handleSetUser = (updatedUser: AppUser | null) => {
    setUser(updatedUser);
  };

  const contextValue = {
    user,
    loading,
    setUser: handleSetUser,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
