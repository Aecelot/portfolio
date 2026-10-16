#include "kcpp/api_server.hpp"
#include "kcpp/log.hpp"
#include "kcpp/http.hpp"
#include <httplib.h>
#include <nlohmann/json.hpp>
#include <cpr/cpr.h>
#include <tinyxml2.h>
#include <sstream>
#include <chrono>
#include <random>
#include <iomanip>
#include <ctime>
#include <algorithm>
 
namespace kcpp {

APIServer::APIServer() : logger_(get_logger()) {
}

APIServer::~APIServer() {
    stop();
}

bool APIServer::initialize(const APIServerConfig& config) {
    config_ = config;

    logger_->info("Initializing API Server:");
    logger_->info("  Host: {}", config_.host);
    logger_->info("  Port: {}", config_.port);
    logger_->info("  LlamaCpp Host: {}", config_.llama_host);
    logger_->info("  LlamaCpp Port: {}", config_.llama_port);

    return true;
}

bool APIServer::start() {
    if (running_) {
        logger_->warn("API Server is already running");
        return false;
    }

    logger_->info("Starting API Server on {}:{}", config_.host, config_.port);

    // Set up API endpoints
    server_.Post("/api/v1/generate", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_generate(req, res);
    });
    
    // Session API (stateful)
    server_.Post("/api/v1/session/create", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_session_create(req, res);
    });
    server_.Post(R"(/api/v1/session/([0-9a-f]{32})/append)", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_session_append(req, res);
    });
    server_.Get(R"(/api/v1/session/([0-9a-f]{32}))", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_session_get(req, res);
    });
    server_.Delete(R"(/api/v1/session/([0-9a-f]{32}))", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_session_delete(req, res);
    });
    server_.Get("/api/v1/sessions", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_sessions_list(req, res);
    });
    
    server_.Get("/api/v1/models", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_models(req, res);
    });
    
    server_.Get("/health", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_health(req, res);
    });
    
    server_.Get("/api/v1/version", [this](const httplib::Request& req, httplib::Response& res) {
        this->handle_version(req, res);
    });

    // Set server options for robustness
    server_.set_read_timeout(300, 0); // 5 minutes
    server_.set_write_timeout(300, 0); // 5 minutes
    server_.set_keep_alive_max_count(100);
    server_.set_keep_alive_timeout(60);

    // Start server in background thread
    server_thread_ = std::thread([this]() {
        logger_->info("API Server listening on {}:{}", config_.host, config_.port);
        bool started = server_.listen(config_.host, config_.port);

        if (started) {
            logger_->info("API Server started successfully");
        } else {
            logger_->error("Failed to start API Server");
        }
    });

    // Wait a bit for server to start
    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    running_ = true;
    logger_->info("API Server startup initiated");

    // Start background session cleanup thread
    cleanup_thread_ = std::thread([this]() {
        while (running_) {
            std::this_thread::sleep_for(std::chrono::minutes(session_cleanup_interval_minutes_));
            if (!running_) break;
            cleanup_expired_sessions(session_max_age_minutes_);
        }
    });

    return true;
}

void APIServer::stop() {
    if (!running_) {
        return;
    }

    logger_->info("Stopping API Server...");
    running_ = false;

    server_.stop();

    if (server_thread_.joinable()) {
        server_thread_.join();
    }
    if (cleanup_thread_.joinable()) {
        cleanup_thread_.join();
    }

    logger_->info("API Server stopped");
}

