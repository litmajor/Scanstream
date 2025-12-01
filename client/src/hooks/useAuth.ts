import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  preferences?: {
    theme: string;
    defaultTimeframe: string;
    defaultExchange: string;
    notificationsEnabled: boolean;
    emailAlerts: boolean;
    priceAlerts: boolean;
    signalAlerts: boolean;
    soundEnabled: boolean;
  };
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
