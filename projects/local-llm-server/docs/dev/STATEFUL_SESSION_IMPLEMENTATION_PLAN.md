# Stateful Session Implementation Plan

## Overview

This document outlines the implementation plan for adding stateful conversation session support to the KoboldCPP API Server. This feature will enable:

- Multi-turn conversations with persistent context
- Automatic prefix caching optimization via KoboldCPP/llama.cpp
- Concurrent session management for multiple users
- Memory-efficient context handling

## Current Architecture Limitations

### Existing Behavior (Stateless)

The current API server implementation (`src/api_server.cpp`) is completely stateless:

```
Request 1: [Complete Prompt] → KoboldCPP → Response
Request 2: [Complete Prompt] → KoboldCPP → Response  (no memory of Request 1)
```

**Problems:**
- Each request is independent
- No conversation history maintained
- Clients must manually track and rebuild full conversation context
- Inefficient for multi-turn dialogues
- Cannot leverage KoboldCPP's prefix caching effectively

## Proposed Architecture

### Stateful Session Model

```
Session Creation: Store [Static Persona]
Turn 1: Append [User Input] → Build: [Persona + Turn1] → KoboldCPP → Store [Response]
Turn 2: Append [User Input] → Build: [Persona + Turn1 + Response1 + Turn2] → KoboldCPP → Store [Response]
Turn 3: Append [User Input] → Build: [Persona + Full History + Turn3] → KoboldCPP → Store [Response]
```

**Benefits:**
- Automatic prefix caching (persona + early turns reused)
- Server-side context management
- Simpler client integration
- Natural conversation flow

## Implementation Components

### 1. Data Structures

#### File: `include/kcpp/api_server.hpp`

```cpp
/**
 * Represents a single conversation session
 */
struct ConversationSession {
    std::string session_id;                      // Unique session identifier
    std::string static_persona;                  // Fixed persona block (sent once)
    std::vector<std::string> turns;              // Growing dialogue history
    std::chrono::system_clock::time_point created_at;
    std::chrono::system_clock::time_point last_accessed;
    
    // Optional session-specific configuration
    int max_context_tokens = 8192;               // Context window limit
    std::vector<std::string> stop_sequences;     // Custom stop strings
    float temperature = 0.7f;                    // Default temperature
    float top_p = 0.9f;                          // Default top_p
};

/**
 * Session creation request
 */
struct CreateSessionRequest {
    std::string persona;                         // Static persona block
    int max_age_minutes = 60;                    // Session TTL
    int max_context_tokens = 8192;               // Optional context limit
    std::vector<std::string> stop_sequences;     // Optional stop strings
};

/**
 * Session append request
 */
struct AppendTurnRequest {
    std::string turn;                            // New turn content (user input)
    int max_tokens = 150;                        // Response length limit
    std::optional<float> temperature;            // Override session default
    std::optional<float> top_p;                  // Override session default
};
```

#### Add to APIServer class:

```cpp
class APIServer {
private:
    // Session management
    std::unordered_map<std::string, ConversationSession> sessions_;
    std::mutex sessions_mutex_;                  // Thread safety
    std::thread cleanup_thread_;                 // Background cleanup
    
    // Session operations
    std::string generate_session_id();
    void cleanup_expired_sessions(int max_age_minutes);
    std::string build_full_prompt(const ConversationSession& session);
    bool validate_context_length(const ConversationSession& session);
    
    // New HTTP handlers
    void handle_session_create(const httplib::Request& req, httplib::Response& res);
    void handle_session_append(const httplib::Request& req, httplib::Response& res);
    void handle_session_get(const httplib::Request& req, httplib::Response& res);
    void handle_session_delete(const httplib::Request& req, httplib::Response& res);
    void handle_sessions_list(const httplib::Request& req, httplib::Response& res);
};
```

### 2. API Endpoints

#### 2.1 Create Session

**Endpoint:** `POST /api/v1/session/create`

**Request:**
```json
{
    "persona": "You are Aldrin Ironwhisper, a merchant. Location: tavern_main...",
    "max_age_minutes": 60,
    "max_context_tokens": 8192,
    "stop_sequences": ["Note:", "Narrator:", "\n\n"],
    "temperature": 0.7,
    "top_p": 0.9
}
```

