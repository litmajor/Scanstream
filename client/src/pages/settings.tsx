
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Bell, 
  Key, 
  Palette, 
  Trash2, 
  Plus,
  Globe,
  Loader2,
  TrendingUp,
  Percent,
  LayoutGrid,
  Shield,
  Zap,
  Download,
  Eye,
  Clock,
  LogOut,
  Lock,
  AlertCircle
} from "lucide-react";

interface ApiKey {
  id: string;
  exchange: string;
  name: string;
  isTestnet: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Preferences {
  theme: string;
  defaultTimeframe: string;
  defaultExchange: string;
  notificationsEnabled: boolean;
  emailAlerts: boolean;
  priceAlerts: boolean;
  signalAlerts: boolean;
  soundEnabled: boolean;
}

interface TradingSettings {
  positionSize: number; // % of capital
  defaultStopLoss: number; // %
  defaultTakeProfit: number; // %
  orderType: string; // 'MARKET' | 'LIMIT'
  slippageTolerance: number; // %
  commissionRate: number; // %
  riskRewardRatio: number;
  maxDailyLoss: number; // %
  maxPositionsOpen: number;
}

interface DashboardSettings {
  widgets: string[];
  layoutName: string;
  defaultIndicators: string[];
  refreshInterval: number;
}

interface AdvancedSettings {
  apiRateLimit: number;
  webhookUrl: string;
  botScheduleEnabled: boolean;
  botScheduleStart: string;
  botScheduleEnd: string;
  alertThrottling: number;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  ipWhitelistEnabled: boolean;
  ipAddresses: string[];
}

interface LoginSession {
  id: string;
  ipAddress: string;
  userAgent: string;
  lastActive: string;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function SettingsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    exchange: "binance",
    name: "",
    apiKey: "",
    apiSecret: "",
    isTestnet: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  const { data: preferences, isLoading: prefsLoading } = useQuery<Preferences>({
    queryKey: ["/api/user/preferences"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: {
      theme: "dark",
      defaultTimeframe: "1h",
      defaultExchange: "binance",
      notificationsEnabled: true,
      emailAlerts: false,
      priceAlerts: true,
      signalAlerts: true,
      soundEnabled: true,
    },
  });

  const { data: apiKeys, isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/user/api-keys"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: [],
  });

  const { data: tradingSettings, isLoading: tradingLoading } = useQuery<TradingSettings>({
    queryKey: ["/api/user/trading-settings"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: {
      positionSize: 5,
      defaultStopLoss: 2,
      defaultTakeProfit: 5,
      orderType: "MARKET",
      slippageTolerance: 0.5,
      commissionRate: 0.1,
      riskRewardRatio: 2,
      maxDailyLoss: 10,
      maxPositionsOpen: 5,
    },
  });

  const { data: dashboardSettings, isLoading: dashLoading } = useQuery<DashboardSettings>({
    queryKey: ["/api/user/dashboard-settings"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: {
      widgets: ["price-chart", "portfolio", "signals"],
      layoutName: "default",
      defaultIndicators: ["RSI", "MACD", "Bollinger"],
      refreshInterval: 5,
    },
  });

  const { data: advancedSettings, isLoading: advancedLoading } = useQuery<AdvancedSettings>({
    queryKey: ["/api/user/advanced-settings"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: {
      apiRateLimit: 1000,
      webhookUrl: "",
      botScheduleEnabled: false,
      botScheduleStart: "09:00",
      botScheduleEnd: "17:00",
      alertThrottling: 5,
    },
  });

  const { data: securitySettings, isLoading: securityLoading } = useQuery<SecuritySettings>({
    queryKey: ["/api/user/security"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: {
      twoFactorEnabled: false,
      ipWhitelistEnabled: false,
      ipAddresses: [],
    },
  });

  const { data: loginSessions, isLoading: sessionsLoading } = useQuery<LoginSession[]>({
    queryKey: ["/api/user/login-sessions"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: [],
  });

  const { data: activityLogs, isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/user/activity-logs"],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5000,
    initialData: [],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<Preferences>) => {
      return apiRequest("PATCH", "/api/user/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Preferences updated", description: "Your settings have been saved." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to update preferences.", 
        variant: "destructive" 
      });
    },
  });

  const updateTradingSettingsMutation = useMutation({
    mutationFn: async (data: Partial<TradingSettings>) => {
      return apiRequest("PATCH", "/api/user/trading-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/trading-settings"] });
      toast({ title: "Trading settings updated", description: "Your trading preferences have been saved." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to update trading settings.", 
        variant: "destructive" 
      });
    },
  });

