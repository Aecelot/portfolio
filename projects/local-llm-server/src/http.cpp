#include "kcpp/http.hpp"
#include <cpr/cpr.h>
#include <tinyxml2.h>
#include <chrono>
#include <fstream>
#include <sstream>

namespace kcpp {

namespace {

std::string load_prompt_template(const std::string& template_path) {
    std::ifstream file(template_path);
    if (!file.is_open()) {
        return "";
    }

    std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
    file.close();
    return content;
}

std::string build_prompt_with_tokens(const std::string& template_content, int tokens) {
    std::string prompt = template_content;

    // Replace {{TOKENS}} placeholder with actual token count
    size_t pos = prompt.find("{{TOKENS}}");
    if (pos != std::string::npos) {
        prompt.replace(pos, 10, std::to_string(tokens));
    }

    return prompt;
}

} // anonymous namespace

SmokeResult smoke_test(const std::string& host, int port) {
    SmokeResult result{};

    try {
        // Load smoke test prompt
        std::string prompt_template = load_prompt_template("./scripts/smoke_prompt.tpl");
        if (prompt_template.empty()) {
            result.error_message = "Failed to load smoke prompt template";
            return result;
        }

        // Build XML payload (Option A schema)
        std::ostringstream xml_body;
        xml_body << "<request>"
                 << "<prompt><![CDATA[" << prompt_template << "]]></prompt>"
                 << "<max_tokens>10</max_tokens>"
                 << "<temperature>0.1</temperature>"
                 << "</request>";

        // Build URL
        std::string url = "http://" + host + ":" + std::to_string(port) + "/api/v1/generate";

        // Record start time
        auto start_time = std::chrono::high_resolution_clock::now();

        // Make HTTP request
        cpr::Response response = cpr::Post(
            cpr::Url{url},
            cpr::Header{{"Content-Type", "application/xml"}},
            cpr::Body{xml_body.str()},
            cpr::Timeout{3000} // 3 second timeout
        );

        // Record end time
        auto end_time = std::chrono::high_resolution_clock::now();
        auto latency = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time);

        result.latency = latency;

        if (response.status_code != 200) {
            result.error_message = "HTTP " + std::to_string(response.status_code) + ": " + response.error.message;
            return result;
        }

        // Parse XML response
        tinyxml2::XMLDocument doc;
        auto parse_rc = doc.Parse(response.text.c_str(), response.text.size());
        if (parse_rc != tinyxml2::XML_SUCCESS) {
            result.error_message = std::string("Failed to parse XML response: ") +
                                   (doc.ErrorStr() ? doc.ErrorStr() : "parse error");
            return result;
        }

        auto* root = doc.FirstChildElement("response");
        if (!root) {
            result.error_message = "Invalid response format: missing <response>";
            return result;
        }

        std::string response_text;
        if (auto* text_el = root->FirstChildElement("text")) {
            if (const char* t = text_el->GetText()) {
                response_text = t;
            }
        }

        // Check if response contains "pong"
        if (response_text.find("pong") != std::string::npos) {
            result.success = true;
            result.response = response_text;
        } else {
            result.error_message = "Response does not contain 'pong': " + response_text;
        }

    } catch (const std::exception& e) {
        result.error_message = "Exception during smoke test: " + std::string(e.what());
    }

    return result;
}

PerfResult perf_tokens_per_sec(const std::string& host, int port, int tokens) {
    PerfResult result{};

    try {
        // Load performance test prompt
        std::string prompt_template = load_prompt_template("./scripts/perf_prompt.tpl");
        if (prompt_template.empty()) {
            result.error_message = "Failed to load performance prompt template";
            return result;
        }

        // Build prompt with token count
        std::string prompt = build_prompt_with_tokens(prompt_template, tokens);

        // Build XML payload (Option A schema)
        std::ostringstream xml_body;
        xml_body << "<request>"
                 << "<prompt><![CDATA[" << prompt << "]]></prompt>"
                 << "<max_tokens>" << tokens << "</max_tokens>"
                 << "<temperature>0.7</temperature>"
                 << "</request>";

        // Build URL
        std::string url = "http://" + host + ":" + std::to_string(port) + "/api/v1/generate";

        // Record start time
        auto start_time = std::chrono::high_resolution_clock::now();

        // Make HTTP request
        cpr::Response response = cpr::Post(
            cpr::Url{url},
            cpr::Header{{"Content-Type", "application/xml"}},
            cpr::Body{xml_body.str()},
            cpr::Timeout{30000} // 30 second timeout for performance test
        );

        // Record end time
        auto end_time = std::chrono::high_resolution_clock::now();
        auto total_time = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time);

        result.total_time = total_time;

        if (response.status_code != 200) {
            result.error_message = "HTTP " + std::to_string(response.status_code) + ": " + response.error.message;
            return result;
        }

        // Parse XML response
        tinyxml2::XMLDocument doc;
        auto parse_rc = doc.Parse(response.text.c_str(), response.text.size());
        if (parse_rc != tinyxml2::XML_SUCCESS) {
            result.error_message = std::string("Failed to parse XML response: ") +
                                   (doc.ErrorStr() ? doc.ErrorStr() : "parse error");
            return result;
        }

        auto* root = doc.FirstChildElement("response");
        if (!root) {
            result.error_message = "Invalid response format: missing <response>";
            return result;
        }

        // Get the response text and count tokens (approximate)
        std::string response_text;
        if (auto* text_el = root->FirstChildElement("text")) {
            if (const char* t = text_el->GetText()) {
                response_text = t;
            }
        }

        // Simple token approximation (words as tokens)
        int tokens_generated = 0;
        std::istringstream iss(response_text);
        std::string word;
        while (iss >> word) {
            tokens_generated++;
        }

        result.tokens_generated = tokens_generated;

        if (total_time.count() > 0) {
            // Calculate tokens per second
            double seconds = total_time.count() / 1000.0;
            result.tokens_per_second = static_cast<double>(tokens_generated) / seconds;
        } else {
            result.tokens_per_second = 0.0;
        }

    } catch (const std::exception& e) {
        result.error_message = "Exception during performance test: " + std::string(e.what());
    }

    return result;
}

}