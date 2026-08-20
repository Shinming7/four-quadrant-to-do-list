// 本地 OCR 代理：接收前端图片，转发智谱 GLM-4.6V-Flash 视觉模型，返回识别文本。
// 零依赖，仅用 Node 内置 http + fetch。
// 启动：node server/ocr-proxy.mjs   （默认端口 8787）
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.OCR_PROXY_PORT || 8787)
const MODEL = process.env.ZHIPU_VISION_MODEL || 'glm-4.6v-flash'
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

function findApiKey() {
  if (process.env.ZHIPU_API_KEY) return process.env.ZHIPU_API_KEY
  const envFile = path.join(process.cwd(), '.env')
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = /^\s*ZHIPU_API_KEY\s*=\s*"?([^"\s]+)"?\s*$/.exec(line)
      if (match) return match[1]
    }
  }
  const toml = path.join(homedir(), '.codex', 'config.toml')
  if (existsSync(toml)) {
    const match = /ZHIPU_API_KEY\s*=\s*"([^"]+)"/.exec(readFileSync(toml, 'utf8'))
    if (match) return match[1]
  }
  return ''
}

const API_KEY = findApiKey()

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function callZhipu(imageDataUrl, prompt) {
  if (!API_KEY) throw new Error('未找到 ZHIPU_API_KEY（请在 .env 或 ~/.codex/config.toml 中配置）')
  const body = JSON.stringify({
    model: MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: prompt },
      ],
    }],
    temperature: 0.2,
    max_tokens: 4096,
  })
  let lastError = null
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(ZHIPU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body,
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      const text = data.choices?.[0]?.message?.content
      if (typeof text === 'string' && text) return text
    }
    const retryable = res.status === 429 || res.status >= 500
    if (!retryable) throw new Error(`智谱 API ${res.status}: ${JSON.stringify(data)}`)
    lastError = new Error(`智谱 API 限流/繁忙，重试 ${attempt} 次后仍失败`)
    await new Promise((resolve) => setTimeout(resolve, 8000 * attempt))
  }
  throw lastError || new Error('智谱 API 调用失败')
}

const server = http.createServer(async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, model: MODEL, hasKey: Boolean(API_KEY) }))
    return
  }
  if (req.method === 'POST' && req.url === '/api/ocr') {
    let raw = ''
    try {
      for await (const chunk of req) raw += chunk
      const parsed = JSON.parse(raw)
      if (typeof parsed.image !== 'string' || !parsed.image) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: '缺少 image 字段' }))
        return
      }
      const prompt = typeof parsed.prompt === 'string' && parsed.prompt
        ? parsed.prompt
        : '这是一张手写的待办/购物清单照片。请逐行准确提取图中全部文字，保持原有顺序和内容，每行一条，不要遗漏、不要推测、不要添加任何说明。直接输出清单内容。'
      const text = await callZhipu(parsed.image, prompt)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ text }))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: 'Not Found' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OCR 智能识别服务已启动: http://0.0.0.0:${PORT}`)
  console.log(`模型: ${MODEL}${API_KEY ? '' : '（警告：未找到 ZHIPU_API_KEY）'}`)
})