void APIServer::handle_generate(const httplib::Request& req, httplib::Response& res) {
    auto start_time = std::chrono::high_resolution_clock::now();

    try {
        logger_->info("Received /api/v1/generate request (XML-only)");

        // Enforce XML Content-Type
        const std::string content_type = req.get_header_value("Content-Type");
        if (content_type.find("application/xml") == std::string::npos) {
            logger_->error("Unsupported Media Type for /generate: '{}'", content_type);
            send_xml_error(res, 415, "Unsupported Media Type: Content-Type must be application/xml");
            return;
        }

        // Parse XML request body
        tinyxml2::XMLDocument doc;
        auto parse_rc = doc.Parse(req.body.c_str(), req.body.size());
        if (parse_rc != tinyxml2::XML_SUCCESS) {
            logger_->error("Failed to parse XML request: {}", doc.ErrorStr() ? doc.ErrorStr() : "unknown parse error");
            send_xml_error(res, 400, std::string("Invalid XML: ") + (doc.ErrorStr() ? doc.ErrorStr() : "parse error"));
            return;
        }

        auto* root = doc.FirstChildElement("request");
        if (!root) {
            send_xml_error(res, 400, "Missing root element <request>");
            return;
        }

        auto* prompt_el = root->FirstChildElement("prompt");
        if (!prompt_el) {
            send_xml_error(res, 400, "Missing required <prompt> element");
            return;
        }

        // Prefer CDATA text to preserve verbatim bytes; accept plain text as a fallback
        std::string prompt;
        {
            auto* first_child = prompt_el->FirstChild();
            if (first_child) {
                if (auto* text = first_child->ToText()) {
                    prompt = text->Value() ? std::string(text->Value()) : std::string();
                    if (!text->CData()) {
                        logger_->warn("Prompt not provided as CDATA; proceeding with plain text content");
                    }
                } else {
                    send_xml_error(res, 400, "Invalid <prompt>: must contain CDATA or text");
                    return;
                }
            } else {
                send_xml_error(res, 400, "Empty <prompt> element");
                return;
            }
        }

        // Extract optional fields with defaults
        auto get_int = [](tinyxml2::XMLElement* parent, const char* name, int def) -> int {
            if (auto* el = parent->FirstChildElement(name)) {
                int v = def;
                if (el->QueryIntText(&v) == tinyxml2::XML_SUCCESS) return v;
            }
            return def;
        };
        auto get_float = [](tinyxml2::XMLElement* parent, const char* name, float def) -> float {
            if (auto* el = parent->FirstChildElement(name)) {
                float v = def;
                if (el->QueryFloatText(&v) == tinyxml2::XML_SUCCESS) return v;
            }
            return def;
        };

        const int max_tokens   = get_int(root, "max_tokens", 150);
        const float temperature = get_float(root, "temperature", 0.8f);
        const float top_p       = get_float(root, "top_p", 0.9f);

        // Parse the prompt XML to extract system and user parts
        std::string system_prompt = "";
        std::string user_prompt = "";

        tinyxml2::XMLDocument inner_doc;
        tinyxml2::XMLError parse_result = inner_doc.Parse(prompt.c_str());
        if (parse_result == tinyxml2::XML_SUCCESS) {
            auto* system_el = inner_doc.FirstChildElement("System");
            if (system_el) {
                // System part: Task, AllowedActions, Output, Example, FinalAnswer
                for (auto* child = system_el->FirstChildElement(); child; child = child->NextSiblingElement()) {
                    std::string child_name = child->Name();
                    if (child_name == "Task" || child_name == "AllowedActions" || child_name == "Output" ||
                        child_name == "Example" || child_name == "FinalAnswer") {
                        const char* text = child->GetText();
                        if (text) {
                            system_prompt += text;
                            system_prompt += "\n";
                        }
                    }
                }
                // User part: Scene, Actors, Player, Plot, Utterance, Intent, ResponderHint
                for (auto* child = system_el->FirstChildElement(); child; child = child->NextSiblingElement()) {
                    std::string child_name = child->Name();
                    if (child_name == "Scene" || child_name == "Actors" || child_name == "Player" ||
                        child_name == "Plot" || child_name == "Utterance" || child_name == "Intent" ||
                        child_name == "ResponderHint") {
                        tinyxml2::XMLPrinter printer;
                        child->Accept(&printer);
                        user_prompt += printer.CStr();
                        user_prompt += "\n";
                    }
                }
            }
        } else {
            // If parsing fails, use the prompt as user
            user_prompt = prompt;
        }

        // Forward to LlamaCPP with retry logic for validation
        LlamaRequest llama_request{
            system_prompt,
            user_prompt,
            max_tokens,
            temperature,
            top_p
        };

        const int max_retries = 3;
        LlamaResponse llama_response;
        std::string validation_error;
        bool validation_passed = false;

        for (int attempt = 1; attempt <= max_retries; ++attempt) {
            llama_response = forward_to_llamacpp(llama_request);

            if (!llama_response.success) {
                send_xml_error(res, 500, "LlamaCPP processing failed: " + llama_response.error_message);
                return;
            }

            // Validate the XML response
            if (validate_action_xml(llama_response.response, validation_error)) {
                validation_passed = true;
                logger_->info("XML validation passed on attempt {}/{}", attempt, max_retries);
                break;
            } else {
                logger_->warn("XML validation failed on attempt {}/{}: {}", attempt, max_retries, validation_error);
                
                if (attempt < max_retries) {
                    logger_->info("Retrying generation...");
                }
            }
        }

        if (!validation_passed) {
            logger_->error("All {} validation attempts failed. Last error: {}", max_retries, validation_error);
            send_xml_error(res, 500, "Generated XML validation failed after " +
                          std::to_string(max_retries) + " attempts. Last error: " + validation_error);
            return;
        }

        // XML escape utility
        auto xml_escape = [](const std::string& in) -> std::string {
            std::string out;
            out.reserve(in.size());
            for (char c : in) {
                switch (c) {
                    case '&':  out += "&";  break;
                    case '<':  out += "<";   break;
                    case '>':  out += ">";   break;
                    case '"':  out += "&quot;"; break;
                    case '\'': out += "'"; break;
                    default:   out += c;        break;
                }
            }
            return out;
        };

        // Calculate processing time (for logging)
        const int processing_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::high_resolution_clock::now() - start_time).count();

        logger_->info("Generate request processed in {}ms", processing_time);

        // Build XML success response
        std::ostringstream oss;
        oss << "<response>"
            << "<text>" << xml_escape(llama_response.response) << "</text>"
            << "<tokens_used>" << llama_response.tokens_used << "</tokens_used>"
            << "<success>true</success>"
            << "</response>";

        res.status = 200;
        res.set_content(oss.str(), "application/xml");

    } catch (const std::exception& e) {
        logger_->error("Exception in handle_generate: {}", e.what());
        send_xml_error(res, 500, "Internal server error: " + std::string(e.what()));
    }
}

void APIServer::handle_models(const httplib::Request& req, httplib::Response& res) {
    try {
        logger_->debug("Received /api/v1/models request (XML)");

        std::ostringstream oss;
        oss << "<models>"
            <<   "<model>"
            <<     "<id>llamacpp-default</id>"
            <<     "<name>LlamaCPP Model</name>"
            <<     "<type>llm</type>"
            <<     "<format>gguf</format>"
            <<     "<status>ready</status>"
            <<   "</model>"
            << "</models>";

        res.status = 200;
        res.set_content(oss.str(), "application/xml");

    } catch (const std::exception& e) {
        logger_->error("Exception in handle_models: {}", e.what());
        send_xml_error(res, 500, "Internal server error: " + std::string(e.what()));
    }
}

void APIServer::handle_health(const httplib::Request& req, httplib::Response& res) {
    try {
        logger_->debug("Received /health request (XML)");

        // Check LlamaCPP health by making a simple request
        const bool llama_healthy = check_llamacpp_health();

        const auto ts = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();

        std::ostringstream oss;
        oss << "<health>"
            <<   "<status>" << (llama_healthy ? "healthy" : "unhealthy") << "</status>"
            <<   "<api_server>running</api_server>"
            <<   "<llamacpp>" << (llama_healthy ? "running" : "unavailable") << "</llamacpp>"
            <<   "<timestamp>" << ts << "</timestamp>"
            <<   "<version>1.0.0</version>"
            << "</health>";

        res.status = llama_healthy ? 200 : 503;
        res.set_content(oss.str(), "application/xml");

    } catch (const std::exception& e) {
        logger_->error("Exception in handle_health: {}", e.what());
        send_xml_error(res, 500, "Health check failed: " + std::string(e.what()));
    }
}

