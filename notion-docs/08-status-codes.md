# Status Codes — Every Error and What it Means

All API responses follow a standard format. This page covers every code you might receive and how to handle it.

---

## Standard error response shape

```json
{
  "detail": "Human-readable error message",
  "code":   "MACHINE_READABLE_CODE",
  "status": 401
}
```

---

## Complete status code reference

### 2xx — Success

| Code | Meaning | When you see it |
|---|---|---|
| `200 OK` | Request succeeded | GET, DELETE, interrupt calls |
| `201 Created` | Resource created | POST /v1/sessions |

---

### 4xx — Your app did something wrong

| Code | `code` field | Meaning | Fix |
|---|---|---|---|
| `400 Bad Request` | `INVALID_REQUEST` | Request is malformed or missing required fields | Check your request body against the API reference |
| `401 Unauthorized` | `INVALID_API_KEY` | API key is missing or wrong | Check your `X-API-Key` header |
| `401 Unauthorized` | `TOKEN_EXPIRED` | The LiveKit JWT token has expired (1 hour TTL) | Call POST /v1/sessions again to get a fresh token — do not reuse tokens |
| `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` | API key valid but not allowed for this operation | Contact us to check your API key permissions |
| `404 Not Found` | `SESSION_NOT_FOUND` | Session ID doesn't exist | Verify the session_id — it may have already ended |
| `408 Request Timeout` | `REQUEST_TIMEOUT` | Server took too long to respond | Retry once; if persists, contact support |
| `422 Unprocessable Entity` | `VALIDATION_ERROR` | Request body has wrong field types or values | See the `detail` field for which field is wrong |
| `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` | You've made too many API calls | Wait and retry — see `Retry-After` header |

---

### 5xx — Our server had a problem

| Code | `code` field | Meaning | Fix |
|---|---|---|---|
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected server error | Retry once; report if it persists |
| `502 Bad Gateway` | `GATEWAY_ERROR` | Upstream service (AI provider) returned an error | Usually temporary — retry after a few seconds |
| `503 Service Unavailable` | `BOT_STARTUP_ERROR` | AI agent failed to start | The bot crashed on startup — retry creating the session |
| `504 Gateway Timeout` | `UPSTREAM_TIMEOUT` | AI provider took too long | Retry — AI provider may be overloaded |

---

## Handling errors in code

### JavaScript

```js
async function createSession(userId) {
  const res = await fetch('http://your-server:8004/client/v1/influencer/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ user_id: userId, agent_config: { influencer_id: 'vlog_star' } }),
  })

  if (!res.ok) {
    const error = await res.json()
    switch (res.status) {
      case 400:
        throw new Error(`Bad request: ${error.detail}`)
      case 401:
        if (error.code === 'TOKEN_EXPIRED') {
          // token expired — get a new one
          return createSession(userId)  // retry
        }
        throw new Error('Invalid API key — check your X-API-Key header')
      case 422:
        throw new Error(`Validation failed: ${error.detail}`)
      case 429:
        const retryAfter = res.headers.get('Retry-After') || 5
        await new Promise(r => setTimeout(r, retryAfter * 1000))
        return createSession(userId)  // retry after backoff
      case 503:
        throw new Error('Bot failed to start — try again in a moment')
      default:
        throw new Error(`Server error ${res.status}: ${error.detail}`)
    }
  }

  return res.json()
}
```

### Vue 3 pattern

```js
// services/api.js
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code   = code
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.detail || 'Request failed', res.status, body.code)
  }

  return res.json()
}
```

```vue
<script setup>
import { ref } from 'vue'
import { createSession } from './services/api.js'
import { ApiError } from './services/api.js'

const error = ref(null)

async function start() {
  try {
    const session = await createSession('user_123')
    // ...
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) error.value = 'Invalid API key'
      else if (err.status === 429) error.value = 'Too many requests — please wait'
      else if (err.status === 503) error.value = 'Bot unavailable — try again'
      else error.value = err.message
    }
  }
}
</script>

<template>
  <div v-if="error" class="error-banner">⚠️ {{ error }}</div>
</template>
```

---

## Rate limits

| Plan | Calls per minute | Sessions per hour |
|---|---|---|
| Development (`sk_dev_*`) | 10 | 20 |
| Standard | 60 | 200 |
| Enterprise | Custom | Custom |

When you hit a rate limit, the `Retry-After` header tells you how many seconds to wait.

---

## Reference comparison

Our status codes follow the same conventions as Agora's ConvoAI. For additional context, see:
- Agora ConvoAI status codes: https://doc.shengwang.cn/doc/convoai/restful/api/response-code
