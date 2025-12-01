import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Calendar,
  Settings,
  LogOut,
  Shield,
  Key
} from "lucide-react";
import { Link } from "wouter";

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isLoading, isAuthenticated, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return "User";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={getDisplayName()} />
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl" data-testid="text-profile-name">{getDisplayName()}</CardTitle>
                <CardDescription className="flex items-center gap-1" data-testid="text-profile-email">
                  <Mail className="h-4 w-4" />
                  {user?.email || "No email set"}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" data-testid="badge-account-type">
              <Shield className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Account Information</h3>
              <div className="grid gap-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>User ID</span>
                  </div>
                  <span className="font-mono text-sm" data-testid="text-user-id">{user?.id}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Member Since</span>
                  </div>
                  <span data-testid="text-member-since">{user?.createdAt ? formatDate(user.createdAt) : "Unknown"}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Key className="h-4 w-4" />
                    <span>Connected Exchanges</span>
                  </div>
                  <Badge variant="outline" data-testid="badge-exchanges-count">0 connected</Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid gap-3">
                <Link href="/settings">
                  <Button variant="outline" className="w-full justify-start" data-testid="button-goto-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Account Settings
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-destructive hover:text-destructive"
                  asChild
                  data-testid="button-logout"
                >
                  <a href="/api/logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
