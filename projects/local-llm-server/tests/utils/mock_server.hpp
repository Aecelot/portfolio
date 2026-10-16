#pragma once

#include <string>
#include <thread>
#include <atomic>
#include <chrono>
#include <httplib.h>

namespace kcpp_test {

// Mock HTTP server for testing API interactions
class MockKoboldCppServer {
public:
    MockKoboldCppServer();
    ~MockKoboldCppServer();

    // Server control
    bool start(int port = 0);  // 0 = auto-select port
    void stop();
    bool is_running() const { return running_; }
    int get_port() const { return port_; }
    std::string get_base_url() const;

    // Response configuration for different endpoints
    void set_generate_response(const std::string& response_text, int status_code = 200);
    void set_models_response(const std::string& models_json, int status_code = 200);
    void set_version_response(const std::string& version_info, int status_code = 200);
    void set_health_response(const std::string& health_status, int status_code = 200);

    // Response delays
    void set_response_delay(std::chrono::milliseconds delay);
    void set_random_delay(int min_ms, int max_ms);

    // Request tracking for verification
    struct RequestInfo {
        std::string method;
        std::string path;
        std::string body;
        std::chrono::system_clock::time_point timestamp;
    };

    std::vector<RequestInfo> get_requests() const;
    void clear_requests();

private:
    void run_server();
    void handle_generate(const httplib::Request& req, httplib::Response& res);
    void handle_models(const httplib::Request& req, httplib::Response& res);
    void handle_version(const httplib::Request& req, httplib::Response& res);
    void handle_health(const httplib::Request& req, httplib::Response& res);

    std::atomic<bool> running_;
    std::atomic<int> port_;
    std::thread server_thread_;

    // Response configurations
    std::string generate_response_text_;
    std::string models_response_;
    std::string version_response_;
    std::string health_response_;
    int generate_status_code_;
    int models_status_code_;
    int version_status_code_;
    int health_status_code_;

    // Delays
    std::chrono::milliseconds response_delay_;
    int min_delay_ms_;
    int max_delay_ms_;

    // Request tracking
    mutable std::mutex requests_mutex_;
    std::vector<RequestInfo> requests_;
};

}  // namespace kcpp_test