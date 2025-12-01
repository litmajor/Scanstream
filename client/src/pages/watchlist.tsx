import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface WatchlistItem {
  id: string;
  symbol: string;
  addedAt: string;
  notes?: string;
  price?: number;
}

export default function WatchlistPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [newSymbol, setNewSymbol] = useState('');
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Fetch watchlist
  const { data: watchlist, isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ['/api/user/watchlist'],
    enabled: isAuthenticated,
    retry: 1,
    initialData: []
  });

  // Add to watchlist
  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest('POST', '/api/user/watchlist', { symbol: symbol.toUpperCase() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/watchlist'] });
      setNewSymbol('');
      toast({ title: 'Added to watchlist', description: `${newSymbol.toUpperCase()} added successfully.` });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error?.message || 'Failed to add symbol', 
        variant: 'destructive' 
      });
    }
  });

  // Remove from watchlist
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/user/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/watchlist'] });
      toast({ title: 'Removed', description: 'Item removed from watchlist.' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error?.message || 'Failed to remove item', 
        variant: 'destructive' 
      });
    }
  });

  // Fetch prices
  useEffect(() => {
    const fetchPrices = async () => {
      if (!watchlist?.length) return;

      try {
        const symbols = watchlist.map(w => w.symbol.toLowerCase()).join(',');
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${symbols}&vs_currencies=usd`
        );
        const data = await response.json();
        
        const newPrices: Record<string, number> = {};
        watchlist.forEach(item => {
          const key = item.symbol.toLowerCase();
          if (data[key]) {
            newPrices[item.symbol] = data[key].usd;
          }
        });
        setPrices(newPrices);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [watchlist]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Watchlist</h1>
        <p className="text-muted-foreground">Track your favorite cryptocurrencies</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add Symbol</CardTitle>
          <CardDescription>Add a new cryptocurrency to your watchlist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="BTC, ETH, SOL..."
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newSymbol.trim()) {
                  addMutation.mutate(newSymbol.trim());
                }
              }}
              data-testid="input-add-symbol"
            />
            <Button 
              onClick={() => newSymbol.trim() && addMutation.mutate(newSymbol.trim())}
              disabled={!newSymbol.trim() || addMutation.isPending}
              data-testid="button-add-symbol"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : watchlist?.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No symbols in your watchlist yet</p>
            </CardContent>
          </Card>
        ) : (
          watchlist?.map((item) => {
            const price = prices[item.symbol] || 0;
            return (
              <Card key={item.id} data-testid={`card-watchlist-${item.symbol}`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.symbol}</Badge>
                        {price > 0 && (
                          <span className="text-lg font-semibold">${price.toLocaleString()}</span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{item.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${item.symbol}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
