import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// These placeholders exercise the CLI contract, not reply generation or judging.
const fixed = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')).cases
const materials = JSON.parse(readFileSync(new URL('./material-cases.json', import.meta.url), 'utf8')).cases
const runner = fileURLToPath(new URL('./run-eval.mjs', import.meta.url))
const textItems = (count) => Array.from({ length: count }, () => 'format-check placeholder')
function output() {
  return {
    cases: fixed.map((c) => ({ case_id: c.id, replies: textItems(c.candidate_count), questions: textItems(c.question_count) })),
    material_cases: materials.map((c) => ({
      case_id: c.id,
      summary: { target_message: null, user_goal: null, relevant_messages: [], user_information: [], other_information: [], gaps: [], conflicts: [], read_status: 'not_needed' },
      outcome: 'ready', clarification: null, replies: textItems(c.candidate_count)
    }))
  }
}
function judgment() {
  const entry = (c, rating) => ({ case_id: c.id, A: structuredClone(rating), B: structuredClone(rating), winner: 'tie' })
  return {
    cases: fixed.map((c) => entry(c, { human_likeness: 2, reason: 'format-check reason', failures: [] })),
    material_cases: materials.map((c) => entry(c, { scores: { acquisition: 2, attribution: 2, sufficiency: 2, handoff: 2 }, failures: [] }))
  }
}
function run(command, data, checkResult) {
  const dir = mkdtempSync(join(tmpdir(), 'chat-reply-eval-test-'))
  try {
    if (command === 'prepare') {
      writeFileSync(join(dir, 'baseline.json'), JSON.stringify(data))
      writeFileSync(join(dir, 'skill.json'), JSON.stringify(output()))
      mkdirSync(join(dir, 'baseline'))
      writeFileSync(join(dir, 'baseline', materials[0].id + '.jsonl'), JSON.stringify({ tool: 'trace-check', input: {}, result: {} }) + '\n')
    } else {
      writeFileSync(join(dir, 'judge.json'), JSON.stringify(data))
    }
    const result = spawnSync(process.execPath, [runner, command, dir], { encoding: 'utf8' })
    checkResult(result, dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('prepare accepts reply and clarification modes, preserves material traces and alternates identities', () => {
  const data = output()
  const clarify = data.material_cases[1]
  clarify.outcome = 'clarify'
  clarify.clarification = 'format-check clarification'
  clarify.replies = []
  run('prepare', data, (result, dir) => {
    assert.equal(result.status, 0, result.stderr)
    const blind = JSON.parse(readFileSync(join(dir, 'blind.json'), 'utf8'))
    assert.equal(blind.cases.length, fixed.length)
    assert.equal(blind.material_cases.length, materials.length)
    const clarificationCase = blind.cases.find((item) => item.case.expected_mode === 'clarify')
    assert.deepEqual(clarificationCase.A.replies, [])
    assert.equal(clarificationCase.A.questions.length, 1)
    assert.equal(blind.material_cases[0].A.calls[0].tool, 'trace-check')
    assert.deepEqual(blind.material_cases[0].B.calls, [])
    assert.equal(blind.material_cases[1].B.outcome, 'clarify')
    assert.equal(blind.material_cases[1].A.outcome, 'ready')
  })
})

test('prepare rejects mixed modes, missing questions and incomplete cases', () => {
  const mutations = [
    (data) => { data.cases.find((item) => item.questions.length).replies.push('format-check placeholder') },
    (data) => { delete data.cases[0].questions },
    (data) => { data.cases.pop() }
  ]
  for (const mutate of mutations) {
    const data = output()
    mutate(data)
    run('prepare', data, (result) => assert.notEqual(result.status, 0))
  }
})

test('report decodes the independently alternating suites', () => {
  const data = judgment()
  data.cases[0].winner = 'B'
  data.cases[1].winner = 'A'
  data.material_cases[0].winner = 'A'
  run('report', data, (result, dir) => {
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'))
    assert.equal(report.cases.win, 2)
    assert.equal(report.material_cases.loss, 1)
    assert.equal(report.passed, true)
  })
})

test('report rejects obsolete scores, missing reasons and unknown failure IDs', () => {
  const mutations = [
    (data) => { data.cases[0].A = { scores: { material: 2 }, failures: [] } },
    (data) => { data.cases[0].A.reason = '' },
    (data) => { data.cases[0].A.failures = ['not-a-fixture-failure'] }
  ]
  for (const mutate of mutations) {
    const data = judgment()
    mutate(data)
    run('report', data, (result) => assert.notEqual(result.status, 0))
  }
})

test('a material critical failure fails the run independently of reply wins', () => {
  const data = judgment()
  data.cases[0].winner = 'B'
  data.material_cases[0].B.failures = [materials[0].failure_conditions.find((f) => f.critical).id]
  run('report', data, (result, dir) => {
    assert.equal(result.status, 1)
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'))
    assert.equal(report.cases.passed, true)
    assert.equal(report.material_cases.passed, false)
    assert.equal(report.passed, false)
  })
})

test('three material losses cannot be offset by reply wins', () => {
  const data = judgment()
  for (const [index, item] of data.cases.entries()) item.winner = index % 2 === 0 ? 'B' : 'A'
  for (let index = 0; index < 3; index++) data.material_cases[index].winner = index % 2 === 0 ? 'A' : 'B'
  run('report', data, (result, dir) => {
    assert.equal(result.status, 1)
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'))
    assert.equal(report.cases.passed, true)
    assert.equal(report.material_cases.loss, 3)
    assert.equal(report.passed, false)
  })
})
