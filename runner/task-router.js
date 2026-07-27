// ═══════════════════════════════════════════════════════════════════════
// Task Router — ATLAS Runner (Phase 2)
//
// This is the code-level home of the routing decision atlas-core.md
// describes in its "Pipeline Routing" table:
//
//   task_type: "content"           → Content Pipeline  (pipeline-runner.js)
//   task_type: "personal-analysis" → Personal Analysis Pipeline
//                                     (personal-analysis-pipeline-runner.js)
//   task_type key absent entirely  → defaults to "content"
//
// This module does not implement either pipeline itself. It reads
// request.task_type, decides which pipeline module to call, and
// forwards the request to it unchanged. It never assembles a result,
// never merges state between the two pipelines, and never falls back
// silently on an unrecognized task_type — that is a hard error.
//
// It imports runFullPipeline from pipeline-runner.js AS-IS (no edits
// to that file) and runPersonalAnalysisPipeline from
// personal-analysis-pipeline-runner.js (Phase 2, Step 2).
// ═══════════════════════════════════════════════════════════════════════

import { runFullPipeline } from './pipeline-runner.js';
import { runPersonalAnalysisPipeline } from './personal-analysis-pipeline-runner.js';

// atlas-core.md recognizes exactly these two task_type values. Anything
// else is a routing error, not a fallback opportunity.
//
// NOTE ON SCOPE: this array lives here for now because task-router.js is
// currently its only consumer. If a second module ever needs the same
// list (e.g. a future server/ validation layer), this should move to a
// shared constants module (e.g. runner/constants.js) and be imported by
// both — not redeclared. Left local intentionally for this phase, per
// the approved plan, to avoid introducing a new file with a single
// export and a single consumer.
export const VALID_TASK_TYPES = ['content', 'personal-analysis'];

/**
 * Route an operator request to the correct pipeline based on
 * request.task_type, per atlas-core.md's Pipeline Routing table.
 *
 * Default-to-content only triggers when the task_type key is entirely
 * absent from the request object — not when it is present but falsy.
 * This distinguishes "operator didn't specify" (→ content) from
 * "operator specified something invalid" (→ error), so null, '', false,
 * 0, or a misspelled string are all treated as routing errors rather
 * than silently defaulting:
 *
 *   { }                              → 'task_type' not in request → content
 *   { task_type: 'content' }         → content
 *   { task_type: 'personal-analysis' } → personal-analysis
 *   { task_type: null }              → throws
 *   { task_type: '' }                → throws
 *   { task_type: false }             → throws
 *   { task_type: 0 }                 → throws
 *   { task_type: 'personalanalysis' } (typo) → throws
 *
 * The two branches share no state: each builds its own input object
 * from `request` and calls its own pipeline module independently.
 *
 * @param {object} request - operator request. Recognized fields:
 *   task_type, task_id
 *   Content Pipeline fields:      raw_input, target_medium, constraints
 *   Personal Analysis fields:     subject_id, subject_profile,
 *                                 analysis_inputs, constraints
 * @param {import('./runner.js').Runner} runner - existing Runner instance,
 *   passed through unchanged to whichever pipeline is selected
 * @returns {Promise<object>} whatever the selected pipeline module returns,
 *   forwarded unmodified
 */
export async function routeTask(request, runner) {
  const taskTypeKeyPresent = Object.prototype.hasOwnProperty.call(request, 'task_type');
  const taskType = taskTypeKeyPresent ? request.task_type : 'content';

  if (!VALID_TASK_TYPES.includes(taskType)) {
    throw new Error(
      `Unknown task_type ${JSON.stringify(request.task_type)}. Must be one of: ` +
      `${VALID_TASK_TYPES.join(', ')}, or the key omitted entirely (defaults to "content").`
    );
  }

  if (taskType === 'content') {
    // Forwarded to pipeline-runner.js's existing runFullPipeline() with
    // no changes to that file. Only this branch's local variables are
    // built here — nothing shared with the personal-analysis branch.
    return runFullPipeline({
      runner,
      taskId: request.task_id,
      rawInput: request.raw_input,
      targetMedium: request.target_medium,
      constraints: request.constraints,
    });
  }

  // taskType === 'personal-analysis'
  // core-engine.md's Input Contract field names are preserved exactly:
  // subject_id, subject_profile, analysis_inputs, constraints.
  return runPersonalAnalysisPipeline({
    runner,
    taskId: request.task_id,
    subjectId: request.subject_id,
    subjectProfile: request.subject_profile,
    analysisInputs: request.analysis_inputs,
    constraints: request.constraints,
  });
}