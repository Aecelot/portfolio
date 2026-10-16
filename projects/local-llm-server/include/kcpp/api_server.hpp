#pragma once

#include <string>
#include <thread>
#include <memory>
#include <vector>
#include <unordered_map>
#include <mutex>
#include <optional>
#include <chrono>
#include <httplib.h>
#include <spdlog/spdlog.h>
#include <spdlog/logger.h>

namespace httplib {
class Server;
} // namespace httplib

namespace tinyxml2 {
class XMLDocument;
class XMLElement;
} // namespace tinyxml2

namespace kcpp {

// Configuration for the API server
struct APIServerConfig {
    std::string host = "0.0.0.0";
    int port = 8080;
    std::string llama_host = "127.0.0.1";
    int llama_port = 8080;
};

// Request/Response structures for LlamaCPP communication
struct LlamaRequest {
    std::string system_prompt;
    std::string user_prompt;
    int max_tokens;
    float temperature;
    float top_p;
};

struct LlamaResponse {
    std::string response;
    bool success = false;
    std::string error_message;
    int tokens_used = 0;
};

// Represents a single conversation session
struct ConversationSession {
    std::string session_id;                      // Unique session identifier (32 hex chars)
    std::string static_persona;                  // Fixed persona block (stored newline-terminated)
    std::vector<std::string> turns;              // Alternating: "User: ...\n", "Assistant: ...\n"
    std::chrono::system_clock::time_point created_at;
    std::chrono::system_clock::time_point last_accessed;

    // Session-specific configuration
    int max_context_tokens = 8192;               // Context window limit
    std::vector<std::string> stop_sequences;     // Custom stop strings
    float temperature = 0.7f;                    // Default temperature
    float top_p = 0.9f;                          // Default top_p
};

/**
 * APIServer provides a simple HTTP API wrapper around LlamaCPP
 * Exposes standard LlamaCPP-compatible endpoints for easy integration
 */
class APIServer {
public:
    APIServer();
    ~APIServer();

    // Configuration and lifecycle
    bool initialize(const APIServerConfig& config);
    bool start();
    void stop();
    bool is_running() const { return running_; }

private:
    // Configuration
    APIServerConfig config_;

    // HTTP server
    httplib::Server server_;

    // Runtime state
    bool running_ = false;
    std::thread server_thread_;

    // Logger
    std::shared_ptr<spdlog::logger> logger_;

    // Session management
    std::unordered_map<std::string, ConversationSession> sessions_;
    mutable std::mutex sessions_mutex_;
    std::thread cleanup_thread_;

    // Session limits/config (defaults; may be overridden via env later)
    int session_max_age_minutes_ = 60;
    int session_cleanup_interval_minutes_ = 5;
    size_t session_max_concurrent_ = 1000;

    // HTTP request handlers
    void handle_generate(const httplib::Request& req, httplib::Response& res);
    void handle_models(const httplib::Request& req, httplib::Response& res);
    void handle_health(const httplib::Request& req, httplib::Response& res);
    void handle_version(const httplib::Request& req, httplib::Response& res);

    // Session HTTP handlers
    void handle_session_create(const httplib::Request& req, httplib::Response& res);
    void handle_session_append(const httplib::Request& req, httplib::Response& res);
    void handle_session_get(const httplib::Request& req, httplib::Response& res);
    void handle_session_delete(const httplib::Request& req, httplib::Response& res);
    void handle_sessions_list(const httplib::Request& req, httplib::Response& res);

    // LlamaCPP communication
    LlamaResponse forward_to_llamacpp(const LlamaRequest& request) const;
    bool check_llamacpp_health() const;

    // Utility functions
    void send_xml_error(httplib::Response& res, int status_code, const std::string& message) const;
    void send_json_error(httplib::Response& res, int status_code, const std::string& message) const;
    std::string generate_session_id() const;
    std::string build_full_prompt(const ConversationSession& session) const;
    void cleanup_expired_sessions(int max_age_minutes);
    
    // Format detection helpers
    bool is_xml_request(const httplib::Request& req) const;
    bool wants_xml_response(const httplib::Request& req) const;
    
    // XML parsing helpers
    std::string extract_cdata_or_text(tinyxml2::XMLElement* elem) const;
    std::vector<std::string> extract_stop_sequences_xml(tinyxml2::XMLElement* root) const;
    
    // XML building helpers
    void add_cdata_element(tinyxml2::XMLDocument& doc,
                          tinyxml2::XMLElement* parent,
                          const char* name,
                          const std::string& content) const;
    void add_text_element(tinyxml2::XMLDocument& doc,
                         tinyxml2::XMLElement* parent,
                         const char* name,
                         const std::string& value) const;
    std::string xml_escape(const std::string& in) const;
    
    // XML validation helpers
    bool validate_action_xml(const std::string& xml, std::string& error_message) const;
    
    // Dual-format response helpers
    void send_error_response(httplib::Response& res,
                            int status_code,
                            const std::string& message,
                            bool use_xml) const;
};

} // namespace kcpp