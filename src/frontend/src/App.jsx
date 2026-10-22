import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { SessionProvider, useSession } from '@/lib/api';
import { Shell, HOME } from '@/components/shell';
import Masterlist from '@/pages/masterlist';
import Check from '@/pages/check';
import Review from '@/pages/review';
import Activity from '@/pages/activity';
import Certificates from '@/pages/certificates';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
function Gate({ roles, page: P }) {
  const { session } = useSession();
  if (!roles.includes(session.role))
    return <Redirect to={HOME[session.role]} />;
  return <P />;
}
function HomeRedirect() {
  const { session } = useSession();
  return <Redirect to={HOME[session.role]} />;
}
function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/masterlist">
            {() => <Gate roles={['staff', 'supervisor']} page={Masterlist} />}
          </Route>
          <Route path="/check">
            {() => <Gate roles={['staff']} page={Check} />}
          </Route>
          <Route path="/review">
            {() => <Gate roles={['supervisor']} page={Review} />}
          </Route>
          <Route path="/activity">
            {() => <Gate roles={['supervisor']} page={Activity} />}
          </Route>
          <Route path="/certificates">
            {() => <Gate roles={['supplier']} page={Certificates} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}
function RoutedErrorBoundary({ children }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
export default App;
