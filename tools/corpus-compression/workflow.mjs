export const meta = {
  name: 'corpus-compression',
  description: 'Paced drafting and review waves for the corpus-compression plan, three agents open at most',
  whenToUse: 'Every drafting or review dispatch in docs/plans/claude-kit_corpus-compression_spec_v1.md',
  phases: [
    { title: 'Draft', detail: 'one read-only drafter per wave' },
    { title: 'Review', detail: 'the round\'s reviewers, pooled under MAX_OPEN' },
  ],
}

// The corpus-compression plan's one dispatch path. It runs under the Workflow
// tool by scriptPath, which evaluates this file as an async body with agent,
// log, phase and args in scope, so the top-level return below is the run's
// result. These constants are the only places a model, an effort or a pool
// size is written. test/corpus-compression-workflow.test.js fails where an
// agent() call lacks a model or an effort, or where MAX_OPEN exceeds five.
//
// Every wave is validated before the first dispatch. Waves then run in order,
// each settling before the next starts, and within a review wave the pool
// holds at most MAX_OPEN agents open, whatever the harness's own per-workflow
// clamp would admit. A failed agent becomes an error entry rather than a
// throw, so its wave still settles, the run stops after that wave, and every
// wave that finished is returned. The script never writes a file: every agent
// it dispatches is read-only and returns text, and the main thread writes
// what it keeps.
//
// A Workflow script cannot read the disk, so resume from disk works through
// args: the main thread lists in args.done the id of every wave whose artifact
// it has already written, and the script skips those waves.

const MAX_OPEN = 3
const REVIEW_MODEL = 'fable'
const REVIEW_EFFORT = 'low'

// The two drafting configurations the pilot's bake-off compares, keyed by the
// name a wave's `config` field carries. The operator names the winner from the
// pilot's pull request, and every later wave passes that name.
const DRAFT_MODEL = { 'opus-medium': 'opus', 'fable-low': 'fable' }
const DRAFT_EFFORT = { 'opus-medium': 'medium', 'fable-low': 'low' }

const DRAFTER = 'claude-kit:corpus-drafter'

// The reviewers a review wave may dispatch: each is a read-only type the
// readonly-agent-guard governs, which is what keeps the dispatch inside the
// doctrine's standing Workflow grant.
const REVIEWERS = [
  'claude-kit:prose-reviewer', 'claude-kit:blind-reader',
  'claude-kit:adversarial-reviewer', 'claude-kit:blind-reviewer',
  'claude-kit:security-reviewer', 'claude-kit:performance-reviewer',
]

function validate(waves, done) {
  if (!Array.isArray(waves) || waves.length === 0) throw new Error('args.waves must be a non-empty array')
  if (!Array.isArray(done)) throw new Error('args.done must be an array of wave ids')
  const ids = new Set()
  for (const wave of waves) {
    if (typeof wave.id !== 'string' || wave.id === '') throw new Error('every wave needs a non-empty string id')
    if (ids.has(wave.id)) throw new Error(`wave ${wave.id}: the id is used twice`)
    ids.add(wave.id)
    if (wave.kind === 'draft') {
      if (typeof wave.config !== 'string' || !Object.hasOwn(DRAFT_MODEL, wave.config)) {
        throw new Error(`wave ${wave.id}: config must be one of ${Object.keys(DRAFT_MODEL).join(', ')}`)
      }
    } else if (wave.kind === 'review') {
      if (!Array.isArray(wave.reviews) || wave.reviews.length === 0) throw new Error(`wave ${wave.id}: reviews must be a non-empty array`)
      for (const r of wave.reviews) {
        if (!REVIEWERS.includes(r.agentType)) throw new Error(`wave ${wave.id}: reviewer ${r.agentType} is not one of ${REVIEWERS.join(', ')}`)
      }
    } else {
      throw new Error(`wave ${wave.id}: kind must be draft or review`)
    }
  }
}

// An agent's outcome as data: its text, or the reason it produced none.
async function settle(call) {
  try {
    const text = await call()
    return text === null || text === undefined ? { error: 'the agent returned no result' } : { text }
  } catch (e) {
    return { error: String((e && e.message) || e) }
  }
}

async function pool(thunks, size) {
  const results = new Array(thunks.length)
  let next = 0
  async function lane() {
    while (next < thunks.length) {
      const i = next++
      results[i] = await thunks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, thunks.length) }, lane))
  return results
}

async function draftWave(wave) {
  const outcome = await settle(() => agent(wave.prompt, {
    label: `draft:${wave.id}`,
    phase: 'Draft',
    agentType: DRAFTER,
    model: DRAFT_MODEL[wave.config],
    effort: DRAFT_EFFORT[wave.config],
  }))
  return { id: wave.id, kind: 'draft', config: wave.config, ...outcome }
}

async function reviewWave(wave) {
  const outcomes = await pool(wave.reviews.map((r, i) => () => settle(() => agent(r.prompt, {
    label: `review:${wave.id}:${i + 1}`,
    phase: 'Review',
    agentType: r.agentType,
    model: REVIEW_MODEL,
    effort: REVIEW_EFFORT,
  }))), MAX_OPEN)
  const reviews = wave.reviews.map((r, i) => ({ agentType: r.agentType, ...outcomes[i] }))
  const failed = reviews.filter(r => r.error).length
  return { id: wave.id, kind: 'review', round: wave.round, reviews, ...(failed ? { error: `${failed} of ${reviews.length} reviewers failed` } : {}) }
}

async function run(waves, done) {
  validate(waves, done)
  const results = []
  for (const wave of waves) {
    if (done.includes(wave.id)) {
      log(`skip ${wave.id}: its artifact is on disk`)
      continue
    }
    const result = wave.kind === 'draft' ? await draftWave(wave) : await reviewWave(wave)
    results.push(result)
    if (result.error) {
      log(`stop after ${wave.id}: ${result.error}`)
      break
    }
  }
  return results
}

return await run(args.waves, args.done || [])
