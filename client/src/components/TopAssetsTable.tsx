import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react';
import type {
  CryptoAsset,
  ForexAsset,
  StockAsset,
  CommodityAsset,
  AssetClass,
} from '@/hooks/useAssetClassData';

interface TopAssetsTableProps {
  assets: (CryptoAsset | ForexAsset | StockAsset | CommodityAsset)[];
  assetClass: AssetClass;
  isLoading: boolean;
  error: Error | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
}

type SortField = 'rank' | 'symbol' | 'price' | 'mcap' | 'change1d' | 'change7d' | 'change30d';
type SortOrder = 'asc' | 'desc';

interface SortState {
  field: SortField;
  order: SortOrder;
}

export default function TopAssetsTable({
  assets,
  assetClass,
  isLoading,
  error,
  currentPage,
  onPageChange,
  itemsPerPage = 100,
}: TopAssetsTableProps) {
  const [sortState, setSortState] = useState<SortState>({ field: 'rank', order: 'asc' });

  // Memoize sorted assets
  const sortedAssets = useMemo(() => {
    if (!assets || assets.length === 0) return [];

    const sorted = [...assets].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortState.field) {
        case 'rank':
          aVal = ('market_cap_rank' in a ? a.market_cap_rank : 0) || 0;
          bVal = ('market_cap_rank' in b ? b.market_cap_rank : 0) || 0;
          break;
        case 'symbol':
          aVal = a.symbol.toUpperCase();
          bVal = b.symbol.toUpperCase();
          break;
        case 'price':
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        case 'mcap':
          aVal = ('market_cap' in a ? a.market_cap : 0) || 0;
          bVal = ('market_cap' in b ? b.market_cap : 0) || 0;
          break;
        case 'change1d':
          aVal = a.change1d || 0;
          bVal = b.change1d || 0;
          break;
        case 'change7d':
          aVal = a.change7d || 0;
          bVal = b.change7d || 0;
          break;
        case 'change30d':
          aVal = a.change30d || 0;
          bVal = b.change30d || 0;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortState.order === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortState.order === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [assets, sortState]);

  // Paginate
  const totalPages = Math.ceil(sortedAssets.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const startIdx = (validPage - 1) * itemsPerPage;
  const paginatedAssets = sortedAssets.slice(startIdx, startIdx + itemsPerPage);

  const handleSort = (field: SortField) => {
    setSortState((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortState.field !== field) {
      return <ChevronsUp className="w-3 h-3 text-gray-400" />;
    }
    return sortState.order === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-blue-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-400" />
    );
  };

  const renderChangeCell = (value: number | undefined) => {
    if (value === undefined) return '-';
    const isPositive = value >= 0;
    return (
      <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
        {isPositive ? '+' : ''}{value.toFixed(2)}%
      </span>
    );
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return '-';
    if (assetClass === 'crypto') {
      return `$${price.toFixed(2)}`;
    } else if (assetClass === 'forex') {
      return price.toFixed(5);
    }
    return `$${price.toFixed(2)}`;
  };

  const formatMcap = (mcap: number | undefined) => {
    if (!mcap) return '-';
    if (mcap >= 1e12) return `$${(mcap / 1e12).toFixed(2)}T`;
    if (mcap >= 1e9) return `$${(mcap / 1e9).toFixed(2)}B`;
    if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(2)}M`;
    return `$${mcap.toFixed(0)}`;
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        Error loading assets: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-96 bg-gray-800/30 rounded-lg animate-pulse flex items-center justify-center">
          <p className="text-gray-400">Loading {assetClass} assets...</p>
        </div>
      </div>
    );
  }

  if (!paginatedAssets || paginatedAssets.length === 0) {
    return (
      <div className="bg-gray-800/20 border border-gray-700/30 rounded-lg p-8 text-center">
        <p className="text-gray-400">No assets available for {assetClass}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/30 bg-gray-900/20">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 border-b border-gray-700/30">
            <tr>
              <th className="px-4 py-3 text-left text-gray-300 font-semibold">
                <button
                  onClick={() => handleSort('rank')}
                  className="flex items-center gap-2 hover:text-blue-400 transition-colors"
                >
                  Rank
                  <SortIcon field="rank" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-gray-300 font-semibold">
                <button
                  onClick={() => handleSort('symbol')}
                  className="flex items-center gap-2 hover:text-blue-400 transition-colors"
                >
                  Symbol
                  <SortIcon field="symbol" />
                </button>
              </th>
              {assetClass === 'crypto' && (
                <th className="px-4 py-3 text-left text-gray-300 font-semibold">
                  <button
                    onClick={() => handleSort('symbol')}
                    className="flex items-center gap-2 hover:text-blue-400 transition-colors"
                  >
                    Name
                    <SortIcon field="symbol" />
                  </button>
                </th>
              )}
              <th className="px-4 py-3 text-right text-gray-300 font-semibold">
                <button
                  onClick={() => handleSort('price')}
                  className="flex items-center justify-end gap-2 hover:text-blue-400 transition-colors w-full"
                >
                  Price
                  <SortIcon field="price" />
                </button>
              </th>
              {assetClass === 'crypto' && (
                <th className="px-4 py-3 text-right text-gray-300 font-semibold">
                  <button
                    onClick={() => handleSort('mcap')}
                    className="flex items-center justify-end gap-2 hover:text-blue-400 transition-colors w-full"
                  >
                    Market Cap
                    <SortIcon field="mcap" />
                  </button>
                </th>
              )}
              <th className="px-4 py-3 text-right text-gray-300 font-semibold">
                <button
                  onClick={() => handleSort('change1d')}
                  className="flex items-center justify-end gap-2 hover:text-blue-400 transition-colors w-full"
                >
                  1D%
                  <SortIcon field="change1d" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-gray-300 font-semibold">
                <button
                  onClick={() => handleSort('change7d')}
                  className="flex items-center justify-end gap-2 hover:text-blue-400 transition-colors w-full"
                >
                  7D%
                  <SortIcon field="change7d" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-gray-300 font-semibold">
                <button
                  onClick={() => handleSort('change30d')}
                  className="flex items-center justify-end gap-2 hover:text-blue-400 transition-colors w-full"
                >
                  30D%
                  <SortIcon field="change30d" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/20">
            {paginatedAssets.map((asset, idx) => {
              const rank = 'market_cap_rank' in asset ? asset.market_cap_rank : startIdx + idx + 1;
              const name = 'name' in asset ? asset.name : asset.symbol;

              return (
                <tr key={`${asset.symbol}-${idx}`} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-300 font-medium">{rank}</td>
                  <td className="px-4 py-3 text-blue-400 font-semibold">{asset.symbol.toUpperCase()}</td>
                  {assetClass === 'crypto' && (
                    <td className="px-4 py-3 text-gray-400 text-sm">{name}</td>
                  )}
                  <td className="px-4 py-3 text-right text-gray-200">{formatPrice(asset.price)}</td>
                  {assetClass === 'crypto' && (
                    <td className="px-4 py-3 text-right text-gray-300">
                      {'market_cap' in asset ? formatMcap(asset.market_cap) : '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">{renderChangeCell(asset.change1d)}</td>
                  <td className="px-4 py-3 text-right">{renderChangeCell(asset.change7d)}</td>
                  <td className="px-4 py-3 text-right">{renderChangeCell(asset.change30d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between bg-gray-800/20 rounded-lg p-4 border border-gray-700/30">
        <div className="text-sm text-gray-400">
          Showing {paginatedAssets.length > 0 ? startIdx + 1 : 0} -{' '}
          {Math.min(startIdx + itemsPerPage, sortedAssets.length)} of {sortedAssets.length} assets
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(1)}
            disabled={validPage === 1}
            className="px-3 py-2 rounded bg-gray-700/40 hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm transition-colors"
            aria-label="First page"
          >
            First
          </button>
          <button
            onClick={() => onPageChange(Math.max(1, validPage - 1))}
            disabled={validPage === 1}
            className="px-3 py-2 rounded bg-gray-700/40 hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm transition-colors"
            aria-label="Previous page"
          >
            Prev
          </button>

          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-sm">Page</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={validPage}
              onChange={(e) => {
                const page = parseInt(e.target.value) || 1;
                onPageChange(Math.max(1, Math.min(page, totalPages || 1)));
              }}
              className="w-12 px-2 py-1 rounded bg-gray-700/40 text-gray-300 text-sm text-center border border-gray-600/40 focus:border-blue-500/50 focus:outline-none"
              placeholder="1"
              title="Enter page number"
              aria-label="Page number"
            />
            <span className="text-gray-400 text-sm">of {totalPages}</span>
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages || 1, validPage + 1))}
            disabled={validPage === totalPages}
            className="px-3 py-2 rounded bg-gray-700/40 hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm transition-colors"
            aria-label="Next page"
          >
            Next
          </button>
          <button
            onClick={() => onPageChange(totalPages || 1)}
            disabled={validPage === totalPages}
            className="px-3 py-2 rounded bg-gray-700/40 hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm transition-colors"
            aria-label="Last page"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
