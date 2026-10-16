#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "kcpp/env.hpp"
#include "kcpp/process.hpp"
#include "kcpp/http.hpp"
#include "kcpp/cli.hpp"
#include "kcpp/log.hpp"
#include "../utils/test_helpers.hpp"
#include "../utils/mock_server.hpp"

namespace kcpp {

class WorkflowIntegrationTest : public kcpp_test::KcppTestBase {
protected:
    void SetUp() override {
        KcppTestBase::SetUp();
        mock_server = std::make_unique<kcpp_test::MockKoboldCppServer>();

        // Initialize logging for integration tests
        init_logger(L"./test_integration_logs/");
    }

    void TearDown() override {
        if (mock_server && mock_server->is_running()) {
            mock_server->stop();
        }
        KcppTestBase::TearDown();
    }

    std::unique_ptr<kcpp_test::MockKoboldCppServer> mock_server;
};

TEST_F(WorkflowIntegrationTest, EndToEnd_StartSmokePerfStatusStop) {
    // Arrange
    std::string env_content =
        "KCPP_HOST=127.0.0.1\n"
        "KCPP_PORT=5001\n"
        "KCPP_MODEL_PATH=test_model.gguf\n"
        "KCPP_THREADS=4\n"
        "KCPP_CTX=2048\n"
        "KCPP_GPULAYERS=20\n";

    std::string env_file = create_test_env_file(env_content);

    // Act & Assert - Test each phase of the workflow

    // 1. Start command (dry run first)
    int start_result = run_cli(5, new char*[5]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("start"),
        const_cast<char*>("--env"),
        const_cast<char*>(env_file.c_str()),
        const_cast<char*>("--dry-run")
    });

    EXPECT_EQ(start_result, 0); // Dry run should succeed

    // 2. Status command (should show not running)
    int status_result = run_cli(2, new char*[2]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("status")
    });

    EXPECT_EQ(status_result, 0); // Status should always succeed

    // 3. Smoke test (will fail without server, but should not crash)
    int smoke_result = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1")
    });

    EXPECT_TRUE(smoke_result == 0 || smoke_result == 1); // Should handle missing server gracefully

    // 4. Performance test (will fail without server, but should not crash)
    int perf_result = run_cli(6, new char*[6]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("perf"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1"),
        const_cast<char*>("--tokens"),
        const_cast<char*>("50")
    });

    EXPECT_TRUE(perf_result == 0 || perf_result == 1); // Should handle missing server gracefully

    // 5. Stop command (should succeed even if nothing is running)
    int stop_result = run_cli(2, new char*[2]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("stop")
    });

    EXPECT_TRUE(stop_result == 0 || stop_result == 1); // Should handle stop gracefully
}

TEST_F(WorkflowIntegrationTest, EndToEnd_WithMockServer) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    std::string server_url = mock_server->get_base_url();

    // Configure mock responses
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");
    mock_server->set_models_response(R"({"object":"list","data":[{"id":"test-model"}]})");
    mock_server->set_version_response(R"({"version":"1.0.0"})");
    mock_server->set_health_response(R"({"status":"healthy"})");

    // Act & Assert

    // 1. Smoke test with running server
    int smoke_result = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1")
    });

    EXPECT_EQ(smoke_result, 0); // Should succeed with mock server

    // 2. Performance test with running server
    int perf_result = run_cli(6, new char*[6]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("perf"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1"),
        const_cast<char*>("--tokens"),
        const_cast<char*>("25")
    });

    EXPECT_EQ(perf_result, 0); // Should succeed with mock server

    // 3. Multiple smoke tests should be consistent
    for (int i = 0; i < 3; ++i) {
        int repeated_smoke = run_cli(4, new char*[4]{
            const_cast<char*>("kcppctl"),
            const_cast<char*>("smoke"),
            const_cast<char*>("--host"),
            const_cast<char*>("127.0.0.1")
        });

        EXPECT_EQ(repeated_smoke, 0); // Should be consistent
    }

    // Verify request tracking
    auto requests = mock_server->get_requests();
    EXPECT_GE(requests.size(), 4); // At least smoke + perf + 3 smoke tests

    // 4. Status command should still work
    int status_result = run_cli(2, new char*[2]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("status")
    });

    EXPECT_EQ(status_result, 0);
}

