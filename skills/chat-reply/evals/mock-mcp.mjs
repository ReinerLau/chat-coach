import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtures = JSON.parse(readFileSync(new URL('./material-cases.json', import.meta.url), 'utf8'))
const [runDir, caseId, tool, rawInput] = process.argv.slice(2)

if (runDir === '--cases') {
  console.log(JSON.stringify(fixtures.cases.map(({ mocks, failure_conditions, ...input }) => input)))
} else {
  if (!runDir || !caseId || !tool || !rawInput) {
    throw new Error(`Usage: node ${fileURLToPath(import.meta.url)} <run-dir> <case-id> <tool> '<JSON input>'`)
  }
  const testCase = fixtures.cases.find((item) => item.id === caseId)
  if (!testCase) throw new Error('Unknown case')
  const input = JSON.parse(rawInput)
  let result
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('参数必须为对象')
    if (!testCase.tools_available.includes(tool)) throw new Error('工具不可用')
    const sessionTool = tool === 'list_wechat_sessions'
    const allowed = sessionTool ? ['query', 'limit', 'offset'] : ['session_id', 'limit', 'before']
    if (Object.keys(input).some((key) => !allowed.includes(key))) throw new Error('未知参数')
    const limit = input.limit ?? 50
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('limit 无效')
    let normalized
    if (sessionTool) {
      const query = input.query ?? ''
      const offset = input.offset ?? 0
      if (typeof query !== 'string' || query.trim().length > 200 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('会话查询参数无效')
      normalized = { query: query.trim(), limit, offset }
    } else {
      if (typeof input.session_id !== 'string' || !input.session_id || (input.before !== undefined && typeof input.before !== 'string')) throw new Error('历史查询参数无效')
      normalized = { session_id: input.session_id, limit, ...(input.before === undefined ? {} : { before: input.before }) }
    }
    const mock = testCase.mocks.find((item) => item.tool === tool && Object.keys(normalized).length === Object.keys(item.input).length && Object.entries(normalized).every(([key, value]) => item.input[key] === value))
    if (!mock) throw new Error('模拟工具未配置此请求；检查会话 ID、分页参数及查询范围')
    result = mock.result
  } catch (error) {
    result = { isError: true, content: [{ type: 'text', text: error.message }] }
  }
  const trace = join(runDir, `${caseId}.jsonl`)
  mkdirSync(dirname(trace), { recursive: true })
  appendFileSync(trace, `${JSON.stringify({ tool, input, result })}\n`)
  console.log(JSON.stringify(result))
}
