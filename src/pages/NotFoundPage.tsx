import { Home, ListChecks } from "lucide-react";

import { LinkButton } from "../shared/components/LinkButton";
import { Notice } from "../shared/components/Notice";
import { PageContainer } from "../shared/components/PageContainer";
import { PageHeader } from "../shared/components/PageHeader";

export function NotFoundPage() {
  return (
    <PageContainer className="page-stack">
      <PageHeader
        eyebrow="Route recovery"
        title="That FairScreen page was not found"
        lead="The requested route is not part of the FairScreen sitemap."
      />
      <Notice title="No data impact" variant="info">
        This recovery page does not request devices, read saved practice data,
        or send information anywhere.
      </Notice>
      <div className="action-row">
        <LinkButton to="/" icon={<Home aria-hidden="true" size={18} />}>
          Go home
        </LinkButton>
        <LinkButton
          to="/saved"
          variant="secondary"
          icon={<ListChecks aria-hidden="true" size={18} />}
        >
          Open saved sessions
        </LinkButton>
      </div>
    </PageContainer>
  );
}