  const addApiKeyMutation = useMutation({
    mutationFn: async (data: typeof newKeyForm) => {
      return apiRequest("POST", "/api/user/api-keys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      setShowAddKey(false);
      setNewKeyForm({ exchange: "binance", name: "", apiKey: "", apiSecret: "", isTestnet: false });
      toast({ title: "API key added", description: "Your exchange connection has been saved." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to add API key.", 
        variant: "destructive" 
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return apiRequest("DELETE", `/api/user/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({ title: "API key deleted", description: "The exchange connection has been removed." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to delete API key.", 
        variant: "destructive" 
      });
    },
  });

  const updateDashboardSettingsMutation = useMutation({
    mutationFn: async (data: Partial<DashboardSettings>) => {
      return apiRequest("PATCH", "/api/user/dashboard-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/dashboard-settings"] });
      toast({ title: "Dashboard settings updated", description: "Your layout has been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update dashboard.", variant: "destructive" });
    },
  });

  const updateAdvancedSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AdvancedSettings>) => {
      return apiRequest("PATCH", "/api/user/advanced-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/advanced-settings"] });
      toast({ title: "Advanced settings updated", description: "Your settings have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update settings.", variant: "destructive" });
    },
  });

  const updateSecuritySettingsMutation = useMutation({
    mutationFn: async (data: Partial<SecuritySettings>) => {
      return apiRequest("PATCH", "/api/user/security", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/security"] });
      toast({ title: "Security settings updated", description: "Your security preferences have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update security.", variant: "destructive" });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest("POST", `/api/user/login-sessions/${sessionId}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/login-sessions"] });
      toast({ title: "Session revoked", description: "The session has been terminated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to revoke session.", variant: "destructive" });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user/export-data", { headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scanstream-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Data exported", description: "Your data has been downloaded." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to export data.", variant: "destructive" });
    },
  });

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-settings-title">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-settings-description">
          Manage your account preferences and exchange connections.
        </p>
      </div>

      <Tabs defaultValue="preferences" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 h-auto">
          <TabsTrigger value="preferences" data-testid="tab-preferences" className="text-xs">
            <Palette className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications" className="text-xs">
            <Bell className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="trading" data-testid="tab-trading" className="text-xs">
            <TrendingUp className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Trading</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="text-xs">
            <LayoutGrid className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" data-testid="tab-advanced" className="text-xs">
            <Zap className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Advanced</span>
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security" className="text-xs">
            <Shield className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy" className="text-xs">
            <Eye className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys" className="text-xs">
            <Key className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize how Scanstream looks and behaves.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {prefsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="theme">Theme</Label>
                      <p className="text-sm text-muted-foreground">Choose your preferred color scheme.</p>
                    </div>
                    <Select
                      value={preferences?.theme || "dark"}
                      onValueChange={(value) => updatePreferencesMutation.mutate({ theme: value })}
                      data-testid="select-theme"
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="timeframe">Default Timeframe</Label>
                      <p className="text-sm text-muted-foreground">Default chart timeframe.</p>
                    </div>
                    <Select
                      value={preferences?.defaultTimeframe || "1h"}
                      onValueChange={(value) => updatePreferencesMutation.mutate({ defaultTimeframe: value })}
                      data-testid="select-timeframe"
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1m">1 Minute</SelectItem>
                        <SelectItem value="5m">5 Minutes</SelectItem>
                        <SelectItem value="15m">15 Minutes</SelectItem>
                        <SelectItem value="1h">1 Hour</SelectItem>
                        <SelectItem value="4h">4 Hours</SelectItem>
                        <SelectItem value="1d">1 Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="exchange">Default Exchange</Label>
                      <p className="text-sm text-muted-foreground">Preferred exchange for trading.</p>
                    </div>
                    <Select
                      value={preferences?.defaultExchange || "binance"}
                      onValueChange={(value) => updatePreferencesMutation.mutate({ defaultExchange: value })}
                      data-testid="select-exchange"
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="binance">Binance</SelectItem>
                        <SelectItem value="coinbase">Coinbase</SelectItem>
                        <SelectItem value="kraken">Kraken</SelectItem>
                        <SelectItem value="kucoin">KuCoin</SelectItem>
                        <SelectItem value="okx">OKX</SelectItem>
                        <SelectItem value="bybit">Bybit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Control how and when you receive alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {prefsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive in-app notifications.</p>
                    </div>
                    <Switch
                      checked={preferences?.notificationsEnabled ?? true}
                      onCheckedChange={(checked) => updatePreferencesMutation.mutate({ notificationsEnabled: checked })}
                      data-testid="switch-notifications"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Alerts</Label>
                      <p className="text-sm text-muted-foreground">Receive important alerts via email.</p>
                    </div>
                    <Switch
                      checked={preferences?.emailAlerts ?? false}
                      onCheckedChange={(checked) => updatePreferencesMutation.mutate({ emailAlerts: checked })}
                      data-testid="switch-email-alerts"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Price Alerts</Label>
                      <p className="text-sm text-muted-foreground">Get notified on significant price movements.</p>
                    </div>
                    <Switch
                      checked={preferences?.priceAlerts ?? true}
                      onCheckedChange={(checked) => updatePreferencesMutation.mutate({ priceAlerts: checked })}
                      data-testid="switch-price-alerts"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Signal Alerts</Label>
                      <p className="text-sm text-muted-foreground">Get notified on new trading signals.</p>
                    </div>
                    <Switch
                      checked={preferences?.signalAlerts ?? true}
                      onCheckedChange={(checked) => updatePreferencesMutation.mutate({ signalAlerts: checked })}
                      data-testid="switch-signal-alerts"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sound Effects</Label>
                      <p className="text-sm text-muted-foreground">Play sounds for notifications.</p>
                    </div>
                    <Switch
                      checked={preferences?.soundEnabled ?? true}
                      onCheckedChange={(checked) => updatePreferencesMutation.mutate({ soundEnabled: checked })}
                      data-testid="switch-sound"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Exchange API Keys</CardTitle>
                  <CardDescription>Connect your exchange accounts for trading.</CardDescription>
                </div>
                <Button onClick={() => setShowAddKey(true)} data-testid="button-add-api-key">
                  <Plus className="h-4 w-4 mr-2" />
                  Add API Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddKey && (
                <Card className="mb-6 bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Add New API Key</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="exchange">Exchange</Label>
                        <Select
                          value={newKeyForm.exchange}
                          onValueChange={(value) => setNewKeyForm({ ...newKeyForm, exchange: value })}
                        >
                          <SelectTrigger data-testid="select-new-exchange">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="binance">Binance</SelectItem>
                            <SelectItem value="coinbase">Coinbase</SelectItem>
                            <SelectItem value="kraken">Kraken</SelectItem>
                            <SelectItem value="kucoin">KuCoin</SelectItem>
                            <SelectItem value="okx">OKX</SelectItem>
                            <SelectItem value="bybit">Bybit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="name">Key Name</Label>
                        <Input
                          id="name"
                          placeholder="My Trading Key"
                          value={newKeyForm.name}
                          onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                          data-testid="input-key-name"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        placeholder="Enter your API key"
                        value={newKeyForm.apiKey}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, apiKey: e.target.value })}
                        data-testid="input-api-key"
                      />
                    </div>
                    <div>
                      <Label htmlFor="apiSecret">API Secret</Label>
                      <Input
                        id="apiSecret"
                        type="password"
                        placeholder="Enter your API secret"
                        value={newKeyForm.apiSecret}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, apiSecret: e.target.value })}
                        data-testid="input-api-secret"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newKeyForm.isTestnet}
                        onCheckedChange={(checked) => setNewKeyForm({ ...newKeyForm, isTestnet: checked })}
                        data-testid="switch-testnet"
                      />
                      <Label>Testnet / Sandbox Mode</Label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowAddKey(false)} data-testid="button-cancel-key">
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => addApiKeyMutation.mutate(newKeyForm)}
                        disabled={!newKeyForm.name || !newKeyForm.apiKey || !newKeyForm.apiSecret || addApiKeyMutation.isPending}
                        data-testid="button-save-key"
                      >
                        {addApiKeyMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save API Key'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {keysLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">Loading API keys...</p>
                </div>
              ) : apiKeys?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys configured yet.</p>
                  <p className="text-sm">Add your first exchange connection to start trading.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys?.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`api-key-${key.id}`}>
                      <div className="flex items-center gap-4">
                        <Globe className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{key.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">{key.exchange}</div>
                        </div>
                        <div className="flex gap-2">
                          {key.isTestnet && <Badge variant="outline">Testnet</Badge>}
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteApiKeyMutation.mutate(key.id)}
                        disabled={deleteApiKeyMutation.isPending}
                        data-testid={`button-delete-key-${key.id}`}
                      >
                        {deleteApiKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading">
          <Card>
            <CardHeader>
              <CardTitle>Trading Settings</CardTitle>
              <CardDescription>Configure your default trading parameters and risk management.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {tradingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="positionSize">Position Size (% of Capital)</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="positionSize"
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          value={tradingSettings?.positionSize || 5}
                          onChange={(e) => updateTradingSettingsMutation.mutate({ positionSize: parseFloat(e.target.value) })}
                          data-testid="input-position-size"
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Default position size per trade</p>
                    </div>

                    <div>
                      <Label htmlFor="defaultStopLoss">Default Stop Loss (%)</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="defaultStopLoss"
                          type="number"
                          min="0.1"
                          max="50"
                          step="0.1"
                          value={tradingSettings?.defaultStopLoss || 2}
                          onChange={(e) => updateTradingSettingsMutation.mutate({ defaultStopLoss: parseFloat(e.target.value) })}
                          data-testid="input-stop-loss"
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Stop loss percentage</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="defaultTakeProfit">Default Take Profit (%)</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="defaultTakeProfit"
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          value={tradingSettings?.defaultTakeProfit || 5}
                          onChange={(e) => updateTradingSettingsMutation.mutate({ defaultTakeProfit: parseFloat(e.target.value) })}
                          data-testid="input-take-profit"
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Take profit percentage</p>
                    </div>

                    <div>
                      <Label htmlFor="riskRewardRatio">Risk/Reward Ratio</Label>
                      <Input
                        id="riskRewardRatio"
                        type="number"
                        min="0.5"
                        max="10"
                        step="0.1"
                        value={tradingSettings?.riskRewardRatio || 2}
                        onChange={(e) => updateTradingSettingsMutation.mutate({ riskRewardRatio: parseFloat(e.target.value) })}
                        className="mt-2"
                        data-testid="input-risk-reward"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Minimum risk/reward ratio</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="slippageTolerance">Slippage Tolerance (%)</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="slippageTolerance"
                          type="number"
                          min="0.01"
                          max="5"
                          step="0.01"
                          value={tradingSettings?.slippageTolerance || 0.5}
                          onChange={(e) => updateTradingSettingsMutation.mutate({ slippageTolerance: parseFloat(e.target.value) })}
                          data-testid="input-slippage"
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Maximum acceptable slippage</p>
                    </div>

                    <div>
                      <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="commissionRate"
                          type="number"
                          min="0"
                          max="1"
                          step="0.001"
                          value={tradingSettings?.commissionRate || 0.1}
                          onChange={(e) => updateTradingSettingsMutation.mutate({ commissionRate: parseFloat(e.target.value) })}
                          data-testid="input-commission"
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Exchange commission rate</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="maxDailyLoss">Max Daily Loss (%)</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          id="maxDailyLoss"
                          type="number"
                          min="1"
                          max="100"
                          step="0.1"
                          value={tradingSettings?.maxDailyLoss || 10}
                          onChange={(e) => updateTradingSettingsMutation.mutate({ maxDailyLoss: parseFloat(e.target.value) })}
                          data-testid="input-max-daily-loss"
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Stop trading after loss</p>
                    </div>

                    <div>
                      <Label htmlFor="maxPositionsOpen">Max Open Positions</Label>
                      <Input
                        id="maxPositionsOpen"
                        type="number"
                        min="1"
                        max="50"
                        value={tradingSettings?.maxPositionsOpen || 5}
                        onChange={(e) => updateTradingSettingsMutation.mutate({ maxPositionsOpen: parseInt(e.target.value) })}
                        className="mt-2"
                        data-testid="input-max-positions"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Maximum concurrent positions</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Customization</CardTitle>
              <CardDescription>Customize your dashboard layout and indicators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {dashLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div>
                    <Label>Active Widgets</Label>
                    <p className="text-sm text-muted-foreground mb-2">Select which widgets to display</p>
                    <div className="space-y-2">
                      {["price-chart", "portfolio", "signals", "alerts", "heatmap"].map((widget) => (
                        <div key={widget} className="flex items-center gap-2">
                          <input type="checkbox" id={widget} defaultChecked={dashboardSettings?.widgets.includes(widget)} className="rounded" data-testid={`check-${widget}`} />
                          <label htmlFor={widget} className="text-sm capitalize cursor-pointer">{widget.replace("-", " ")}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <Label htmlFor="layoutName">Saved Layout</Label>
                    <Select value={dashboardSettings?.layoutName || "default"} onValueChange={(value) => updateDashboardSettingsMutation.mutate({ layoutName: value })}>
                      <SelectTrigger data-testid="select-layout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default Layout</SelectItem>
                        <SelectItem value="compact">Compact Layout</SelectItem>
                        <SelectItem value="detailed">Detailed Layout</SelectItem>
                        <SelectItem value="custom">Custom Layout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div>
                    <Label>Default Indicators</Label>
                    <p className="text-sm text-muted-foreground mb-2">Technical indicators to display by default</p>
                    <div className="space-y-2">
                      {["RSI", "MACD", "Bollinger", "EMA", "SMA"].map((indicator) => (
                        <div key={indicator} className="flex items-center gap-2">
                          <input type="checkbox" id={indicator} defaultChecked={dashboardSettings?.defaultIndicators.includes(indicator)} className="rounded" data-testid={`check-ind-${indicator}`} />
                          <label htmlFor={indicator} className="text-sm cursor-pointer">{indicator}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                    <Input id="refreshInterval" type="number" min="1" max="60" value={dashboardSettings?.refreshInterval || 5} onChange={(e) => updateDashboardSettingsMutation.mutate({ refreshInterval: parseInt(e.target.value) })} data-testid="input-refresh" className="mt-2" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Configure API limits, webhooks, and automation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {advancedLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div>
                    <Label htmlFor="apiRateLimit">API Rate Limit (requests/minute)</Label>
                    <Input id="apiRateLimit" type="number" min="10" max="10000" value={advancedSettings?.apiRateLimit || 1000} onChange={(e) => updateAdvancedSettingsMutation.mutate({ apiRateLimit: parseInt(e.target.value) })} className="mt-2" data-testid="input-rate-limit" />
                  </div>
                  <Separator />
                  <div>
                    <Label htmlFor="webhookUrl">Webhook URL</Label>
                    <Input id="webhookUrl" type="url" placeholder="https://your-webhook-endpoint.com" value={advancedSettings?.webhookUrl || ""} onChange={(e) => updateAdvancedSettingsMutation.mutate({ webhookUrl: e.target.value })} className="mt-2" data-testid="input-webhook" />
                    <p className="text-xs text-muted-foreground mt-1">Receive trading alerts via webhook</p>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Bot Scheduling</Label>
                        <p className="text-sm text-muted-foreground">Enable scheduled bot operation</p>
                      </div>
                      <Switch checked={advancedSettings?.botScheduleEnabled || false} onCheckedChange={(checked) => updateAdvancedSettingsMutation.mutate({ botScheduleEnabled: checked })} data-testid="switch-bot-schedule" />
                    </div>
                    {advancedSettings?.botScheduleEnabled && (
                      <>
                        <div className="grid grid-cols-2 gap-4 ml-4">
                          <div>
                            <Label htmlFor="scheduleStart">Start Time</Label>
                            <Input id="scheduleStart" type="time" value={advancedSettings?.botScheduleStart || "09:00"} onChange={(e) => updateAdvancedSettingsMutation.mutate({ botScheduleStart: e.target.value })} className="mt-2" data-testid="input-start-time" />
                          </div>
                          <div>
                            <Label htmlFor="scheduleEnd">End Time</Label>
                            <Input id="scheduleEnd" type="time" value={advancedSettings?.botScheduleEnd || "17:00"} onChange={(e) => updateAdvancedSettingsMutation.mutate({ botScheduleEnd: e.target.value })} className="mt-2" data-testid="input-end-time" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <Label htmlFor="alertThrottling">Alert Throttling (minutes)</Label>
                    <Input id="alertThrottling" type="number" min="1" max="60" value={advancedSettings?.alertThrottling || 5} onChange={(e) => updateAdvancedSettingsMutation.mutate({ alertThrottling: parseInt(e.target.value) })} className="mt-2" data-testid="input-throttling" />
                    <p className="text-xs text-muted-foreground mt-1">Minimum time between duplicate alerts</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security & Sessions</CardTitle>
              <CardDescription>Manage your security settings and active sessions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {securityLoading || sessionsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">Add extra security to your account</p>
                      </div>
                      <Switch checked={securitySettings?.twoFactorEnabled || false} onCheckedChange={(checked) => updateSecuritySettingsMutation.mutate({ twoFactorEnabled: checked })} data-testid="switch-2fa" />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>IP Whitelist</Label>
                        <p className="text-sm text-muted-foreground">Only allow specific IPs</p>
                      </div>
                      <Switch checked={securitySettings?.ipWhitelistEnabled || false} onCheckedChange={(checked) => updateSecuritySettingsMutation.mutate({ ipWhitelistEnabled: checked })} data-testid="switch-ip-whitelist" />
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Active Sessions</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {loginSessions && loginSessions.length > 0 ? (
                        loginSessions.map((session) => (
                          <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{session.ipAddress}</p>
                              <p className="text-xs text-muted-foreground">{session.userAgent?.substring(0, 50)}...</p>
                              <p className="text-xs text-muted-foreground">Last active: {new Date(session.lastActive).toLocaleDateString()}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => revokeSessionMutation.mutate(session.id)} data-testid={`btn-revoke-${session.id}`}>
                              <Lock className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No active sessions</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Data & Privacy</CardTitle>
              <CardDescription>Manage your data and privacy settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {logsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full justify-start" onClick={() => exportDataMutation.mutate()} disabled={exportDataMutation.isPending} data-testid="btn-export-data">
                      <Download className="h-4 w-4 mr-2" />
                      {exportDataMutation.isPending ? "Exporting..." : "Export My Data"}
                    </Button>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Recent Activity</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {activityLogs && activityLogs.length > 0 ? (
                        activityLogs.slice(0, 10).map((log) => (
                          <div key={log.id} className="p-2 bg-muted/50 rounded text-sm">
                            <p className="font-medium">{log.action}</p>
                            <p className="text-xs text-muted-foreground">{log.details}</p>
                            <p className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No activity logged</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
