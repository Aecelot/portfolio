# Technical Design Document

## System Architecture

The LlamaCPP Control Tool (kcppctl) is built as a modular C++ application that manages LlamaCPP processes and provides an HTTP API wrapper. It follows a layered architecture with clear separation of concerns: CLI interface, process management, HTTP server, and client interactions.

### High-Level Architecture Diagram

```
External Applications (e.g., UE5, Python Scripts)
         ↓ (HTTP Requests)
    API Server (kcppctl)
         ↓ (HTTP/Process Calls)
    LlamaCPP Runtime (llama-cli.exe or llama-server.exe)
         ↓ (Inference)
    GGUF Model Files
```

- **CLI Layer**: Handles command-line parsing and user interactions.
- **Process Management Layer**: Manages LlamaCPP process lifecycle.
- **API Layer**: HTTP server exposing REST endpoints.
- **Client Layer**: HTTP client for forwarding requests and testing.

## Key Components

### 1. Core Modules
- **src/main.cpp**: Entry point, initializes CLI and dispatches commands.
- **src/cli.cpp**: Command-line argument parsing using a custom CLI framework.
- **src/api_server.cpp**: HTTP server implementation using httplib, handling endpoints and forwarding to LlamaCPP.
- **src/http.cpp**: Utility functions for smoke tests and performance benchmarks.
- **src/process_windows.cpp**: Windows-specific process management for starting/stopping LlamaCPP.
- **src/env.cpp**: Environment variable loading and configuration parsing.
- **src/log.cpp**: Logging system using spdlog for structured output.

### 2. Header Files (include/kcpp/)
- **api_server.hpp**: Defines APIServer class, endpoints, and session structures (planned).
- **cli.hpp**: CLI command definitions and options.
- **env.hpp**: Environment configuration structures.
- **http.hpp**: HTTP utility functions and result structs.
- **log.hpp**: Logging macros and setup.
- **process.hpp**: Process management interfaces.
- **version.hpp**: Version constants.

### 3. API Endpoints Implementation
- **POST /api/v1/generate**: Parses JSON request, extracts prompt and params, forwards to LlamaCPP's /completion endpoint via cpr, returns generated text.
- **GET /api/v1/models**: Returns static model info.
- **GET /health**: Checks LlamaCPP health by sending GET to /health.
- **GET /api/v1/version**: Returns version details.

### 4. Process Management
- **Starting LlamaCPP**: Uses Windows APIs to launch llama-cli.exe or llama-server.exe with specified arguments (e.g., model path, GPU layers).
- **Stopping**: Terminates processes gracefully via Windows process handles.
- **Monitoring**: Tracks process status and health via HTTP checks.

### 5. Configuration System
- **File-Based**: Loads from config/env.* files (e.g., env.local, env.ryzen-ai-optimized).
- **Variables**: Parsed into structs for LLM_HOST, LLM_PORT, LLM_MODEL_PATH, etc.
- **Profiles**: Predefined configs for different hardware (high-end, low-end, Ryzen AI).

## Dependencies and Technologies

### External Libraries
- **httplib**: Lightweight HTTP server library for API endpoints.
- **cpr**: Modern C++ HTTP client for requests to LlamaCPP.
- **nlohmann/json**: JSON parsing and serialization.
- **spdlog**: Logging framework with rotation and multiple sinks.
- **fmt**: String formatting (used by spdlog).
- **vcpkg**: Package manager for dependency resolution.

### Runtime Dependencies
- **LlamaCPP Binaries**: Pre-built executables (llama-cli.exe, llama-server.exe) in llamacpp/bin/.
- **GGUF Models**: User-downloaded model files in models/ directory.

### Build System
- **CMake**: Build configuration with toolchain file for vcpkg.
- **Visual Studio 2022**: MSVC compiler for Windows builds.
- **C++17**: Language standard for modern features.

## Code Structure and Patterns

### Design Patterns Used
- **Singleton for Logging**: Global logger instance via get_logger().
- **Factory for Configurations**: Environment loading creates config objects.
- **Observer for Process Monitoring**: HTTP health checks monitor LlamaCPP status.
- **Command Pattern for CLI**: Each command (start, stop, smoke) as a separate handler.

