import { Router, type ErrorRequestHandler } from 'express';
import { symbolManager } from '../../services/symbol-manager';
import { symbolFormatter, DisplayVariant } from '../../services/symbol-formatter';
import { symbolNormalizer } from '../../services/symbol-normalizer';
import { AssetClass } from '../../types/symbol-universe';
import { requireAuth } from '../../middleware/auth';

const router = Router();

const allowedAssetClasses = new Set(Object.values(AssetClass));

function isAssetClass(value: unknown): value is AssetClass {
  return typeof value === 'string' && allowedAssetClasses.has(value as AssetClass);
}

function isValidLimit(value: unknown, fallback: number): number | undefined {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : undefined;
}

// GET /api/symbol-universe/state
router.get('/state', (req, res) => {
  const state = symbolManager.getUniverseState();
  // Convert Maps to plain objects for JSON
  const symbolsObj: Record<string, any> = {};
  for (const [k, v] of state.symbols.entries()) symbolsObj[k] = v;

  const groupsObj: Record<string, any> = {};
  for (const [k, v] of state.groups.entries()) groupsObj[k] = v;

  res.json({
    symbols: symbolsObj,
    groups: groupsObj,
    uiConfig: state.uiConfig,
    stats: state.stats,
    validationRules: state.validationRules,
  });
});

// GET /api/symbol-universe/symbols
router.get('/symbols', (req, res) => {
  const { assetClass, venue, active, group, limit } = req.query;
  const parsedLimit = isValidLimit(limit, 100);
  if (
    (assetClass !== undefined && !isAssetClass(assetClass)) ||
    parsedLimit === undefined
  ) {
    return res.status(400).json({ error: 'Invalid assetClass or limit' });
  }

  const result = symbolManager.lookup({
    assetClass: assetClass && isAssetClass(assetClass) ? assetClass : undefined,
    venue: venue ? String(venue) : undefined,
    group: group ? String(group) : undefined,
    activeOnly: active === 'true',
    limit: parsedLimit,
  });

  res.json(result.symbols);
});

// GET /api/symbol-universe/symbols/:canonical
router.get('/symbols/:canonical', (req, res) => {
  const { canonical } = req.params;
  const symbol = symbolManager.getSymbol(canonical);

  if (!symbol) return res.status(404).json({ error: 'Symbol not found' });
  res.json(symbol);
});

// GET /api/symbol-universe/format/:canonical
router.get('/format/:canonical', (req, res) => {
  const { canonical } = req.params;
  const { variant = 'standard' } = req.query;

  try {
    const formatted = symbolFormatter.format(canonical, variant as DisplayVariant);
    res.json(formatted);
  } catch (err) {
    res.status(404).json({ error: 'Symbol not found' });
  }
});

// POST /api/symbol-universe/normalize
router.post('/normalize', (req, res) => {
  const { format, venue } = req.body;
  if (
    typeof format !== 'string' ||
    format.trim().length === 0 ||
    format.length > 64 ||
    typeof venue !== 'string' ||
    venue.trim().length === 0 ||
    venue.length > 32
  ) return res.status(400).json({ error: 'format and venue must be bounded strings' });

  const result = symbolNormalizer.normalize(format, venue);
  res.json(result);
});

// POST /api/symbol-universe/denormalize
router.post('/denormalize', (req, res) => {
  const { canonical, venue } = req.body;
  if (
    typeof canonical !== 'string' ||
    canonical.trim().length === 0 ||
    canonical.length > 64 ||
    typeof venue !== 'string' ||
    venue.trim().length === 0 ||
    venue.length > 32
  ) return res.status(400).json({ error: 'canonical and venue must be bounded strings' });

  const result = symbolNormalizer.denormalize(canonical, venue);
  res.json(result);
});

// GET /api/symbol-universe/search
router.get('/search', (req, res) => {
  const { q, assetClass, limit } = req.query;
  const parsedLimit = isValidLimit(limit, 10);
  if (
    (assetClass !== undefined && !isAssetClass(assetClass)) ||
    parsedLimit === undefined ||
    (q !== undefined && (typeof q !== 'string' || q.length > 64))
  ) {
    return res.status(400).json({ error: 'Invalid search query' });
  }

  const result = symbolManager.lookup({
    symbol: q ? String(q) : undefined,
    assetClass: assetClass && isAssetClass(assetClass) ? assetClass : undefined,
    limit: parsedLimit,
    activeOnly: true,
  });

  res.json(result.symbols);
});

// GET /api/symbol-universe/groups
router.get('/groups', (req, res) => {
  const groups = symbolManager.getGroups();
  res.json(groups);
});

// GET /api/symbol-universe/groups/:groupId
router.get('/groups/:groupId', (req, res) => {
  const { groupId } = req.params;
  const symbols = symbolManager.getGroupSymbols(groupId);
  if (symbols.length === 0) return res.status(404).json({ error: 'Group not found' });
  res.json(symbols);
});

// GET /api/symbol-universe/stats
router.get('/stats', (req, res) => {
  const stats = symbolManager.getStats();
  res.json(stats);
});

// GET /api/symbol-universe/ui-config
router.get('/ui-config', (req, res) => {
  const config = symbolManager.getUIConfig();
  res.json(config);
});

// POST /api/symbol-universe/ui-config
router.post('/ui-config', requireAuth, (req, res) => {
  const config = req.body;
  if (
    typeof config !== 'object' ||
    config === null ||
    Array.isArray(config) ||
    Object.keys(config).length > 10 ||
    Object.entries(config).some(([key, value]) => {
      if (['showAssetClass', 'showQuote', 'showLiquidity', 'showTradingHours', 'abbreviate'].includes(key)) {
        return typeof value !== 'boolean';
      }
      return key === 'colors' || key === 'icons'
        ? typeof value !== 'object' || value === null || Array.isArray(value) ||
          Object.keys(value).length > 5 ||
          Object.values(value).some((entry) => typeof entry !== 'string' || entry.length > 32)
        : true;
    })
  ) {
    return res.status(400).json({ error: 'Invalid symbol-universe UI configuration' });
  }
  symbolManager.setUIConfig(config);
  res.json(symbolManager.getUIConfig());
});

// EventSource /api/symbol-universe/changes
router.get('/changes', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (event: any) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      // ignore write errors
    }
  };

  const cleanup = symbolManager.onChange(listener);

  req.on('close', () => {
    cleanup();
  });
});

const handleRouterError: ErrorRequestHandler = (_error, _req, res, _next) => {
  if (!res.headersSent) {
    res.status(500).json({ error: 'Symbol universe request failed' });
  }
};

router.use(handleRouterError);

export default router;
