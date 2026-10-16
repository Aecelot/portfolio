#pragma once

#include <string>
#include <memory>

namespace kcpp {

struct StartSpec {
    std::string program;
    std::string working_dir;
    std::string arguments;
    std::string log_path;
};

class Process {
public:
    virtual ~Process() = default;
    virtual bool is_running() const = 0;
    virtual int get_pid() const = 0;
    virtual bool terminate(int timeout_ms = 5000) = 0;
};

// LlamaCPP process management (if needed in future)
// std::unique_ptr<Process> start_llama(const StartSpec& spec);
// bool stop_llama();
// bool is_llama_running();

}