void APIServer::handle_version(const httplib::Request& req, httplib::Response& res) {
    try {
        logger_->debug("Received /api/v1/version request (XML)");

        std::ostringstream oss;
        oss << "<version_info>"
            <<   "<version>1.0.0</version>"
            <<   "<name>LlamaCPP API Server</name>"
            <<   "<description>Simple HTTP API wrapper for LlamaCPP</description>"
            <<   "<llamacpp_version>1.0.0</llamacpp_version>"
            << "</version_info>";

        res.status = 200;
        res.set_content(oss.str(), "application/xml");

    } catch (const std::exception& e) {
        logger_->error("Exception in handle_version: {}", e.what());
        send_xml_error(res, 500, "Internal server error: " + std::string(e.what()));
    }
}

// -------- Session JSON helper and handlers (Phase 2/3) --------

void APIServer::send_json_error(httplib::Response& res, int status_code, const std::string& message) const {
    nlohmann::json j = {
        {"error", message},
        {"status_code", status_code}
    };
    res.status = status_code;
    res.set_content(j.dump(), "application/json");
}

static std::string to_rfc3339(std::chrono::system_clock::time_point tp) {
    std::time_t tt = std::chrono::system_clock::to_time_t(tp);
    std::tm tm{};
#if defined(_WIN32)
    gmtime_s(&tm, &tt);
#else
    gmtime_r(&tt, &tm);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

static inline void ensure_trailing_newline(std::string& s) {
    if (s.empty() || s.back() != '\n') s.push_back('\n');
}

std::string APIServer::generate_session_id() const {
    unsigned char buf[16];
    std::random_device rd;
    for (int i = 0; i < 16; i += 4) {
        unsigned int r = rd();
        buf[i]     = static_cast<unsigned char>((r >> 24) & 0xFF);
        buf[i + 1] = static_cast<unsigned char>((r >> 16) & 0xFF);
        buf[i + 2] = static_cast<unsigned char>((r >> 8) & 0xFF);
        buf[i + 3] = static_cast<unsigned char>(r & 0xFF);
    }
    static const char* hex = "0123456789abcdef";
    std::string out;
    out.resize(32);
    for (int i = 0; i < 16; ++i) {
        out[2 * i]     = hex[(buf[i] >> 4) & 0x0F];
        out[2 * i + 1] = hex[buf[i] & 0x0F];
    }
    return out;
}

std::string APIServer::build_full_prompt(const ConversationSession& session) const {
    std::string out;
    out.reserve(session.static_persona.size() + session.turns.size() * 64);
    out += session.static_persona;
    for (const auto& t : session.turns) out += t;
    return out;
}

void APIServer::handle_session_create(const httplib::Request& req, httplib::Response& res) {
    bool use_xml = is_xml_request(req);
    
    try {
        const std::string content_type = req.get_header_value("Content-Type");
        if (content_type.find("application/json") == std::string::npos &&
            content_type.find("application/xml") == std::string::npos) {
            send_error_response(res, 415, "Unsupported Media Type: Content-Type must be application/json or application/xml", use_xml);
            return;
        }

        ConversationSession sess;
        sess.session_id = generate_session_id();
        sess.created_at = std::chrono::system_clock::now();
        sess.last_accessed = sess.created_at;

        // Parse request based on format
        if (use_xml) {
            // Parse XML request
            tinyxml2::XMLDocument doc;
            auto parse_rc = doc.Parse(req.body.c_str(), req.body.size());
            if (parse_rc != tinyxml2::XML_SUCCESS) {
                logger_->error("Failed to parse XML request: {}", doc.ErrorStr() ? doc.ErrorStr() : "unknown parse error");
                send_xml_error(res, 400, std::string("Invalid XML: ") + (doc.ErrorStr() ? doc.ErrorStr() : "parse error"));
                return;
            }

            auto* root = doc.FirstChildElement("session_request");
            if (!root) {
                send_xml_error(res, 400, "Missing root element <session_request>");
                return;
            }

            auto* persona_el = root->FirstChildElement("persona");
            if (!persona_el) {
                send_xml_error(res, 400, "Missing required <persona> element");
                return;
            }

            try {
                sess.static_persona = extract_cdata_or_text(persona_el);
            } catch (const std::exception& e) {
                send_xml_error(res, 400, std::string("Invalid <persona>: ") + e.what());
                return;
            }

            // Extract optional fields
            auto get_int = [](tinyxml2::XMLElement* parent, const char* name, int def) -> int {
                if (auto* el = parent->FirstChildElement(name)) {
                    int v = def;
                    if (el->QueryIntText(&v) == tinyxml2::XML_SUCCESS) return v;
                }
                return def;
            };
            auto get_float = [](tinyxml2::XMLElement* parent, const char* name, float def) -> float {
                if (auto* el = parent->FirstChildElement(name)) {
                    float v = def;
                    if (el->QueryFloatText(&v) == tinyxml2::XML_SUCCESS) return v;
                }
                return def;
            };

            sess.max_context_tokens = std::max(256, get_int(root, "max_context_tokens", 8192));
            sess.temperature = get_float(root, "temperature", 0.7f);
            sess.top_p = get_float(root, "top_p", 0.9f);
            sess.stop_sequences = extract_stop_sequences_xml(root);

        } else {
            // Parse JSON request
            nlohmann::json j = nlohmann::json::parse(req.body);

            if (!j.contains("persona") || !j["persona"].is_string()) {
                send_json_error(res, 400, "Missing 'persona' string");
                return;
            }

            sess.static_persona = j["persona"].get<std::string>();

            if (j.contains("max_context_tokens")) {
                sess.max_context_tokens = std::max(256, j["max_context_tokens"].get<int>());
            }
            if (j.contains("stop_sequences") && j["stop_sequences"].is_array()) {
                for (auto& s : j["stop_sequences"]) {
                    if (s.is_string()) sess.stop_sequences.push_back(s.get<std::string>());
                }
            }
            if (j.contains("temperature")) sess.temperature = j["temperature"].get<float>();
            if (j.contains("top_p")) sess.top_p = j["top_p"].get<float>();
        }

        // Common validation and processing
        ensure_trailing_newline(sess.static_persona);

        // Persona token estimate (simple heuristic)
        int persona_tokens = static_cast<int>((sess.static_persona.size() + 3) / 4);
        if (persona_tokens >= sess.max_context_tokens) {
            send_error_response(res, 400, "Persona too long for context window", use_xml);
            return;
        }

        int max_ctx = sess.max_context_tokens;
        std::string sid = sess.session_id;
        auto created_time = sess.created_at;

        {
            std::lock_guard<std::mutex> lock(sessions_mutex_);
            // Capacity check: evict oldest if needed
            if (sessions_.size() >= session_max_concurrent_) {
                auto oldest = sessions_.end();
                for (auto it = sessions_.begin(); it != sessions_.end(); ++it) {
                    if (oldest == sessions_.end() || it->second.last_accessed < oldest->second.last_accessed) oldest = it;
                }
                if (oldest != sessions_.end()) {
                    logger_->warn("Evicting session due to capacity in create(): {}", oldest->first);
                    sessions_.erase(oldest);
                }
            }
            sessions_[sid] = std::move(sess);
        }

        logger_->info("Created session: {} (format: {})", sid, use_xml ? "XML" : "JSON");

        // Build response based on format
        if (use_xml) {
            tinyxml2::XMLDocument doc;
            auto* root = doc.NewElement("session_response");
            doc.InsertFirstChild(root);

            add_text_element(doc, root, "session_id", sid);
            add_text_element(doc, root, "created_at", to_rfc3339(created_time));
            add_text_element(doc, root, "persona_tokens", std::to_string(persona_tokens));
            add_text_element(doc, root, "max_context_tokens", std::to_string(max_ctx));
            add_text_element(doc, root, "success", "true");

            tinyxml2::XMLPrinter printer;
            doc.Print(&printer);

            res.status = 201;
            res.set_content(printer.CStr(), "application/xml");
        } else {
            nlohmann::json resp = {
                {"session_id", sid},
                {"created_at", to_rfc3339(created_time)},
                {"persona_tokens", persona_tokens},
                {"max_context_tokens", max_ctx}
            };
            res.status = 201;
            res.set_content(resp.dump(), "application/json");
        }

    } catch (const std::exception& e) {
        logger_->error("Exception in handle_session_create: {}", e.what());
        send_error_response(res, 500, std::string("Internal error: ") + e.what(), use_xml);
    }
}

void APIServer::handle_session_append(const httplib::Request& req, httplib::Response& res) {
    bool use_xml = is_xml_request(req);
    
    try {
        if (req.matches.size() < 2) {
            send_error_response(res, 400, "Invalid session id", use_xml);
            return;
        }
        std::string session_id = req.matches[1];

        std::string turn;
        int max_tokens = 150;
        float temperature = 0.7f;
        float top_p = 0.9f;

        // Parse request based on format
        if (use_xml) {
            tinyxml2::XMLDocument doc;
            auto parse_rc = doc.Parse(req.body.c_str(), req.body.size());
            if (parse_rc != tinyxml2::XML_SUCCESS) {
                logger_->error("Failed to parse XML request: {}", doc.ErrorStr() ? doc.ErrorStr() : "unknown parse error");
                send_xml_error(res, 400, std::string("Invalid XML: ") + (doc.ErrorStr() ? doc.ErrorStr() : "parse error"));
                return;
            }

            auto* root = doc.FirstChildElement("append_request");
            if (!root) {
                send_xml_error(res, 400, "Missing root element <append_request>");
                return;
            }

            auto* turn_el = root->FirstChildElement("turn");
            if (!turn_el) {
                send_xml_error(res, 400, "Missing required <turn> element");
                return;
            }

            try {
                turn = extract_cdata_or_text(turn_el);
            } catch (const std::exception& e) {
                send_xml_error(res, 400, std::string("Invalid <turn>: ") + e.what());
                return;
            }

            // Extract optional fields
            auto get_int = [](tinyxml2::XMLElement* parent, const char* name, int def) -> int {
                if (auto* el = parent->FirstChildElement(name)) {
                    int v = def;
                    if (el->QueryIntText(&v) == tinyxml2::XML_SUCCESS) return v;
                }
                return def;
            };
            auto get_float = [](tinyxml2::XMLElement* parent, const char* name, float def) -> float {
                if (auto* el = parent->FirstChildElement(name)) {
                    float v = def;
                    if (el->QueryFloatText(&v) == tinyxml2::XML_SUCCESS) return v;
                }
                return def;
            };

            max_tokens = get_int(root, "max_tokens", 150);
            temperature = get_float(root, "temperature", 0.7f);
            top_p = get_float(root, "top_p", 0.9f);

        } else {
            nlohmann::json j = nlohmann::json::parse(req.body);
            if (!j.contains("turn") || !j["turn"].is_string()) {
                send_json_error(res, 400, "Missing 'turn' string");
                return;
            }
            turn = j["turn"].get<std::string>();
            max_tokens = j.value("max_tokens", 150);
            temperature = j.contains("temperature") ? j["temperature"].get<float>() : 0.7f;
            top_p = j.contains("top_p") ? j["top_p"].get<float>() : 0.9f;
        }

        ensure_trailing_newline(turn);

        // Off-lock copy for building prompt
        ConversationSession session_copy;
        {
            std::lock_guard<std::mutex> lock(sessions_mutex_);
            auto it = sessions_.find(session_id);
            if (it == sessions_.end()) {
                send_error_response(res, 404, "Session not found", use_xml);
                return;
            }
            session_copy = it->second;
        }

        // Build full prompt
        std::string full_prompt = build_full_prompt(session_copy);
        full_prompt += "User: " + turn;

        // Token estimate with headroom and safety factor
        auto estimate_tokens = [](size_t chars) -> int {
            // approx ceil(chars / 3.5) without <cmath>
            return static_cast<int>((chars * 100 + 349) / 350);
        };
        int estimated = estimate_tokens(full_prompt.size());
        int with_headroom = estimated + max_tokens;
        with_headroom = with_headroom + with_headroom / 7; // ~1.14 safety

        if (with_headroom > session_copy.max_context_tokens) {
            if (use_xml) {
                tinyxml2::XMLDocument doc;
                auto* root = doc.NewElement("error");
                doc.InsertFirstChild(root);
                
                add_text_element(doc, root, "message", "Context window exceeded");
                add_text_element(doc, root, "status_code", "413");
                
                auto* details = doc.NewElement("details");
                add_text_element(doc, details, "estimated_prompt_tokens", std::to_string(estimated));
                add_text_element(doc, details, "max_tokens", std::to_string(max_tokens));
                add_text_element(doc, details, "limit", std::to_string(session_copy.max_context_tokens));
                root->InsertEndChild(details);
                
                tinyxml2::XMLPrinter printer;
                doc.Print(&printer);
                
                res.status = 413;
                res.set_content(printer.CStr(), "application/xml");
            } else {
                nlohmann::json details = {
                    {"estimated_prompt_tokens", estimated},
                    {"max_tokens", max_tokens},
                    {"limit", session_copy.max_context_tokens}
                };
                nlohmann::json err = {
                    {"error", "Context window exceeded"},
                    {"status_code", 413},
                    {"details", details}
                };
                res.status = 413;
                res.set_content(err.dump(), "application/json");
            }
            return;
        }

        // Forward to backend
        LlamaRequest req_llm{session_copy.static_persona, turn, max_tokens, temperature, top_p};
        LlamaResponse llm_resp = forward_to_llamacpp(req_llm);
        if (!llm_resp.success) {
            send_error_response(res, 502, std::string("Backend error: ") + llm_resp.error_message, use_xml);
            return;
        }

        // Normalize assistant response and store both sides
        std::string assistant = llm_resp.response;
        while (!assistant.empty() && (assistant.back() == '\n' || assistant.back() == '\r')) assistant.pop_back();
        assistant = "Assistant: " + assistant;
        ensure_trailing_newline(assistant);

        {
            std::lock_guard<std::mutex> lock(sessions_mutex_);
            auto it = sessions_.find(session_id);
            if (it == sessions_.end()) {
                send_error_response(res, 404, "Session not found", use_xml);
                return;
            }
            std::string user_line = "User: " + turn;
            it->second.turns.push_back(std::move(user_line));
            it->second.turns.push_back(std::move(assistant));
            it->second.last_accessed = std::chrono::system_clock::now();
        }

        double utilization = static_cast<double>(with_headroom) / session_copy.max_context_tokens;
        if (utilization > 1.0) utilization = 1.0;

        logger_->info("Session {} - Turn appended ({} tokens, format: {})",
                     session_id, llm_resp.tokens_used, use_xml ? "XML" : "JSON");

        // Build response based on format
        if (use_xml) {
            tinyxml2::XMLDocument doc;
            auto* root = doc.NewElement("append_response");
            doc.InsertFirstChild(root);

            add_text_element(doc, root, "session_id", session_id);
            add_cdata_element(doc, root, "response", llm_resp.response);
            add_text_element(doc, root, "tokens_used", std::to_string(llm_resp.tokens_used));
            add_text_element(doc, root, "total_context_tokens", std::to_string(estimated));
            
            std::ostringstream util_str;
            util_str << std::fixed << std::setprecision(2) << utilization;
            add_text_element(doc, root, "context_utilization", util_str.str());
            add_text_element(doc, root, "success", "true");

            tinyxml2::XMLPrinter printer;
            doc.Print(&printer);

            res.status = 200;
            res.set_content(printer.CStr(), "application/xml");
        } else {
            nlohmann::json resp = {
                {"session_id", session_id},
                {"response", llm_resp.response},
                {"tokens_used", llm_resp.tokens_used},
                {"total_context_tokens", estimated},
                {"context_utilization", utilization}
            };
            res.status = 200;
            res.set_content(resp.dump(), "application/json");
        }

    } catch (const std::exception& e) {
        logger_->error("Exception in handle_session_append: {}", e.what());
        send_error_response(res, 500, std::string("Internal error: ") + e.what(), use_xml);
    }
}

void APIServer::handle_session_get(const httplib::Request& req, httplib::Response& res) {
    bool use_xml = wants_xml_response(req);
    
    try {
        if (req.matches.size() < 2) {
            send_error_response(res, 400, "Invalid session id", use_xml);
            return;
        }
        std::string session_id = req.matches[1];

        ConversationSession session_copy;
        {
            std::lock_guard<std::mutex> lock(sessions_mutex_);
            auto it = sessions_.find(session_id);
            if (it == sessions_.end()) {
                send_error_response(res, 404, "Session not found", use_xml);
                return;
            }
            it->second.last_accessed = std::chrono::system_clock::now();
            session_copy = it->second;
        }

        std::string prompt = build_full_prompt(session_copy);
        int total_tokens = static_cast<int>((prompt.size() + 3) / 4);

        if (use_xml) {
            tinyxml2::XMLDocument doc;
            auto* root = doc.NewElement("session_data");
            doc.InsertFirstChild(root);

            add_text_element(doc, root, "session_id", session_id);
            add_cdata_element(doc, root, "persona", session_copy.static_persona);
            
            auto* turns_elem = doc.NewElement("turns");
            for (size_t i = 0; i < session_copy.turns.size(); ++i) {
                auto* turn = doc.NewElement("turn");
                turn->SetAttribute("index", static_cast<int>(i));
                auto* cdata = doc.NewText(session_copy.turns[i].c_str());
                cdata->SetCData(true);
                turn->InsertEndChild(cdata);
                turns_elem->InsertEndChild(turn);
            }
            root->InsertEndChild(turns_elem);

            add_text_element(doc, root, "created_at", to_rfc3339(session_copy.created_at));
            add_text_element(doc, root, "last_accessed", to_rfc3339(session_copy.last_accessed));
            add_text_element(doc, root, "total_context_tokens", std::to_string(total_tokens));
            add_text_element(doc, root, "max_context_tokens", std::to_string(session_copy.max_context_tokens));
            add_text_element(doc, root, "success", "true");

            tinyxml2::XMLPrinter printer;
            doc.Print(&printer);

            res.status = 200;
            res.set_content(printer.CStr(), "application/xml");
        } else {
            nlohmann::json resp = {
                {"session_id", session_id},
                {"persona", session_copy.static_persona},
                {"turns", session_copy.turns},
                {"created_at", to_rfc3339(session_copy.created_at)},
                {"last_accessed", to_rfc3339(session_copy.last_accessed)},
                {"total_context_tokens", total_tokens},
                {"max_context_tokens", session_copy.max_context_tokens}
            };
            res.status = 200;
            res.set_content(resp.dump(), "application/json");
        }
    } catch (const std::exception& e) {
        logger_->error("Exception in handle_session_get: {}", e.what());
        send_error_response(res, 500, std::string("Internal error: ") + e.what(), use_xml);
    }
}

void APIServer::handle_session_delete(const httplib::Request& req, httplib::Response& res) {
    bool use_xml = wants_xml_response(req);
    
    try {
        if (req.matches.size() < 2) {
            send_error_response(res, 400, "Invalid session id", use_xml);
            return;
        }
        std::string session_id = req.matches[1];
        bool deleted = false;
        {
            std::lock_guard<std::mutex> lock(sessions_mutex_);
            auto it = sessions_.find(session_id);
            if (it != sessions_.end()) {
                sessions_.erase(it);
                deleted = true;
            }
        }

        if (use_xml) {
            tinyxml2::XMLDocument doc;
            auto* root = doc.NewElement("delete_response");
            doc.InsertFirstChild(root);

            add_text_element(doc, root, "deleted", deleted ? "true" : "false");
            add_text_element(doc, root, "session_id", session_id);

            tinyxml2::XMLPrinter printer;
            doc.Print(&printer);

            res.status = 200;
            res.set_content(printer.CStr(), "application/xml");
        } else {
            nlohmann::json resp = {{"deleted", deleted}, {"session_id", session_id}};
            res.status = 200;
            res.set_content(resp.dump(), "application/json");
        }
    } catch (const std::exception& e) {
        logger_->error("Exception in handle_session_delete: {}", e.what());
        send_error_response(res, 500, std::string("Internal error: ") + e.what(), use_xml);
    }
}

void APIServer::handle_sessions_list(const httplib::Request& req, httplib::Response& res) {
    bool use_xml = wants_xml_response(req);
    
    try {
        int limit = 100;
        try {
            if (req.has_param("limit")) {
                limit = std::stoi(req.get_param_value("limit"));
            }
        } catch (...) {}

        struct Item {
            std::string id;
            std::chrono::system_clock::time_point created;
            std::chrono::system_clock::time_point last;
            size_t turns;
            int context_tokens;
        };
        std::vector<Item> items;
        {
            std::lock_guard<std::mutex> lock(sessions_mutex_);
            items.reserve(sessions_.size());
            for (const auto& kv : sessions_) {
                std::string prompt = build_full_prompt(kv.second);
                int tokens = static_cast<int>((prompt.size() + 3) / 4);
                items.push_back(Item{kv.first, kv.second.created_at, kv.second.last_accessed, kv.second.turns.size(), tokens});
            }
        }
        std::sort(items.begin(), items.end(), [](const Item& a, const Item& b){ return a.last > b.last; });
        if (items.size() > static_cast<size_t>(limit)) items.resize(limit);

        if (use_xml) {
            tinyxml2::XMLDocument doc;
            auto* root = doc.NewElement("sessions_list");
            doc.InsertFirstChild(root);

            auto* sessions_elem = doc.NewElement("sessions");
            for (const auto& it : items) {
                auto* session = doc.NewElement("session");
                add_text_element(doc, session, "session_id", it.id);
                add_text_element(doc, session, "created_at", to_rfc3339(it.created));
                add_text_element(doc, session, "last_accessed", to_rfc3339(it.last));
                add_text_element(doc, session, "turn_count", std::to_string(it.turns));
                add_text_element(doc, session, "context_tokens", std::to_string(it.context_tokens));
                sessions_elem->InsertEndChild(session);
            }
            root->InsertEndChild(sessions_elem);

            add_text_element(doc, root, "total_sessions", std::to_string(items.size()));

            tinyxml2::XMLPrinter printer;
            doc.Print(&printer);

            res.status = 200;
            res.set_content(printer.CStr(), "application/xml");
        } else {
            nlohmann::json arr = nlohmann::json::array();
            for (const auto& it : items) {
                nlohmann::json obj = {
                    {"session_id", it.id},
                    {"created_at", to_rfc3339(it.created)},
                    {"last_accessed", to_rfc3339(it.last)},
                    {"turn_count", it.turns},
                    {"context_tokens", it.context_tokens}
                };
                arr.push_back(std::move(obj));
            }
            nlohmann::json resp = {{"sessions", arr}, {"total_sessions", items.size()}};
            res.status = 200;
            res.set_content(resp.dump(), "application/json");
        }
    } catch (const std::exception& e) {
        logger_->error("Exception in handle_sessions_list: {}", e.what());
        send_error_response(res, 500, std::string("Internal error: ") + e.what(), use_xml);
    }
}

void APIServer::cleanup_expired_sessions(int max_age_minutes) {
    std::lock_guard<std::mutex> lock(sessions_mutex_);
    auto now = std::chrono::system_clock::now();
    const auto ttl = std::chrono::minutes(max_age_minutes);

    for (auto it = sessions_.begin(); it != sessions_.end(); ) {
        if (now - it->second.last_accessed > ttl) {
            logger_->info("Cleaning up expired session {}", it->first);
            it = sessions_.erase(it);
        } else {
            ++it;
        }
    }

    if (sessions_.size() > session_max_concurrent_) {
        std::vector<std::pair<std::string, std::chrono::system_clock::time_point>> order;
        order.reserve(sessions_.size());
        for (const auto& kv : sessions_) order.emplace_back(kv.first, kv.second.last_accessed);
        std::sort(order.begin(), order.end(), [](auto& a, auto& b){ return a.second < b.second; });
        size_t to_remove = sessions_.size() - session_max_concurrent_;
        for (size_t i = 0; i < to_remove; ++i) {
            logger_->warn("Evicting session {} due to capacity", order[i].first);
            sessions_.erase(order[i].first);
        }
    }
}

// -------- End of session handlers --------
LlamaResponse APIServer::forward_to_llamacpp(const LlamaRequest& request) const {
    LlamaResponse out;

    auto post_payload = [&](bool include_grammar) -> cpr::Response {
        // Build LlamaCPP URL
        std::string url = "http://" + config_.llama_host + ":" +
                          std::to_string(config_.llama_port) + "/v1/chat/completions";

        // Base JSON payload for chat completions
        nlohmann::json json_payload = {
            {"model", "Llama-3.2-1B-Instruct-Q4_K_M.gguf"},
            {"messages", {
                {"role", "system", "content", request.system_prompt},
                {"role", "user", "content", request.user_prompt}
            }},
            {"max_tokens", request.max_tokens},
            {"temperature", request.temperature},
            {"top_p", request.top_p}
        };

        // Optionally include GBNF grammar to enforce <Action> root
        if (include_grammar) {
            static const char* kActionRootGBNF =
                "root ::= action\n"
                "action ::= \"<Action\" attrs \">\" body \"</Action>\"\n"
                "attrs ::= \" id=\\\"\" id \"\\\">\"\n"
                "id ::= \"npc_speak\" | \"place_marker\" | \"offer_gate_task\" | \"redirect_to_npc\" | \"adjust_affinity_light\"\n"
                "body ::= arguments rationale uihints\n"
                "arguments ::= \"<Arguments>\" arglist \"</Arguments>\"\n"
                "arglist ::= argument | arglist argument\n"
                "argument ::= \"<Argument key=\\\"\" key \"\\\" value=\\\"\" value \"\\\"/>\"\n"
                "key ::= { [^\\\"]* }\n"
                "value ::= { [^\\\"]* }\n"
                "rationale ::= \"<Rationale>\" text \"</Rationale>\"\n"
                "text ::= { [^<>]* }\n"
                "uihints ::= \"<UIHints>\" hintlist \"</UIHints>\"\n"
                "hintlist ::= hint | hintlist hint\n"
                "hint ::= \"<Hint key=\\\"\" key \"\\\" value=\\\"\" value \"\\\"/>\"\n";

            json_payload["grammar_type"] = "gbnf";
            json_payload["grammar"] = kActionRootGBNF;
        }

        // Make HTTP request with longer timeout for generation
        return cpr::Post(
            cpr::Url{url},
            cpr::Header{{"Content-Type", "application/json"}},
            cpr::Body{json_payload.dump()},
            cpr::Timeout{120000} // 2 minutes timeout for generation
        );
    };

    try {
        // First try with grammar
        cpr::Response http_response = post_payload(true);

        // If grammar not supported or other failure, retry without grammar
        if (http_response.status_code != 200) {
            // Retry once without grammar
            cpr::Response retry_response = post_payload(false);

            if (retry_response.status_code != 200) {
                out.error_message = "LlamaCPP HTTP " +
                    std::to_string(retry_response.status_code) + ": " +
                    retry_response.error.message;
                return out;
            }

            // Parse JSON response for chat completions
            try {
                nlohmann::json json_response = nlohmann::json::parse(retry_response.text);
                if (!json_response.contains("choices") || !json_response["choices"].is_array() || json_response["choices"].empty()) {
                    out.error_message = "Invalid LlamaCPP response format";
                    return out;
                }
                out.response = json_response["choices"][0]["message"]["content"];
                out.tokens_used = json_response.value("usage", nlohmann::json::object())["completion_tokens"].get<int>();
                out.success = true;
                return out;
            } catch (const std::exception& e) {
                out.error_message = "Failed to parse LlamaCPP response (no-grammar): " + std::string(e.what());
                return out;
            }
        }

        // Parse JSON response (grammar path)
        try {
            nlohmann::json json_response = nlohmann::json::parse(http_response.text);
            if (!json_response.contains("choices") || !json_response["choices"].is_array() || json_response["choices"].empty()) {
                out.error_message = "Invalid LlamaCPP response format";
                return out;
            }
            out.response = json_response["choices"][0]["message"]["content"];
            out.tokens_used = json_response.value("usage", nlohmann::json::object())["completion_tokens"].get<int>();
            out.success = true;
            return out;
        } catch (const std::exception& e) {
            out.error_message = "Failed to parse LlamaCPP response (with-grammar): " + std::string(e.what());
            return out;
        }

    } catch (const std::exception& e) {
        out.error_message = "Exception forwarding to LlamaCPP: " + std::string(e.what());
        return out;
    }
}

bool APIServer::check_llamacpp_health() const {
    try {
        // Make a simple test request to LlamaCPP
        std::string url = "http://" + config_.llama_host + ":" +
                         std::to_string(config_.llama_port) + "/health";

        cpr::Response response = cpr::Get(
            cpr::Url{url},
            cpr::Timeout{5000} // 5 second timeout for health check
        );

        return response.status_code == 200;

    } catch (const std::exception& e) {
        logger_->error("Health check failed: {}", e.what());
        return false;
    }
}

void APIServer::send_xml_error(httplib::Response& res, int status_code, const std::string& message) const {
    // XML escape utility
    auto xml_escape = [](const std::string& in) -> std::string {
        std::string out;
        out.reserve(in.size());
        for (char c : in) {
            switch (c) {
                case '&':  out += "&";  break;
                case '<':  out += "<";   break;
                case '>':  out += ">";   break;
                case '"':  out += "&quot;"; break;
                case '\'': out += "'"; break;
                default:   out += c;        break;
            }
        }
        return out;
    };

    std::ostringstream oss;
    oss << "<error>"
        << "<message>" << xml_escape(message) << "</message>"
        << "<status_code>" << status_code << "</status_code>"
        << "</error>";

    res.status = status_code;
    res.set_content(oss.str(), "application/xml");
}
// -------- XML Helper Functions for Session Support --------

bool APIServer::is_xml_request(const httplib::Request& req) const {
    const std::string content_type = req.get_header_value("Content-Type");
    return content_type.find("application/xml") != std::string::npos;
}

bool APIServer::wants_xml_response(const httplib::Request& req) const {
    const std::string accept = req.get_header_value("Accept");
    // Check both Accept header and Content-Type (for symmetry in POST/PUT)
    if (!accept.empty() && accept.find("application/xml") != std::string::npos) {
        return true;
    }
    return is_xml_request(req);
}

std::string APIServer::extract_cdata_or_text(tinyxml2::XMLElement* elem) const {
    if (!elem) return "";
    
    auto* first_child = elem->FirstChild();
    if (!first_child) return "";
    
    if (auto* text = first_child->ToText()) {
        std::string content = text->Value() ? std::string(text->Value()) : std::string();
        
        // Validate CDATA content doesn't contain CDATA end marker
        if (text->CData() && content.find("]]>") != std::string::npos) {
            throw std::invalid_argument("CDATA content cannot contain ']]>'");
        }
        
        if (!text->CData()) {
            logger_->warn("Element content not provided as CDATA; using plain text");
        }
        
        return content;
    }
    
    throw std::invalid_argument("Element must contain CDATA or text node");
}

std::vector<std::string> APIServer::extract_stop_sequences_xml(tinyxml2::XMLElement* root) const {
    std::vector<std::string> sequences;
    
    auto* stop_elem = root->FirstChildElement("stop_sequences");
    if (!stop_elem) return sequences;
    
    for (auto* stop = stop_elem->FirstChildElement("stop"); stop; stop = stop->NextSiblingElement("stop")) {
        const char* text = stop->GetText();
        if (text) {
            sequences.push_back(std::string(text));
        }
    }
    
    return sequences;
}

std::string APIServer::xml_escape(const std::string& in) const {
    std::string out;
    out.reserve(in.size());
    for (char c : in) {
        switch (c) {
            case '&':  out += "&amp;";  break;
            case '<':  out += "&lt;";   break;
            case '>':  out += "&gt;";   break;
            case '"':  out += "&quot;"; break;
            case '\'': out += "&apos;"; break;
            default:   out += c;        break;
        }
    }
    return out;
}

void APIServer::add_cdata_element(tinyxml2::XMLDocument& doc, 
                                   tinyxml2::XMLElement* parent,
                                   const char* name, 
                                   const std::string& content) const {
    auto* elem = doc.NewElement(name);
    auto* cdata = doc.NewText(content.c_str());
    cdata->SetCData(true);
    elem->InsertEndChild(cdata);
    parent->InsertEndChild(elem);
}

void APIServer::add_text_element(tinyxml2::XMLDocument& doc,
                                  tinyxml2::XMLElement* parent,
                                  const char* name,
                                  const std::string& value) const {
    auto* elem = doc.NewElement(name);
    elem->SetText(value.c_str());
    parent->InsertEndChild(elem);
}

void APIServer::send_error_response(httplib::Response& res,
                                     int status_code,
                                     const std::string& message,
                                     bool use_xml) const {
    if (use_xml) {
        send_xml_error(res, status_code, message);
    } else {
        send_json_error(res, status_code, message);
    }
}

// -------- XML Validation Function --------

bool APIServer::validate_action_xml(const std::string& xml, std::string& error_message) const {
    // Parse the XML
    tinyxml2::XMLDocument doc;
    tinyxml2::XMLError parse_result = doc.Parse(xml.c_str());
    
    if (parse_result != tinyxml2::XML_SUCCESS) {
        error_message = "XML parse error: ";
        error_message += doc.ErrorStr() ? doc.ErrorStr() : "unknown error";
        return false;
    }
    
    // Check for <Action> root element
    auto* action_elem = doc.FirstChildElement("Action");
    if (!action_elem) {
        error_message = "Missing <Action> root element";
        return false;
    }
    
    // Validate 'id' attribute
    const char* id_attr = action_elem->Attribute("id");
    if (!id_attr) {
        error_message = "Missing 'id' attribute in <Action>";
        return false;
    }
    
    std::string id(id_attr);
    static const std::vector<std::string> allowed_actions = {
        "npc_speak", "place_marker", "offer_gate_task",
        "redirect_to_npc", "adjust_affinity_light"
    };
    
    if (std::find(allowed_actions.begin(), allowed_actions.end(), id) == allowed_actions.end()) {
        error_message = "Invalid action id '" + id + "'. Must be one of: npc_speak, place_marker, offer_gate_task, redirect_to_npc, adjust_affinity_light";
        return false;
    }
    
    // Check for required <Arguments> element
    auto* args_elem = action_elem->FirstChildElement("Arguments");
    if (!args_elem) {
        error_message = "Missing required <Arguments> element";
        return false;
    }
    
    // Check for required <Rationale> element
    auto* rationale_elem = action_elem->FirstChildElement("Rationale");
    if (!rationale_elem) {
        error_message = "Missing required <Rationale> element";
        return false;
    }
    
    // Validate Rationale length (<=120 characters)
    const char* rationale_text = rationale_elem->GetText();
    if (rationale_text) {
        std::string rationale(rationale_text);
        if (rationale.length() > 120) {
            error_message = "Rationale too long (" + std::to_string(rationale.length()) +
                          " characters). Maximum is 120 characters";
            return false;
        }
    }
    
    // <UIHints> is optional, so we don't validate it
    
    return true;
}

// -------- End of XML Helper Functions --------


} // namespace kcpp