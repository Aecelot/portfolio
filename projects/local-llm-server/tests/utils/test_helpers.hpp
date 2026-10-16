#pragma once

#include <string>
#include <vector>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <gmock/gmock.h>

namespace kcpp_test {

// Temporary file/directory management
class TempFile {
public:
    explicit TempFile(const std::string& content = "");
    explicit TempFile(const std::vector<std::string>& lines);
    ~TempFile();

    std::string get_path() const { return path_; }
    void write_content(const std::string& content);
    std::string read_content() const;

private:
    std::string path_;
};

class TempDir {
public:
    explicit TempDir(const std::string& name = "test_dir_");
    ~TempDir();

    std::string get_path() const { return path_; }
    std::string create_file(const std::string& filename, const std::string& content = "");
    std::string create_subdir(const std::string& dirname);

private:
    std::string path_;
};

// Test fixture base class with common setup
class KcppTestBase : public ::testing::Test {
protected:
    void SetUp() override;
    void TearDown() override;

    // Common test data
    static constexpr const char* TEST_HOST = "127.0.0.1";
    static constexpr int TEST_PORT = 5001;
    static constexpr int TEST_THREADS = 4;
    static constexpr int TEST_CTX = 2048;
    static constexpr int TEST_GPU_LAYERS = 20;

    // Helper methods
    std::string create_test_env_file(const std::string& content = "");
    std::string create_test_template_file(const std::string& content);
};

// Mock HTTP server for testing HTTP client
class MockHttpServer {
public:
    MockHttpServer();
    ~MockHttpServer();

    bool start(int port = 0);  // 0 = auto-select port
    void stop();
    int get_port() const { return port_; }
    std::string get_base_url() const;

    // Response configuration
    void set_response(const std::string& response_body, int status_code = 200);
    void set_delay(std::chrono::milliseconds delay);

private:
    int port_ = 0;
    void* server_handle_ = nullptr;  // Would use httplib server in real implementation
    std::string response_body_ = R"({"results":[{"text":"test response"}]})";
    int status_code_ = 200;
    std::chrono::milliseconds delay_{0};
};

// String manipulation helpers
std::vector<std::string> split_string(const std::string& str, char delimiter);
std::string trim_string(const std::string& str);
std::string join_strings(const std::vector<std::string>& strings, const std::string& delimiter);

// Environment variable helpers for testing
class EnvVarGuard {
public:
    explicit EnvVarGuard(const std::string& name, const std::string& value);
    ~EnvVarGuard();

private:
    std::string name_;
    std::string original_value_;
};

// Process testing helpers
class ProcessTestHelper {
public:
    static bool is_process_running(int pid);
    static int get_current_process_id();
    static void sleep_ms(int milliseconds);
};

// Test data generators
std::string generate_random_string(size_t length);
int generate_random_int(int min, int max);

}  // namespace kcpp_test