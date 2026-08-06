/**
 * Voice for the commentator.
 *
 * `GET /v1/line/:id` returns an MP3 of one scripted line. The first request for
 * a line generates it with ElevenLabs and stores it in R2; every request after
 * that is served from R2.
 *
 * Two things this deliberately is not:
 *
 * * **It is not a text-to-speech proxy.** Only ids from the compiled-in script
 *   are accepted. Taking arbitrary text would turn this into a free speech
 *   synthesiser for anyone who found the URL, billed to us.
 * * **It is not on the game's critical path.** The board plays fine with this
 *   endpoint unreachable; the client falls back to showing the line as text.
 *
 * The API key lives in a Worker secret and never reaches the browser.
 */

// Imported straight from the app's script rather than copied. A duplicated
// list would drift the moment a line was added, and the Worker would start
// refusing ids the client was asking for.
import { SFX_PROMPTS } from '../../src/audio/sfx-prompts'
import { allAdviceLines } from '../../src/commentary/advice'
import { allFactLines } from '../../src/commentary/facts'
import { allLines } from '../../src/commentary/lines'

/** id → the text actually spoken, including its performance directions. */
const LINE_SPEECH: Record<string, string> = Object.fromEntries(
  [...allLines(), ...allFactLines(), ...allAdviceLines()].map((l) => [l.id, l.speech ?? l.text])
)
const LINE_IDS = Object.keys(LINE_SPEECH)

export interface Env {
  AUDIO: R2Bucket
  ELEVENLABS_API_KEY: string
}

/** The Vietnamese voice, and the model that performs the bracketed directions. */
const VOICE_ID = 'K7ewtjKRNtwwt3lKQ6M0'
const MODEL_ID = 'eleven_v3'

/** id -> the sound-effect prompt, for the same reason the line script is compiled in. */
const SFX = Object.fromEntries(SFX_PROMPTS.map((s) => [s.id, s]))

/** Audio for a given id never changes, so it can be cached hard. */
const IMMUTABLE = 'public, max-age=31536000, immutable'

function cors(extra: HeadersInit = {}): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...extra,
  }
}

/** What went wrong upstream, kept so a failure can be diagnosed rather than guessed at. */
let lastVoiceError = ''

async function synthesise(env: Env, text: string): Promise<ArrayBuffer | null> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    }
  )
  if (!res.ok) {
    // Swallowing this was a mistake: a whole category of lines failed
    // identically twice and there was nothing to look at but a 503.
    lastVoiceError = `${res.status} ${(await res.text()).slice(0, 300)}`
    return null
  }
  return res.arrayBuffer()
}

/**
 * Sound effects, generated once and then served from R2.
 *
 * Same shape as the spoken lines and for the same reason: the prompt list is
 * compiled in, so this cannot become a free sound generator for whoever finds
 * the URL. The build script downloads these into the repository, where they are
 * committed — the board has to make a sound with no network at all.
 */
async function synthesiseSfx(env: Env, prompt: string, seconds: number): Promise<ArrayBuffer | null> {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text: prompt, duration_seconds: seconds, prompt_influence: 0.6 }),
  })
  if (!res.ok) return null
  return res.arrayBuffer()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() })
    }

    if (url.pathname === '/v1/lines') {
      // Lets the client pre-warm, and makes the accepted set inspectable.
      return Response.json(
        { ids: LINE_IDS },
        { headers: cors({ 'cache-control': 'public, max-age=3600' }) }
      )
    }

    const sfxMatch = url.pathname.match(/^\/v1\/sfx\/([a-z0-9-]{1,20})$/)
    if (sfxMatch && request.method === 'GET') {
      const sound = SFX[sfxMatch[1]]
      if (!sound) {
        return new Response('Unknown sound', { status: 404, headers: cors() })
      }
      const key = `sfx/${sound.id}.mp3`
      const stored = await env.AUDIO.get(key)
      if (stored) {
        return new Response(stored.body, {
          headers: cors({ 'content-type': 'audio/mpeg', 'cache-control': IMMUTABLE }),
        })
      }
      const audio = await synthesiseSfx(env, sound.prompt, sound.seconds)
      if (!audio) {
        return new Response('Sound unavailable', { status: 503, headers: cors() })
      }
      await env.AUDIO.put(key, audio, {
        httpMetadata: { contentType: 'audio/mpeg', cacheControl: IMMUTABLE },
      })
      return new Response(audio, {
        headers: cors({ 'content-type': 'audio/mpeg', 'cache-control': IMMUTABLE }),
      })
    }

    const match = url.pathname.match(/^\/v1\/line\/([a-z0-9-]{1,40})$/)
    if (!match || request.method !== 'GET') {
      return new Response('Not found', { status: 404, headers: cors() })
    }

    const id = match[1]
    const text = LINE_SPEECH[id]
    if (!text) {
      // Unknown id: refuse rather than synthesise. This is the whole reason the
      // script is compiled in.
      return new Response('Unknown line', { status: 404, headers: cors() })
    }

    const key = `voice/${VOICE_ID}/${id}.mp3`

    const cached = await env.AUDIO.get(key)
    if (cached) {
      return new Response(cached.body, {
        headers: cors({ 'content-type': 'audio/mpeg', 'cache-control': IMMUTABLE }),
      })
    }

    const audio = await synthesise(env, text)
    if (!audio) {
      // Upstream trouble is not the player's problem: the client falls back to
      // text either way. The reason is included for whoever is generating.
      return new Response(`Voice unavailable: ${lastVoiceError}`, {
        status: 503,
        headers: cors(),
      })
    }

    // Store for everyone who comes next. `waitUntil` is not used because a
    // failed write should not silently mean we re-bill this line forever.
    await env.AUDIO.put(key, audio, {
      httpMetadata: { contentType: 'audio/mpeg', cacheControl: IMMUTABLE },
    })

    return new Response(audio, {
      headers: cors({ 'content-type': 'audio/mpeg', 'cache-control': IMMUTABLE }),
    })
  },
} satisfies ExportedHandler<Env>
