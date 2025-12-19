import React, { useState, useEffect } from 'react';
import { Archive, Search, Trash2, Download, Plus, X, Tag, Calendar, TrendingUp, RefreshCw } from 'lucide-react';

interface BacktestMetrics {
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
}

interface ArchivedResult {
  id: string;
  name: string;
  preset?: string;
  assets: string[];
  metrics: BacktestMetrics;
  archivedAt: number;
  tags: string[];
  notes: string;
}

interface ArchiveStorage {
  results: ArchivedResult[];
  lastUpdated: number;
}

interface ResultsArchiveProps {
  onLoadResult?: (result: ArchivedResult) => void;
  onExportResult?: (result: ArchivedResult) => void;
}

// Archive Manager Class
class ArchiveManager {
  private storageKey = 'backtest_archive_v1';

  save(
    name: string,
    preset: string,
    assets: string[],
    metrics: BacktestMetrics,
    tags: string[],
    notes: string
  ): ArchivedResult {
    const archived: ArchivedResult = {
      id: `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      preset,
      assets,
      metrics,
      archivedAt: Date.now(),
      tags,
      notes,
    };

    const storage = this.getStorage();
    storage.results.push(archived);
    storage.lastUpdated = Date.now();
    localStorage.setItem(this.storageKey, JSON.stringify(storage));

    return archived;
  }

  getAll(): ArchivedResult[] {
    return this.getStorage().results;
  }

  search(query: string): ArchivedResult[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.preset?.toLowerCase().includes(lower) ||
        r.assets.some((a) => a.toLowerCase().includes(lower)) ||
        r.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }

  filterByTags(tags: string[]): ArchivedResult[] {
    if (tags.length === 0) return this.getAll();
    return this.getAll().filter((r) => tags.some((tag) => r.tags.includes(tag)));
  }

  filterByDateRange(startDate: number, endDate: number): ArchivedResult[] {
    return this.getAll().filter((r) => r.archivedAt >= startDate && r.archivedAt <= endDate);
  }

  delete(id: string): void {
    const storage = this.getStorage();
    storage.results = storage.results.filter((r) => r.id !== id);
    storage.lastUpdated = Date.now();
    localStorage.setItem(this.storageKey, JSON.stringify(storage));
  }

  update(id: string, updates: Partial<ArchivedResult>): void {
    const storage = this.getStorage();
    const result = storage.results.find((r) => r.id === id);
    if (result) {
      Object.assign(result, updates);
      storage.lastUpdated = Date.now();
      localStorage.setItem(this.storageKey, JSON.stringify(storage));
    }
  }

  private getStorage(): ArchiveStorage {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : { results: [], lastUpdated: 0 };
  }
}

const ResultsArchive: React.FC<ResultsArchiveProps> = ({ onLoadResult, onExportResult }) => {
  const [archiveManager] = useState(() => new ArchiveManager());
  const [allResults, setAllResults] = useState<ArchivedResult[]>([]);
  const [displayedResults, setDisplayedResults] = useState<ArchivedResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'return' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [newTag, setNewTag] = useState('');

  // Load results
  useEffect(() => {
    loadResults();
  }, []);

  // Filter and sort
  useEffect(() => {
    let filtered = allResults;

    // Apply search
    if (searchQuery) {
      filtered = archiveManager.search(searchQuery);
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((r) => selectedTags.some((tag) => r.tags.includes(tag)));
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'date') {
        comparison = a.archivedAt - b.archivedAt;
      } else if (sortBy === 'return') {
        comparison = (a.metrics.totalReturn ?? 0) - (b.metrics.totalReturn ?? 0);
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setDisplayedResults(sorted);
  }, [allResults, searchQuery, selectedTags, sortBy, sortOrder]);

  const loadResults = () => {
    setAllResults(archiveManager.getAll());
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this archived result?')) {
      archiveManager.delete(id);
      loadResults();
    }
  };

  const handleAddTag = (resultId: string, tag: string) => {
    if (tag.trim()) {
      const result = allResults.find((r) => r.id === resultId);
      if (result && !result.tags.includes(tag)) {
        archiveManager.update(resultId, {
          tags: [...result.tags, tag],
        });
        loadResults();
        setNewTag('');
      }
    }
  };

  const handleRemoveTag = (resultId: string, tag: string) => {
    const result = allResults.find((r) => r.id === resultId);
    if (result) {
      archiveManager.update(resultId, {
        tags: result.tags.filter((t) => t !== tag),
      });
      loadResults();
    }
  };

  const handleSaveNotes = (resultId: string) => {
    archiveManager.update(resultId, { notes: editNotes });
    loadResults();
    setEditingId(null);
  };

  // Get all unique tags
  const allTags = Array.from(
    new Set(allResults.flatMap((r) => r.tags))
  ).sort();

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Archive className="w-6 h-6 text-purple-400" />
            Results Archive
          </h2>
          <p className="text-gray-400 mt-1">{allResults.length} archived results</p>
        </div>
        <button
          onClick={loadResults}
          className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-white"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, preset, asset, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Filter by tags:</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setSelectedTags(
                        selectedTags.includes(tag)
                          ? selectedTags.filter((t) => t !== tag)
                          : [...selectedTags, tag]
                      )
                    }
                    className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                      selectedTags.includes(tag)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sort Options */}
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('date')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'date'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                Date
              </button>
              <button
                onClick={() => setSortBy('return')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'return'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                Return
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'name'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                Name
              </button>
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      {displayedResults.length > 0 ? (
        <div className="space-y-3">
          {displayedResults.map((result) => (
            <div
              key={result.id}
              className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-purple-500 transition-colors"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{result.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                    {result.preset && (
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs">{result.preset}</span>
                    )}
                    {result.assets.length > 0 && (
                      <span className="text-xs">
                        {result.assets.join(', ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(result.archivedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">
                    {((result.metrics.totalReturn ?? 0) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">Return</p>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="bg-gray-900 rounded p-2">
                  <p className="text-xs text-gray-400">Sharpe</p>
                  <p className="font-semibold text-white">
                    {(result.metrics.sharpeRatio ?? 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-900 rounded p-2">
                  <p className="text-xs text-gray-400">Max DD</p>
                  <p className="font-semibold text-red-400">
                    {((result.metrics.maxDrawdown ?? 0) * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="bg-gray-900 rounded p-2">
                  <p className="text-xs text-gray-400">Win Rate</p>
                  <p className="font-semibold text-blue-400">
                    {((result.metrics.winRate ?? 0) * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="bg-gray-900 rounded p-2">
                  <p className="text-xs text-gray-400">Sharpe</p>
                  <p className="font-semibold text-white">
                    {(result.metrics.sharpeRatio ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {result.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {result.tags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-900 bg-opacity-50 border border-purple-500 rounded text-xs text-purple-300"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(result.id, tag)}
                        className="ml-1 hover:text-purple-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div className="mb-3">
                {editingId === result.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                      rows={3}
                      placeholder="Add notes..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveNotes(result.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setEditingId(result.id);
                      setEditNotes(result.notes);
                    }}
                    className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 min-h-6"
                  >
                    {result.notes || 'Click to add notes...'}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onLoadResult?.(result)}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  Load
                </button>
                {onExportResult && (
                  <button
                    onClick={() => onExportResult(result)}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                )}
                <button
                  onClick={() => handleDelete(result.id)}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Add Tag Input */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag(result.id, newTag);
                    }
                  }}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-400"
                />
                <button
                  onClick={() => handleAddTag(result.id, newTag)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <Archive className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">
            {searchQuery || selectedTags.length > 0
              ? 'No results match your filters'
              : 'No archived results yet'}
          </p>
        </div>
      )}
    </div>
  );
};

export { ArchiveManager, type ArchivedResult };
export default ResultsArchive;