**Response (Success):**
```json
{
    "session_id": "a1b2c3d4e5f6g7h8",
    "created_at": "2025-10-21T18:00:00Z",
    "persona_tokens": 145,
    "max_context_tokens": 8192
}
```

**Response (Error):**
```json
{
    "error": "Persona too long (exceeds max_context_tokens)",
    "status_code": 400
}
```

#### 2.2 Append Turn

**Endpoint:** `POST /api/v1/session/{session_id}/append`

**Request:**
```json
{
    "turn": "User: What's for sale today?\n",
    "max_tokens": 48,
    "temperature": 0.7,
    "top_p": 0.9
}
```

**Response (Success):**
```json
{
    "session_id": "a1b2c3d4e5f6g7h8",
    "response": "Aldrin: Got some dried meat and stale bread. Not much else worth mentioning.",
    "tokens_used": 18,
    "total_context_tokens": 163,
    "context_utilization": 0.02
}
```

**Response (Error - Session Not Found):**
```json
{
    "error": "Session not found",
    "status_code": 404
}
```

**Response (Error - Context Overflow):**
```json
{
    "error": "Context window exceeded (8345/8192 tokens)",
    "status_code": 413,
    "suggestion": "Create a new session or summarize early turns"
}
```

#### 2.3 Get Session

**Endpoint:** `GET /api/v1/session/{session_id}`

**Response:**
```json
{
    "session_id": "a1b2c3d4e5f6g7h8",
    "persona": "You are Aldrin Ironwhisper...",
    "turns": [
        "User: What's for sale?\n",
        "Aldrin: Got some dried meat...\n"
    ],
    "created_at": "2025-10-21T18:00:00Z",
    "last_accessed": "2025-10-21T18:05:00Z",
    "total_context_tokens": 163,
    "max_context_tokens": 8192
}
```

#### 2.4 Delete Session

**Endpoint:** `DELETE /api/v1/session/{session_id}`

**Response:**
```json
{
    "deleted": true,
    "session_id": "a1b2c3d4e5f6g7h8"
}
```

#### 2.5 List Sessions

**Endpoint:** `GET /api/v1/sessions`

**Response:**
```json
{
    "sessions": [
        {
            "session_id": "a1b2c3d4e5f6g7h8",
            "created_at": "2025-10-21T18:00:00Z",
            "last_accessed": "2025-10-21T18:05:00Z",
            "turn_count": 3,
            "context_tokens": 245
        }
    ],
    "total_sessions": 1
}
```

### 3. Core Logic Implementation

#### 3.1 Session ID Generation

**File:** `src/api_server.cpp`

```cpp
#include <random>
#include <sstream>
#include <iomanip>

std::string APIServer::generate_session_id() {
    // Generate cryptographically random 16-character hex ID
    std::random_device rd;
    std::mt19937_64 gen(rd());
    std::uniform_int_distribution<uint64_t> dis;
    
    std::stringstream ss;
    ss << std::hex << std::setfill('0') << std::setw(16) << dis(gen);
    return ss.str();
}
```

#### 3.2 Session Creation Handler

```cpp
void APIServer::handle_session_create(const httplib::Request& req, httplib::Response& res) {
    try {
        // Parse request
        auto json_req = nlohmann::json::parse(req.body);
        
        if (!json_req.contains("persona")) {
            send_json_error(res, 400, "Missing 'persona' field");
            return;
        }
        
        // Create session
        ConversationSession session;
        session.session_id = generate_session_id();
        session.static_persona = json_req["persona"];
        session.created_at = std::chrono::system_clock::now();
        session.last_accessed = session.created_at;
        
        // Optional configuration
        if (json_req.contains("max_context_tokens")) {
            session.max_context_tokens = json_req["max_context_tokens"];
        }
        if (json_req.contains("stop_sequences")) {
            session.stop_sequences = json_req["stop_sequences"].get<std::vector<std::string>>();
        }
        if (json_req.contains("temperature")) {
            session.temperature = json_req["temperature"];
        }
        if (json_req.contains("top_p")) {
            session.top_p = json_req["top_p"];
        }
        
        // Estimate persona token count (rough: 1 token ≈ 4 chars)
        int persona_tokens = session.static_persona.length() / 4;
        
        // Validate persona doesn't exceed context
        if (persona_tokens >= session.max_context_tokens) {
            send_json_error(res, 400, "Persona too long for context window");
            return;
        }
        
        // Store session (thread-safe)
        {
            std::lock_guard<std::mutex> lock(sessions_mutex_);
            sessions_[session.session_id] = session;
        }
        
        logger_->info("Created session: {}", session.session_id);
        
        // Build response
        nlohmann::json json_res = {
            {"session_id", session.session_id},
            {"created_at", std::chrono::system_clock::to_time_t(session.created_at)},
            {"persona_tokens", persona_tokens},
            {"max_context_tokens", session.max_context_tokens}
        };
        
        res.status = 201;
        res.set_content(json_res.dump(), "application/json");
        
    } catch (const std::exception& e) {
        logger_->error("Exception in handle_session_create: {}", e.what());
        send_json_error(res, 500, "Internal error: " + std::string(e.what()));
    }
}
```

