import { EventEmitter } from 'events';

/**
 * Phase 5 Real-time Event System
 * Emits events for:
 * - Signal generation/updates
 * - Agent performance changes
 * - Regime transitions
 * - Market regime updates
 */
class Phase5EventBridge extends EventEmitter {
  private static instance: Phase5EventBridge;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): Phase5EventBridge {
    if (!Phase5EventBridge.instance) {
      Phase5EventBridge.instance = new Phase5EventBridge();
    }
    return Phase5EventBridge.instance;
  }

  /**
   * Emit a new signal event
   */
  emitSignalNew(signalData: any) {
    console.log('[Phase5Events] Emitting new signal event:', signalData.symbol);
    this.emit('phase5:signal:new', {
      type: 'phase5:signal:new',
      timestamp: Date.now(),
      payload: signalData
    });
  }

  /**
   * Emit a signal update event (e.g., exit price updated)
   */
  emitSignalUpdate(signalData: any) {
    console.log('[Phase5Events] Emitting signal update event:', signalData.symbol);
    this.emit('phase5:signal:update', {
      type: 'phase5:signal:update',
      timestamp: Date.now(),
      payload: signalData
    });
  }

  /**
   * Emit an agent performance update
   */
  emitAgentUpdate(agentData: any) {
    console.log('[Phase5Events] Emitting agent update event:', agentData.agent_name);
    this.emit('phase5:agent:update', {
      type: 'phase5:agent:update',
      timestamp: Date.now(),
      payload: agentData
    });
  }

  /**
   * Emit a regime change event
   */
  emitRegimeUpdate(regimeData: any) {
    console.log('[Phase5Events] Emitting regime update event:', regimeData.current_regime);
    this.emit('phase5:regime:update', {
      type: 'phase5:regime:update',
      timestamp: Date.now(),
      payload: regimeData
    });
  }

  /**
   * Listen for signal new events (for internal components)
   */
  onSignalNew(callback: (data: any) => void) {
    this.on('phase5:signal:new', callback);
    return () => this.off('phase5:signal:new', callback);
  }

  /**
   * Listen for signal update events
   */
  onSignalUpdate(callback: (data: any) => void) {
    this.on('phase5:signal:update', callback);
    return () => this.off('phase5:signal:update', callback);
  }

  /**
   * Listen for agent update events
   */
  onAgentUpdate(callback: (data: any) => void) {
    this.on('phase5:agent:update', callback);
    return () => this.off('phase5:agent:update', callback);
  }

  /**
   * Listen for regime update events
   */
  onRegimeUpdate(callback: (data: any) => void) {
    this.on('phase5:regime:update', callback);
    return () => this.off('phase5:regime:update', callback);
  }
}

export const phase5EventBridge = Phase5EventBridge.getInstance();
export default Phase5EventBridge;
