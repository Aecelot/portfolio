#pragma once

#include <string>
#include <chrono>

namespace kcpp {

struct SmokeResult {
    bool success;
    std::string response;
    std::chrono::milliseconds latency;
    std::string error_message;
};

struct PerfResult {
    double tokens_per_second;
    int tokens_generated;
    std::chrono::milliseconds total_time;
    std::string error_message;
};

// LlamaCPP API functions
SmokeResult smoke_test(const std::string& host, int port);
PerfResult perf_tokens_per_sec(const std::string& host, int port, int tokens);

}