#### 3.3 Session Append Handler

```cpp
void APIServer::handle_session_append(const httplib::Request& req, httplib::Response& res) {
    try {
        // Extract session_id from URL path
        std::string session_id = req.matches[1];
        
        // Parse request
        auto json_req = nlohmann::json::parse(req.body);
        
        if (!json_req.contains("turn")) {
            send_json_error(res, 400, "Missing 'turn' field");
            return;
        }
        
        std::string new_turn = json_req["turn"];
        int max_tokens = json_req.value("max_tokens", 150);
        
        // Thread-safe session access
        std::lock_guard<std::mutex> lock(sessions_mutex_);
        
        // Find session
        auto it = sessions_.find(session_id);
        if (it == sessions_.end()) {
            send_json_error(res, 404, "Session not found");
            return;
        }
        
        ConversationSession& session = it->second;
        
        // Build full prompt: persona + all turns + new turn
        std::string full_prompt = build_full_prompt(session) + new_turn;
        
        // Validate context length
        int estimated_tokens = full_prompt.length() / 4;
        if (estimated_tokens > session.max_context_tokens) {
            send_json_error(res, 413, 
                "Context window exceeded (" + std::to_string(estimated_tokens) + 
                "/" + std::to_string(session.max_context_tokens) + " tokens)");
            return;
        }
        
        // Get temperature/top_p (request overrides session defaults)
        float temperature = json_req.value("temperature", session.temperature);
        float top_p = json_req.value("top_p", session.top_p);
        
        // Forward to KoboldCPP
        KoboldRequest kobold_req{full_prompt, max_tokens, temperature, top_p};
        KoboldResponse kobold_resp = forward_to_koboldcpp(kobold_req);
        
        if (!kobold_resp.success) {
            send_json_error(res, 500, "KoboldCPP error: " + kobold_resp.error_message);
            return;
        }
        
        // Append both user turn and model response to session history
        session.turns.push_back(new_turn);
        session.turns.push_back(kobold_resp.response + "\n");
        session.last_accessed = std::chrono::system_clock::now();
        
        // Build response
        nlohmann::json json_res = {
            {"session_id", session_id},
            {"response", kobold_resp.response},
            {"tokens_used", kobold_resp.tokens_used},
            {"total_context_tokens", estimated_tokens},
            {"context_utilization", static_cast<float>(estimated_tokens) / session.max_context_tokens}
        };
        
        res.status = 200;
        res.set_content(json_res.dump(), "application/json");
        
        logger_->info("Session {} - Turn appended ({} tokens)", 
                     session_id, kobold_resp.tokens_used);
        
    } catch (const std::exception& e) {
        logger_->error("Exception in handle_session_append: {}", e.what());
        send_json_error(res, 500, "Internal error: " + std::string(e.what()));
    }
}
```

#### 3.4 Build Full Prompt

```cpp
std::string APIServer::build_full_prompt(const ConversationSession& session) {
    std::stringstream ss;
    
    // Start with static persona
    ss << session.static_persona;
    
    // Append all turns
    for (const auto& turn : session.turns) {
        ss << turn;
    }
    
    return ss.str();
}
```

#### 3.5 Session Cleanup

