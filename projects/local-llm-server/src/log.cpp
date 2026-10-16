#include "kcpp/log.hpp"
#include "kcpp/version.hpp"
#include <spdlog/spdlog.h>
#include <spdlog/sinks/rotating_file_sink.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <iostream>
#include <Windows.h>

namespace kcpp {

namespace {

std::shared_ptr<spdlog::logger> g_logger = nullptr;

} // anonymous namespace

void init_logger(const std::wstring& log_dir) {
    try {
        // Convert wide string to UTF-8 for spdlog
        int size_needed = WideCharToMultiByte(CP_UTF8, 0, log_dir.c_str(), (int)log_dir.size(), NULL, 0, NULL, NULL);
        std::string utf8_log_dir(size_needed, 0);
        WideCharToMultiByte(CP_UTF8, 0, log_dir.c_str(), (int)log_dir.size(), &utf8_log_dir[0], size_needed, NULL, NULL);

        // Create log directory if it doesn't exist
        CreateDirectoryA(utf8_log_dir.c_str(), NULL);

        // Create rotating file sink (5 MB per file, max 3 files)
        auto rotating_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
            utf8_log_dir + "/kcppctl.log",
            5 * 1024 * 1024, // 5 MB
            3                // max 3 files
        );

        // Create console sink with color support
        auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();

        // Combine sinks
        std::vector<spdlog::sink_ptr> sinks{console_sink, rotating_sink};

        // Create logger with both sinks
        g_logger = std::make_shared<spdlog::logger>("kcppctl", sinks.begin(), sinks.end());

        // Set pattern: [YYYY-MM-DD HH:MM:SS] [level] message
        g_logger->set_pattern("[%Y-%m-%d %H:%M:%S] [%l] %v");

        // Set level to info (will show info, warn, error)
        g_logger->set_level(spdlog::level::info);

        // Flush every 3 seconds
        g_logger->flush_on(spdlog::level::warn);

        // Register as default logger
        spdlog::set_default_logger(g_logger);

        g_logger->info("kcppctl v{} logger initialized", KCPPCTL_VERSION);
        g_logger->info("Log directory: {}", utf8_log_dir);

    } catch (const std::exception& e) {
        // Fallback to console-only logging if file logging fails
        try {
            auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
            g_logger = std::make_shared<spdlog::logger>("kcppctl", console_sink);

            g_logger->set_pattern("[%Y-%m-%d %H:%M:%S] [%l] %v");
            g_logger->set_level(spdlog::level::info);
            spdlog::set_default_logger(g_logger);

            g_logger->warn("Failed to initialize file logging, using console only: {}", e.what());
        } catch (const std::exception& fallback_error) {
            // If even console logging fails, print to stderr
            std::cerr << "Failed to initialize logging: " << fallback_error.what() << std::endl;
        }
    }
}

std::shared_ptr<spdlog::logger> get_logger() {
    if (g_logger == nullptr) {
        // Initialize with default settings if not already done
        init_logger(L"./logs/");
    }
    return g_logger;
}

}