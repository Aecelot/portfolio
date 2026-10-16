#pragma once

#include <string>
#include <stdexcept>

namespace kcpp {

struct Env {
    std::string llm_host;
    int llm_port;
    std::string llm_model_path;
    int llm_threads;
    int llm_ctx;
    int llm_gpulayers;
};

class EnvError : public std::runtime_error {
public:
    explicit EnvError(const std::string& message) : std::runtime_error(message) {}
};

Env load_env(const std::wstring& path = L"./config/env.local");

}