```cpp
void APIServer::cleanup_expired_sessions(int max_age_minutes) {
    std::lock_guard<std::mutex> lock(sessions_mutex_);
    
    auto now = std::chrono::system_clock::now();
    size_t cleaned = 0;
    
    for (auto it = sessions_.begin(); it != sessions_.end();) {
        auto age_minutes = std::chrono::duration_cast<std::chrono::minutes>(
            now - it->second.last_accessed).count();
        
        if (age_minutes > max_age_minutes) {
            logger_->info("Cleaning up expired session: {} (age: {} minutes)", 
                         it->first, age_minutes);
            it = sessions_.erase(it);
            cleaned++;
        } else {
            ++it;
        }
    }
    
    if (cleaned > 0) {
        logger_->info("Cleaned up {} expired sessions", cleaned);
    }
}
```

#### 3.6 Background Cleanup Thread

```cpp
// In APIServer::start():
cleanup_thread_ = std::thread([this]() {
    while (running_) {
        std::this_thread::sleep_for(std::chrono::minutes(5));
        cleanup_expired_sessions(60);  // Clean sessions older than 60 minutes
    }
});

// In APIServer::stop():
if (cleanup_thread_.joinable()) {
    cleanup_thread_.join();
}
```

### 4. Files to Modify

#### Primary Files:

1. **`include/kcpp/api_server.hpp`**
   - Add `ConversationSession` struct
   - Add session management methods to `APIServer` class
   - Add session map and mutex members

2. **`src/api_server.cpp`**
   - Implement session creation handler
   - Implement session append handler
   - Implement session retrieval/delete handlers
   - Implement cleanup logic
   - Register new endpoints in `start()`

#### Test Files:

3. **`tests/unit/test_session_management.cpp`** (new file)
   - Test session creation
   - Test session append
   - Test context overflow handling
   - Test session expiration
   - Test concurrent session access

4. **`tests/integration/test_stateful_workflow.cpp`** (new file)
   - Test multi-turn conversation
   - Test prefix caching effectiveness
   - Test session persistence across requests

### 5. Testing Strategy

#### Unit Tests

```cpp
TEST_CASE("Session creation", "[session]") {
    APIServer server;
    // Test successful session creation
    // Test persona validation
    // Test session ID uniqueness
}

TEST_CASE("Session append", "[session]") {
    // Test turn append
    // Test context building
    // Test response storage
}

TEST_CASE("Context overflow", "[session]") {
    // Test context limit enforcement
    // Test error handling
}

TEST_CASE("Session cleanup", "[session]") {
    // Test expiration logic
    // Test thread safety
}
```

#### Integration Tests

```cpp
TEST_CASE("Multi-turn conversation", "[integration]") {
    // Create session with persona
    // Append multiple turns
    // Verify context builds correctly
    // Verify prefix caching benefits
}

TEST_CASE("Concurrent sessions", "[integration]") {
    // Create multiple sessions
    // Interleave requests
    // Verify session isolation
}
```

### 6. Performance Considerations

#### Prefix Caching Optimization

**Scenario:** Session with 200-token persona + 5 turns (50 tokens each)

```
Turn 1: Process 200 (persona) + 50 (turn1) = 250 tokens
Turn 2: Reuse 200 (cached) + 50 (turn1, cached) + Process 50 (turn2) = 50 new tokens
Turn 3: Reuse 300 (cached) + Process 50 (turn3) = 50 new tokens
```

**Expected speedup:** 5-20x on prompt processing (depends on hardware)

#### Memory Usage

**Per session:** ~10-50 KB (depends on conversation length)
**1000 concurrent sessions:** ~10-50 MB
**Recommendation:** Set max_age_minutes to prevent unbounded growth

#### Thread Safety

- All session map access protected by mutex
- Short critical sections (fast operations only)
- No blocking I/O inside critical sections

### 7. Future Enhancements

#### Phase 2 (Optional):

1. **Persistent Sessions**
   - Save sessions to disk (SQLite or JSON files)
   - Restore sessions on server restart
   - Session snapshots for long conversations

2. **Advanced Context Management**
   - Automatic context summarization when approaching limit
   - Sliding window mode (keep recent N turns)
   - Importance-based pruning

3. **Session Analytics**
   - Token usage tracking
   - Performance metrics per session
   - Conversation quality metrics

4. **Multi-Backend Support**
   - Session affinity to specific KoboldCPP instances
   - Load balancing across multiple backends
   - Dedicated backend per session for optimal caching

### 8. Migration Path

#### Backward Compatibility

