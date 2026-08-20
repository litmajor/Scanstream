import { useQuery } from '@tanstack/react-query';
import { worldTicksKey } from '@/lib/queryKeys';
import type { UITick } from '@/types';

export default function useWorldTicks() {
  const result = useQuery<UITick[] | null>({
    queryKey: worldTicksKey,
    // World ticks arrive through the MDL subscription and are cache-only.
    enabled: false,
    staleTime: 500,
    select: (data: UITick[] | null) => data || [],
  });

  return result;
}
