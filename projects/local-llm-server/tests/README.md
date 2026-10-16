# Comprehensive Test Suite

This directory contains a complete test suite for the kcppctl project, providing comprehensive coverage of all system components.

## Test Structure

```
tests/
├── unit/                 # Unit tests for individual modules
│   ├── test_env.cpp     # Environment configuration tests
│   ├── test_process.cpp # Process management tests
│   ├── test_http.cpp    # HTTP client tests
│   ├── test_cli.cpp     # CLI interface tests
│   └── test_log.cpp     # Logging system tests
├── integration/         # End-to-end workflow tests
│   └── test_workflows.cpp
└── utils/               # Test utilities and helpers
    ├── test_helpers.hpp # Test framework utilities
    ├── test_helpers.cpp # Implementation
    ├── mock_server.hpp  # Mock HTTP server for testing
    └── mock_server.cpp  # Implementation
```

## Test Coverage

### Unit Tests

#### Environment Configuration (`test_env.cpp`)
- **Parsing Logic**: Valid KEY=VALUE pairs, whitespace handling, comments/empty lines
- **Data Validation**: Integer parsing, boundary values, invalid formats
- **File I/O**: Missing files, UTF-8/UTF-16 paths, permission errors
- **Configuration**: Port range validation, thread/context validation, GPU layers
- **Edge Cases**: Unicode paths, very large files, malformed content

#### Process Management (`test_process.cpp`)
- **Process Creation**: Valid executables, arguments, working directories
- **PID Management**: PID file creation/reading, cleanup, concurrent access
- **Process State**: Running detection, exit code handling, invalid PIDs
- **Termination**: Graceful termination, force termination, timeout handling
- **Error Handling**: Invalid executables, resource exhaustion, system errors

#### HTTP Client (`test_http.cpp`)
- **API Testing**: Valid responses, HTTP errors, JSON parsing, timeouts
- **Template Processing**: File loading, token replacement, malformed templates
- **Response Validation**: Pong detection, result structure, empty responses
- **Performance Measurement**: Latency calculation, token counting, throughput
- **Network Simulation**: Connection failures, delays, intermittent connectivity

#### CLI Interface (`test_cli.cpp`)
- **Argument Parsing**: Flags, options with values, mixed arguments, validation
- **Command Routing**: All command types, subcommands, unknown commands
- **Command Execution**: Start/stop/status/smoke/perf operations
- **Error Handling**: Invalid arguments, missing values, malformed input
- **Output Formatting**: Success/error messages, help text, status display

#### Logging System (`test_log.cpp`)
- **Initialization**: Valid paths, directory creation, Unicode handling
- **File Management**: Rotating files, size limits, concurrent access
- **Log Levels**: Info/warn/error levels, pattern formatting
- **Error Recovery**: Fallback to console, permission errors, disk space
- **Content Handling**: Special characters, binary data, structured logging

### Integration Tests

#### End-to-End Workflows (`test_workflows.cpp`)
- **Complete Workflow**: Start → Smoke → Perf → Status → Stop cycle
- **Error Recovery**: Network failures, configuration issues, resource cleanup
- **Load Testing**: Concurrent operations, stress testing, memory usage
- **Configuration Integration**: Environment files, CLI overrides, validation
- **Cross-Module Testing**: Component interaction, state consistency

## Running Tests

### Prerequisites

Ensure all dependencies are installed:

```powershell
.\vcpkg\vcpkg.exe install
```

### Build and Run All Tests

```bash
# Configure CMake with tests enabled
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release

# Build the test executable
cmake --build build --target kcppctl_tests --config Release

# Run all tests
ctest --build-config Release -V

# Or run directly
.\build\kcppctl_tests.exe
```

### Run Specific Test Suites

```bash
# Run only unit tests
.\build\kcppctl_tests.exe --gtest_filter="*Unit*"

# Run only integration tests
.\build\kcppctl_tests.exe --gtest_filter="*Integration*"

# Run specific test case
.\build\kcppctl_tests.exe --gtest_filter="EnvTest.LoadEnv_WithValidFile_ShouldParseAllValues"
```

### Run Tests with Coverage

```bash
# Generate coverage report (if supported)
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug -DCOVERAGE=ON
cmake --build build --target kcppctl_tests --config Debug
ctest --build-config Debug

# Coverage analysis would require additional tools
```

## Test Utilities

### Mock HTTP Server

