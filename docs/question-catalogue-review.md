# Question Catalogue Editorial Review Checklist

Milestone: M05 deterministic question provider  
Catalogue version: `local-question-provider-v1`

## Automated Checks

- `UNIT-Q-001`: catalogue has 60 unique built-in template IDs.
- `UNIT-Q-001`: each required bank has exactly 12 templates.
- `UNIT-Q-002`: normalized duplicate prompts are detected.
- `UNIT-Q-003`: role-term extraction is local, capped, stop-word filtered, and deterministic.
- `UNIT-Q-004`: same input and seed produce deep-equal selection and order.
- `UNIT-Q-005`: duplicate rendered prompts are prevented and recovery questions are used on exhaustion.
- `UNIT-Q-006`: custom-question duplicate validation and final snapshot behavior are covered.
- `UNIT-Q-007`: a fake provider can replace the local provider without page changes.

## Human Review Fields

Reviewer:

Date:

Browser/build reviewed:

Checklist:

- All templates are appropriate for interview practice and do not imply hiring,
  ranking, personality, emotion, identity, honesty, or competence inference.
- Templates use neutral, user-controllable language.
- Tokenized templates do not fabricate company facts, credentials, resume
  achievements, duties, or skills.
- Fallback questions are role-neutral and useful when a bank is exhausted.
- Category banks remain balanced across foundational, standard, and advanced
  difficulty.
- Custom-question UI copy does not assess authorship quality.

Notes:
