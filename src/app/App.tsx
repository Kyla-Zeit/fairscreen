import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { AppShell } from "./AppShell";
import { BrowserServicesProvider } from "./BrowserServicesProvider";
import { DocumentTitleManager } from "./DocumentTitleManager";
import { FairScreenRepositoryProvider } from "./FairScreenRepositoryProvider";
import { ResourceRegistryProvider } from "./ResourceRegistryProvider";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { type AppRouteDefinition, routeDefinitions } from "./routes";
import { DeviceCheckPage } from "../features/device-check/DeviceCheckPage";
import { InterviewPage } from "../features/interview/InterviewPage";
import { SavedSessionReportPage } from "../features/reports/SavedSessionReportPage";
import { SavedSessionsPage } from "../features/sessions/SavedSessionsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { QuestionProviderProvider } from "../features/questions/QuestionProviderContext";
import { SetupDraftProvider } from "../features/setup/SetupDraftProvider";
import { SetupPage } from "../features/setup/SetupPage";
import { AccessibilityPage } from "../pages/AccessibilityPage";
import { HomePage } from "../pages/HomePage";
import { MethodologyPage } from "../pages/MethodologyPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PrivacyPage } from "../pages/PrivacyPage";
import { RoutePlaceholderPage } from "../pages/RoutePlaceholderPage";

export function App() {
  return (
    <ResourceRegistryProvider>
      <BrowserServicesProvider>
        <QuestionProviderProvider>
          <SetupDraftProvider>
            <FairScreenRepositoryProvider>
              <HashRouter>
                <DocumentTitleManager />
                <AppShell>
                  <Routes>
                    {routeDefinitions.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={
                          <RouteErrorBoundary>
                            {renderRoute(route)}
                          </RouteErrorBoundary>
                        }
                      />
                    ))}
                    <Route
                      path="/interviews/:sessionId/practise"
                      element={<LegacyPracticeRedirect />}
                    />
                    <Route
                      path="/fairness"
                      element={<Navigate replace to="/methodology" />}
                    />
                    <Route
                      path="*"
                      element={
                        <RouteErrorBoundary>
                          <NotFoundPage />
                        </RouteErrorBoundary>
                      }
                    />
                  </Routes>
                </AppShell>
              </HashRouter>
            </FairScreenRepositoryProvider>
          </SetupDraftProvider>
        </QuestionProviderProvider>
      </BrowserServicesProvider>
    </ResourceRegistryProvider>
  );
}

function renderRoute(route: AppRouteDefinition) {
  switch (route.id) {
    case "home":
      return <HomePage />;
    case "practice":
      return <SetupPage />;
    case "device-check":
      return <DeviceCheckPage />;
    case "interview":
      return <InterviewPage />;
    case "report":
      return <SavedSessionReportPage />;
    case "saved":
      return <SavedSessionsPage />;
    case "privacy":
      return <PrivacyPage />;
    case "methodology":
      return <MethodologyPage />;
    case "accessibility":
      return <AccessibilityPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <RoutePlaceholderPage route={route} />;
  }
}

function LegacyPracticeRedirect() {
  const { sessionId = "example" } = useParams();
  return (
    <Navigate
      replace
      to={`/interviews/${encodeURIComponent(sessionId)}/practice`}
    />
  );
}
