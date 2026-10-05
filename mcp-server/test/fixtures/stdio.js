import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { createHistoryRuntime } from '../../src/runtime.js'
import { runServer } from '../../src/app.js'

const root = process.argv[2]
const source = {
  sessions: () => [{ username: 'friend', nickname: '测试朋友' }],
  *messagePages() {
    yield [{ mesLocalID: '1', msgCreateTime: 100, msgContent: '测试消息', mesDes: 1, messageType: 1 }]
  },
  close: () => writeFileSync(join(root, 'closed'), 'yes')
}
await runServer(createHistoryRuntime({ accountRoot: root, dataFile: join(root, 'messages.sqlite') }, {
  env: { WECHAT_DB_KEY: 'a'.repeat(64) }, sourceFactory: () => source
}))
