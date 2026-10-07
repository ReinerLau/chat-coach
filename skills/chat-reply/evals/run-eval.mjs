import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const suites = [
  { key: 'cases', fixtures: read(new URL('./cases.json', import.meta.url)).cases, dimensions: ['material', 'action', 'expression', 'stop', 'diversity'] },
  { key: 'material_cases', fixtures: read(new URL('./material-cases.json', import.meta.url)).cases, dimensions: ['acquisition', 'attribution', 'sufficiency', 'handoff'] }
]
function check(condition, message) { if (!condition) throw new Error(message) }
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
function trace(dir, id) {
  const path = join(dir, `${id}.jsonl`)
  return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []
}
function validateOutput(output) {
  check(exactKeys(output, ['cases', 'material_cases']), 'Invalid output suites')
  for (const { key, fixtures } of suites) {
    check(Array.isArray(output[key]) && output[key].length === fixtures.length, `Incomplete ${key}`)
    for (const [index, testCase] of fixtures.entries()) {
      const item = output[key][index]
      check(item.case_id === testCase.id, `Wrong case order: ${testCase.id}`)
      check(Array.isArray(item.replies) && item.replies.every((reply) => typeof reply === 'string' && reply.trim()), `Invalid replies: ${testCase.id}`)
      if (key === 'cases') {
        check(exactKeys(item, ['case_id', 'replies']) && item.replies.length === testCase.candidate_count, `Invalid fixed output: ${testCase.id}`)
        continue
      }
      check(exactKeys(item, ['case_id', 'summary', 'outcome', 'clarification', 'replies']), `Invalid material output: ${testCase.id}`)
      check(['ready', 'clarify'].includes(item.outcome), `Invalid outcome: ${testCase.id}`)
      check(item.outcome === 'ready' ? item.replies.length === testCase.candidate_count && item.clarification === null : item.replies.length === 0 && typeof item.clarification === 'string' && item.clarification.trim(), `Invalid completion: ${testCase.id}`)
      const summary = item.summary
      check(exactKeys(summary, ['target_message', 'user_goal', 'relevant_messages', 'user_information', 'other_information', 'gaps', 'conflicts', 'read_status']), `Invalid summary: ${testCase.id}`)
      check([summary.target_message, summary.user_goal].every((value) => value === null || typeof value === 'string'), `Invalid target/goal: ${testCase.id}`)
      for (const field of ['relevant_messages', 'user_information', 'other_information']) {
        check(Array.isArray(summary[field]) && summary[field].every((record) => exactKeys(record, ['speaker', 'content', 'source', 'time']) && ['speaker', 'content', 'source'].every((name) => typeof record[name] === 'string' && record[name].trim()) && (record.time === null || typeof record.time === 'string' || typeof record.time === 'number')), `Invalid records: ${testCase.id}/${field}`)
      }
      check(['gaps', 'conflicts'].every((field) => Array.isArray(summary[field]) && summary[field].every((value) => typeof value === 'string')), `Invalid gaps/conflicts: ${testCase.id}`)
      check(['not_needed', 'ok', 'empty', 'error', 'unavailable'].includes(summary.read_status), `Invalid read status: ${testCase.id}`)
    }
  }
}

const [command, runDir] = process.argv.slice(2)
check(runDir && ['prepare', 'report'].includes(command), 'Usage: run-eval.mjs <prepare|report> <run-dir>')
if (command === 'prepare') {
  const outputs = { baseline: read(join(runDir, 'baseline.json')), skill: read(join(runDir, 'skill.json')) }
  Object.values(outputs).forEach(validateOutput)
  const blind = {}
  for (const { key, fixtures } of suites) {
    blind[key] = fixtures.map((testCase, index) => {
      const identity = index % 2 === 0 ? { A: 'baseline', B: 'skill' } : { A: 'skill', B: 'baseline' }
      return { case: testCase, case_id: testCase.id, ...Object.fromEntries(Object.entries(identity).map(([label, role]) => [label, {
        ...outputs[role][key][index],
        ...(key === 'material_cases' ? { calls: trace(join(runDir, role), testCase.id) } : {})
      }])) }
    })
  }
  writeFileSync(join(runDir, 'blind.json'), `${JSON.stringify(blind, null, 2)}\n`)
  console.log(JSON.stringify({ prepared: true, fixed: suites[0].fixtures.length, materials: suites[1].fixtures.length }))
} else {
  const judge = read(join(runDir, 'judge.json'))
  check(exactKeys(judge, ['cases', 'material_cases']), 'Invalid judge suites')
  const report = {}
  for (const { key, fixtures, dimensions } of suites) {
    check(Array.isArray(judge[key]) && judge[key].length === fixtures.length, `Incomplete judge ${key}`)
    const totals = { win: 0, loss: 0, tie: 0, critical_failures: [], passed: false }
    for (const [index, testCase] of fixtures.entries()) {
      const item = judge[key][index]
      check(exactKeys(item, ['case_id', 'A', 'B', 'winner']) && item.case_id === testCase.id && ['A', 'B', 'tie'].includes(item.winner), `Invalid judgment: ${testCase.id}`)
      for (const side of ['A', 'B']) {
        const rating = item[side]
        check(exactKeys(rating, ['scores', 'failures']) && exactKeys(rating.scores, dimensions) && Object.values(rating.scores).every((score) => Number.isInteger(score) && score >= 0 && score <= 2), `Invalid scores: ${testCase.id}/${side}`)
        check(Array.isArray(rating.failures) && new Set(rating.failures).size === rating.failures.length && rating.failures.every((id) => testCase.failure_conditions.some((failure) => failure.id === id)), `Invalid failure IDs: ${testCase.id}/${side}`)
      }
      const skillSide = index % 2 === 0 ? 'B' : 'A'
      totals[item.winner === 'tie' ? 'tie' : item.winner === skillSide ? 'win' : 'loss']++
      for (const id of item[skillSide].failures) {
        if (testCase.failure_conditions.find((failure) => failure.id === id).critical) totals.critical_failures.push({ case_id: testCase.id, failure: id })
      }
    }
    totals.passed = totals.critical_failures.length === 0 && totals.loss <= 2
    report[key] = totals
  }
  report.passed = Object.values(report).every((suite) => suite.passed)
  writeFileSync(join(runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  if (!report.passed) process.exitCode = 1
}
