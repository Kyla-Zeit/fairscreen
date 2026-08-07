import {
  Contrast,
  Keyboard,
  MicOff,
  MonitorOff,
  MousePointer2,
  TimerReset,
} from "lucide-react";

import { Disclosure } from "../shared/components/Disclosure";
import { LinkButton } from "../shared/components/LinkButton";
import { Notice } from "../shared/components/Notice";
import { PageContainer } from "../shared/components/PageContainer";
import { PageHeader } from "../shared/components/PageHeader";

const accessPrinciples = [
  {
    icon: <Keyboard aria-hidden="true" size={24} />,
    title: "Keyboard operation",
    text: "Routes, links, menu controls, disclosures, and skip navigation are designed to work from the keyboard without traps.",
  },
  {
    icon: <TimerReset aria-hidden="true" size={24} />,
    title: "Timing control",
    text: "Timed practice must offer flexible, extended, or untimed paths so speed is not treated as essential.",
  },
  {
    icon: <MonitorOff aria-hidden="true" size={24} />,
    title: "Camera optional",
    text: "A user can practice, use manual text, and review answer content without a camera.",
  },
  {
    icon: <MicOff aria-hidden="true" size={24} />,
    title: "Microphone optional",
    text: "Typed and pasted transcripts are first-class alternatives to browser speech recognition or microphone capture.",
  },
  {
    icon: <Contrast aria-hidden="true" size={24} />,
    title: "Contrast and motion",
    text: "The interface respects reduced-motion and higher-contrast preferences, with text labels rather than color-only signals.",
  },
  {
    icon: <MousePointer2 aria-hidden="true" size={24} />,
    title: "Target size",
    text: "Primary controls use comfortable sizing and spacing, especially on narrow screens and touch devices.",
  },
];

export function AccessibilityPage() {
  return (
    <PageContainer className="page-stack education-page">
      <PageHeader
        eyebrow="Accessibility"
        title="Accessibility and alternatives"
        lead="FairScreen targets WCAG 2.2 AA for authored content and flows. The target is documented honestly; assistive-technology review still needs recorded manual evidence before release."
        actions={
          <>
            <LinkButton to="/interviews/new">
              Start a practice interview
            </LinkButton>
            <LinkButton to="/privacy" variant="secondary">
              Review privacy
            </LinkButton>
          </>
        }
      />

      <section className="content-grid" aria-label="Accessibility principles">
        {accessPrinciples.map((principle) => (
          <article className="info-card" key={principle.title}>
            <div className="card-icon">{principle.icon}</div>
            <h2>{principle.title}</h2>
            <p>{principle.text}</p>
          </article>
        ))}
      </section>

      <Notice
        title="Manual transcript is a complete alternative"
        variant="privacy"
      >
        Recognition can misrepresent accents, names, technical language, and
        speech differences. A typed or pasted transcript must remain available
        without repeated device prompts.
      </Notice>

      <section className="section-block" aria-labelledby="access-details">
        <div className="section-heading">
          <p className="eyebrow">Design details</p>
          <h2 id="access-details">Controls that reduce pressure</h2>
        </div>
        <div className="disclosure-stack">
          <Disclosure summary="Keyboard and focus behavior">
            <p>
              The app includes a skip link, visible focus states, route-heading
              focus after navigation, Escape handling for the mobile menu, and
              native controls where possible.
            </p>
          </Disclosure>
          <Disclosure summary="Reduced motion and high contrast">
            <p>
              Non-essential transitions are minimized and disabled when the
              system requests reduced motion. High-contrast and forced-colors
              modes retain borders, text labels, and visible focus.
            </p>
          </Disclosure>
          <Disclosure summary="Camera, microphone, and preview alternatives">
            <p>
              Camera and microphone features are optional. Preview, live
              prompts, visual meters, and timer announcements must be hideable
              or adjustable without removing the core practice path.
            </p>
          </Disclosure>
          <Disclosure summary="Print and text equivalents">
            <p>
              Tables carry the canonical meaning for comparisons. Decorative
              visuals must duplicate table information, and print output should
              use plain high-contrast text without relying on interactive UI.
            </p>
          </Disclosure>
        </div>
      </section>
    </PageContainer>
  );
}
