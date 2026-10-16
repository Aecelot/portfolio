# Client Integration Guide

**API Server Version:** 1.0.0  
**Last Updated:** 2025-10-24

This guide is for developers building applications that connect to the Local LLM API Server. It covers both stateless (XML) and stateful (JSON session) modes.

---

## Table of Contents

1. [API Modes Overview](#api-modes-overview)
2. [Stateless Mode (XML)](#stateless-mode-xml)
3. [Stateful Mode (JSON Sessions)](#stateful-mode-json-sessions)
4. [Key Differences](#key-differences-between-modes)
5. [Important Considerations](#important-considerations)
6. [Best Practices](#best-practices-for-client-apps)
7. [Code Examples](#code-examples)
8. [Error Handling](#error-handling)
9. [Migration Notes](#migration-impact)

---

## API Modes Overview

The API server provides two distinct modes of operation:

| Mode | Formats | Endpoint | Use Case |
|------|----------|----------|----------|
| **Stateless** | XML | `/api/v1/generate` | Single requests, one-off queries |
| **Stateful** | JSON or XML | `/api/v1/session/*` | Multi-turn conversations, chatbots |

**Choose based on your needs:**
- **Stateless:** Simple, independent requests with no memory between calls
- **Stateful:** Conversational AI with server-side context management and prefix caching
  - **Both JSON and XML formats supported** - use `Content-Type: application/json` or `Content-Type: application/xml`
  - XML format allows CDATA for verbatim content preservation (nested XML, code blocks, etc.)

---

## Stateless Mode (XML)

### Endpoint
```
POST /api/v1/generate
Content-Type: application/xml
```

### Request Format
```xml
<request>
  <prompt><![CDATA[Your prompt text here]]></prompt>
  <max_tokens>150</max_tokens>
  <temperature>0.8</temperature>
  <top_p>0.9</top_p>
</request>
```

### Response Format
```xml
<response>
  <text>Generated text response</text>
  <tokens_used>42</tokens_used>
  <success>true</success>
</response>
```

### Error Response
```xml
<error>
  <message>Error description</message>
  <status_code>400</status_code>
</error>
```

### Critical Requirements

✅ **MUST use `<![CDATA[...]]>`** for prompt content to preserve verbatim text  
✅ **MUST set Content-Type: application/xml** (415 error if not set)  
✅ Responses may be wrapped in `<answer>` tags via GBNF grammar enforcement  
❌ No conversation history maintained between requests  

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | The text prompt (use CDATA) |
| `max_tokens` | integer | No | 150 | Maximum tokens to generate |
| `temperature` | float | No | 0.8 | Sampling temperature (0.0-2.0) |
| `top_p` | float | No | 0.9 | Nucleus sampling threshold (0.0-1.0) |

---

## Stateful Mode (Sessions)

### Overview

Stateful sessions maintain conversation context across multiple requests. The server automatically manages history and enables prefix caching for improved performance.

**Supported Formats:** Both JSON and XML are fully supported for all session endpoints:
- **JSON Format:** Best for most applications, compact and widely supported
- **XML Format:** Ideal when you need CDATA for verbatim content (nested XML, code examples, special characters)
- Use `Content-Type: application/json` or `Content-Type: application/xml` for requests
- Use `Accept` header to specify response format preference (defaults to request format if not specified)

### Session Workflow (JSON)

#### 1. Create Session (JSON)
```http
POST /api/v1/session/create
Content-Type: application/json
```

**Request:**
```json
{
  "persona": "You are a helpful assistant.\n",
  "max_context_tokens": 8192,
  "temperature": 0.7,
  "top_p": 0.9,
  "stop_sequences": ["Note:", "---"]
}
```

**Response:**
```json
{
  "session_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "created_at": "2025-10-24T22:00:00Z",
  "persona_tokens": 145,
  "max_context_tokens": 8192
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `persona` | string | Yes | - | Static system prompt/character description |
| `max_context_tokens` | integer | No | 8192 | Context window limit |
| `temperature` | float | No | 0.7 | Default temperature for this session |
| `top_p` | float | No | 0.9 | Default top_p for this session |
| `stop_sequences` | array | No | [] | Custom stop strings |

---

#### 2. Append Turn (JSON)
```http
POST /api/v1/session/{session_id}/append
Content-Type: application/json
```

**Request:**
```json
{
  "turn": "What's the weather like today?\n",
  "max_tokens": 48,
  "temperature": 0.7,
  "top_p": 0.9
}
```

**Response:**
```json
{
  "session_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "response": "I don't have access to real-time weather data...",
  "tokens_used": 18,
  "total_context_tokens": 163,
  "context_utilization": 0.02
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `turn` | string | Yes | - | User input for this turn |
| `max_tokens` | integer | No | 150 | Maximum tokens to generate |
| `temperature` | float | No | session default | Override session temperature |
| `top_p` | float | No | session default | Override session top_p |

---

#### 3. Retrieve Session (JSON)
```http
GET /api/v1/session/{session_id}
```

**Response:**
```json
{
  "session_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "persona": "You are a helpful assistant.\n",
  "turns": [
    "User: Hello!\n",
    "Assistant: Hi there! How can I help you?\n",
    "User: What's the weather like?\n",
    "Assistant: I don't have access to real-time weather...\n"
  ],
  "created_at": "2025-10-24T22:00:00Z",
  "last_accessed": "2025-10-24T22:05:00Z",
  "total_context_tokens": 163,
  "max_context_tokens": 8192
}
```

---

#### 4. List Sessions (JSON)
```http
GET /api/v1/sessions?limit=100
```

**Response:**
```json
{
  "sessions": [
    {
      "session_id": "a1b2c3d4...",
      "created_at": "2025-10-24T22:00:00Z",
      "last_accessed": "2025-10-24T22:05:00Z",
      "turn_count": 4,
      "context_tokens": 163
    }
  ],
  "total_sessions": 1
}
```

**Query Parameters:**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 100 | 1000 | Maximum sessions to return |

---

#### 5. Delete Session (JSON)
```http
DELETE /api/v1/session/{session_id}
```

**Response:**
```json
{
  "deleted": true,
  "session_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

---

### Session Workflow (XML)

#### 1. Create Session (XML)

```http
POST /api/v1/session/create
Content-Type: application/xml
```

**Request:**
```xml
<session_request>
  <persona><![CDATA[You are a helpful assistant.
You answer questions clearly and concisely.]]></persona>
  <max_context_tokens>8192</max_context_tokens>
  <temperature>0.7</temperature>
  <top_p>0.9</top_p>
  <stop_sequences>
    <stop>Note:</stop>
    <stop>---</stop>
  </stop_sequences>
</session_request>
```

**Response (Success - 201):**
```xml
<session_response>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
  <created_at>2025-10-24T22:00:00Z</created_at>
  <persona_tokens>145</persona_tokens>
  <max_context_tokens>8192</max_context_tokens>
  <success>true</success>
</session_response>
```

**Parameters:** Same as JSON version, but in XML format with CDATA for persona content.

---

#### 2. Append Turn (XML)

```http
POST /api/v1/session/{session_id}/append
Content-Type: application/xml
```

**Request:**
```xml
<append_request>
  <turn><![CDATA[<conversation>
  <user id="42">What's the weather like today?</user>
</conversation>]]></turn>
  <max_tokens>48</max_tokens>
  <temperature>0.7</temperature>
  <top_p>0.9</top_p>
</append_request>
```

**Response (Success - 200):**
```xml
<append_response>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
  <response><![CDATA[I don't have access to real-time weather data, but I can help you find weather information through other means.]]></response>
  <tokens_used>18</tokens_used>
  <total_context_tokens>163</total_context_tokens>
  <context_utilization>0.02</context_utilization>
  <success>true</success>
</append_response>
```

---

#### 3. Retrieve Session (XML)

```http
GET /api/v1/session/{session_id}
Accept: application/xml
```

**Response (Success - 200):**
```xml
<session_data>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
  <persona><![CDATA[You are a helpful assistant.]]></persona>
  <turns>
    <turn index="0"><![CDATA[User: Hello!\n]]></turn>
    <turn index="1"><![CDATA[Assistant: Hi there! How can I help you?\n]]></turn>
    <turn index="2"><![CDATA[User: What's the weather like?\n]]></turn>
    <turn index="3"><![CDATA[Assistant: I don't have access to real-time weather...\n]]></turn>
  </turns>
  <created_at>2025-10-24T22:00:00Z</created_at>
  <last_accessed>2025-10-24T22:05:00Z</last_accessed>
  <total_context_tokens>163</total_context_tokens>
  <max_context_tokens>8192</max_context_tokens>
  <success>true</success>
</session_data>
```

---

#### 4. List Sessions (XML)

```http
GET /api/v1/sessions?limit=100
Accept: application/xml
```

**Response (Success - 200):**
```xml
<sessions_list>
  <sessions>
    <session>
      <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
      <created_at>2025-10-24T22:00:00Z</created_at>
      <last_accessed>2025-10-24T22:05:00Z</last_accessed>
      <turn_count>4</turn_count>
      <context_tokens>163</context_tokens>
    </session>
  </sessions>
  <total_sessions>1</total_sessions>
</sessions_list>
```

---

#### 5. Delete Session (XML)

```http
DELETE /api/v1/session/{session_id}
Accept: application/xml
```

**Response (Success - 200):**
```xml
<delete_response>
  <deleted>true</deleted>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
</delete_response>
```

---

## Key Differences Between Modes

| Aspect | Stateless (`/generate`) | Stateful (`/session/*`) |
|--------|------------------------|------------------------|
| **Format** | XML only | JSON or XML |
| **Content-Type** | application/xml | application/json or application/xml |
| **Context** | None (each request independent) | Server maintains full history |
| **Use Case** | Single queries, batch processing | Multi-turn conversations, chatbots |
| **Performance** | No caching benefits | Prefix caching (5-20x faster on prompts) |
| **Memory** | Stateless (0 bytes) | ~10-50 KB per session |
| **Session Limit** | N/A | 1000 concurrent sessions max |
| **TTL** | N/A | 60 minutes of inactivity |
| **Cleanup** | N/A | Automatic background cleanup |
| **CDATA Support** | Required for prompts | Supported in XML format (persona & turns) |

---

## Important Considerations

### 1. XML Grammar Enforcement

The llama.cpp backend uses GBNF grammar to enforce response structure:
- Responses may be wrapped in `<answer>` tags
- This is automatic and transparent via grammar injection
- Fallback to plain text if grammar not supported

**Example:**
```xml
<answer>This is the generated response text.</answer>
```

### 2. Context Window Management

**Stateful sessions enforce token limits:**
- Default: 8192 tokens (configurable per session)
- Token estimation: `chars / 3.5` with 15% safety margin
- Headroom reserved for generated tokens
- **Error 413** returned if context would overflow

**Client should:**
- Monitor `context_utilization` in responses
- Handle 413 errors by creating new session or summarizing history
- Set appropriate `max_context_tokens` when creating sessions

### 3. Session Lifecycle

**Automatic Management:**
- Sessions expire after **60 minutes** of inactivity
- Max **1000 concurrent sessions** (oldest evicted if limit reached)
- Background cleanup runs every **5 minutes**

**Client Responsibilities:**
- Store `session_id` securely for subsequent requests
- Handle 404 errors (session expired or deleted)
- Delete sessions when conversation ends to free resources

### 4. Concurrency & Thread Safety

✅ All session operations are thread-safe  
✅ Multiple clients can have independent sessions  
✅ Concurrent requests to same session are serialized safely  
✅ No race conditions or data corruption  

### 5. Session ID Format

- **Length:** 32 characters
- **Format:** Lowercase hexadecimal (`[0-9a-f]{32}`)
- **Generation:** Cryptographically secure random
- **Example:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

---

## Best Practices for Client Apps

### Choose the Right Mode

**Use Stateless XML for:**
- One-off completions
- Batch processing
- Independent queries
- Applications without conversation history
- Simple text generation tasks

**Use Stateful Sessions (JSON or XML) for:**
- Chatbots and conversational AI
- Multi-turn dialogues
- Applications needing conversation history
- Scenarios benefiting from prefix caching
- Character-based interactions

**Within Stateful Sessions, choose format:**
- **JSON:** For most applications - compact, widely supported, easy to parse
- **XML with CDATA:** When you need verbatim preservation of:
  - Nested XML structures
  - Code examples with special characters
  - Complex formatted content
  - Pre-formatted text blocks

### Session Management Pattern

```javascript
// Create session at conversation start
const session = await createSession({
  persona: "You are a coding assistant.\n",
  max_context_tokens: 8192
});

const sessionId = session.session_id;

// Process multiple turns
for (const userMessage of conversationMessages) {
  try {
    const response = await appendTurn(sessionId, {
      turn: `User: ${userMessage}\n`,
      max_tokens: 150
    });
    
    console.log(`Assistant: ${response.response}`);
    console.log(`Context usage: ${(response.context_utilization * 100).toFixed(1)}%`);
    
  } catch (error) {
    if (error.status_code === 413) {
      // Context full - options:
      // 1. Create new session
      // 2. Summarize history
      // 3. End conversation
      console.log("Context limit reached");
      break;
    }
  }
}

// Cleanup when done
await deleteSession(sessionId);
```

### Handle Context Overflow

```javascript
async function sendTurnWithOverflowHandling(sessionId, turn) {
  try {
    return await appendTurn(sessionId, turn);
  } catch (error) {
    if (error.status_code === 413) {
      // Option 1: Create new session with summary
      const currentSession = await getSession(sessionId);
      const summary = await generateSummary(currentSession.turns);
      
      await deleteSession(sessionId);
      
      const newSession = await createSession({
        persona: `${currentSession.persona}\nConversation summary: ${summary}\n`
      });
      
      return await appendTurn(newSession.session_id, turn);
    }
    throw error;
  }
}
```

### Monitor Session Health

```javascript
async function monitorSession(sessionId) {
  const response = await appendTurn(sessionId, {...});
  
  // Warn if approaching limit
  if (response.context_utilization > 0.85) {
    console.warn(`Session ${sessionId} is at 85% capacity`);
  }
  
  // Log usage
  console.log(`Tokens: ${response.total_context_tokens}/${response.max_context_tokens}`);
  
  return response;
}
```

---

## Code Examples

### PowerShell

#### Stateless XML Request
```powershell
$xmlBody = @"
<request>
  <prompt><![CDATA[Write a haiku about programming]]></prompt>
  <max_tokens>50</max_tokens>
  <temperature>0.9</temperature>
</request>
"@

$response = Invoke-RestMethod `
  -Uri "http://localhost:8080/api/v1/generate" `
  -Method Post `
  -ContentType "application/xml" `
  -Body $xmlBody

Write-Host $response.response.text
```

#### Stateful Session
```powershell
# Create session
$sessionBody = @{
  persona = "You are a helpful coding assistant.`n"
  max_context_tokens = 8192
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Uri "http://localhost:8080/api/v1/session/create" `
  -Method Post `
  -ContentType "application/json" `
  -Body $sessionBody

$sessionId = $session.session_id
Write-Host "Created session: $sessionId"

# Send first turn
$turnBody = @{
  turn = "How do I write a loop in Python?`n"
  max_tokens = 100
} | ConvertTo-Json

$reply = Invoke-RestMethod `
  -Uri "http://localhost:8080/api/v1/session/$sessionId/append" `
  -Method Post `
  -ContentType "application/json" `
  -Body $turnBody

Write-Host "Assistant: $($reply.response)"

# Send follow-up
$followUpBody = @{
  turn = "Can you show an example?`n"
  max_tokens = 150
} | ConvertTo-Json

$reply2 = Invoke-RestMethod `
  -Uri "http://localhost:8080/api/v1/session/$sessionId/append" `
  -Method Post `
  -ContentType "application/json" `
  -Body $followUpBody

Write-Host "Assistant: $($reply2.response)"

# Delete session when done
Invoke-RestMethod `
  -Uri "http://localhost:8080/api/v1/session/$sessionId" `
  -Method Delete
```

### JavaScript/Node.js

#### Stateless Request
```javascript
const axios = require('axios');

async function generateText(prompt) {
  const xmlBody = `
    <request>
      <prompt><![CDATA[${prompt}]]></prompt>
      <max_tokens>150</max_tokens>
      <temperature>0.8</temperature>
    </request>
  `;
  
  const response = await axios.post(
    'http://localhost:8080/api/v1/generate',
    xmlBody,
    { headers: { 'Content-Type': 'application/xml' } }
  );
  
  // Parse XML response (use xml2js or similar)
  return response.data;
}
```

#### Stateful Session
```javascript
const axios = require('axios');

class SessionClient {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }
  
  async createSession(persona, options = {}) {
    const response = await axios.post(
      `${this.baseUrl}/api/v1/session/create`,
      {
        persona: persona + '\n',
        max_context_tokens: options.maxTokens || 8192,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    this.sessionId = response.data.session_id;
    return response.data;
  }
  
  async sendMessage(message, options = {}) {
    if (!this.sessionId) {
      throw new Error('No active session. Call createSession() first.');
    }
    
    const response = await axios.post(
      `${this.baseUrl}/api/v1/session/${this.sessionId}/append`,
      {
        turn: message + '\n',
        max_tokens: options.maxTokens || 150,
        temperature: options.temperature,
        top_p: options.topP
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    return response.data;
  }
  
  async getSession() {
    if (!this.sessionId) {
      throw new Error('No active session.');
    }
    
    const response = await axios.get(
      `${this.baseUrl}/api/v1/session/${this.sessionId}`
    );
    
    return response.data;
  }
  
  async deleteSession() {
    if (!this.sessionId) return;
    
    await axios.delete(
      `${this.baseUrl}/api/v1/session/${this.sessionId}`
    );
    
    this.sessionId = null;
  }
}

// Usage
async function main() {
  const client = new SessionClient();
  
  await client.createSession('You are a helpful assistant.');
  
  const response1 = await client.sendMessage('Hello!');
  console.log(response1.response);
  
  const response2 = await client.sendMessage('Tell me a joke');
  console.log(response2.response);
  
  await client.deleteSession();
}
```

### Python

```python
import requests
import json

class LLMClient:
    def __init__(self, base_url='http://localhost:8080'):
        self.base_url = base_url
        self.session_id = None
    
    def generate_stateless(self, prompt, max_tokens=150, temperature=0.8):
        """Stateless XML request"""
        xml_body = f"""
        <request>
          <prompt><![CDATA[{prompt}]]></prompt>
          <max_tokens>{max_tokens}</max_tokens>
          <temperature>{temperature}</temperature>
        </request>
        """
        
        response = requests.post(
            f'{self.base_url}/api/v1/generate',
            data=xml_body,
            headers={'Content-Type': 'application/xml'}
        )
        
        return response.text
    
    def create_session(self, persona, max_context_tokens=8192, **kwargs):
        """Create a stateful session"""
        payload = {
            'persona': persona + '\n',
            'max_context_tokens': max_context_tokens,
            **kwargs
        }
        
        response = requests.post(
            f'{self.base_url}/api/v1/session/create',
            json=payload
        )
        
        data = response.json()
        self.session_id = data['session_id']
        return data
    
    def send_message(self, message, max_tokens=150, **kwargs):
        """Send a message in the current session"""
        if not self.session_id:
            raise ValueError('No active session. Call create_session() first.')
        
        payload = {
            'turn': message + '\n',
            'max_tokens': max_tokens,
            **kwargs
        }
        
        response = requests.post(
            f'{self.base_url}/api/v1/session/{self.session_id}/append',
            json=payload
        )
        
        return response.json()
    
    def get_session(self):
        """Retrieve current session details"""
        if not self.session_id:
            raise ValueError('No active session.')
        
        response = requests.get(
            f'{self.base_url}/api/v1/session/{self.session_id}'
        )
        
        return response.json()
    
    def delete_session(self):
        """Delete the current session"""
        if not self.session_id:
            return
        
        requests.delete(
            f'{self.base_url}/api/v1/session/{self.session_id}'
        )
        
        self.session_id = None

# Usage example
if __name__ == '__main__':
    client = LLMClient()
    
    # Stateless example
    result = client.generate_stateless('Write a haiku about code')
    print(result)
    
    # Stateful example
    client.create_session('You are a helpful programming assistant.')
    
    response1 = client.send_message('How do I sort a list in Python?')
    print(f"Assistant: {response1['response']}")
    
    response2 = client.send_message('Can you show an example?')
    print(f"Assistant: {response2['response']}")
    
    session_info = client.get_session()
    print(f"Context usage: {session_info['total_context_tokens']}/{session_info['max_context_tokens']}")
    
    client.delete_session()
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Possible Cause | Recommended Action |
|------|---------|---------------|-------------------|
| `200` | OK | Success | Process response |
| `201` | Created | Session created | Store session_id |
| `400` | Bad Request | Invalid request format | Check request syntax |
| `404` | Not Found | Session doesn't exist | Session expired or invalid ID |
| `413` | Payload Too Large | Context overflow | Create new session or summarize |
| `415` | Unsupported Media Type | Wrong Content-Type | Use application/xml or application/json |
| `422` | Unprocessable Entity | Invalid parameters | Check parameter ranges |
| `500` | Internal Server Error | Server error | Retry or contact support |
| `502` | Bad Gateway | Backend (llama.cpp) error | Check backend status |
| `503` | Service Unavailable | Backend unhealthy | Wait and retry |

### Error Response Formats

**XML Error (Stateless):**
```xml
<error>
  <message>Missing required &lt;prompt&gt; element</message>
  <status_code>400</status_code>
</error>
```

**JSON Error (Stateful):**
```json
{
  "error": "Context window exceeded",
  "status_code": 413,
  "details": {
    "estimated_prompt_tokens": 8500,
    "max_tokens": 150,
    "limit": 8192
  }
}
```

### Error Handling Example

```javascript
async function robustSessionAppend(sessionId, turn) {
  try {
    return await appendTurn(sessionId, turn);
  } catch (error) {
    switch (error.status_code) {
      case 404:
        console.error('Session expired or not found');
        // Create new session
        break;
      
      case 413:
        console.error('Context overflow');
        // Handle overflow (new session, summarize, etc.)
        break;
      
      case 502:
        console.error('Backend error');
        // Retry after delay
        await sleep(5000);
        return await appendTurn(sessionId, turn);
      
      default:
        console.error(`Unexpected error: ${error.message}`);
        throw error;
    }
  }
}
```

---

## Migration Impact

### Backend Change: KoboldCPP → llama.cpp

The API server backend has migrated from KoboldCPP to native llama.cpp. **This is transparent to clients:**

✅ External API contracts unchanged  
✅ Request/response formats remain the same  
✅ Only internal transport layer modified  
✅ Clients using the documented API are unaffected  

**No changes required in client code.**

### Benefits of Migration

- **Lighter weight:** Native llama.cpp is simpler and faster
- **Better caching:** Native prefix caching support
- **Faster updates:** Direct access to latest llama.cpp features
- **GPU optimization:** Better CUDA/GPU acceleration

---

## Additional Resources

- **API Server Codebase:** [`src/api_server.cpp`](../src/api_server.cpp)
- **Implementation Plan:** [`docs/STATEFUL_SESSION_IMPLEMENTATION_PLAN.md`](STATEFUL_SESSION_IMPLEMENTATION_PLAN.md)
- **XML API Plan:** [`docs/XML_API_IMPLEMENTATION_PLAN.md`](XML_API_IMPLEMENTATION_PLAN.md)
- **Development Log:** [`DEVLOG.md`](../dev/DEVLOG.md)

---

## Support & Contact

For issues, questions, or feature requests, please refer to the project repository or contact the development team.

**Server Health Check:**
```
GET http://localhost:8080/health
```

**API Version:**
```
GET http://localhost:8080/api/v1/version
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-24  
**API Server Version:** 1.0.0