The test suite includes a mock HTTP server (`MockKoboldCppServer`) that simulates KoboldCpp API responses:

```cpp
// In your test
auto mock_server = std::make_unique<kcpp_test::MockKoboldCppServer>();
ASSERT_TRUE(mock_server->start());

// Configure responses
mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");

// Test your code
auto result = smoke_test("127.0.0.1", mock_server->get_port());
```

### Test Helpers

Common utilities for test setup and validation:

```cpp
// Temporary files and directories
kcpp_test::TempFile temp_file("test content");
kcpp_test::TempDir temp_dir("test_prefix_");

// Environment variable management
kcpp_test::EnvVarGuard env_guard("TEST_VAR", "test_value");

// Test data generation
std::string random_data = kcpp_test::generate_random_string(100);
```

## Test Data and Fixtures

### Environment Files
Tests use temporary environment files with various configurations:

```env
LLM_HOST=127.0.0.1
LLM_PORT=5001
LLM_MODEL_PATH=test_model.gguf
LLM_THREADS=8
LLM_CTX=4096
LLM_GPULAYERS=35
```

### Template Files
Tests create temporary prompt templates:

```text
<s>[INST] <<SYS>>You are a test assistant.<</SYS>>Say 'pong' and stop.[/INST]
```

### Mock Responses
Tests configure realistic API responses:

```json
{
  "results": [
    {
      "text": "pong"
    }
  ]
}
```

## Adding New Tests

### Unit Test Structure

```cpp
#include <gtest/gtest.h>
#include "kcpp/your_module.hpp"

namespace kcpp {

class YourModuleTest : public kcpp_test::KcppTestBase {
protected:
  void SetUp() override {
    KcppTestBase::SetUp();
    // Test-specific setup
  }

  void TearDown() override {
    KcppTestBase::TearDown();
    // Test-specific cleanup
  }
};

TEST_F(YourModuleTest, TestCaseName_ShouldExpectedBehavior) {
  // Arrange
  // Act
  // Assert
}

}  // namespace kcpp
```

### Integration Test Structure

```cpp
TEST_F(WorkflowIntegrationTest, FeatureWorkflow_ShouldWorkEndToEnd) {
  // Arrange - Set up complete system state
  // Act - Execute full workflow
  // Assert - Verify end-to-end behavior
}
```

## Test Best Practices

### Isolation
- Each test should be independent
- Use temporary files and directories
- Clean up resources in TearDown()

### Mocking
- Use MockKoboldCppServer for HTTP testing
- Mock external dependencies when possible
- Avoid testing third-party APIs directly

### Coverage
- Test both success and failure paths
- Include boundary value testing
- Test edge cases and error conditions

### Performance
- Keep tests fast for quick feedback
- Use appropriate timeouts for network tests
- Group related tests in test suites

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    steps:
    - uses: actions/checkout@v2
    - name: Setup vcpkg
      run: vcpkg install
    - name: Configure CMake
      run: cmake -B build -DCMAKE_BUILD_TYPE=Release
    - name: Build tests
      run: cmake --build build --target kcppctl_tests --config Release
    - name: Run tests
      run: ctest --build-config Release
```

## Troubleshooting

### Common Issues

**Tests fail due to missing dependencies:**
```bash
.\vcpkg\vcpkg.exe install --triplet=x64-windows
```

**Tests fail due to file permissions:**
- Ensure write access to test directories
- Check antivirus exclusions for test files

**Network tests timeout:**
- Verify mock server is starting correctly
- Check firewall settings for test ports

**Memory usage in long-running tests:**
- Monitor system resources during test execution
- Use appropriate timeouts to prevent hanging

### Debug Mode

Run tests with additional output for debugging:

```bash
# Verbose test output
ctest --build-config Release -V

# Debug specific test
.\build\kcppctl_tests.exe --gtest_filter="TestName" --gtest_break_on_failure
```

## Test Results and Reporting

### Expected Test Counts
- **Unit Tests**: ~50+ test cases
- **Integration Tests**: ~15+ test cases
- **Total Coverage**: >90% of codebase

### Performance Benchmarks
Integration tests include performance validation:
- HTTP response times < 100ms for smoke tests
- Memory usage stability during load testing
- Process startup/shutdown times < 5 seconds

This comprehensive test suite ensures the reliability, performance, and maintainability of the kcppctl system across all components and integration scenarios.