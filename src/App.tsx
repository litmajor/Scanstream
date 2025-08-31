import { Switch, Route } from "wouter";
import { queryClient } from "../client/src/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "../client/src/components/ui/toaster";
import { TooltipProvider } from "../client/src/components/ui/tooltip";
import TradingTerminal from "../client/src/pages/trading-terminal";
import NotFound from "../client/src/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={TradingTerminal} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
