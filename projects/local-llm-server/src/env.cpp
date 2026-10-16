#include "kcpp/env.hpp"
#include <fstream>
#include <sstream>
#include <algorithm>
#include <iostream>
#include <Windows.h>

namespace kcpp {

namespace {

std::string parse_env_value(const std::string& line, const std::string& key) {
    if (line.empty() || line[0] == '#') {
        return "";
    }

    size_t pos = line.find('=');
    if (pos == std::string::npos) {
        return "";
    }

    std::string current_key = line.substr(0, pos);
    if (current_key != key) {
        return "";
    }

    std::string value = line.substr(pos + 1);

    // Trim whitespace
    value.erase(value.begin(), std::find_if(value.begin(), value.end(), [](unsigned char ch) {
        return !std::isspace(ch);
    }));
    value.erase(std::find_if(value.rbegin(), value.rend(), [](unsigned char ch) {
        return !std::isspace(ch);
    }).base(), value.end());

    return value;
}

int parse_int_value(const std::string& value, const std::string& key) {
    if (value.empty()) {
        throw EnvError("Missing value for required key: " + key);
    }

    try {
        return std::stoi(value);
    } catch (const std::exception&) {
        throw EnvError("Invalid integer value for " + key + ": " + value);
    }
}

} // anonymous namespace

Env load_env(const std::wstring& path) {
    Env env{};

    // Default values
    env.llm_host = "127.0.0.1";
    env.llm_port = 5001;
    env.llm_model_path = "../models/mistral-7b-instruct-v0.3/mistral-7b-instruct-v0.3.Q5_K_M.gguf";
    env.llm_threads = 8;
    env.llm_ctx = 4096;
    env.llm_gpulayers = 35;

    // Convert wide string path to UTF-8 for file operations
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, path.c_str(), (int)path.size(), NULL, 0, NULL, NULL);
    std::string utf8_path(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, path.c_str(), (int)path.size(), &utf8_path[0], size_needed, NULL, NULL);

    std::ifstream file(utf8_path);
    if (!file.is_open()) {
        // If file doesn't exist, return defaults
        return env;
    }

    std::string line;
    while (std::getline(file, line)) {
        // Parse each environment variable
        std::string host = parse_env_value(line, "LLM_HOST");
        if (!host.empty()) {
            env.llm_host = host;
            continue;
        }

        std::string port = parse_env_value(line, "LLM_PORT");
        if (!port.empty()) {
            env.llm_port = parse_int_value(port, "LLM_PORT");
            continue;
        }

        std::string model_path = parse_env_value(line, "LLM_MODEL_PATH");
        if (!model_path.empty()) {
            env.llm_model_path = model_path;
            continue;
        }

        std::string threads = parse_env_value(line, "LLM_THREADS");
        if (!threads.empty()) {
            env.llm_threads = parse_int_value(threads, "LLM_THREADS");
            continue;
        }

        std::string ctx = parse_env_value(line, "LLM_CTX");
        if (!ctx.empty()) {
            env.llm_ctx = parse_int_value(ctx, "LLM_CTX");
            continue;
        }

        std::string gpulayers = parse_env_value(line, "LLM_GPULAYERS");
        if (!gpulayers.empty()) {
            env.llm_gpulayers = parse_int_value(gpulayers, "LLM_GPULAYERS");
            continue;
        }
    }

    file.close();

    // Validate required values
    if (env.llm_port <= 0 || env.llm_port > 65535) {
        throw EnvError("Invalid port number: " + std::to_string(env.llm_port));
    }

    if (env.llm_threads <= 0) {
        throw EnvError("Invalid thread count: " + std::to_string(env.llm_threads));
    }

    if (env.llm_ctx <= 0) {
        throw EnvError("Invalid context size: " + std::to_string(env.llm_ctx));
    }

    if (env.llm_gpulayers < 0) {
        throw EnvError("Invalid GPU layers: " + std::to_string(env.llm_gpulayers));
    }

    return env;
}

}