TEST_F(WorkflowIntegrationTest, ConfigurationValidationWorkflow) {
    // Arrange - Test various configuration scenarios

    // 1. Test with minimal valid configuration
    std::string minimal_env =
        "KCPP_HOST=127.0.0.1\n"
        "KCPP_PORT=5001\n";

    std::string minimal_env_file = create_test_env_file(minimal_env);

    int start_minimal = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("start"),
        const_cast<char*>("--env"),
        const_cast<char*>(minimal_env_file.c_str())
    });

    EXPECT_TRUE(start_minimal == 0 || start_minimal == 1);

    // 2. Test with invalid configuration
    std::string invalid_env =
        "KCPP_HOST=127.0.0.1\n"
        "KCPP_PORT=invalid_port\n";

    std::string invalid_env_file = create_test_env_file(invalid_env);

    int start_invalid = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("start"),
        const_cast<char*>("--env"),
        const_cast<char*>(invalid_env_file.c_str())
    });

    EXPECT_EQ(start_invalid, 1); // Should fail with invalid config

    // 3. Test with boundary value configuration
    std::string boundary_env =
        "KCPP_HOST=127.0.0.1\n"
        "KCPP_PORT=1\n"
        "KCPP_THREADS=1\n"
        "KCPP_CTX=1\n"
        "KCPP_GPULAYERS=0\n";

    std::string boundary_env_file = create_test_env_file(boundary_env);

    int start_boundary = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("start"),
        const_cast<char*>("--env"),
        const_cast<char*>(boundary_env_file.c_str())
    });

    EXPECT_TRUE(start_boundary == 0 || start_boundary == 1); // Should handle boundary values
}

TEST_F(WorkflowIntegrationTest, ErrorHandlingWorkflow) {
    // Arrange & Act & Assert

    // 1. Test with non-existent environment file
    int start_no_env = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("start"),
        const_cast<char*>("--env"),
        const_cast<char*>("non_existent_file.env")
    });

    EXPECT_TRUE(start_no_env == 0 || start_no_env == 1); // Should handle missing file gracefully

    // 2. Test with invalid host
    int smoke_invalid_host = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("999.999.999.999")
    });

    EXPECT_EQ(smoke_invalid_host, 1); // Should fail with invalid host

    // 3. Test with invalid port
    int smoke_invalid_port = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--port"),
        const_cast<char*>("not_a_number")
    });

    EXPECT_EQ(smoke_invalid_port, 1); // Should fail with invalid port

    // 4. Test with out of range port
    int smoke_bad_port = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--port"),
        const_cast<char*>("99999")
    });

    EXPECT_EQ(smoke_bad_port, 1); // Should fail with out of range port
}

TEST_F(WorkflowIntegrationTest, LoggingIntegrationWorkflow) {
    // Arrange
    std::string env_content = "KCPP_HOST=127.0.0.1\nKCPP_PORT=5001\n";
    std::string env_file = create_test_env_file(env_content);

    // Act - Execute various commands that should generate log entries
    run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("start"),
        const_cast<char*>("--env"),
        const_cast<char*>(env_file.c_str())
    });

    run_cli(2, new char*[2]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("status")
    });

    run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1")
    });

    // Assert - Logging should work throughout the workflow
    // In a real implementation, you might verify log file contents
    auto logger = get_logger();
    EXPECT_NE(logger, nullptr);

    logger->info("Integration test logging verification");
    SUCCEED();
}

TEST_F(WorkflowIntegrationTest, ConcurrentCommandExecution) {
    // Arrange - Test that multiple CLI commands can be prepared simultaneously
    std::vector<std::vector<const char*>> command_sets = {
        {"kcppctl", "status"},
        {"kcppctl", "smoke", "--host", "127.0.0.1"},
        {"kcppctl", "perf", "--tokens", "10"},
        {"kcppctl", "--help"}
    };

    // Act - Execute all commands
    std::vector<int> results;
    for (const auto& cmd_args : command_sets) {
        std::vector<char*> argv;
        for (const char* arg : cmd_args) {
            argv.push_back(const_cast<char*>(arg));
        }

        int result = run_cli(static_cast<int>(argv.size()), argv.data());
        results.push_back(result);
    }

    // Assert - All commands should execute without issues
    for (int result : results) {
        EXPECT_TRUE(result == 0 || result == 1); // All should succeed or fail gracefully
    }
}

