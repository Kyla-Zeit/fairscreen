import type { AppRouteDefinition } from "../app/routes";
import { EmptyState } from "../shared/components/EmptyState";
import { LinkButton } from "../shared/components/LinkButton";
import { PageContainer } from "../shared/components/PageContainer";
import { PageHeader } from "../shared/components/PageHeader";

interface RoutePlaceholderPageProps {
  readonly route: AppRouteDefinition;
}

export function RoutePlaceholderPage({ route }: RoutePlaceholderPageProps) {
  return (
    <PageContainer className="page-stack">
      <PageHeader
        eyebrow="Coming soon"
        title={route.title}
        lead={route.summary}
      />
      <EmptyState
        availability={
          route.availability ??
          "This workflow is not available yet, and no data or device access starts from this page."
        }
        icon={route.icon}
        title={`${route.label} is not available yet`}
        actions={
          <>
            {route.primaryAction ? (
              <LinkButton to={route.primaryAction.to}>
                {route.primaryAction.label}
              </LinkButton>
            ) : null}
            <LinkButton to="/" variant="secondary">
              Exit to Home
            </LinkButton>
          </>
        }
      >
        <p>
          You can safely leave this page. There is nothing to save, discard, or
          stop.
        </p>
      </EmptyState>
    </PageContainer>
  );
}
