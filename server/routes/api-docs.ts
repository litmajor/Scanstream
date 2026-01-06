/**
 * API Documentation Routes
 * 
 * Provides comprehensive API documentation and metrics endpoints
 * - View all registered endpoints
 * - Get usage statistics
 * - Health monitoring
 * - Export documentation (OpenAPI, Markdown)
 * - Performance analytics
 */

import { Router, Request, Response } from 'express';
import { apiRegistry } from '../services/api-registry';

const router = Router();

/**
 * GET /api/docs/endpoints
 * List all registered API endpoints
 */
router.get('/endpoints', (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    const tag = req.query.tag as string;

    let endpoints = apiRegistry.getAllEndpoints();

    if (category) {
      endpoints = endpoints.filter(e => e.category === category);
    }

    if (tag) {
      endpoints = endpoints.filter(e => e.tags.includes(tag));
    }

    const sorted = endpoints.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.path.localeCompare(b.path);
    });

    res.json({
      total: sorted.length,
      endpoints: sorted.map(e => ({
        id: e.id,
        method: e.method,
        path: e.path,
        name: e.name,
        description: e.description,
        category: e.category,
        isActive: e.isActive,
        isDeprecated: e.isDeprecated,
        tags: e.tags,
        version: e.version,
      })),
      filters: {
        category: category || 'all',
        tag: tag || 'all',
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve endpoints',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/endpoints/:method/:path
 * Get detailed documentation for a specific endpoint
 */
router.get('/endpoints/:method/:path(.*)', (req: Request, res: Response) => {
  try {
    const method = req.params.method.toUpperCase() as any;
    const path = `/${req.params.path}`;

    const endpoint = apiRegistry.getEndpoint(method, path);

    if (!endpoint) {
      return res.status(404).json({
        error: 'Endpoint not found',
        method,
        path,
      });
    }

    res.json({
      ...endpoint,
      requestHistory: apiRegistry.getRequestHistory(method, path, 50),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve endpoint details',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/stats
 * Get comprehensive API statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = apiRegistry.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/health
 * Get health status of all endpoints
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const health = apiRegistry.getHealthStatus();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve health status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/health/:method/:path
 * Get health status of a specific endpoint
 */
router.get('/health/:method/:path(.*)', (req: Request, res: Response) => {
  try {
    const method = req.params.method.toUpperCase() as any;
    const path = `/${req.params.path}`;

    const endpoint = apiRegistry.getEndpoint(method, path);

    if (!endpoint) {
      return res.status(404).json({
        error: 'Endpoint not found',
        method,
        path,
      });
    }

    const health = apiRegistry.getHealthStatus();
    const endpointHealth = health.endpoints.find(
      e => e.method === method && e.path === path
    );

    res.json({
      endpoint: { method, path },
      health: endpointHealth,
      overallAPIHealth: health.overallHealth,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve endpoint health',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/performance
 * Get performance metrics and timeline
 */
router.get('/performance', (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const timeline = apiRegistry.getPerformanceTimeline(Math.min(hours, 168)); // Max 7 days

    const slowEndpoints = apiRegistry.getSlowEndpoints(1000);
    const unhealthyEndpoints = apiRegistry.getUnhealthyEndpoints(0.05);

    res.json({
      timeline,
      slowEndpoints: slowEndpoints.map(e => ({
        path: e.path,
        method: e.method,
        avgLatencyMs: e.metrics.averageLatencyMs,
        maxLatencyMs: e.metrics.maxLatencyMs,
        requestCount: e.metrics.totalRequests,
      })),
      unhealthyEndpoints: unhealthyEndpoints.map(e => ({
        path: e.path,
        method: e.method,
        errorRate: (e.metrics.failedRequests / (e.metrics.totalRequests || 1) * 100).toFixed(2) + '%',
        failedRequests: e.metrics.failedRequests,
        totalRequests: e.metrics.totalRequests,
        lastError: e.metrics.lastError,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve performance data',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/openapi
 * Export API documentation as OpenAPI/Swagger
 */
router.get('/openapi', (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    const openapi = apiRegistry.exportAsOpenAPI();

    if (format === 'yaml') {
      // Simple YAML conversion (would normally use proper YAML library)
      res.header('Content-Type', 'application/yaml');
      res.send(JSON.stringify(openapi, null, 2));
    } else {
      res.header('Content-Type', 'application/json');
      res.json(openapi);
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export OpenAPI documentation',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/markdown
 * Export API documentation as Markdown
 */
router.get('/markdown', (req: Request, res: Response) => {
  try {
    const markdown = apiRegistry.exportAsMarkdown();
    res.header('Content-Type', 'text/markdown');
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export Markdown documentation',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/categories
 * Get all available endpoint categories
 */
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = [
      'CORE',
      'BACKTEST',
      'SIGNAL',
      'TRADING',
      'STRATEGY',
      'AGENT',
      'ANALYTICS',
      'SCOUT',
      'FEATURE_FLAGS',
      'ADMIN',
    ];

    const byCategory = categories.reduce(
      (acc, cat) => {
        const endpoints = apiRegistry.getEndpointsByCategory(cat as any);
        acc[cat] = endpoints.length;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      categories: byCategory,
      total: Object.values(byCategory).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve categories',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/tags
 * Get all available endpoint tags
 */
router.get('/tags', (req: Request, res: Response) => {
  try {
    const endpoints = apiRegistry.getAllEndpoints();
    const tags = new Set<string>();

    endpoints.forEach(e => {
      e.tags.forEach(tag => tags.add(tag));
    });

    const tagMap = Array.from(tags).reduce(
      (acc, tag) => {
        const eps = apiRegistry.getEndpointsByTag(tag);
        acc[tag] = eps.length;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      tags: tagMap,
      total: Array.from(tags).length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve tags',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/usage
 * Get endpoint usage metrics
 */
router.get('/usage', (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || 'all';
    const endpoints = apiRegistry.getAllEndpoints();

    const usage = endpoints
      .map(e => ({
        path: e.path,
        method: e.method,
        category: e.category,
        totalRequests: e.metrics.totalRequests,
        successCount: e.metrics.successfulRequests,
        errorCount: e.metrics.failedRequests,
        uptime: e.metrics.uptime.toFixed(2) + '%',
        avgLatency: e.metrics.averageLatencyMs.toFixed(0) + 'ms',
        lastCalled: e.metrics.lastCalledAt,
        requestsPerHour: e.metrics.requestsPerHour,
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);

    res.json({
      period,
      data: usage,
      summary: {
        totalEndpoints: endpoints.length,
        totalRequests: endpoints.reduce((sum, e) => sum + e.metrics.totalRequests, 0),
        totalErrors: endpoints.reduce((sum, e) => sum + e.metrics.failedRequests, 0),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve usage data',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/deprecated
 * Get list of deprecated endpoints
 */
router.get('/deprecated', (req: Request, res: Response) => {
  try {
    const endpoints = apiRegistry.getAllEndpoints()
      .filter(e => e.isDeprecated)
      .map(e => ({
        method: e.method,
        path: e.path,
        name: e.name,
        deprecationNote: e.deprecationNote,
        registeredAt: e.registeredAt,
        lastModified: e.lastModified,
      }));

    res.json({
      total: endpoints.length,
      endpoints,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve deprecated endpoints',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/docs/summary
 * Quick summary dashboard
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const stats = apiRegistry.getStats();
    const health = apiRegistry.getHealthStatus();
    const slowEndpoints = apiRegistry.getSlowEndpoints(1000).length;
    const unhealthyEndpoints = apiRegistry.getUnhealthyEndpoints(0.05).length;

    res.json({
      timestamp: new Date(),
      overview: {
        totalEndpoints: stats.summary.totalEndpoints,
        activeEndpoints: stats.summary.activeEndpoints,
        totalRequests: stats.summary.totalRequests,
        errorRate: stats.summary.errorRate.toFixed(2) + '%',
        avgLatency: stats.summary.avgLatency.toFixed(0) + 'ms',
        avgUptime: stats.summary.avgUptime.toFixed(2) + '%',
      },
      health: {
        overallStatus: health.overallHealth,
        slowEndpoints,
        unhealthyEndpoints,
      },
      topEndpoints: stats.topEndpoints,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve summary',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