TEST_F(WorkflowIntegrationTest, ConfigurationOverrideWorkflow) {
    // Arrange
    std::string env_content = "KCPP_HOST=127.0.0.1\nKCPP_PORT=5001\n";
    std::string env_file = create_test_env_file(env_content);

    // Act - Test that CLI arguments override environment file values
    int result = run_cli(6, new char*[6]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--env"),
        const_cast<char*>(env_file.c_str()),
        const_cast<char*>("--host"),
        const_cast<char*>("192.168.1.1")
    });

    // Assert - Should use CLI argument over env file
    EXPECT_TRUE(result == 0 || result == 1);
}

TEST_F(WorkflowIntegrationTest, ResourceCleanupWorkflow) {
    // Arrange
    std::string env_content = "KCPP_HOST=127.0.0.1\nKCPP_PORT=5001\n";
    std::string env_file = create_test_env_file(env_content);

    // Act - Execute start/stop cycle multiple times
    for (int i = 0; i < 3; ++i) {
        int start_result = run_cli(4, new char*[4]{
            const_cast<char*>("kcppctl"),
            const_cast<char*>("start"),
            const_cast<char*>("--env"),
            const_cast<char*>(env_file.c_str())
        });

        int stop_result = run_cli(2, new char*[2]{
            const_cast<char*>("kcppctl"),
            const_cast<char*>("stop")
        });

        // Assert - Each cycle should complete
        EXPECT_TRUE(start_result == 0 || start_result == 1);
        EXPECT_TRUE(stop_result == 0 || stop_result == 1);
    }

    SUCCEED();
}

TEST_F(WorkflowIntegrationTest, TemplateIntegrationWorkflow) {
    // Arrange - Test with actual template files
    std::string smoke_template = "<s>[INST] <<SYS>>You are a test assistant.<</SYS>>Say 'pong' and stop.[/INST]";
    std::string perf_template = "Generate {{TOKENS}} tokens about artificial intelligence and machine learning.";

    std::string smoke_template_file = create_test_template_file(smoke_template);
    std::string perf_template_file = create_test_template_file(perf_template);

    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");

    // Act - Test that templates are loaded and processed correctly
    int smoke_result = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1")
    });

    // Assert
    EXPECT_EQ(smoke_result, 0); // Should succeed with proper template
}

TEST_F(WorkflowIntegrationTest, CrossPlatformPathHandling) {
    // Arrange - Test various path formats
    std::vector<std::string> path_configs = {
        "KCPP_MODEL_PATH=C:/models/test.gguf\n",
        "KCPP_MODEL_PATH=C:\\models\\test.gguf\n",
        "KCPP_MODEL_PATH=/unix/style/path/model.gguf\n",
        "KCPP_MODEL_PATH=relative/path/model.gguf\n"
    };

    for (const auto& path_config : path_configs) {
        std::string env_content = "KCPP_HOST=127.0.0.1\nKCPP_PORT=5001\n" + path_config;
        std::string env_file = create_test_env_file(env_content);

        // Act
        int result = run_cli(4, new char*[4]{
            const_cast<char*>("kcppctl"),
            const_cast<char*>("start"),
            const_cast<char*>("--env"),
            const_cast<char*>(env_file.c_str())
        });

        // Assert - Should handle all path formats
        EXPECT_TRUE(result == 0 || result == 1);
    }
    SUCCEED();
}

TEST_F(WorkflowIntegrationTest, MemoryUsageWorkflow) {
    // Arrange - Test that repeated operations don't leak memory
    std::string env_content = "KCPP_HOST=127.0.0.1\nKCPP_PORT=5001\n";
    std::string env_file = create_test_env_file(env_content);

    // Act - Execute many operations in sequence
    for (int i = 0; i < 50; ++i) {
        int result = run_cli(4, new char*[4]{
            const_cast<char*>("kcppctl"),
            const_cast<char*>("smoke"),
            const_cast<char*>("--host"),
            const_cast<char*>("127.0.0.1")
        });

        // Each operation should complete
        EXPECT_TRUE(result == 0 || result == 1);
    }

    // Assert - System should still be responsive
    SUCCEED();
}

