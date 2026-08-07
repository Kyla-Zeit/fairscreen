import {
  ArrowRight,
  Blocks,
  ClipboardCheck,
  EyeOff,
  FileText,
  Keyboard,
  Mic,
  Monitor,
  ShieldCheck,
  TimerReset,
  Video,
} from "lucide-react";

import { LinkButton } from "../shared/components/LinkButton";
import { PageContainer } from "../shared/components/PageContainer";

const leadCopy =
  "FairScreen helps you practice automated interviews and strengthen the substance of your answers. It can describe certain video-call conditions, but it never treats gaze, expression, movement, or speaking style as evidence of confidence, honesty, personality, or competence.";

const localFirstCopy =
  "Your video is not uploaded to FairScreen. Camera analysis runs in your browser, frame-level landmarks are discarded, and recordings are saved only when you choose. Browser speech recognition may use a vendor service; FairScreen asks before using it.";

const measuredItems = [
  "Answer timing and reviewed transcript content",
  "Optional microphone-level and pause estimates",
  "Optional camera framing, brightness, face presence, and near-camera orientation",
];

const refusedItems = [
  "Emotion or personality",
  "Honesty or deception",
  "Confidence or enthusiasm",
  "Employability or job competence",
  "Identity or demographics",
];

const workflowSteps = [
  {
    icon: <ClipboardCheck aria-hidden="true" size={24} />,
    title: "Prepare your interview",
    text: "Choose the role context, question style, timing, and whether any optional device checks make sense for you.",
  },
  {
    icon: <TimerReset aria-hidden="true" size={24} />,
    title: "Practice your answers",
    text: "Use typed answers, a microphone, a camera, or neither device. Missing media is a supported path, not a failure.",
  },
  {
    icon: <Blocks aria-hidden="true" size={24} />,
    title: "Review answer content",
    text: "FairScreen analyzes only reviewed transcript text when coaching the structure and substance of your answer.",
  },
  {
    icon: <FileText aria-hidden="true" size={24} />,
    title: "Save and practice again",
    text: "Keep completed and unfinished sessions locally, review your reports, and repeat questions when you are ready.",
  },
];

const communicationOptions = [
  "Camera-optional practice",
  "Microphone-optional practice",
  "Manual transcripts",
  "Adjustable timing",
  "Reduced motion",
  "High contrast",
  "Keyboard operation",
];

export function HomePage() {
  return (
    <>
      <section className="hero-section">
        <PageContainer className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow--on-dark">
              Privacy-focused interview practice
            </p>
            <h1 tabIndex={-1}>Practice the interview. Question the scoring.</h1>
            <p className="hero-lead">{leadCopy}</p>
            <div className="action-row">
              <LinkButton
                to="/interviews/new"
                icon={<ArrowRight aria-hidden="true" size={18} />}
              >
                Start a practice interview
              </LinkButton>
              <LinkButton to="/saved" variant="secondary">
                Review saved sessions
              </LinkButton>
            </div>
            <p className="hero-reassurance">
              Local-first by design. These pages do not request camera or
              microphone access.
            </p>
          </div>
          <div
            className="comparison-panel"
            aria-label="FairScreen measurement boundaries"
          >
            <div className="comparison-card">
              <h2>What FairScreen measures</h2>
              <ul className="icon-list">
                {measuredItems.map((item) => (
                  <li key={item}>
                    <ShieldCheck aria-hidden="true" size={18} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="comparison-card comparison-card--boundary">
              <h2>What FairScreen refuses to infer</h2>
              <ul className="icon-list">
                {refusedItems.map((item) => (
                  <li key={item}>
                    <EyeOff aria-hidden="true" size={18} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="home-stack">
        <section className="section-block" aria-labelledby="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">How FairScreen works</p>
            <h2 id="how-it-works">Practice steps that keep you in control</h2>
          </div>
          <div className="step-grid">
            {workflowSteps.map((step) => (
              <article className="info-card" key={step.title}>
                <div className="card-icon">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-section" aria-labelledby="separate-systems">
          <div>
            <p className="eyebrow">Separate by design</p>
            <h2 id="separate-systems">
              Answer coaching and video conditions are separate
            </h2>
          </div>
          <div
            className="separation-diagram"
            aria-label="Separate analysis paths"
          >
            <div className="path-card">
              <ClipboardCheck aria-hidden="true" size={22} />
              <h3>Reviewed answer content</h3>
              <p>
                Transcript-based feedback can discuss structure, specificity,
                evidence, and follow-through after you review the text.
              </p>
            </div>
            <div className="path-card">
              <Video aria-hidden="true" size={22} />
              <h3>Optional video conditions</h3>
              <p>
                Camera observations describe capture conditions such as framing,
                brightness, and near-camera orientation. They do not change
                answer-content feedback.
              </p>
            </div>
          </div>
        </section>

        <section className="privacy-banner" aria-labelledby="local-first">
          <div className="card-icon">
            <ShieldCheck aria-hidden="true" size={24} />
          </div>
          <div>
            <h2 id="local-first">Local-first privacy banner</h2>
            <p>{localFirstCopy}</p>
          </div>
        </section>

        <section className="section-block" aria-labelledby="communication">
          <div className="section-heading">
            <p className="eyebrow">Different ways of communicating</p>
            <h2 id="communication">Use the practice path that fits you</h2>
            <p>
              FairScreen is designed so optional measurements can be unavailable
              without blocking learning or turning communication differences
              into personal judgments.
            </p>
          </div>
          <ul className="option-grid">
            {communicationOptions.map((option) => (
              <li key={option}>
                {option.includes("Microphone") ? (
                  <Mic aria-hidden="true" size={18} />
                ) : option.includes("Keyboard") ? (
                  <Keyboard aria-hidden="true" size={18} />
                ) : option.includes("Camera") ? (
                  <Monitor aria-hidden="true" size={18} />
                ) : (
                  <ShieldCheck aria-hidden="true" size={18} />
                )}
                <span>{option}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="final-cta" aria-labelledby="home-final-cta">
          <div>
            <p className="eyebrow">Practice without surveillance theatre</p>
            <h2 id="home-final-cta">Ready to explore the workflow?</h2>
            <p>
              Start with guided setup or review sessions you have already saved.
              Camera and microphone access remain optional and under your
              control.
            </p>
          </div>
          <div className="action-row">
            <LinkButton to="/interviews/new">
              Start a practice interview
            </LinkButton>
            <LinkButton to="/saved" variant="secondary">
              Review saved sessions
            </LinkButton>
          </div>
        </section>
      </PageContainer>
    </>
  );
}