- Keep existing `/api/v1/generate` endpoint (stateless mode)
- New session endpoints are additive
- Clients can choose stateful or stateless based on use case

#### Recommended Migration

1. **Simple Use Cases:** Continue using stateless `/generate`
2. **Chat Applications:** Migrate to session-based endpoints
3. **Hybrid:** Use sessions for multi-turn, stateless for one-off queries

### 9. Configuration

#### Environment Variables (Optional)

```bash
# Session management
LLM_SESSION_MAX_AGE_MINUTES=60
LLM_SESSION_CLEANUP_INTERVAL_MINUTES=5
LLM_SESSION_MAX_CONCURRENT=1000
LLM_SESSION_DEFAULT_CONTEXT_TOKENS=8192
```

### 10. Documentation

#### API Documentation

- Update `API_README.md` with session endpoints
- Add usage examples for stateful conversations
- Document best practices for context management

#### Developer Guide

- Add session management architecture diagram
- Document thread safety guarantees
- Explain prefix caching benefits

## Implementation Timeline

### Phase 1: Core Implementation (Week 1)
- [ ] Add session data structures
- [ ] Implement session creation/append/delete
- [ ] Add basic thread safety
- [ ] Unit tests for core functionality

### Phase 2: Integration & Testing (Week 2)
- [ ] Integration tests
- [ ] Performance benchmarks
- [ ] Documentation updates
- [ ] Code review & refinement

### Phase 3: Production Readiness (Week 3)
- [ ] Session cleanup & memory management
- [ ] Error handling & edge cases
- [ ] Production configuration
- [ ] Deployment guide

## Success Criteria

1. ✅ Sessions persist across multiple requests
2. ✅ Prefix caching reduces prompt processing time by >5x
3. ✅ Thread-safe concurrent session handling
4. ✅ Automatic cleanup prevents memory leaks
5. ✅ Backward compatible with existing API
6. ✅ Comprehensive test coverage (>80%)
7. ✅ Production-ready error handling

## Conclusion

This implementation will transform the API server from a simple proxy to a full-featured conversational AI backend, enabling efficient multi-turn dialogues while leveraging KoboldCPP's native prefix caching capabilities.

---

# Addendum: Enhanced Specification, Risks, and Step-by-Step Implementation Guide

This addendum refines the plan into a spec-level document to prevent ambiguity before coding. It includes API contracts, concurrency rules, token accounting, backend interoperability, cleanup lifecycle, limits, and testing details. It also highlights incompatibilities found in the current code and proposes resolution.

## A. Critical Findings and Decisions

1) API shape mismatch (must resolve before sessions)
- Observed:
  - The server’s /api/v1/generate handler returns:
    {"text": string, "tokens_used": int, "success": bool}
  - The client/test utilities (src/http.cpp) expect:
    {"results": [{"text": string}], ...}
- Decision:
  - For backward compatibility, standardize /api/v1/generate to return BOTH fields:
    {
      "text": "...",
      "results": [{ "text": "..." }],
      "tokens_used": 123,
      "success": true
    }
  - Update tests later to use one shape consistently; keep dual shape initially to avoid breaking any existing consumers.

2) Backend response format differences
- Observed:
  - forward_to_llamacpp currently calls /completion and expects fields "content" and "tokens_predicted".
  - Other code expects a "results" array or "text".
- Decision:
  - Introduce a minimal backend-adapter function that maps backend JSON to our internal LlamaResponse:
    - Accepts backend JSON
    - Extracts text and tokens from known keys: "content"/"text"/"results[0].text"/"choices[0].text"
    - Extracts tokens used from "tokens_predicted"/"eval_count"/"usage" fields where available
  - Keep our internal response stable: response, tokens_used, success, error_message.

3) Prefix caching contract with backend
- Decision:
  - When using llama.cpp HTTP server, include cache-related flags for session reuse if supported by the running version:
    - "cache_prompt": true
    - "prompt_cache_key": "<session_id>"
  - If backend does not support caching, the session feature still works; the caching speedups simply won’t apply.

4) Token length enforcement
- Decision:
  - Try exact token accounting via backend tokenize endpoint (if available).
  - If not available, use a configured heuristic with safety margin:
    - estimate = ceil(chars / 3.5)
    - reserve margin for generated tokens (e.g., +max_tokens)
    - apply a safety factor (e.g., 1.15)
  - Expose env overrides for heuristic and margin.