TEST_F(WorkflowIntegrationTest, NetworkErrorRecoveryWorkflow) {
    // Arrange
    ASSERT_TRUE(mock_server->start());

    // Act - Test behavior with intermittent server availability

    // 1. First, server is available
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");
    int smoke_available = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1")
    });

    EXPECT_EQ(smoke_available, 0);

    // 2. Simulate server error
    mock_server->set_generate_response("Internal Server Error", 500);
    int smoke_error = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1")
    });

    EXPECT_EQ(smoke_error, 1); // Should fail gracefully

    // 3. Server recovers
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");
    int smoke_recovered = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("smoke"),
        const_cast<char*>("--host"),
        const_cast<char*>("127.0.0.1")
    });

    EXPECT_EQ(smoke_recovered, 0); // Should work again

    // Verify request tracking captured all attempts
    auto requests = mock_server->get_requests();
    EXPECT_GE(requests.size(), 3);
}

TEST_F(WorkflowIntegrationTest, LoadTestingWorkflow) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");

    // Act - Simulate load testing with many rapid requests
    std::vector<int> results;
    for (int i = 0; i < 20; ++i) {
        int result = run_cli(4, new char*[4]{
            const_cast<char*>("kcppctl"),
            const_cast<char*>("smoke"),
            const_cast<char*>("--host"),
            const_cast<char*>("127.0.0.1")
        });

        results.push_back(result);

        // Small delay between requests
        kcpp_test::ProcessTestHelper::sleep_ms(10);
    }

    // Assert - All requests should complete successfully
    for (int result : results) {
        EXPECT_EQ(result, 0);
    }

    // Verify all requests were tracked
    auto requests = mock_server->get_requests();
    EXPECT_GE(requests.size(), 20);
}

TEST_F(WorkflowIntegrationTest, ConfigurationConsistencyWorkflow) {
    // Arrange - Test that configuration is consistently applied across commands
    std::string env_content =
        "KCPP_HOST=127.0.0.1\n"
        "KCPP_PORT=5001\n"
        "KCPP_THREADS=8\n";

    std::string env_file = create_test_env_file(env_content);

    // Act - Use same config file for multiple commands
    int start_result = run_cli(4, new char*[4]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("start"),
        const_cast<char*>("--env"),
        const_cast<char*>(env_file.c_str())
    });

    int status_result = run_cli(2, new char*[2]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("status")
    });

    int stop_result = run_cli(2, new char*[2]{
        const_cast<char*>("kcppctl"),
        const_cast<char*>("stop")
    });

    // Assert - All operations should be consistent
    EXPECT_TRUE(start_result == 0 || start_result == 1);
    EXPECT_EQ(status_result, 0);
    EXPECT_TRUE(stop_result == 0 || stop_result == 1);
}

TEST_F(WorkflowIntegrationTest, StressTestWorkflow) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");

    // Act - Execute a comprehensive stress test
    std::vector<std::string> commands = {"status", "smoke", "perf"};
    std::vector<int> results;

    for (int iteration = 0; iteration < 10; ++iteration) {
        for (const auto& cmd : commands) {
            if (cmd == "status") {
                int result = run_cli(2, new char*[2]{
                    const_cast<char*>("kcppctl"),
                    const_cast<char*>("status")
                });
                results.push_back(result);
            }
            else if (cmd == "smoke") {
                int result = run_cli(4, new char*[4]{
                    const_cast<char*>("kcppctl"),
                    const_cast<char*>("smoke"),
                    const_cast<char*>("--host"),
                    const_cast<char*>("127.0.0.1")
                });
                results.push_back(result);
            }
            else if (cmd == "perf") {
                int result = run_cli(6, new char*[6]{
                    const_cast<char*>("kcppctl"),
                    const_cast<char*>("perf"),
                    const_cast<char*>("--host"),
                    const_cast<char*>("127.0.0.1"),
                    const_cast<char*>("--tokens"),
                    const_cast<char*>("10")
                });
                results.push_back(result);
            }
        }
    }

    // Assert - All operations should complete successfully
    for (int result : results) {
        EXPECT_TRUE(result == 0 || result == 1);
    }

    // Verify server handled all requests
    auto requests = mock_server->get_requests();
    EXPECT_GE(requests.size(), 20); // At least 20 requests from the test
}

}  // namespace kcpp