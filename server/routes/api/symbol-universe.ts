import { Router } from 'express';
import { symbolManager } from '../../services/symbol-manager';
import { symbolFormatter, DisplayVariant } from '../../services/symbol-formatter';
import { symbolNormalizer } from '../../services/symbol-normalizer';

const router = Router();

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

  const result = symbolManager.lookup({
    assetClass: assetClass ? (assetClass as any) : undefined,
    venue: venue ? String(venue) : undefined,
    group: group ? String(group) : undefined,
    activeOnly: active === 'true',
    limit: limit ? parseInt(String(limit)) : undefined,
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
  if (!format || !venue) return res.status(400).json({ error: 'format and venue are required' });

  const result = symbolNormalizer.normalize(format, venue);
  res.json(result);
});

// POST /api/symbol-universe/denormalize
router.post('/denormalize', (req, res) => {
  const { canonical, venue } = req.body;
  if (!canonical || !venue) return res.status(400).json({ error: 'canonical and venue are required' });

  const result = symbolNormalizer.denormalize(canonical, venue);
  res.json(result);
});

// GET /api/symbol-universe/search
router.get('/search', (req, res) => {
  const { q, assetClass, limit } = req.query;

  const result = symbolManager.lookup({
    symbol: q ? String(q) : undefined,
    assetClass: assetClass ? (assetClass as any) : undefined,
    limit: limit ? parseInt(String(limit)) : 10,
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
router.post('/ui-config', (req, res) => {
  // TODO: add auth check in production
  const config = req.body;
  symbolManager.setUIConfig(config);
  res.json(symbolManager.getUIConfig());
});

// EventSource /api/symbol-universe/changes
router.get('/changes', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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

export default router;
