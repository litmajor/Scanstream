import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

export function setupWatchlistRoutes(app: any) {
  const isAuthenticated = (req: any, res: Response, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // Get watchlist
  app.get('/api/user/watchlist', isAuthenticated, async (req: any, res: Response) => {
    try {
      const watchlist = await prisma.watchlist.findMany({
        where: { userId: req.user.id },
        orderBy: { addedAt: 'desc' }
      });
      res.json(watchlist);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add to watchlist
  app.post('/api/user/watchlist', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { symbol, notes } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      const existing = await prisma.watchlist.findUnique({
        where: { userId_symbol: { userId: req.user.id, symbol } }
      });

      if (existing) {
        return res.status(400).json({ error: 'Symbol already in watchlist' });
      }

      const item = await prisma.watchlist.create({
        data: {
          userId: req.user.id,
          symbol,
          notes: notes || null
        }
      });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove from watchlist
  app.delete('/api/user/watchlist/:id', isAuthenticated, async (req: any, res: Response) => {
    try {
      const item = await prisma.watchlist.findFirst({
        where: { id: req.params.id, userId: req.user.id }
      });

      if (!item) {
        return res.status(404).json({ error: 'Watchlist item not found' });
      }

      await prisma.watchlist.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

export default router;
