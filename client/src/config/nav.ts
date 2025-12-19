import {
  LayoutDashboard,
  Search,
  Wallet,
  BarChart3,
  Target,
  DollarSign,
  Brain,
  TrendingUp,
  Layers,
  Maximize2,
  Settings,
  Database,
  Activity,
  Grid3x3,
  Wind,
  Award,
  Zap,
  Bell,
  User,
  LogOut,
  UserCheck,
  ShieldCheck,
  GitBranch
} from 'lucide-react'

export interface NavItem {
  name: string
  path: string
  icon?: any
  section?:
    | 'main'
    | 'trading'
    | 'analysis'
    | 'portfolio'
    | 'tools'
    | 'agents'
    | 'docs'
    | 'admin'
    | 'dev'
  featureFlag?: string
  roles?: string[]
}

export const navItems: NavItem[] = [
  // --- Primary / Main ---
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, section: 'main' },
  { name: 'Agent Hub', path: '/agent-arena-hub', icon: Brain, section: 'main', featureFlag: 'agents' },

  // Trading top-level
  { name: 'Trading Terminal', path: '/trading-terminal', icon: Maximize2, section: 'main' },
  { name: 'Paper Trading', path: '/paper-trading', icon: DollarSign, section: 'main' },

  // Market Intelligence / Markets
  { name: 'Market Intelligence', path: '/market-intelligence', icon: TrendingUp, section: 'main' },
  { name: 'Markets (Scanner)', path: '/gateway-scanner', icon: Zap, section: 'main' },
  { name: 'Watchlist', path: '/watchlist', icon: Search, section: 'main' },

  // --- Trading Group ---
  { name: 'Strategies', path: '/strategies', icon: Target, section: 'trading' },
  { name: 'Strategy Synthesis', path: '/strategy-synthesis', icon: Target, section: 'trading' },
  { name: 'Scanner', path: '/scanner', icon: Search, section: 'trading' },
  { name: 'Signals', path: '/signals', icon: Zap, section: 'trading' },
  { name: 'Scout Reports', path: '/scout-reports', icon: TrendingUp, section: 'trading', featureFlag: 'scoutReports' },
  { name: 'Signal Performance', path: '/signal-performance', icon: Award, section: 'trading' },
  { name: 'Signal Structures', path: '/signal-structures', icon: Database, section: 'trading' },

  // --- Analysis Group ---
  // TODO: Implement Market Analysis, Performance Analytics, Correlation Analysis pages
  // { name: 'Market Analysis', path: '/market-analysis', icon: BarChart3, section: 'analysis' },
  // { name: 'Performance Analytics', path: '/performance-analytics', icon: TrendingUp, section: 'analysis' },
  // { name: 'Correlation Analysis', path: '/correlation-analysis', icon: Layers, section: 'analysis' },

  // --- Portfolio Group ---
  { name: 'Positions', path: '/positions', icon: Activity, section: 'portfolio' },
  { name: 'Position Sizing', path: '/position-sizing-dashboard', icon: GitBranch, section: 'portfolio' },

  // --- Tools / Utilities ---
  { name: 'Symbol Universe', path: '/symbol-universe', icon: Database, section: 'tools' },
  { name: 'Gateway Alerts', path: '/gateway-alerts', icon: Bell, section: 'tools', roles: ['admin'] },
  

  // --- Agents / ML (collapsed by default, feature-flagged) ---
  { name: 'Agent Arena', path: '/agent-arena-hub', icon: Brain, section: 'agents', featureFlag: 'agents' },
  { name: 'Agent Interactions', path: '/agent-interactions', icon: User, section: 'agents', featureFlag: 'agents' },
  { name: 'Agent Signal Insights', path: '/agent-signal-insights', icon: Zap, section: 'agents', featureFlag: 'agents' },
  { name: 'RL Position Agent', path: '/rl-position-agent', icon: Brain, section: 'agents', featureFlag: 'agents' },
  { name: 'ML Engine', path: '/ml-engine', icon: Brain, section: 'agents', featureFlag: 'ml' },
  { name: 'ML Training Hub', path: '/ml-training-hub', icon: Brain, section: 'agents', featureFlag: 'ml' },

  // --- Docs / Learning ---
  { name: 'Learning Center', path: '/learning-center', icon: UserCheck, section: 'docs' },

  // --- Admin / Role-gated ---
  { name: 'Gateway Alerts (Admin)', path: '/gateway-alerts', icon: ShieldCheck, section: 'admin', roles: ['admin'] },

  
]

export default navItems

// User menu items shown in the bottom user area
export const userMenu: NavItem[] = [
  { name: 'Profile', path: '/profile', icon: User },
  { name: 'Settings', path: '/settings', icon: Settings },
  { name: 'API Keys', path: '/settings/api-keys', icon: Database, featureFlag: 'apiKeys' },
  { name: 'Billing', path: '/settings/billing', icon: Wallet, featureFlag: 'billing' },
]
