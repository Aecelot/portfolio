cmake_minimum_required(VERSION 3.24 FATAL_ERROR)

project(kcppctl VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# MSVC specific flags
if(MSVC)
    add_compile_options(/W4 /utf-8 /EHsc)
endif()

# Find packages from vcpkg
find_package(cpr CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(fmt CONFIG REQUIRED)
find_package(spdlog CONFIG REQUIRED)
find_package(httplib CONFIG REQUIRED)
find_package(GTest CONFIG REQUIRED)
# Additional dependencies
find_package(cpr CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(spdlog CONFIG REQUIRED)
find_package(fmt CONFIG REQUIRED)
find_package(httplib CONFIG REQUIRED)
find_package(tinyxml2 CONFIG REQUIRED)

# Include directories
include_directories(include)

# Source files
set(SOURCES
    src/main.cpp
    src/env.cpp
    src/process_windows.cpp
    src/http.cpp
    src/log.cpp
    src/cli.cpp
    src/api_server.cpp
)

# Create executable
add_executable(kcppctl ${SOURCES})

# Link libraries
target_link_libraries(kcppctl
    PRIVATE
    cpr::cpr
    nlohmann_json::nlohmann_json
    fmt::fmt
    spdlog::spdlog
    httplib::httplib
    tinyxml2::tinyxml2
    Ws2_32
)

# Install target
install(TARGETS kcppctl DESTINATION bin)

# Enable testing
enable_testing()

# Find GTest
find_package(GTest CONFIG REQUIRED)

# Test sources
set(TEST_SOURCES
    tests/unit/test_simple.cpp
    # tests/unit/test_env.cpp
    # tests/unit/test_process.cpp
    # tests/unit/test_http.cpp
    # tests/unit/test_cli.cpp
    # tests/unit/test_log.cpp
    # tests/integration/test_workflows.cpp
    # tests/utils/test_helpers.cpp
    # tests/utils/mock_server.cpp
    # Main project sources needed for linking
    # src/env.cpp
    # src/process_windows.cpp
    # src/http.cpp
    # src/cli.cpp
    # src/log.cpp
    # src/api_server.cpp
)

# Create test executable
add_executable(kcppctl_tests ${TEST_SOURCES})

# Link test libraries (only GTest for simple tests)
target_link_libraries(kcppctl_tests
    PRIVATE
    GTest::gtest
    GTest::gtest_main
    GTest::gmock
    GTest::gmock_main
)

# Include directories for tests (none needed for simple test)

# Set C++20 for tests
set_target_properties(kcppctl_tests PROPERTIES CXX_STANDARD 20)
set_target_properties(kcppctl_tests PROPERTIES CXX_STANDARD_REQUIRED ON)

# Test definitions
add_test(NAME kcppctl_unit_tests COMMAND kcppctl_tests)