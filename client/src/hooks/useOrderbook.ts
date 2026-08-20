import { useQuery } from '@tanstack/react-query';
import { orderbookKey } from '@/lib/queryKeys';

export default function useOrderbook(symbol: string | undefined) {
  const key = symbol ? orderbookKey(symbol) : ['orderbook', 'unknown'];
  const result = useQuery({
    queryKey: key,
    enabled: !!symbol,
    staleTime: 500,
  });

  return result;
}
