import { Home, RotateCcw } from "lucide-react";

import { Button } from "./Button";
import { LinkButton } from "./LinkButton";
import { Notice } from "./Notice";
import { PageContainer } from "./PageContainer";

interface ErrorBoundaryFallbackProps {
  readonly diagnosticCode: string;
}

export function ErrorBoundaryFallback({
  diagnosticCode,
}: ErrorBoundaryFallbackProps) {
  return (
    <PageContainer className="page-stack">
      <div className="page-header">
        <p className="eyebrow">Unexpected error</p>
        <h1 tabIndex={-1}>FairScreen recovered this route</h1>
        <p className="lead">
          Active resources were stopped while the route recovered. Your last
          confirmed local save is unchanged.
        </p>
      </div>
      <Notice title="Privacy-safe diagnostic" variant="error">
        Diagnostic code: <code>{diagnosticCode}</code>
      </Notice>
      <div className="action-row">
        <LinkButton to="/" icon={<Home aria-hidden="true" size={18} />}>
          Go home
        </LinkButton>
        <Button
          variant="secondary"
          icon={<RotateCcw aria-hidden="true" size={18} />}
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </Button>
      </div>
    </PageContainer>
  );
}