### Threading and Concurrency
- **API Server**: Runs in a background thread for non-blocking HTTP handling.
- **Process Management**: Synchronous for simplicity, with timeouts.
- **Health Checks**: Asynchronous HTTP requests with timeouts.
- **Mutexes**: Used for thread-safe session management (in planned features).

### Error Handling
- **HTTP Errors**: Standardized JSON error responses with status codes.
- **Process Errors**: Logging and graceful termination on failures.
- **Network Errors**: Retry logic in health checks, timeout handling.

## Data Flow

### Text Generation Flow
1. Client sends POST to /api/v1/generate with JSON payload.
2. APIServer parses request, validates fields.
3. Forwards to LlamaCPP /completion via cpr::Post.
4. Parses LlamaCPP response, extracts text and tokens.
5. Returns formatted JSON to client.

### Testing Flow (Smoke Test)
1. CLI triggers smoke_test() in http.cpp.
2. Loads prompt from scripts/smoke_prompt.tpl.
3. Sends POST to /api/v1/generate.
4. Checks response for expected "pong" string.
5. Reports latency and success.

### Configuration Flow
1. CLI or script specifies config file (e.g., config/env.local).
2. env.cpp loads file, parses into EnvConfig struct.
3. Values used to build LlamaCPP command arguments.

## Hardware Optimization Details

### GPU Acceleration
- **CUDA (NVIDIA)**: Via LLM_GPULAYERS, offloads layers to GPU.
- **Vulkan**: Used in llama.cpp binaries for cross-platform GPU support.
- **OpenCL (AMD)**: For Ryzen AI, with LLM_USECLBLAST flags.

### Performance Tuning
- **Context Size (LLM_CTX)**: Balances memory and coherence (e.g., 8192 for large contexts).
- **Threads (LLM_THREADS)**: CPU threads for inference (e.g., 12 for Ryzen AI).
- **Batch Size**: Optimizes for VRAM (e.g., LLM_BATCH_SIZE=1024).

## Security and Deployment

### Security Considerations
- **Localhost Access**: API binds to 127.0.0.1 by default; no authentication.
- **Firewall**: Relies on Windows firewall for external protection.
- **Data Privacy**: No data persistence; models and configs are local.

### Deployment
- **Standalone Executable**: Built as kcppctl.exe via CMake.
- **Scripts**: PowerShell wrappers (start-llama-server.ps1) for easy execution.
- **Environment**: Windows 11, Visual Studio, vcpkg for reproducibility.

## Testing Strategy

### Unit Tests
- **CLI Parsing**: Test argument handling in cli.cpp.
- **Environment Loading**: Verify config parsing in env.cpp.
- **API Handlers**: Mock HTTP requests for endpoint testing.

### Integration Tests
- **End-to-End Flow**: Start server, send requests, verify responses.
- **Process Lifecycle**: Test start/stop and health monitoring.
- **Performance**: Automated benchmarks for TPS validation.

### Tools
- **Google Test**: For unit tests (planned in tests/ directory).
- **Manual Testing**: Via CLI commands and cURL for API.

## Future Technical Enhancements

### Stateful Sessions (As Per Plan)
- **Session Storage**: In-memory map with mutex for concurrency.
- **Cleanup Thread**: Background task for expired sessions.
- **Prefix Caching**: Leverages LlamaCPP's optimization for repeated prompts.

### Scalability
- **Multiple Instances**: Support for running multiple LlamaCPP processes.
- **Load Balancing**: Distribute requests across backends.

### Monitoring
- **Metrics**: Add Prometheus endpoints for TPS, memory usage.
- **Logging Levels**: Configurable verbosity for production.

## Code Quality and Best Practices

### Standards
- **C++17 Features**: Smart pointers, optional, string_view for efficiency.
- **RAII**: Resource management via destructors.
- **Const Correctness**: Immutable data where possible.
- **Documentation**: Comments in headers and complex functions.

### Performance
- **Minimal Overhead**: Thin wrapper around LlamaCPP.
- **Efficient Serialization**: JSON parsing only for necessary data.
- **Memory Management**: Avoid leaks in long-running processes.

This technical design ensures the system is maintainable, performant, and extensible for local LLM management.