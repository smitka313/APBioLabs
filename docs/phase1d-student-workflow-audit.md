# Phase 1D — Student workflow audit

Status: **initial source review; student-facing changes not yet implemented**.

## Scope

Review the complete student journey across Labs 1–13: getting started, moving among activities, finding relevant instructions, entering measurements and calculations, recovering work, and submitting a report. Prioritize phone use and avoid changes to scientific models, grading, or stored progress.

## Existing capabilities to preserve

The README and shared `lab.js` establish that the site already has:
- Auto-save and an explicit warning when browser storage fails.
- Progress-file and resume-code transfer between devices.
- Pause/bookmark, guided steps and a "Show me" control that locates a relevant element.
- A shared step navigation and completion/progress indicators.
- Word report download, print/PDF view, and printable worksheet.

Do not implement duplicates of these features.

## Proposed audit matrix

| Workflow | Questions to verify | Acceptance evidence |
| --- | --- | --- |
| First visit | Is the next action clear without extra reading? | Phone screenshots and task walkthrough |
| Step navigation | Can students return to prior instructions and resume the current activity? | Touch and keyboard walkthrough |
| Measurements | Are units, reference values and input prompts visible at the moment needed? | Lab-specific task examples |
| Save/transfer | Do warnings and resume steps make sense to a student? | Save/restore tests and manual copy review |
| Submission | Can students identify what to hand in and whether it saved locally? | DOCX/PDF workflow checks |

## Initial evidence

- `lab09.html` includes the shared lab-step navigation.
- `lab.js` provides "Show me" links for targeted controls.
- `README.md` documents save/transfer and submission workflows.
- The prior mobile tap-target audit reported no undersized *visible* lab controls in its tested states, after accounting for the teacher dashboard's intentionally hidden file input.

## Next steps

1. Walk each lab's major student tasks on a narrow viewport and desktop, recording specific friction points.
2. Prioritize issues by student impact, reproducibility and risk.
3. Implement a small student-facing fix only after confirming the issue.
4. Run the release checklist and verify mobile, persistence, science and submission workflows.
5. Keep the PR draft until tested and reviewed.

This file is an audit plan, **not** evidence that all 13 student workflows have been manually validated.
