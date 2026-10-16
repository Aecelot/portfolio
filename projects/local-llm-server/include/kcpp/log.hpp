#pragma once

#include <memory>
#include <string>
#include <spdlog/spdlog.h>

namespace spdlog {
class logger;
}

namespace kcpp {

void init_logger(const std::wstring& log_dir = L"./logs/");
std::shared_ptr<spdlog::logger> get_logger();

}