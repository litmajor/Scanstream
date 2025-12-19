import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Share2, X, Check, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt?: string;
  userId?: string;
  description?: string;
}

interface WatchlistManagerProps {
  watchlists: Watchlist[];
  setWatchlists: (watchlists: Watchlist[]) => void;
}

export default function WatchlistManager({ watchlists: initialWatchlists, setWatchlists }: WatchlistManagerProps) {
  const [selectedWatchlist, setSelectedWatchlist] = useState<Watchlist | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch watchlists from API
  const { data: watchlistsData, isLoading } = useQuery({
    queryKey: ['watchlists'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/watchlists');
        if (!response.ok) throw new Error('Failed to fetch watchlists');
        return response.json();
      } catch (err) {
        console.error('Watchlist fetch error:', err);
        // Fall back to initial watchlists
        return { data: initialWatchlists };
      }
    },
  });

  const watchlists = watchlistsData?.data || initialWatchlists || [];

  useEffect(() => {
    if (watchlists.length > 0) {
      setWatchlists(watchlists);
    }
  }, [watchlists, setWatchlists]);

  // Create watchlist mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, symbols: [] }),
      });
      if (!response.ok) throw new Error('Failed to create watchlist');
      return response.json();
    },
    onSuccess: (newWatchlist) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setSelectedWatchlist(newWatchlist);
      setNewName('');
      setIsCreating(false);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create watchlist');
    },
  });

  // Update watchlist mutation
  const updateMutation = useMutation({
    mutationFn: async (watchlist: Watchlist) => {
      const response = await fetch(`/api/watchlists/${watchlist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: watchlist.name, symbols: watchlist.symbols }),
      });
      if (!response.ok) throw new Error('Failed to update watchlist');
      return response.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setSelectedWatchlist(updated);
      setEditingId(null);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to update watchlist');
    },
  });

  // Delete watchlist mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/watchlists/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete watchlist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setSelectedWatchlist(null);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to delete watchlist');
    },
  });

  const handleCreateWatchlist = async () => {
    if (!newName.trim()) return;
    createMutation.mutate(newName);
  };

  const handleDeleteWatchlist = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleUpdateWatchlist = async (updatedWatchlist: Watchlist) => {
    updateMutation.mutate(updatedWatchlist);
  };

  const handleRemoveSymbol = (symbol: string) => {
    if (!selectedWatchlist) return;
    const updated = {
      ...selectedWatchlist,
      symbols: selectedWatchlist.symbols.filter((s) => s !== symbol),
    };
    handleUpdateWatchlist(updated);
  };

  const handleCopyShareLink = () => {
    if (!selectedWatchlist) return;
    const url = `${window.location.origin}/watchlist/${selectedWatchlist.id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="grid grid-cols-3 gap-6 h-full">
      {/* Error Alert */}
      {error && (
        <div className="col-span-3 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Watchlists List */}
      <div className="col-span-1 border-r border-slate-700/30">
        <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
          <h3 className="font-semibold text-white">My Watchlists</h3>
          <button
            onClick={() => setIsCreating(true)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-blue-400 hover:text-blue-300"
            title="Create new watchlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isCreating && (
          <div className="p-3 border-b border-slate-700/30 space-y-2">
            <input
              type="text"
              placeholder="Watchlist name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateWatchlist();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateWatchlist}
                className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewName('');
                }}
                className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1 overflow-y-auto max-h-[calc(100%-60px)]">
          {watchlists.map((watchlist) => (
            <button
              key={watchlist.id}
              onClick={() => setSelectedWatchlist(watchlist)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                selectedWatchlist?.id === watchlist.id
                  ? 'bg-slate-800 border-l-2 border-blue-500'
                  : 'hover:bg-slate-800/50'
              }`}
            >
              <div className="font-medium text-white text-sm">{watchlist.name}</div>
              <div className="text-xs text-slate-400 mt-1">{watchlist.symbols.length} symbols</div>
            </button>
          ))}
        </div>
      </div>

      {/* Watchlist Details */}
      <div className="col-span-2">
        {selectedWatchlist ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/30">
              <div className="flex items-center justify-between mb-3">
                {editingId === selectedWatchlist.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => {
                        handleUpdateWatchlist({ ...selectedWatchlist, name: newName });
                        setEditingId(null);
                      }}
                      className="p-1.5 bg-green-600 hover:bg-green-700 rounded transition-colors text-white"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setNewName('');
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-slate-300"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-white">{selectedWatchlist.name}</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(selectedWatchlist.id);
                          setNewName(selectedWatchlist.name);
                        }}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Edit watchlist name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCopyShareLink}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Copy share link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWatchlist(selectedWatchlist.id)}
                        className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 hover:text-red-300"
                        title="Delete watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Created: {new Date(selectedWatchlist.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Symbols List */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedWatchlist.symbols.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <p>No symbols in this watchlist yet</p>
                  <p className="text-xs mt-2">Add symbols from the Symbol Universe</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {selectedWatchlist.symbols.map((symbol) => (
                    <div
                      key={symbol}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between hover:bg-slate-800 transition-colors"
                    >
                      <span className="font-medium text-white">{symbol}</span>
                      <button
                        onClick={() => handleRemoveSymbol(symbol)}
                        className="p-1 hover:bg-red-900/30 rounded transition-colors text-red-400"
                        title={`Remove ${symbol}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700/30 text-xs text-slate-400">
              Total symbols: {selectedWatchlist.symbols.length}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No watchlist selected</p>
              <p className="text-xs">Create or select a watchlist to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
