#include "mock_server.hpp"
#include <random>
#include <iostream>

namespace kcpp_test {

MockKoboldCppServer::MockKoboldCppServer()
    : running_(false)
    , port_(0)
    , generate_response_text_(R"({"results":[{"text":"pong"}]})")
    , models_response_(R"({"object":"list","data":[{"id":"test-model","object":"model","created":0,"owned_by":"test"}]})")
    , version_response_(R"({"version":"1.0.0","created":"2024-01-01T00:00:00Z"})")
    , health_response_(R"({"status":"healthy","timestamp":"2024-01-01T00:00:00Z"})")
    , generate_status_code_(200)
    , models_status_code_(200)
    , version_status_code_(200)
    , health_status_code_(200)
    , response_delay_(0)
    , min_delay_ms_(0)
    , max_delay_ms_(0) {
}

MockKoboldCppServer::~MockKoboldCppServer() {
    stop();
}

bool MockKoboldCppServer::start(int port) {
    if (running_) {
        return false;
    }

    port_ = port;
    running_ = true;

    server_thread_ = std::thread(&MockKoboldCppServer::run_server, this);

    // Wait a bit for server to start
    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    return running_;
}

void MockKoboldCppServer::stop() {
    if (!running_) {
        return;
    }

    running_ = false;

    if (server_thread_.joinable()) {
        server_thread_.join();
    }

    port_ = 0;
}

std::string MockKoboldCppServer::get_base_url() const {
    return "http://127.0.0.1:" + std::to_string(port_);
}

void MockKoboldCppServer::set_generate_response(const std::string& response_text, int status_code) {
    generate_response_text_ = response_text;
    generate_status_code_ = status_code;
}

void MockKoboldCppServer::set_models_response(const std::string& models_json, int status_code) {
    models_response_ = models_json;
    models_status_code_ = status_code;
}

void MockKoboldCppServer::set_version_response(const std::string& version_info, int status_code) {
    version_response_ = version_info;
    version_status_code_ = status_code;
}

void MockKoboldCppServer::set_health_response(const std::string& health_status, int status_code) {
    health_response_ = health_status;
    health_status_code_ = status_code;
}

void MockKoboldCppServer::set_response_delay(std::chrono::milliseconds delay) {
    response_delay_ = delay;
    min_delay_ms_ = max_delay_ms_ = 0;
}

void MockKoboldCppServer::set_random_delay(int min_ms, int max_ms) {
    min_delay_ms_ = min_ms;
    max_delay_ms_ = max_ms;
    response_delay_ = std::chrono::milliseconds(0);
}

std::vector<MockKoboldCppServer::RequestInfo> MockKoboldCppServer::get_requests() const {
    std::lock_guard<std::mutex> lock(requests_mutex_);
    return requests_;
}

void MockKoboldCppServer::clear_requests() {
    std::lock_guard<std::mutex> lock(requests_mutex_);
    requests_.clear();
}

void MockKoboldCppServer::run_server() {
    httplib::Server server;

    // Set up request tracking
    server.set_post_routing_handler([this](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(requests_mutex_);
        RequestInfo info;
        info.method = req.method;
        info.path = req.path;
        info.body = req.body;
        info.timestamp = std::chrono::system_clock::now();
        requests_.push_back(info);
    });

    // Route handlers
    server.Post("/api/v1/generate", [this](const httplib::Request& req, httplib::Response& res) {
        handle_generate(req, res);
    });

    server.Get("/api/v1/models", [this](const httplib::Request& req, httplib::Response& res) {
        handle_models(req, res);
    });

    server.Get("/api/v1/version", [this](const httplib::Request& req, httplib::Response& res) {
        handle_version(req, res);
    });

    server.Get("/health", [this](const httplib::Request& req, httplib::Response& res) {
        handle_health(req, res);
    });

    // Auto-select port if not specified
    if (port_ == 0) {
        port_ = server.bind_to_any_port("127.0.0.1");
    } else {
        server.bind_to_port("127.0.0.1", port_);
    }

    // Start server
    server.listen_after_bind();

    // Keep running until stopped
    while (running_) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
}

void MockKoboldCppServer::handle_generate(const httplib::Request& req, httplib::Response& res) {
    // Add delay if configured
    if (min_delay_ms_ > 0 && max_delay_ms_ > 0) {
        int delay_ms = min_delay_ms_ + (std::rand() % (max_delay_ms_ - min_delay_ms_ + 1));
        std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
    } else if (response_delay_.count() > 0) {
        std::this_thread::sleep_for(response_delay_);
    }

    res.status = generate_status_code_;
    res.set_content(generate_response_text_, "application/json");
}

void MockKoboldCppServer::handle_models(const httplib::Request& req, httplib::Response& res) {
    // Add delay if configured
    if (min_delay_ms_ > 0 && max_delay_ms_ > 0) {
        int delay_ms = min_delay_ms_ + (std::rand() % (max_delay_ms_ - min_delay_ms_ + 1));
        std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
    } else if (response_delay_.count() > 0) {
        std::this_thread::sleep_for(response_delay_);
    }

    res.status = models_status_code_;
    res.set_content(models_response_, "application/json");
}

void MockKoboldCppServer::handle_version(const httplib::Request& req, httplib::Response& res) {
    // Add delay if configured
    if (min_delay_ms_ > 0 && max_delay_ms_ > 0) {
        int delay_ms = min_delay_ms_ + (std::rand() % (max_delay_ms_ - min_delay_ms_ + 1));
        std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
    } else if (response_delay_.count() > 0) {
        std::this_thread::sleep_for(response_delay_);
    }

    res.status = version_status_code_;
    res.set_content(version_response_, "application/json");
}

void MockKoboldCppServer::handle_health(const httplib::Request& req, httplib::Response& res) {
    // Add delay if configured
    if (min_delay_ms_ > 0 && max_delay_ms_ > 0) {
        int delay_ms = min_delay_ms_ + (std::rand() % (max_delay_ms_ - min_delay_ms_ + 1));
        std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
    } else if (response_delay_.count() > 0) {
        std::this_thread::sleep_for(response_delay_);
    }

    res.status = health_status_code_;
    res.set_content(health_response_, "application/json");
}

}  // namespace kcpp_test