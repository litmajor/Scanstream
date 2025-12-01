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
  Eye,
  EyeOff,
  Shield,
  Clock,
  Globe
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
  });

  const { data: apiKeys, isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/user/api-keys"],
    enabled: isAuthenticated,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<Preferences>) => {
      return apiRequest("PATCH", "/api/user/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Preferences updated", description: "Your settings have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update preferences.", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Error", description: "Failed to add API key.", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Error", description: "Failed to delete API key.", variant: "destructive" });
    },
  });

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <Palette className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize how Scanstream looks and behaves.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                        disabled={!newKeyForm.name || !newKeyForm.apiKey || !newKeyForm.apiSecret}
                        data-testid="button-save-key"
                      >
                        Save API Key
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {keysLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading API keys...</div>
              ) : apiKeys?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys configured yet.</p>
                  <p className="text-sm">Add your first exchange connection to start trading.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys?.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`api-key-${key.id}`}>
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
                        data-testid={`button-delete-key-${key.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
