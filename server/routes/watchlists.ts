import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Middleware for authentication (optional - can be removed if no auth system)
const isAuthenticated = (req: any, res: Response, next: any) => {
  // For now, treat all requests as authenticated
  // In production, check req.user or JWT token
  if (!req.user) {
    req.user = { id: 'default-user' }; // Default user for demo
  }
  next();
};

/**
 * GET /api/watchlists
 * Get all watchlist symbols for the current user grouped by symbol
 */
router.get('/', isAuthenticated, async (req: any, res: Response) => {
  try {
    const watchlistEntries = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      orderBy: { addedAt: 'desc' },
    });

    // Group by symbol for compatibility
    const grouped = watchlistEntries.reduce((acc: any, entry) => {
      if (!acc[entry.symbol]) {
        acc[entry.symbol] = [];
      }
      acc[entry.symbol].push(entry);
      return acc;
    }, {});

    res.json({
      data: watchlistEntries,
      symbols: Object.keys(grouped),
      total: watchlistEntries.length,
    });
  } catch (error: any) {
    console.error('Error fetching watchlists:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/watchlists
 * Add a symbol to user's watchlist
 * Body: { symbol, notes? }
 */
router.post('/', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { symbol, notes = '' } = req.body;

    if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const symbolUpper = symbol.toUpperCase().trim();

    // Check if symbol already exists in watchlist
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_symbol: {
          userId: req.user.id,
          symbol: symbolUpper,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Symbol already in watchlist' });
    }

    const watchlistEntry = await prisma.watchlist.create({
      data: {
        userId: req.user.id,
        symbol: symbolUpper,
        notes: notes || null,
      },
    });

    res.status(201).json(watchlistEntry);
  } catch (error: any) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/watchlists/:symbol
 * Get watchlist entry for a specific symbol
 */
router.get('/:symbol', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { symbol } = req.params;

    const entry = await prisma.watchlist.findUnique({
      where: {
        userId_symbol: {
          userId: req.user.id,
          symbol: symbol.toUpperCase(),
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Symbol not in watchlist' });
    }

    res.json(entry);
  } catch (error: any) {
    console.error('Error fetching watchlist entry:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/watchlists/:symbol
 * Update a watchlist entry (notes)
 * Body: { notes? }
 */
router.put('/:symbol', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { symbol } = req.params;
    const { notes } = req.body;

    const entry = await prisma.watchlist.findUnique({
      where: {
        userId_symbol: {
          userId: req.user.id,
          symbol: symbol.toUpperCase(),
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Symbol not in watchlist' });
    }

    const updated = await prisma.watchlist.update({
      where: {
        userId_symbol: {
          userId: req.user.id,
          symbol: symbol.toUpperCase(),
        },
      },
      data: {
        ...(notes !== undefined && { notes }),
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating watchlist entry:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/watchlists/:symbol
 * Remove a symbol from watchlist
 */
router.delete('/:symbol', isAuthenticated, async (req: any, res: Response) => {
  try {
    const { symbol } = req.params;

    const entry = await prisma.watchlist.findUnique({
      where: {
        userId_symbol: {
          userId: req.user.id,
          symbol: symbol.toUpperCase(),
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Symbol not in watchlist' });
    }

    await prisma.watchlist.delete({
      where: {
        userId_symbol: {
          userId: req.user.id,
          symbol: symbol.toUpperCase(),
        },
      },
    });

    res.json({ success: true, message: 'Symbol removed from watchlist' });
  } catch (error: any) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