5) Concurrency and locks
- Decision:
  - Do not hold the sessions mutex while making network calls.
  - Pattern:
    - Lock sessions map: lookup session, copy what’s needed (persona, turns, configuration), unlock.
    - Build prompt off-lock.
    - Call backend off-lock.
    - Re-lock to append new turns, verify session still exists and not expired, then update.
  - Keep critical sections as short as possible.

6) TTL and capacity management
- Decision:
  - Enforce both:
    - Per-session TTL (based on last_accessed)
    - Global capacity: max concurrent sessions (evict LRU/oldest by last_accessed when limit reached)
  - Cleanup thread periodically deletes expired sessions and enforces capacity.

7) Session ID
- Decision:
  - Use 128-bit cryptographically-secure random (not mt19937). 32 hex chars.
  - Example approach: fill a 16-byte array with std::random_device, hex-encode.

8) Prompt formatting contract (stable, testable)
- Decision:
  - Canonical prompt format:
    - <persona>\n
    - User: <text>\n
    - Assistant: <text>\n
    - ...
    - User: <new turn>\n
  - Ensure all turns end with a trailing newline to prevent adjacency bleed.
  - Enforce maximum turn length per append to avoid pathological inputs.

9) Error shape (consistent across endpoints)
- Decision: Always use
  {
    "error": "<message>",
    "status_code": <http_code>,
    "details": { ...optional... }
  }

10) Streaming
- Decision (Phase 1): Non-streaming only. Add SSE/streaming in Phase 2.

---

## B. Canonical Data Model (in-memory)

ConversationSession
- session_id: string (32 hex chars, lower-case)
- static_persona: string (required, not empty, newline-terminated in storage)
- turns: vector<string> (alternating: User: ..., Assistant: ...; every string newline-terminated)
- created_at: time_point
- last_accessed: time_point
- max_context_tokens: int (default 8192; env override available)
- stop_sequences: vector<string>
- temperature: float (default 0.7)
- top_p: float (default 0.9)
- Optional counters:
  - approx_prompt_tokens_cached: int (incrementally updated for fast checks)
  - total_tokens_generated: int

Invariants
- static_persona and all turns end with a single trailing newline
- turns length is even after append (we add both user and assistant entries on success)
- last_accessed is updated on GET (and any mutation)
- session_id uniqueness is guaranteed

---

## C. Prompt Construction

build_full_prompt(session)
- Concatenate in order:
  1) session.static_persona
  2) for each turn in session.turns: append in stored order
- Before calling backend, append the current new turn as:
  "User: " + new_turn (ensuring exactly one trailing newline)
- For assistant responses, store as:
  "Assistant: " + response_text + "\n"

Validation
- Reject if any stored turn violates newline-termination
- Sanitize embedded null bytes
- Enforce per-turn max length (configurable, e.g., 8KB)

---

## D. API Endpoints (final contracts)

All endpoints return "application/json" and use the error shape above for non-2xx. Path variables are validated with regex.

1) POST /api/v1/session/create
Request
{
  "persona": "System/Persona text ...",
  "max_age_minutes": 60,                // optional, default from env (e.g., 60)
  "max_context_tokens": 8192,           // optional
  "stop_sequences": ["Note:", "Narrator:"], // optional
  "temperature": 0.7,                   // optional
  "top_p": 0.9                          // optional
}
Validation
- persona required and non-empty
- persona token estimate less than max_context_tokens
- temperature in (0, 2], top_p in (0, 1]
Response 201
{
  "session_id": "32hexcharslowercase",
  "created_at": "RFC3339 string",
  "persona_tokens": <int_estimate_or_exact>,
  "max_context_tokens": <int>
}

2) POST /api/v1/session/{session_id}/append
Path session_id: ^[0-9a-f]{32}$
Request
{
  "turn": "What's for sale?\n",
  "max_tokens": 48,                     // optional default 150
  "temperature": 0.7,                   // optional override
  "top_p": 0.9                          // optional override
}
Algorithm
- Validate session_id, body, and limits
- Copy session off-lock
- Build prompt (persona + turns + "User: {turn}\n")
- Enforce context size with margin (see Token Accounting)
- Send to backend with cache settings and stop sequences
- Re-lock, re-check session, append both entries if success
Response 200
{
  "session_id": "...",
  "response": "Assistant: ...",         // without trailing newline
  "tokens_used": <int_if_available>,
  "total_context_tokens": <estimate_or_exact>,
  "context_utilization": <float in [0,1]>
}
Errors
- 404 session not found
- 413 context limit exceeded
- 422 invalid temperature/top_p/max_tokens
- 502 backend error (with details)

