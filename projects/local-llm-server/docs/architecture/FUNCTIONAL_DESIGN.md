# Functional Design Document

## Overview

The LlamaCPP Control Tool (kcppctl) is a lightweight C++ command-line interface designed to simplify the management and integration of LlamaCPP processes on Windows. It serves as a wrapper around the LlamaCPP runtime, providing process management, API testing, and a RESTful API server for seamless integration with external applications such as UE5 or Director systems.

The system enables users to run large language models (LLMs) locally with hardware optimizations, perform automated testing, and interact via a standard HTTP API, focusing on reliability, ease of use, and minimal dependencies.

## Key Functional Requirements

### 1. Process Management
- **Start/Stop LlamaCPP Server**: Launch and terminate LlamaCPP processes with intelligent lifecycle management.
- **Configuration Loading**: Load settings from environment configuration files tailored for different hardware (e.g., RTX 3060, AMD Ryzen AI 300).
- **Hardware Optimization**: Automatically detect and apply optimizations for GPU acceleration (CUDA, Vulkan, OpenCL).

### 2. API Integration and Connectivity
- **HTTP API Wrapper**: Expose LlamaCPP functionality via REST endpoints, acting as a proxy for external applications.
- **Standard Endpoints**: Provide OpenAI-compatible and custom endpoints for text generation, model information, health checks, and version info.
- **Connection Methods**:
  - Direct HTTP requests to localhost:8080 (default port).
  - Integration via Python, JavaScript, or other HTTP clients.
  - Example: Use `requests` library in Python to send POST requests to `/api/v1/generate`.

### 3. Testing and Monitoring
- **Smoke Testing**: Automated connectivity and basic functionality tests to ensure API responsiveness.
- **Performance Benchmarking**: Measure tokens per second (TPS) and latency for generation requests.
- **Health Monitoring**: Real-time status checks for both the API server and underlying LlamaCPP process.
- **Logging**: Structured logging with rotation for debugging and monitoring.

### 4. Configuration Management
- **Environment Profiles**: Support multiple config files (e.g., env.local, env.high-end, env.ryzen-ai-optimized) for different setups.
- **Variables**: Key settings include LLM_HOST, LLM_PORT, LLM_MODEL_PATH, LLM_THREADS, LLM_CTX, LLM_GPULAYERS.
- **Model Management**: Handle GGUF model files, with automated download options via HuggingFace CLI.

### 5. Stateful Sessions (Planned)
- **Multi-Turn Conversations**: Maintain conversation history for persistent context.
- **Session Management**: Create, append, retrieve, and delete sessions with automatic cleanup.
- **Prefix Caching**: Optimize prompt processing using LlamaCPP's caching for repeated elements.

## User Scenarios

### Scenario 1: Basic Text Generation
1. User starts the LlamaCPP server via `kcppctl start`.
2. External app (e.g., UE5) sends HTTP POST to `http://localhost:8080/api/v1/generate` with prompt JSON.
3. System forwards request to LlamaCPP, returns generated text.

### Scenario 2: Performance Testing
1. User runs `kcppctl perf --tokens 512` to benchmark.
2. System generates a test prompt, measures response time and TPS.
3. Results displayed for optimization tuning.

### Scenario 3: Hardware Optimization (e.g., Ryzen AI)
1. User runs `start-llama-server.ps1 -RyzenAIOptimized`.
2. System detects AMD iGPU, applies OpenCL flags, and validates acceleration.
3. User monitors via `validate-gpu-acceleration.ps1`.

### Scenario 4: Integration with External Systems
- **Python Integration**:
  ```python
  import requests
  response = requests.post('http://localhost:8080/api/v1/generate', json={'prompt': 'Hello', 'max_tokens': 50})
  print(response.json()['text'])
  ```
- **JavaScript Integration**: Use fetch or axios to connect via HTTP.

## API Endpoints and Connection Details

### Core API Endpoints
1. **POST /api/v1/generate**
   - Purpose: Generate text from a prompt.
   - Request Body: JSON with `prompt`, `max_tokens`, `temperature`, `top_p`.
   - Response: JSON with `text`, `tokens_used`, `success`.
   - Connection: HTTP POST to localhost:8080 (configurable via LLM_PORT).

2. **GET /api/v1/models**
   - Purpose: Retrieve model information.
   - Response: Static JSON with model ID, name, type, format, status.

3. **GET /health**
   - Purpose: Check health of API server and LlamaCPP.
   - Response: JSON with status, timestamps, version.

4. **GET /api/v1/version**
   - Purpose: Get version details.
   - Response: JSON with version, name, description.

### Connection Protocols
- **HTTP/HTTPS**: Standard REST API over HTTP (default port 8080).
- **Timeout Handling**: Requests have configurable timeouts (e.g., 2 minutes for generation).
- **Error Responses**: Standardized JSON errors (e.g., 400 for invalid requests, 500 for server errors).
- **Authentication**: None required (localhost access assumed).

### Integration Guidelines
- **Libraries**: Compatible with any HTTP client (e.g., cURL, requests, fetch).
- **Rate Limiting**: No explicit limits; rely on LlamaCPP's capacity.
- **Best Practices**: Batch requests if possible; handle errors gracefully; use health endpoint for monitoring.

## Non-Functional Requirements
- **Performance**: Support for 20-100+ TPS on optimized hardware.
- **Reliability**: Graceful error handling, automatic retries for health checks.
- **Security**: Localhost-only access; no authentication for simplicity.
- **Scalability**: Designed for single-instance use; sessions for multi-user simulation.
- **Usability**: Command-line interface with help (`--help`), dry-run modes.

## Future Enhancements
- Implement stateful sessions as per the implementation plan.
- Add persistent session storage for long-term conversations.
- Support for multiple LlamaCPP backends or load balancing.