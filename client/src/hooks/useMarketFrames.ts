import { useQuery } from '@tanstack/react-query';
import { marketFramesKey } from '@/lib/queryKeys';

export default function useMarketFrames(exchange = 'default') {
  const key = marketFramesKey(exchange);
  const result = useQuery({
    queryKey: key,
    // Market frames arrive through the MDL subscription and are cache-only.
    enabled: false,
    staleTime: 1000, // short-lived stale so realtime deltas keep UI fresh
  });

  return result;
}
