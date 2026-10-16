# LlamaCPP API Server

A simple HTTP API wrapper around LlamaCPP that provides easy integration for external applications.

## Overview

This API server exposes LlamaCPP functionality through standard REST endpoints, making it easy for other applications (like your Director/UE5 system) to generate text using LlamaCPP without directly managing the LlamaCPP process.

## Quick Start

1. **Start LlamaCPP** (if not already running):
    ```bash
    ./kcppctl start
    ```

2. **Start the API Server**:
    ```bash
    ./kcppctl api-server start --host 0.0.0.0 --port 8080
    ```

3. **Test the API**:
    ```bash
    curl -X POST http://localhost:8080/api/v1/generate \
      -H "Content-Type: application/json" \
      -d '{"prompt": "Hello, world!", "max_tokens": 50}'
    ```

## API Endpoints

### POST /api/v1/generate
Generate text using LlamaCPP.

**Request:**
```json
{
  "prompt": "Your prompt here",
  "max_tokens": 150,
  "temperature": 0.8,
  "top_p": 0.9
}
```

**Response:**
```json
{
  "text": "Generated response text",
  "tokens_used": 42,
  "success": true
}
```

### GET /api/v1/models
Get information about available models.

**Response:**
```json
{
  "id": "llamacpp-default",
  "name": "LlamaCPP Model",
  "type": "llm",
  "format": "gguf",
  "status": "ready"
}
```

### GET /health
Check the health status of both the API server and KoboldCPP.

**Response:**
```json
{
  "status": "healthy",
  "api_server": "running",
  "llamacpp": "running",
  "timestamp": 1699123456,
  "version": "1.0.0"
}
```

### GET /api/v1/version
Get version information.

**Response:**
```json
{
  "version": "1.0.0",
  "name": "LlamaCPP API Server",
  "description": "Simple HTTP API wrapper for LlamaCPP",
  "llamacpp_version": "1.0.0"
}
```

## CLI Commands

### Start API Server
```bash
kcppctl api-server start [options]
```

**Options:**
- `--host <host>` - Host to bind to (default: 127.0.0.1)
- `--port <port>` - Port to bind to (default: 8080)

### Stop API Server
```bash
kcppctl api-server stop
```

## Configuration

The API server uses these default settings:
- **Host:** `0.0.0.0` (binds to all interfaces)
- **Port:** `8080`
- **LlamaCPP Host:** `127.0.0.1`
- **LlamaCPP Port:** `8080`

## Integration Example

Here's how your Director/UE5 system can integrate with this API:

```python
import requests

def generate_text(prompt, max_tokens=150):
    response = requests.post('http://localhost:8080/api/v1/generate', json={
        'prompt': prompt,
        'max_tokens': max_tokens,
        'temperature': 0.8
    })
    
    if response.status_code == 200:
        data = response.json()
        return data['text']
    else:
        raise Exception(f"API request failed: {response.status_code}")

# Usage
result = generate_text("Tell me about the ancient forest")
print(result)
```

## Architecture

```
UE5/Director System
        ↓ (HTTP API calls)
   API Server (this project)
        ↓ (HTTP API calls)
   LlamaCPP Process
        ↓ (local inference)
   GGUF Model Files
```

## Benefits

- **Simple Integration:** Standard HTTP API that any application can call
- **Process Management:** Handles LlamaCPP lifecycle automatically
- **Health Monitoring:** Built-in health checks for both services
- **Standard Endpoints:** Compatible with common LLM API patterns
- **Reliable:** Robust error handling and timeouts

## Troubleshooting

1. **API Server won't start:**
    - Check if port 8080 is already in use
    - Ensure LlamaCPP is running on port 8080

2. **Generation requests fail:**
    - Verify LlamaCPP is responding to requests
    - Check the `/health` endpoint for status

3. **Slow responses:**
    - Increase LlamaCPP timeouts if needed
    - Check system resource usage

## Development

To build from source:
```bash
mkdir build && cd build
cmake ..
make
```

To run tests:
```bash
./kcppctl smoke --host localhost --port 8080