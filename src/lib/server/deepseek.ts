// Shared DeepSeek client for all AI routes — one place for model, params,
// streaming, and error handling. Server-only.

import OpenAI from 'openai'

const MODEL = 'deepseek-chat'

export function deepseekConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
}

function client() {
  return new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
  })
}

export interface ChatOptions {
  system: string
  user: string
  maxTokens: number
  /** Ask the model for a guaranteed-JSON response (DeepSeek json_object mode). */
  jsonMode?: boolean
}

/** Streams the completion back as a plain-text Response. */
export async function streamChat({ system, user, maxTokens, jsonMode }: ChatOptions): Promise<Response> {
  const stream = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    stream: true,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/** Non-streaming completion — returns the full text (used by the weekly cron). */
export async function completeChat({ system, user, maxTokens, jsonMode }: ChatOptions): Promise<string> {
  const res = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    stream: false,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  })
  return res.choices?.[0]?.message?.content ?? ''
}
