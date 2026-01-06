/**
 * API Registry & Documentation Service
 * 
 * Centralizes all API endpoints with:
 * - Complete endpoint documentation
 * - Usage tracking and analytics
 * - Performance metrics (latency, throughput)
 * - Error tracking and debugging
 * - Real-time endpoint status
 * - Automatic route registration validation
 */

import { Router } from 'express';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type EndpointCategory = 
  | 'CORE'
  | 'BACKTEST'
  | 'SIGNAL'
  | 'TRADING'
  | 'STRATEGY'
  | 'AGENT'
  | 'ANALYTICS'
  | 'SCOUT'
  | 'FEATURE_FLAGS'
  | 'ADMIN';

export interface EndpointMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  lastCalledAt?: Date;
  lastErrorAt?: Date;
  lastError?: string;
  uptime: number; // percentage
  requestsPerHour: number;
}

export interface APIEndpoint {
  // Identification
  id: string;
  method: HTTPMethod;
  path: string;
  category: EndpointCategory;
  
  // Documentation
  name: string;
  description: string;
  version: string; // API version (v1, v2, etc.)
  
  // Parameters
  queryParams?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: any;
  }[];
  
  bodySchema?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    example?: any;
  };
  
  pathParams?: {
    name: string;
    type: string;
    description: string;
  }[];
  
  // Response
  responseSchema?: {
    status: number;
    description: string;
    schema: any;
    example?: any;
  }[];
  
  // Metadata
  tags: string[];
  isDeprecated: boolean;
  deprecationNote?: string;
  authentication?: 'NONE' | 'API_KEY' | 'JWT' | 'OAUTH2';
  rateLimit?: {
    requestsPerMinute: number;
    burstSize: number;
  };
  
  // Performance
  expectedLatencyMs?: number;
  timeout?: number;
  cacheable: boolean;
  cacheTTLSeconds?: number;
  
  // Status
  isActive: boolean;
  lastModified: Date;
  registeredAt: Date;
  
  // Metrics
  metrics: EndpointMetrics;
}

export class APIRegistry {
  private endpoints: Map<string, APIEndpoint> = new Map();
  private requestLog: Array<{
    endpointId: string;
    timestamp: Date;
    latency: number;
    status: number;
    error?: string;
  }> = [];
  
  private readonly MAX_LOG_SIZE = 10000;
  private updateInterval: NodeJS.Timer | null = null;

  constructor() {
    this.startMetricsRefresh();
  }

  /**
   * Register a new API endpoint
   */
  registerEndpoint(endpoint: Omit<APIEndpoint, 'metrics' | 'registeredAt' | 'lastModified'>) {
    const id = `${endpoint.method.toUpperCase()}:${endpoint.path}`;
    
    const fullEndpoint: APIEndpoint = {
      ...endpoint,
      id,
      registeredAt: new Date(),
      lastModified: new Date(),
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatencyMs: 0,
        maxLatencyMs: 0,
        minLatencyMs: Infinity,
        uptime: 100,
        requestsPerHour: 0,
      },
    };

