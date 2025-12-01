
import { Router } from 'express';
import { signalWebSocketService } from '../services/websocket-signals';

const router = Router();

// Send a notification to all connected clients
router.post('/send', async (req, res) => {
  try {
    const { category, priority, title, message, metadata, actionLabel, actionUrl } = req.body;

    if (!category || !priority || !title || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: category, priority, title, message' 
      });
    }

    signalWebSocketService.broadcastNotification({
      category,
      priority,
      title,
      message,
      metadata,
      actionLabel,
      actionUrl,
    });

    res.json({ success: true, message: 'Notification sent' });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to trigger sample notifications
router.post('/test', async (req, res) => {
  try {
    const { type = 'signal' } = req.body;

    const testNotifications = {
      signal: {
        category: 'signal' as const,
        priority: 'high' as const,
        title: 'New BUY Signal Detected',
        message: 'Strong BUY signal for BTC/USDT at $45,280 with 85% confidence',
        metadata: {
          symbol: 'BTC/USDT',
          signal: 'BUY',
          confidence: 85,
          price: 45280,
        },
        actionLabel: 'View Signal',
        actionUrl: '/signals',
      },
      trade: {
        category: 'trade' as const,
        priority: 'medium' as const,
        title: 'Trade Executed',
        message: 'Successfully opened long position on ETH/USDT',
        metadata: {
          symbol: 'ETH/USDT',
          side: 'LONG',
          size: 0.5,
          entryPrice: 2845,
        },
        actionLabel: 'View Position',
        actionUrl: '/positions',
      },
      alert: {
        category: 'alert' as const,
        priority: 'urgent' as const,
        title: 'Price Alert Triggered',
        message: 'BTC/USDT has broken above $46,000 resistance',
        metadata: {
          symbol: 'BTC/USDT',
          price: 46050,
          level: 46000,
          direction: 'above',
        },
      },
      system: {
        category: 'system' as const,
        priority: 'low' as const,
        title: 'System Update',
        message: 'New trading strategy "Gradient Trend Filter" is now available',
        actionLabel: 'Explore Strategies',
        actionUrl: '/strategies',
      },
    };

    const notification = testNotifications[type as keyof typeof testNotifications] || testNotifications.signal;
    
    signalWebSocketService.broadcastNotification(notification);

    res.json({ success: true, notification });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