3) GET /api/v1/session/{session_id}
Response 200
{
  "session_id": "...",
  "persona": "...",
  "turns": ["User: ...\n", "Assistant: ...\n", ...],
  "created_at": "RFC3339",
  "last_accessed": "RFC3339",
  "total_context_tokens": <estimate_or_exact>,
  "max_context_tokens": <int>
}

4) DELETE /api/v1/session/{session_id}
Response 200
{
  "deleted": true,
  "session_id": "..."
}

5) GET /api/v1/sessions
Query params (optional):
- limit (default 100, max 1000)
- before (RFC3339, list sessions last_accessed <= before)
Response 200
{
  "sessions": [
    {
      "session_id": "...",
      "created_at": "RFC3339",
      "last_accessed": "RFC3339",
      "turn_count": <int>,
      "context_tokens": <estimate_or_exact>
    }
  ],
  "total_sessions": <int>
}

---

## E. Token Accounting

Preferred (Exact)
- If backend exposes /tokenize, call it with persona + turns + new turn to get exact count before generation.
- Add requested max_tokens to ensure headroom; reject if overflow.

Fallback (Heuristic)
- tokens_est = ceil(chars / 3.5)
- with_safety = ceil((tokens_est + max_tokens) * safety_factor)
- Default safety_factor = 1.15 (configurable)

Store last computed total_context_tokens to reduce rework. Recompute when turns change.

---

## F. Backend Call (non-streaming)

Request shape (example for llama.cpp server)
{
  "prompt": "<full_prompt>",
  "max_tokens": <int>,
  "temperature": <float>,
  "top_p": <float>,
  "stop": ["..."],                      // if not empty
  "cache_prompt": true,                 // if supported
  "prompt_cache_key": "<session_id>"   // if supported
}
Response parsing
- Extract first non-empty text field among: "content", "text", "results[0].text", "choices[0].text"
- Extract tokens used from: "tokens_predicted", "eval_count", or usage fields if present
- On parse failure, return backend error with raw preview in details (truncate safely)

---

## G. Concurrency and Cleanup

Session map protection
- Use std::mutex across all CRUD operations.
- Off-lock network behavior:
  - Lock, find session, copy necessary fields, unlock.
  - Network call.
  - Lock again, re-validate session presence, append both turns, unlock.

Cleanup thread
- Runs every CLEANUP_INTERVAL_MINUTES (default 5)
- Steps:
  1) Lock, remove expired sessions (last_accessed > TTL)
  2) If size > MAX_CONCURRENT_SESSIONS, evict oldest last_accessed until size <= limit
  3) Unlock
- Shutdown:
  - Use an atomic<bool> shutdown flag and condition_variable to wake thread early
  - stop(): set shutdown=true; notify; join thread

---

## H. Limits, Security, and Validation

- Max persona size in bytes (default 64 KB)
- Max turn size in bytes (default 8 KB)
- Max max_tokens (default 512, max 2048)
- Validate temperature (0,2], top_p (0,1]
- Reject control characters except CR/LF/TAB in persona and turns
- CORS: If needed, add Access-Control-Allow-Origin based on config
- Rate limiting (Phase 2)
- Log scrubbing: never log full persona/turns by default; log hashes and token counts

---

## I. Observability

Logging (info)
- Session lifecycle: created/deleted/expired with ids and age
- Append: session_id, tokens_used, total_context_tokens, latency
Logging (warn/error)
- Exceeded context, invalid input, backend unavailability, parse failures

Metrics (optional, Phase 2)
- sessions_active, sessions_created_total, sessions_deleted_total
- tokens_generated_total, backend_latency_ms histogram
- context_overflow_total

---

## J. JSON Schemas (reference, Draft 07)

