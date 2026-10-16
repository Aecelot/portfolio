#include "test_helpers.hpp"
#include <random>
#include <chrono>
#include <Windows.h>

namespace kcpp_test {

// Temporary file implementation
TempFile::TempFile(const std::string& content) {
    // Create a unique temporary file path
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto tm = *std::localtime(&time_t);

    std::ostringstream oss;
    oss << "temp_test_file_" << std::rand() << "_" << time_t << ".tmp";
    path_ = oss.str();

    write_content(content);
}

TempFile::TempFile(const std::vector<std::string>& lines) {
    // Create a unique temporary file path
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);

    std::ostringstream oss;
    oss << "temp_test_file_" << std::rand() << "_" << time_t << ".tmp";
    path_ = oss.str();

    // Write lines to file
    std::ofstream file(path_);
    for (const auto& line : lines) {
        file << line << std::endl;
    }
}

TempFile::~TempFile() {
    if (!path_.empty()) {
        std::filesystem::remove(path_);
    }
}

void TempFile::write_content(const std::string& content) {
    std::ofstream file(path_);
    file << content;
}

std::string TempFile::read_content() const {
    std::ifstream file(path_);
    std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
    return content;
}

// Temporary directory implementation
TempDir::TempDir(const std::string& name) {
    // Create a unique temporary directory path
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);

    std::ostringstream oss;
    oss << name << std::rand() << "_" << time_t;
    path_ = oss.str();

    std::filesystem::create_directory(path_);
}

TempDir::~TempDir() {
    if (!path_.empty()) {
        std::filesystem::remove_all(path_);
    }
}

std::string TempDir::create_file(const std::string& filename, const std::string& content) {
    std::string full_path = path_ + "/" + filename;
    std::ofstream file(full_path);
    file << content;
    return full_path;
}

std::string TempDir::create_subdir(const std::string& dirname) {
    std::string full_path = path_ + "/" + dirname;
    std::filesystem::create_directory(full_path);
    return full_path;
}

// Test base class implementation
void KcppTestBase::SetUp() {
    // Seed random number generator for consistent test results
    std::srand(12345);
}

void KcppTestBase::TearDown() {
    // Clean up any test artifacts if needed
}

// Mock HTTP server implementation
MockHttpServer::MockHttpServer() = default;

MockHttpServer::~MockHttpServer() {
    stop();
}

bool MockHttpServer::start(int port) {
    // Simplified implementation - in a real scenario, would use httplib
    // For now, just simulate starting on a port
    port_ = (port == 0) ? 8080 : port;
    return true;
}

void MockHttpServer::stop() {
    port_ = 0;
}

std::string MockHttpServer::get_base_url() const {
    return "http://127.0.0.1:" + std::to_string(port_);
}

void MockHttpServer::set_response(const std::string& response_body, int status_code) {
    response_body_ = response_body;
    status_code_ = status_code;
}

void MockHttpServer::set_delay(std::chrono::milliseconds delay) {
    delay_ = delay;
}

// String manipulation helpers
std::vector<std::string> split_string(const std::string& str, char delimiter) {
    std::vector<std::string> result;
    std::istringstream iss(str);
    std::string token;

    while (std::getline(iss, token, delimiter)) {
        result.push_back(token);
    }

    return result;
}

std::string trim_string(const std::string& str) {
    std::string result = str;

    // Trim leading whitespace
    result.erase(result.begin(), std::find_if(result.begin(), result.end(), [](unsigned char ch) {
        return !std::isspace(ch);
    }));

    // Trim trailing whitespace
    result.erase(std::find_if(result.rbegin(), result.rend(), [](unsigned char ch) {
        return !std::isspace(ch);
    }).base(), result.end());

    return result;
}

std::string join_strings(const std::vector<std::string>& strings, const std::string& delimiter) {
    if (strings.empty()) {
        return "";
    }

    std::string result = strings[0];
    for (size_t i = 1; i < strings.size(); ++i) {
        result += delimiter + strings[i];
    }

    return result;
}

// Environment variable helpers
EnvVarGuard::EnvVarGuard(const std::string& name, const std::string& value)
    : name_(name) {

    // Get current value
    char* current_value = std::getenv(name_.c_str());
    original_value_ = (current_value != nullptr) ? current_value : "";

    // Set new value
    std::string set_command = "set " + name_ + "=" + value;
    system(set_command.c_str());
}

EnvVarGuard::~EnvVarGuard() {
    // Restore original value
    if (original_value_.empty()) {
        std::string clear_command = "set " + name_ + "=";
        system(clear_command.c_str());
    } else {
        std::string restore_command = "set " + name_ + "=" + original_value_;
        system(restore_command.c_str());
    }
}

// Process testing helpers
bool ProcessTestHelper::is_process_running(int pid) {
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (process == NULL) {
        return false;
    }

    DWORD exitCode;
    bool running = GetExitCodeProcess(process, &exitCode) && exitCode == STILL_ACTIVE;
    CloseHandle(process);
    return running;
}

int ProcessTestHelper::get_current_process_id() {
    return GetCurrentProcessId();
}

void ProcessTestHelper::sleep_ms(int milliseconds) {
    Sleep(milliseconds);
}

// Test data generators
std::string generate_random_string(size_t length) {
    static const char charset[] =
        "0123456789"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz";

    std::string result;
    result.reserve(length);

    for (size_t i = 0; i < length; ++i) {
        result += charset[std::rand() % (sizeof(charset) - 1)];
    }

    return result;
}

int generate_random_int(int min, int max) {
    return min + (std::rand() % (max - min + 1));
}

// Helper methods for KcppTestBase
std::string KcppTestBase::create_test_env_file(const std::string& content) {
    TempFile temp_file(content.empty() ?
        "LLM_HOST=127.0.0.1\nLLM_PORT=5001\nLLM_MODEL_PATH=test.gguf" :
        content);

    return temp_file.get_path();
}

std::string KcppTestBase::create_test_template_file(const std::string& content) {
    TempFile temp_file(content.empty() ?
        "<s>[INST] <<SYS>>You are a test assistant.<</SYS>>{{TOKENS}}[/INST]" :
        content);

    return temp_file.get_path();
}

}  // namespace kcpp_test