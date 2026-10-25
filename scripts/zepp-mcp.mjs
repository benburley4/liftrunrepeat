// Minimal client for ZeppBridge's local MCP server (zeppbridge-mcp.exe, JSON-RPC
// over stdio). Used by zepp-watch-push.mjs to draft and publish training
// plans to the Amazfit watch. ZeppBridge must be installed; publishing also
// needs "Allow AI to publish directly" switched on in ZeppBridge settings.

import { spawn } from 'node:child_process'
import { join } from 'node:path'

const EXE = process.env.ZEPPBRIDGE_MCP ?? join(process.env.LOCALAPPDATA ?? '', 'ZeppBridge', 'zeppbridge-mcp.exe')

/** Opens a session, runs `fn(call)`, and always closes the server process. */
export async function withZeppBridge(fn, { timeoutMs = 60_000 } = {}) {
  const proc = spawn(EXE, [], { stdio: ['pipe', 'pipe', 'pipe'] })
  const pending = new Map()
  let nextId = 1
  let buf = ''
  let stderr = ''
  proc.stderr.on('data', d => { stderr += d })
  proc.stdout.on('data', d => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      const p = pending.get(msg.id)
      if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message ?? JSON.stringify(msg.error))) : p.resolve(msg.result) }
    }
  })
  const exited = new Promise((_, reject) => proc.on('exit', code => reject(new Error(`zeppbridge-mcp exited (${code}) ${stderr.trim()}`))))
  exited.catch(() => {})
  const request = (method, params) => {
    const id = nextId++
    const done = new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    const timer = new Promise((_, reject) => setTimeout(() => reject(new Error(`${method} timed out`)), timeoutMs))
    return Promise.race([done, exited, timer])
  }
  try {
    await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'thehybridlife', version: '1' } })
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    /** Calls a tool; returns its JSON payload (the text content parsed when possible). */
    const call = async (name, args) => {
      const result = await request('tools/call', { name, arguments: args })
      const text = (result?.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('\n')
      let data = result?.structuredContent ?? null
      if (!data && text) { try { data = JSON.parse(text) } catch { data = { text } } }
      return { isError: !!result?.isError, data, text }
    }
    return await fn(call)
  } finally {
    proc.kill()
  }
}
