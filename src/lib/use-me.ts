import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

export type Me = { id: string; username: string | null; displayName: string; phone: string | null; email: string | null; kycStatus?: string; roles: { role: string; status: string }[] };

/** The signed-in account (GET /me), shared by every screen that needs it. */
export function useMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['me'],
    enabled: status === 'signed_in',
    queryFn: async () => {
      const { data, error } = await api.GET('/me');
      if (error) throw error;
      return data as unknown as Me;
    },
  });
}
