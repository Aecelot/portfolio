#include "kcpp/process.hpp"
#include <memory>
#include <string>
#include <fstream>
#include <sstream>
#include <chrono>
#include <iomanip>
#include <Windows.h>
#include <TlHelp32.h>
#include <processthreadsapi.h>

namespace kcpp {

class WindowsProcess : public Process {
public:
    WindowsProcess(int pid, const std::string& log_path)
        : pid_(pid), log_path_(log_path) {}

    bool is_running() const override {
        HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid_);
        if (process == NULL) {
            return false;
        }
        DWORD exitCode;
        if (GetExitCodeProcess(process, &exitCode)) {
            bool running = (exitCode == STILL_ACTIVE);
            CloseHandle(process);
            return running;
        }
        CloseHandle(process);
        return false;
    }

    int get_pid() const override { return pid_; }

    bool terminate(int timeout_ms = 5000) override {
        HANDLE process = OpenProcess(PROCESS_TERMINATE, FALSE, pid_);
        if (process == NULL) {
            return false;
        }

        bool result = TerminateProcess(process, 0) != 0;
        CloseHandle(process);
        return result;
    }

private:
    int pid_;
    std::string log_path_;
};

// LlamaCPP process management functions can be added here if needed in the future

}