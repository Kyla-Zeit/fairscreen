import {
  Blocks,
  ClipboardCheck,
  EyeOff,
  ShieldQuestion,
  Video,
} from "lucide-react";

import { Disclosure } from "../shared/components/Disclosure";
import { LinkButton } from "../shared/components/LinkButton";
import { Notice } from "../shared/components/Notice";
import { PageContainer } from "../shared/components/PageContainer";
import { PageHeader } from "../shared/components/PageHeader";

export function MethodologyPage() {
  return (
    <PageContainer className="page-stack education-page">
      <PageHeader
        eyebrow="Methodology"
        title="Methodology and limits"
        lead="FairScreen separates reviewed answer content from observable call conditions. The separation is intentional: a changed camera setup must not become a changed judgment about a person."
        actions={
          <LinkButton to="/interviews/new">
            Start a practice interview
          </LinkButton>
        }
      />

      <section className="content-grid" aria-label="Methodology principles">
        <article className="info-card">
          <div className="card-icon">
            <ClipboardCheck aria-hidden="true" size={24} />
          </div>
          <h2>Interview coaching, not candidate assessment</h2>
          <p>
            FairScreen is for one person practicing their own responses. It is
            not designed to assess another person, rank candidates, or automate
            a hiring decision.
          </p>
        </article>
        <article className="info-card">
          <div className="card-icon">
            <Blocks aria-hidden="true" size={24} />
          </div>
          <h2>Reviewed transcript content comes first</h2>
          <p>
            Content coaching is based on the transcript that the user has
            reviewed. Optional camera or microphone observations do not feed
            into answer-content analysis.
          </p>
        </article>
        <article className="info-card">
          <div className="card-icon">
            <Video aria-hidden="true" size={24} />
          </div>
          <h2>Observable conditions are limited</h2>
          <p>
            Framing, brightness, face presence, microphone level, and pauses are
            capture conditions. They can be inaccurate, incomplete, or
            irrelevant to the quality of an answer.
          </p>
        </article>
        <article className="info-card">
          <div className="card-icon">
            <EyeOff aria-hidden="true" size={24} />
          </div>
          <h2>Unsupported traits stay out</h2>
          <p>
            FairScreen does not infer internal state, identity, demographics,
            integrity, or hiring-related worth from video, audio, or text.
          </p>
        </article>
      </section>

      <Notice title="Near-camera orientation is not eye contact" variant="info">
        Looking at the displayed question or interviewer is normal. Because the
        webcam is usually above or beside the screen, looking at the person on
        screen may appear as looking away from the camera. FairScreen calls its
        approximation "near-camera orientation." It does not measure eye contact
        or attention.
      </Notice>

      <section className="section-block" aria-labelledby="method-limits">
        <div className="section-heading">
          <p className="eyebrow">Responsible use</p>
          <h2 id="method-limits">Limitations that stay visible</h2>
        </div>
        <div className="disclosure-stack">
          <Disclosure summary="What optional measurements mean">
            <p>
              Optional audio and video observations describe the capture
              environment: whether the camera could see a face, whether the
              image looked dim, whether the microphone signal was low, or
              whether orientation was near the camera. They are not proof of why
              something happened.
            </p>
          </Disclosure>
          <Disclosure summary="What deterministic analysis can miss">
            <p>
              FairScreen uses documented wording patterns in reviewed text. It
              may miss context, misunderstand phrasing, or overemphasize a
              pattern that does not matter for the user&apos;s real interview.
            </p>
          </Disclosure>
        </div>
      </section>

      <section className="limitation-panel" aria-labelledby="validation-limit">
        <div className="card-icon">
          <ShieldQuestion aria-hidden="true" size={24} />
        </div>
        <div>
          <h2 id="validation-limit">Validation boundary</h2>
          <p>
            FairScreen is not validated or designed to predict job performance.
            Do not use it to assess another person.
          </p>
        </div>
      </section>

      <section className="section-block" aria-labelledby="method-next">
        <div className="section-heading">
          <p className="eyebrow">Where to go next</p>
          <h2 id="method-next">Review privacy or start practicing</h2>
        </div>
        <div className="action-row">
          <LinkButton to="/privacy" variant="secondary">
            Review privacy
          </LinkButton>
          <LinkButton to="/interviews/new">
            Start a practice interview
          </LinkButton>
        </div>
      </section>
    </PageContainer>
  );
}
