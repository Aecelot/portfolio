#include "kcpp/cli.hpp"
#include "kcpp/version.hpp"
#include "kcpp/env.hpp"
#include "kcpp/process.hpp"
#include "kcpp/http.hpp"
#include "kcpp/api_server.hpp"
#include "kcpp/log.hpp"
#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
#include <fstream>
#include <iomanip>
#include <sstream>

namespace kcpp {

namespace {

struct CliOptions {
    std::string env_path = "./config/env.local";
    std::string host = "127.0.0.1";
    int port = 8080;
    std::string llama_host = "127.0.0.1";
    int llama_port = 5001;
    int tokens = 512;
    bool tail_logs = false;
    bool dry_run = false;
};

CliOptions parse_arguments(int argc, char** argv) {
    CliOptions opts;

    for (int i = 2; i < argc; ++i) {
        std::string arg = argv[i];

        // Check if this is a flag (no value needed)
        if (arg == "--dry-run") {
            opts.dry_run = true;
            continue;
        } else if (arg == "--tail") {
            opts.tail_logs = true;
            continue;
        }

        // For options that need values
        if (i + 1 >= argc) {
            std::cerr << "Missing value for option: " << arg << std::endl;
            continue;
        }

        std::string value = argv[++i];

        if (arg == "--env") {
            opts.env_path = value;
        } else if (arg == "--host") {
            opts.host = value;
        } else if (arg == "--port") {
            try {
                opts.port = std::stoi(value);
            } catch (const std::exception&) {
                std::cerr << "Invalid port number: " << value << std::endl;
            }
        } else if (arg == "--llama-host") {
            opts.llama_host = value;
        } else if (arg == "--llama-port") {
            try {
                opts.llama_port = std::stoi(value);
            } catch (const std::exception&) {
                std::cerr << "Invalid llama port number: " << value << std::endl;
            }
        } else if (arg == "--tokens") {
            try {
                opts.tokens = std::stoi(value);
            } catch (const std::exception&) {
                std::cerr << "Invalid token count: " << value << std::endl;
            }
        } else {
            std::cerr << "Unknown option: " << arg << std::endl;
        }
    }

    return opts;
}

void print_usage(const char* program_name) {
    std::cout << "kcppctl v" << KCPPCTL_VERSION << " - LLM Control Tool" << std::endl;
    std::cout << "Usage: " << program_name << " <command> [options]" << std::endl;
    std::cout << std::endl;
    std::cout << "Server Commands:" << std::endl;
    std::cout << "  serve [--host host] [--port port] [--llama-host host] [--llama-port port]" << std::endl;
    std::cout << "        Start XML API wrapper server (default: 127.0.0.1:8080 -> llama.cpp at 127.0.0.1:5001)" << std::endl;
    std::cout << std::endl;
    std::cout << "Test Commands:" << std::endl;
    std::cout << "  smoke [--host host] [--port port]" << std::endl;
    std::cout << "        Test API connectivity" << std::endl;
    std::cout << "  perf [--host host] [--port port] [--tokens n]" << std::endl;
    std::cout << "        Performance benchmark" << std::endl;
    std::cout << std::endl;
    std::cout << "Other Commands:" << std::endl;
    std::cout << "  logs [--tail]" << std::endl;
    std::cout << "        Show recent logs" << std::endl;
    std::cout << std::endl;
    std::cout << "Examples:" << std::endl;
    std::cout << "  " << program_name << " serve" << std::endl;
    std::cout << "  " << program_name << " serve --port 8080 --llama-port 5001" << std::endl;
    std::cout << "  " << program_name << " smoke --host 127.0.0.1 --port 8080" << std::endl;
    std::cout << "  " << program_name << " perf --host 127.0.0.1 --port 8080 --tokens 100" << std::endl;
}


int cmd_smoke(const CliOptions& opts) {
    auto logger = get_logger();

    std::cout << "Running smoke test against " << opts.host << ":" << opts.port << "..." << std::endl;

    auto result = smoke_test(opts.host, opts.port);

    if (result.success) {
        std::cout << "✓ Smoke test PASSED" << std::endl;
        std::cout << "Response: " << result.response << std::endl;
        std::cout << "Latency: " << result.latency.count() << "ms" << std::endl;
        logger->info("Smoke test passed in {}ms", result.latency.count());
        return 0;
    } else {
        std::cout << "✗ Smoke test FAILED" << std::endl;
        std::cout << "Error: " << result.error_message << std::endl;
        if (result.latency.count() > 0) {
            std::cout << "Latency: " << result.latency.count() << "ms" << std::endl;
        }
        logger->error("Smoke test failed: {}", result.error_message);
        return 1;
    }
}

int cmd_perf(const CliOptions& opts) {
    auto logger = get_logger();

    std::cout << "Running performance test (" << opts.tokens << " tokens) against "
              << opts.host << ":" << opts.port << "..." << std::endl;

    auto result = perf_tokens_per_sec(opts.host, opts.port, opts.tokens);

    if (result.error_message.empty()) {
        std::cout << "✓ Performance test completed" << std::endl;
        std::cout << "Tokens generated: " << result.tokens_generated << std::endl;
        std::cout << "Total time: " << result.total_time.count() << "ms" << std::endl;
        std::cout << "Tokens per second: " << std::fixed << std::setprecision(2)
                  << result.tokens_per_second << std::endl;
        logger->info("Performance test: {:.2f} tokens/sec", result.tokens_per_second);
        return 0;
    } else {
        std::cout << "✗ Performance test FAILED" << std::endl;
        std::cout << "Error: " << result.error_message << std::endl;
        if (result.total_time.count() > 0) {
            std::cout << "Time before failure: " << result.total_time.count() << "ms" << std::endl;
        }
        logger->error("Performance test failed: {}", result.error_message);
        return 1;
    }
}

int cmd_logs(const CliOptions& opts) {
    auto logger = get_logger();

    if (opts.tail_logs) {
        std::cout << "Tailing logs... (Ctrl+C to stop)" << std::endl;
        logger->info("Log tail requested - implement when threading available");
        std::cout << "Log tailing not yet implemented" << std::endl;
        return 1;
    } else {
        std::cout << "Showing recent logs..." << std::endl;
        logger->info("Recent logs requested - implement file reading");
        std::cout << "Log display not yet implemented" << std::endl;
        return 0;
    }
}

int cmd_serve(const CliOptions& opts) {
    auto logger = get_logger();
    
    std::cout << "Starting XML API Server..." << std::endl;
    std::cout << "  Listening on: " << opts.host << ":" << opts.port << std::endl;
    std::cout << "  Backend (llama.cpp): " << opts.llama_host << ":" << opts.llama_port << std::endl;
    std::cout << std::endl;
    
    // Create and configure API server
    APIServer server;
    APIServerConfig config;
    config.host = opts.host;
    config.port = opts.port;
    config.llama_host = opts.llama_host;
    config.llama_port = opts.llama_port;
    
    if (!server.initialize(config)) {
        std::cerr << "Failed to initialize API server" << std::endl;
        logger->error("API server initialization failed");
        return 1;
    }
    
    if (!server.start()) {
        std::cerr << "Failed to start API server" << std::endl;
        logger->error("API server start failed");
        return 1;
    }
    
    std::cout << "✓ Server started successfully" << std::endl;
    std::cout << std::endl;
    std::cout << "Endpoints available:" << std::endl;
    std::cout << "  POST http://" << opts.host << ":" << opts.port << "/api/v1/generate (XML stateless)" << std::endl;
    std::cout << "  POST http://" << opts.host << ":" << opts.port << "/api/v1/session/create (JSON/XML)" << std::endl;
    std::cout << "  GET  http://" << opts.host << ":" << opts.port << "/health" << std::endl;
    std::cout << "  GET  http://" << opts.host << ":" << opts.port << "/api/v1/version" << std::endl;
    std::cout << std::endl;
    std::cout << "Press Ctrl+C to stop the server..." << std::endl;
    
    logger->info("API server started on {}:{}", opts.host, opts.port);
    
    // Keep the server running
    std::cin.get();
    
    std::cout << std::endl << "Shutting down server..." << std::endl;
    server.stop();
    logger->info("API server stopped");
    
    return 0;
}

} // anonymous namespace

int run_cli(int argc, char** argv) {
    // Initialize logger
    init_logger();

    if (argc < 2) {
        print_usage(argv[0]);
        return 1;
    }

    std::string command = argv[1];
    CliOptions opts = parse_arguments(argc, argv);

    // Server commands
    if (command == "serve") {
        return cmd_serve(opts);
    }
    // Test commands
    else if (command == "smoke") {
        return cmd_smoke(opts);
    } else if (command == "perf") {
        return cmd_perf(opts);
    }
    // Other commands
    else if (command == "logs") {
        return cmd_logs(opts);
    } else if (command == "--help" || command == "-h") {
        print_usage(argv[0]);
        return 0;
    } else {
        std::cout << "Unknown command: " << command << std::endl;
        std::cout << "Use --help for usage information" << std::endl;
        return 1;
    }
}

}