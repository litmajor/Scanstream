import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSelector from './ThemeSelector';
import {
  LayoutDashboard,
  Search as SearchIcon,
  Wallet,
  BarChart3,
  Target,
  DollarSign,
  Brain,
  TrendingUp,
  Layers,
  Sparkles,
  Menu,
  X,
  Moon,
  Sun,
  Zap,
  Activity,
  Grid3x3,
  Wind,
  Award,
  Bell,
  Settings,
  User,
  LogOut
} from 'lucide-react';
import navItems, { userMenu } from '@/config/nav'
import { useAuth } from '../hooks/useAuth';
import { Input } from '@/components/ui/input';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { preset, setPreset, colors } = useTheme();
  const { user } = useAuth();
  const [search, setSearch] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [features, setFeatures] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('features') || '{}')
    } catch (e) {
      return {}
    }
  })
  const [showFeaturePanel, setShowFeaturePanel] = useState(false)

  // Feature flag helper reads from local state (backed by localStorage)
  const isFeatureEnabled = (flag?: string) => {
    if (!flag) return true
    return !!features[flag]
  }

  const hasRole = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true
    if (!user) return false
    return roles.includes(((user as any).role || '').toString())
  }

  const filteredNav = useMemo(() => {
    const q = search.trim().toLowerCase()
    return navItems.filter((item) => {
      if (!isFeatureEnabled(item.featureFlag)) return false
      if (!hasRole(item.roles)) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
      )
    })
  }, [search, user, features])

  const mainItems = filteredNav.filter(item => item.section === 'main')
  const tradingItems = filteredNav.filter(item => item.section === 'trading')
  const advancedItems = filteredNav.filter(item => (item.section as any) === 'advanced')
  const analysisItems = filteredNav.filter(item => item.section === 'analysis')
  const portfolioItems = filteredNav.filter(item => item.section === 'portfolio')
  const toolsItems = filteredNav.filter(item => item.section === 'tools')
  const agentsItems = filteredNav.filter(item => item.section === 'agents')
  const docsItems = filteredNav.filter(item => item.section === 'docs')
  const adminItems = filteredNav.filter(item => item.section === 'admin')
  const devItems = filteredNav.filter(item => item.section === 'dev')

  useEffect(() => {
    localStorage.setItem('features', JSON.stringify(features))
  }, [features])

  const toggleFeature = (flag: string) => {
    setFeatures(prev => {
      const next = { ...prev, [flag]: !prev[flag] }
      localStorage.setItem('features', JSON.stringify(next))
      return next
    })
  }

  return (
    <div 
      className="min-h-screen transition-colors duration-300 flex"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col backdrop-blur-sm transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-16'
        }`}
        style={{
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
        }}
      >
        {/* Header */}
        <div 
          className="flex h-16 items-center justify-between border-b px-4"
          style={{ borderBottomColor: colors.border }}
        >
          {isSidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Malta Ghost 5
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 w-full justify-end">
            {isSidebarOpen && (
              <div style={{ width: '220px' }}>
                <Input placeholder="Quick search..." value={search} onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
              </div>
            )}
            {/* Theme selector in header for quick access */}
            <div className="mr-2">
              <ThemeSelector />
            </div>
            <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-2 transition-colors"
            style={{ color: colors.text }}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          </div>
        </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-6">
            {/* Main Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Main
                </h3>
              )}
              <div className="space-y-1">
                {mainItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}

                {isSidebarOpen && (
                  <div className="mt-2 px-3">
                    <button onClick={() => setShowFeaturePanel(!showFeaturePanel)} className="w-full text-left rounded-lg px-3 py-2.5 transition-all" style={{ color: colors.textSecondary, backgroundColor: `${colors.card}22` }}>
                      <Settings className="h-4 w-4 inline-block mr-2" /> Feature Flags
                    </button>
                    {showFeaturePanel && (
                      <div className="mt-2 space-y-2 px-2">
                        {['agents','ml','devUi','apiKeys','billing'].map((flag) => (
                          <label key={flag} className="flex items-center justify-between w-full px-2 py-1 rounded" style={{ color: colors.textSecondary }}>
                            <span className="text-sm">{flag}</span>
                            <input type="checkbox" checked={!!features[flag]} onChange={() => toggleFeature(flag)} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>

            {/* Trading Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Trading
                </h3>
              )}
              <div className="space-y-1">
                {tradingItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Advanced Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Advanced
                </h3>
              )}
              <div className="space-y-1">
                {advancedItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}
                {/* Flow Engine addition to sidebar */}
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Flow Engine
                  </h3>
                )}
                <div className="space-y-1">
                  <Link href="/flow-engine">
                    <span
                      className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                      style={{
                        backgroundColor: location === '/flow-engine' ? colors.accent : 'transparent',
                        color: location === '/flow-engine' ? colors.background : colors.textSecondary,
                      }}
                      title={!isSidebarOpen ? 'Flow Engine' : undefined}
                    >
                      <Zap className="h-5 w-5 flex-shrink-0" />
                      {isSidebarOpen && <span className="font-medium">Flow Engine</span>}
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Analysis Section (Secondary Sidebar) */}
            {analysisItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Analysis
                  </h3>
                )}
                <div className="space-y-1">
                  {analysisItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <span
                          className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                          style={{
                            backgroundColor: isActive ? colors.accent : 'transparent',
                            color: isActive ? colors.background : colors.textSecondary,
                          }}
                          title={!isSidebarOpen ? item.name : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Portfolio Section */}
            {portfolioItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Portfolio
                  </h3>
                )}
                <div className="space-y-1">
                  {portfolioItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <span
                          className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                          style={{
                            backgroundColor: isActive ? colors.accent : 'transparent',
                            color: isActive ? colors.background : colors.textSecondary,
                          }}
                          title={!isSidebarOpen ? item.name : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tools / Utilities Section */}
            {toolsItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Utilities
                  </h3>
                )}
                <div className="space-y-1">
                  {toolsItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <span
                          className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                          style={{
                            backgroundColor: isActive ? colors.accent : 'transparent',
                            color: isActive ? colors.background : colors.textSecondary,
                          }}
                          title={!isSidebarOpen ? item.name : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Agents Section */}
            {agentsItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Agents
                  </h3>
                )}
                <div className="space-y-1">
                  {agentsItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <span
                          className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                          style={{
                            backgroundColor: isActive ? colors.accent : 'transparent',
                            color: isActive ? colors.background : colors.textSecondary,
                          }}
                          title={!isSidebarOpen ? item.name : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Learning / Docs Section */}
            {docsItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Learning
                  </h3>
                )}
                <div className="space-y-1">
                  {docsItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <span
                          className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                          style={{
                            backgroundColor: isActive ? colors.accent : 'transparent',
                            color: isActive ? colors.background : colors.textSecondary,
                          }}
                          title={!isSidebarOpen ? item.name : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dev Section */}
            <div>
              {isSidebarOpen && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                  Dev
                </h3>
              )}
              <div className="space-y-1">
                {devItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <span
                        className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                        style={{
                          backgroundColor: isActive ? colors.accent : 'transparent',
                          color: isActive ? colors.background : colors.textSecondary,
                        }}
                        title={!isSidebarOpen ? item.name : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

            {/* Admin Section */}
            {adminItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
                    Admin
                  </h3>
                )}
                <div className="space-y-1">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <span
                          className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`}
                          style={{
                            backgroundColor: isActive ? colors.accent : 'transparent',
                            color: isActive ? colors.background : colors.textSecondary,
                          }}
                          title={!isSidebarOpen ? item.name : undefined}
                        >
                          {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
                          {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

          {/* User Section at Bottom - driven by userMenu config */}
          <div 
            className="border-t p-3 space-y-2"
            style={{ borderTopColor: colors.border }}
          >
            {user && (
              <div className={`flex items-center space-x-3 mb-3 ${!isSidebarOpen && 'justify-center'}`}>
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="Profile" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: colors.accent, color: colors.background }}>
                    {user.firstName?.[0] || user.email?.[0] || 'U'}
                  </div>
                )}
                {isSidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                      {user.firstName || user.email?.split('@')[0] || 'User'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              {userMenu.filter(i => {
                if (!i.featureFlag) return true
                try { const f = JSON.parse(localStorage.getItem('features')||'{}'); return !!f[i.featureFlag]; } catch (e) { return false }
              }).map((m) => {
                const isActive = location === m.path
                return (
                  <Link key={m.path} href={m.path}>
                    <span className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`} style={{ backgroundColor: isActive ? colors.accent : 'transparent', color: isActive ? colors.background : colors.textSecondary }} title={!isSidebarOpen ? m.name : undefined}>
                      {m.icon ? <m.icon className="h-5 w-5 flex-shrink-0" /> : <Settings className="h-5 w-5" />}
                      {isSidebarOpen && <span className="font-medium">{m.name}</span>}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Logout Link */}
            <a href="/api/logout">
              <span className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${!isSidebarOpen && 'justify-center'}`} style={{ color: colors.textSecondary }} title={!isSidebarOpen ? 'Sign Out' : undefined} data-testid="link-logout">
                <LogOut className="h-5 w-5 flex-shrink-0" />
                {isSidebarOpen && <span className="font-medium">Sign Out</span>}
              </span>
            </a>

            {/* Modern theme toggle */}
            <button onClick={() => setPreset(preset === 'dark' ? 'light' : 'dark')} className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 transition-all ${!isSidebarOpen && 'justify-center'}`} style={{ color: colors.textSecondary }} title={preset === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} data-testid="button-theme-toggle">
              {preset === 'dark' ? (
                <>
                  <Sun className="h-5 w-5 flex-shrink-0" />
                  {isSidebarOpen && <span className="font-medium">Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5 flex-shrink-0" />
                  {isSidebarOpen && <span className="font-medium">Dark Mode</span>}
                </>
              )}
            </button>

            {/* Advanced theme selector */}
            {isSidebarOpen && (
              <div className="flex items-center space-x-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: `${colors.card}66` }}>
                <div className="flex-1">
                  <p className="text-xs font-medium" style={{ color: colors.textSecondary }}>Theme: {preset}</p>
                </div>
                <ThemeSelector />
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 ${
            isSidebarOpen ? 'ml-64' : 'ml-16'
          }`}
        >
          {children}
        </main>
      </div>
  );
}