/**
 * Read-only client for the Renpho Health cloud (cloud.renpho.com).
 *
 * Unofficial: Renpho has no public API. Ported from the MIT-licensed renpho-py
 * package, which reverse-engineered the app's protocol, so Renpho can break it
 * without notice. Requests and responses are AES-128-ECB with a key shared by
 * every copy of the app; the real protection in transit is HTTPS.
 */

import { createCipheriv, createDecipheriv } from 'node:crypto'

const BASE_URL = 'https://cloud.renpho.com'
const AES_KEY = Buffer.from('ed*wijdi$h6fe3ew', 'utf8') // public, from the app
const APP_VERSION = '6.6.0'
const PLATFORM = 'android'
const SUCCESS_CODES = new Set(['0', '101', '200', '20000'])
const SCALE_TYPES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '0A',
  '0B', '0C', '0D', '0E', '0F', '10', '11', '12', '13', '14']
const PAGE_SIZE = 50
const TIMEOUT_MS = 30_000

function encrypt(text) {
  const c = createCipheriv('aes-128-ecb', AES_KEY, null)
  return Buffer.concat([c.update(text, 'utf8'), c.final()]).toString('base64')
}

function decrypt(b64) {
  const d = createDecipheriv('aes-128-ecb', AES_KEY, null)
  return Buffer.concat([d.update(b64, 'base64'), d.final()]).toString('utf8')
}

/** Renpho ids are longer than a JS number can hold exactly, so read them as strings. */
export function parseKeepingBigInts(text) {
  return JSON.parse(text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"'))
}

const body = obj => ({ encryptData: encrypt(JSON.stringify(obj)) })

function records(page) {
  if (Array.isArray(page)) return page
  for (const key of ['list', 'data', 'records', 'measurements']) {
    if (Array.isArray(page?.[key])) return page[key]
  }
  return []
}

export class RenphoClient {
  constructor(email, password) {
    this.email = email
    this.password = password
    this.token = null
    this.userId = null
  }

  async post(endpoint, payload, context) {
    const headers = { 'Content-Type': 'application/json', appVersion: APP_VERSION, platform: PLATFORM }
    if (this.token) { headers.token = this.token; headers.userId = String(this.userId) }
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Renpho ${context}: HTTP ${res.status}`)
    const json = await res.json()
    if (!SUCCESS_CODES.has(String(json.code))) throw new Error(`Renpho ${context}: code ${json.code} ${json.msg ?? ''}`.trim())
    return json.data ? parseKeepingBigInts(decrypt(json.data)) : null
  }

  async login() {
    const data = await this.post('renpho-aggregation/user/login', body({
      questionnaire: {},
      login: {
        password: this.password, areaCode: 'US', appRevision: APP_VERSION, cellphoneType: 'NodeScript',
        systemType: '11', email: this.email, platform: PLATFORM,
      },
      bindingList: { deviceTypes: SCALE_TYPES },
    }), 'login')
    this.token = data?.login?.token
    this.userId = data?.login?.id
    if (!this.token) throw new Error('Renpho login: no token in response')
  }

  /**
   * Every reading for the signed-in profile, across its scale tables. An account
   * can hold several people's profiles, so also check `bUserId` on each row.
   */
  async measurements() {
    const devices = await this.post('renpho-aggregation/device/count', body({}), 'device list')
    const seen = new Map()
    for (const scale of devices?.scale ?? []) {
      if (!scale.tableName) continue
      // Other profiles on the account are other people: don't fetch them at all.
      if (!(scale.userIds ?? []).map(String).includes(String(this.userId))) continue
      for (let page = 1; ; page++) {
        const rows = records(await this.post('RenphoHealth/scale/queryAllMeasureDataList', body({
          pageNum: page, pageSize: PAGE_SIZE, userIds: [String(this.userId)], tableName: scale.tableName,
        }), `readings page ${page}`))
        const before = seen.size
        for (const r of rows) seen.set(`${scale.tableName}:${r.id}`, r)
        if (rows.length < PAGE_SIZE) break
        if (seen.size === before) throw new Error(`Renpho readings page ${page}: server repeated earlier records`)
      }
    }
    return [...seen.values()]
  }
}