    this.endpoints.set(id, fullEndpoint);
    console.log(`[APIRegistry] Registered endpoint: ${endpoint.method} ${endpoint.path}`);
  }

  /**
   * Register multiple endpoints at once
   */
  registerEndpoints(endpoints: Omit<APIEndpoint, 'metrics' | 'registeredAt' | 'lastModified'>[]) {
    endpoints.forEach(ep => this.registerEndpoint(ep));
  }

  /**
   * Track a request to an endpoint
   */
  trackRequest(method: HTTPMethod, path: string, latency: number, status: number, error?: string) {
    const endpointId = `${method.toUpperCase()}:${path}`;
    const endpoint = this.endpoints.get(endpointId);

    if (!endpoint) {
      console.warn(`[APIRegistry] Unknown endpoint: ${endpointId}`);
      return;
    }

    // Update metrics
    endpoint.metrics.totalRequests++;
    endpoint.metrics.lastCalledAt = new Date();

    if (status >= 200 && status < 300) {
      endpoint.metrics.successfulRequests++;
    } else {
      endpoint.metrics.failedRequests++;
      endpoint.metrics.lastErrorAt = new Date();
      endpoint.metrics.lastError = error;
    }

    // Update latency metrics
    const prevAvg = endpoint.metrics.averageLatencyMs;
    endpoint.metrics.averageLatencyMs = 
      (prevAvg * (endpoint.metrics.totalRequests - 1) + latency) / endpoint.metrics.totalRequests;
    endpoint.metrics.maxLatencyMs = Math.max(endpoint.metrics.maxLatencyMs, latency);
    endpoint.metrics.minLatencyMs = Math.min(endpoint.metrics.minLatencyMs, latency);

    // Update uptime
    endpoint.metrics.uptime = (endpoint.metrics.successfulRequests / endpoint.metrics.totalRequests) * 100;

    // Add to request log
    this.requestLog.push({
      endpointId,
      timestamp: new Date(),
      latency,
      status,
      error,
    });

    // Prune request log if too large
    if (this.requestLog.length > this.MAX_LOG_SIZE) {
      this.requestLog = this.requestLog.slice(-this.MAX_LOG_SIZE);
    }
  }

  /**
   * Get all registered endpoints
   */
  getAllEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get endpoints by category
   */
  getEndpointsByCategory(category: EndpointCategory): APIEndpoint[] {
    return Array.from(this.endpoints.values())
      .filter(ep => ep.category === category);
  }

  /**
   * Get endpoints by tag
   */
  getEndpointsByTag(tag: string): APIEndpoint[] {
    return Array.from(this.endpoints.values())
      .filter(ep => ep.tags.includes(tag));
  }

  /**
   * Get a single endpoint
   */
  getEndpoint(method: HTTPMethod, path: string): APIEndpoint | undefined {
    const id = `${method.toUpperCase()}:${path}`;
    return this.endpoints.get(id);
  }

  /**
   * Get endpoint statistics
   */
  getStats() {
    const endpoints = this.getAllEndpoints();
    const totalEndpoints = endpoints.length;
    const activeEndpoints = endpoints.filter(e => e.isActive).length;
    const deprecatedEndpoints = endpoints.filter(e => e.isDeprecated).length;

    // Calculate aggregate metrics
    const totalRequests = endpoints.reduce((sum, e) => sum + e.metrics.totalRequests, 0);
    const totalErrors = endpoints.reduce((sum, e) => sum + e.metrics.failedRequests, 0);
    const avgUptime = endpoints.length > 0 
      ? endpoints.reduce((sum, e) => sum + e.metrics.uptime, 0) / endpoints.length
      : 100;
    const avgLatency = endpoints.length > 0
      ? endpoints.reduce((sum, e) => sum + e.metrics.averageLatencyMs, 0) / endpoints.length
      : 0;

    // Endpoints by category
    const byCategory: Record<EndpointCategory, number> = {} as any;
    const categories: EndpointCategory[] = [
      'CORE', 'BACKTEST', 'SIGNAL', 'TRADING', 'STRATEGY', 'AGENT', 'ANALYTICS', 'SCOUT', 'FEATURE_FLAGS', 'ADMIN'
    ];
    
    categories.forEach(cat => {
      byCategory[cat] = endpoints.filter(e => e.category === cat).length;
    });

    // Top endpoints by request count
    const topEndpoints = [...endpoints]
      .sort((a, b) => b.metrics.totalRequests - a.metrics.totalRequests)
      .slice(0, 10)
      .map(e => ({
        path: e.path,
        method: e.method,
        requests: e.metrics.totalRequests,
        avgLatency: e.metrics.averageLatencyMs,
        uptime: e.metrics.uptime,
      }));

    return {
      timestamp: new Date(),
      summary: {
        totalEndpoints,
        activeEndpoints,
        deprecatedEndpoints,
        totalRequests,
        totalErrors,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        avgUptime,
        avgLatency,
      },
      byCategory,
      topEndpoints,
    };
  }

  /**
   * Get health status of all endpoints
   */
  getHealthStatus() {
    const endpoints = this.getAllEndpoints();

    const healthStatus = endpoints.map(ep => ({
      path: ep.path,
      method: ep.method,
      category: ep.category,
      status: ep.isActive ? 'ACTIVE' : 'INACTIVE',
      health: this.calculateHealth(ep),
      metrics: {
        requests: ep.metrics.totalRequests,
        uptime: ep.metrics.uptime,
        avgLatency: ep.metrics.averageLatencyMs,
        lastCalled: ep.metrics.lastCalledAt,
        lastError: ep.metrics.lastError,
      },
    }));

    const overallHealth = this.calculateOverallHealth(endpoints);

    return {
      timestamp: new Date(),
      overallHealth,
      endpoints: healthStatus,
    };
  }

  /**
   * Get request history for an endpoint
   */
  getRequestHistory(method: HTTPMethod, path: string, limit: number = 100) {
    const endpointId = `${method.toUpperCase()}:${path}`;
    
    return this.requestLog
      .filter(log => log.endpointId === endpointId)
      .slice(-limit)
      .map(log => ({
        timestamp: log.timestamp,
        latency: log.latency,
        status: log.status,
        error: log.error,
      }));
  }

  /**
   * Get performance timeline (requests per hour)
   */
  getPerformanceTimeline(hours: number = 24) {
    const timeline: Array<{
      hour: Date;
      requestCount: number;
      errorCount: number;
      avgLatency: number;
    }> = [];

    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const logsInHour = this.requestLog.filter(
        log => log.timestamp >= hourStart && log.timestamp < hourEnd
      );

      timeline.push({
        hour: hourStart,
        requestCount: logsInHour.length,
        errorCount: logsInHour.filter(log => log.status >= 400).length,
        avgLatency: logsInHour.length > 0
          ? logsInHour.reduce((sum, log) => sum + log.latency, 0) / logsInHour.length
          : 0,
      });
    }

    return timeline;
  }

  /**
   * Export documentation as OpenAPI/Swagger format
   */
  exportAsOpenAPI(title: string = 'Scanstream API', version: string = '1.0.0') {
    const endpoints = this.getAllEndpoints();
    const paths: Record<string, any> = {};

    endpoints.forEach(ep => {
      if (!paths[ep.path]) {
        paths[ep.path] = {};
      }

      paths[ep.path][ep.method.toLowerCase()] = {
        summary: ep.name,
        description: ep.description,
        tags: [ep.category, ...ep.tags],
        parameters: [
          ...(ep.queryParams || []).map(p => ({
            name: p.name,
            in: 'query',
            required: p.required,
            schema: { type: p.type },
            description: p.description,
          })),
          ...(ep.pathParams || []).map(p => ({
            name: p.name,
            in: 'path',
            required: true,
            schema: { type: p.type },
            description: p.description,
          })),
        ],
        ...(ep.bodySchema && {
          requestBody: {
            content: {
              'application/json': {
                schema: ep.bodySchema,
              },
            },
          },
        }),
        responses: {
          ...(ep.responseSchema || [{ status: 200, description: 'Success', schema: {} }]).reduce(
            (acc, res) => ({
              ...acc,
              [res.status]: {
                description: res.description,
                content: {
                  'application/json': {
                    schema: res.schema,
                  },
                },
              },
            }),
            {}
          ),
        },
        deprecated: ep.isDeprecated,
      };
    });

    return {
      openapi: '3.0.0',
      info: {
        title,
        version,
        description: 'Comprehensive API documentation for Scanstream trading platform',
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
        { url: 'https://api.scanstream.com', description: 'Production' },
      ],
      paths,
      tags: [
        { name: 'CORE', description: 'Core functionality' },
        { name: 'BACKTEST', description: 'Backtesting endpoints' },
        { name: 'SIGNAL', description: 'Signal generation and tracking' },
        { name: 'TRADING', description: 'Trading execution' },
        { name: 'STRATEGY', description: 'Strategy management' },
        { name: 'AGENT', description: 'Agent-related endpoints' },
        { name: 'ANALYTICS', description: 'Analytics and reporting' },
        { name: 'SCOUT', description: 'Scout report generation' },
        { name: 'FEATURE_FLAGS', description: 'Feature flag management' },
        { name: 'ADMIN', description: 'Administrative endpoints' },
      ],
    };
  }

  /**
   * Export as markdown documentation
   */
  exportAsMarkdown(): string {
    const endpoints = this.getAllEndpoints();
    const byCategory: Record<string, APIEndpoint[]> = {};

    endpoints.forEach(ep => {
      if (!byCategory[ep.category]) {
        byCategory[ep.category] = [];
      }
      byCategory[ep.category].push(ep);
    });

    let markdown = `# Scanstream API Documentation\n\n`;
    markdown += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Table of contents
    markdown += `## Table of Contents\n\n`;
    Object.keys(byCategory).forEach(cat => {
      markdown += `- [${cat}](#${cat.toLowerCase()})\n`;
    });
    markdown += '\n';

    // Endpoints by category
    Object.entries(byCategory).forEach(([category, eps]) => {
      markdown += `## ${category}\n\n`;

      eps.forEach(ep => {
        markdown += `### ${ep.name}\n\n`;
        markdown += `**Method:** \`${ep.method}\`  \n`;
        markdown += `**Path:** \`${ep.path}\`  \n`;
        markdown += `**Description:** ${ep.description}\n\n`;

        if (ep.queryParams && ep.queryParams.length > 0) {
          markdown += `#### Query Parameters\n\n`;
          markdown += `| Name | Type | Required | Description |\n`;
          markdown += `|------|------|----------|-------------|\n`;
          ep.queryParams.forEach(p => {
            markdown += `| \`${p.name}\` | ${p.type} | ${p.required ? 'Yes' : 'No'} | ${p.description} |\n`;
          });
          markdown += '\n';
        }

        if (ep.bodySchema) {
          markdown += `#### Request Body\n\n`;
          markdown += '```json\n';
          markdown += JSON.stringify(ep.bodySchema.example || ep.bodySchema, null, 2);
          markdown += '\n```\n\n';
        }

        if (ep.responseSchema && ep.responseSchema.length > 0) {
          markdown += `#### Responses\n\n`;
          ep.responseSchema.forEach(res => {
            markdown += `**${res.status}** - ${res.description}\n\n`;
            markdown += '```json\n';
            markdown += JSON.stringify(res.example || res.schema, null, 2);
            markdown += '\n```\n\n';
          });
        }

        if (ep.isDeprecated) {
          markdown += `⚠️ **Deprecated:** ${ep.deprecationNote}\n\n`;
        }

        markdown += '---\n\n';
      });
    });

    return markdown;
  }

  /**
   * Update endpoint documentation
   */
  updateEndpoint(method: HTTPMethod, path: string, updates: Partial<APIEndpoint>) {
    const id = `${method.toUpperCase()}:${path}`;
    const endpoint = this.endpoints.get(id);

    if (!endpoint) {
      console.warn(`[APIRegistry] Endpoint not found: ${id}`);
      return;
    }

    const updated = {
      ...endpoint,
      ...updates,
      lastModified: new Date(),
    };

    this.endpoints.set(id, updated);
    console.log(`[APIRegistry] Updated endpoint: ${method} ${path}`);
  }

  /**
   * Deprecate an endpoint
   */
  deprecateEndpoint(method: HTTPMethod, path: string, note: string, replacementPath?: string) {
    this.updateEndpoint(method, path, {
      isDeprecated: true,
      deprecationNote: `${note}${replacementPath ? ` Use ${replacementPath} instead.` : ''}`,
    });
  }

  /**
   * Get endpoints that are slow
   */
  getSlowEndpoints(thresholdMs: number = 1000): APIEndpoint[] {
    return Array.from(this.endpoints.values())
      .filter(ep => ep.metrics.averageLatencyMs > thresholdMs)
      .sort((a, b) => b.metrics.averageLatencyMs - a.metrics.averageLatencyMs);
  }

  /**
   * Get endpoints with high error rates
   */
  getUnhealthyEndpoints(errorRateThreshold: number = 0.05): APIEndpoint[] {
    return Array.from(this.endpoints.values())
      .filter(ep => {
        const errorRate = ep.metrics.totalRequests > 0 
          ? ep.metrics.failedRequests / ep.metrics.totalRequests
          : 0;
        return errorRate > errorRateThreshold;
      })
      .sort((a, b) => {
        const aRate = a.metrics.failedRequests / (a.metrics.totalRequests || 1);
        const bRate = b.metrics.failedRequests / (b.metrics.totalRequests || 1);
        return bRate - aRate;
      });
  }

  /**
   * Calculate health score for an endpoint
   */
  private calculateHealth(endpoint: APIEndpoint): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    if (!endpoint.isActive) return 'POOR';
    
    const uptime = endpoint.metrics.uptime || 100;
    const latency = endpoint.metrics.averageLatencyMs || 0;
    const errorRate = endpoint.metrics.totalRequests > 0
      ? endpoint.metrics.failedRequests / endpoint.metrics.totalRequests
      : 0;

    let score = 100;
    score -= (100 - uptime) * 2; // Uptime is critical
    score -= errorRate * 50; // Error rate matters
    score -= Math.min(latency / 100, 20); // Cap latency penalty

    if (score >= 95) return 'EXCELLENT';
    if (score >= 85) return 'GOOD';
    if (score >= 70) return 'FAIR';
    return 'POOR';
  }

  /**
   * Calculate overall API health
   */
  private calculateOverallHealth(endpoints: APIEndpoint[]): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' {
    const active = endpoints.filter(e => e.isActive);
    if (active.length === 0) return 'CRITICAL';

    const avgUptime = active.reduce((sum, e) => sum + e.metrics.uptime, 0) / active.length;
    const avgErrorRate = active.reduce((sum, e) => {
      const rate = e.metrics.totalRequests > 0 
        ? e.metrics.failedRequests / e.metrics.totalRequests
        : 0;
      return sum + rate;
    }, 0) / active.length;

    if (avgUptime >= 99 && avgErrorRate < 0.01) return 'HEALTHY';
    if (avgUptime >= 95 && avgErrorRate < 0.05) return 'DEGRADED';
    return 'CRITICAL';
  }

  /**
   * Start periodic metrics refresh
   */
  private startMetricsRefresh() {
    this.updateInterval = setInterval(() => {
      this.endpoints.forEach(ep => {
        // Update requests per hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentRequests = this.requestLog.filter(
          log => log.endpointId === ep.id && log.timestamp > oneHourAgo
        ).length;
        ep.metrics.requestsPerHour = recentRequests;
      });
    }, 60000); // Every minute
  }

  /**
   * Stop the registry
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval as any);
    }
  }
}

// Singleton instance
export const apiRegistry = new APIRegistry();