CreateSessionRequest
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["persona"],
  "properties": {
    "persona": { "type": "string", "minLength": 1 },
    "max_age_minutes": { "type": "integer", "minimum": 1, "maximum": 43200 },
    "max_context_tokens": { "type": "integer", "minimum": 256, "maximum": 262144 },
    "stop_sequences": { "type": "array", "items": { "type": "string" }, "maxItems": 16 },
    "temperature": { "type": "number", "exclusiveMinimum": 0.0, "maximum": 2.0 },
    "top_p": { "type": "number", "exclusiveMinimum": 0.0, "maximum": 1.0 }
  },
  "additionalProperties": false
}

AppendTurnRequest
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["turn"],
  "properties": {
    "turn": { "type": "string", "minLength": 1 },
    "max_tokens": { "type": "integer", "minimum": 1, "maximum": 4096 },
    "temperature": { "type": "number", "exclusiveMinimum": 0.0, "maximum": 2.0 },
    "top_p": { "type": "number", "exclusiveMinimum": 0.0, "maximum": 1.0 }
  },
  "additionalProperties": false
}

---

## K. Step-by-Step Implementation Plan (solidified)

1) Endpoint scaffolding
- Add 5 endpoints with precise paths and parameter validation.
- Ensure generate endpoint returns both "text" and "results" initially.

2) Session store and ID
- Add ConversationSession and sessions map with mutex.
- Implement secure 128-bit random session ids (lowercase hex).

3) Prompt construction and formatting
- Implement build_full_prompt with persona + turns.
- Enforce newline termination for all stored strings.

4) Token accounting
- Implement tokenize call if available; else heuristic with safety factor and headroom for max_tokens.

5) Backend request/response adapter
- Map backend JSON to internal LlamaResponse structure resiliently.
- Pass stop, temperature, top_p, cache flags.

6) Append flow concurrency
- Lock to read, unlock for network, lock to write.
- Revalidate session existence and TTL, append both turns atomically.

7) Cleanup worker
- Add background thread with shutdown signaling.
- Enforce TTL and capacity.
- Unit test cleanup without flakiness (use deterministic time via abstraction or injectable clock).

8) Tests
- Unit:
  - session creation (valid/invalid)
  - append (valid), context overflow, overrides (temperature/top_p)
  - concurrent appends to different sessions; interleaving
  - cleanup TTL and capacity
- Integration:
  - full multi-turn flow; verify prompt growth; basic timing for caching
  - list/get/delete flows
  - error cases: 404, 413, 422, backend errors

9) Documentation
- Update API docs with final request/response shapes.
- Add examples (PowerShell Invoke-RestMethod).

---

## L. PowerShell usage examples (non-streaming)

$base = "http://127.0.0.1:8080"

# Create session
$createBody = @{
  persona = "You are Aldrin Ironwhisper, a merchant.\nLocation: tavern_main.\n"
  max_age_minutes = 60
  max_context_tokens = 8192
  temperature = 0.7
  top_p = 0.9
} | ConvertTo-Json
$create = Invoke-RestMethod -Uri "$base/api/v1/session/create" -Method Post -ContentType "application/json" -Body $createBody
$sessionId = $create.session_id

# Append a user turn
$appendBody = @{
  turn = "What's for sale today?\n"
  max_tokens = 48
} | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "$base/api/v1/session/$sessionId/append" -Method Post -ContentType "application/json" -Body $appendBody
$resp.response

# Inspect session
Invoke-RestMethod -Uri "$base/api/v1/session/$sessionId" -Method Get

# Delete session
Invoke-RestMethod -Uri "$base/api/v1/session/$sessionId" -Method Delete

---

## M. Open Questions (to lock down before coding)

- Do we need per-session overrides for stop sequences after creation, or only at create-time?
- Should we expose a "truncate-to-fit" mode instead of hard-rejecting on context overflow? (Phase 2)
- Do we need a streaming append endpoint in Phase 1? (currently no)

---

## N. Acceptance Criteria (expanded)

- Sessions persist across requests with canonical prompt formatting and strict validation.
- /api/v1/generate returns dual-shape response to bridge current mismatch.
- Token accounting prevents overflow with either exact or heuristic methods.
- No lock is held during backend I/O; append uses lock-sandwich pattern.
- Cleanup properly enforces TTL and capacity; server shuts down cleanly.
- Tests cover normal, error, and concurrency paths; integration verified against the running backend.
- Observability: clear logs for lifecycle, append, overflow, and backend issues.
