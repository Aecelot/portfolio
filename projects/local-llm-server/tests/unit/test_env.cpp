#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "kcpp/env.hpp"
#include "../utils/test_helpers.hpp"

namespace kcpp {

class EnvTest : public kcpp_test::KcppTestBase {
};

TEST_F(EnvTest, LoadEnv_WithValidFile_ShouldParseAllValues) {
    // Arrange
    std::string env_content =
        "LLM_HOST=192.168.1.100\n"
        "LLM_PORT=8080\n"
        "LLM_MODEL_PATH=/models/llama.gguf\n"
        "LLM_THREADS=16\n"
        "LLM_CTX=8192\n"
        "LLM_GPULAYERS=50\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.llm_host, "192.168.1.100");
    EXPECT_EQ(env.llm_port, 8080);
    EXPECT_EQ(env.llm_model_path, "/models/llama.gguf");
    EXPECT_EQ(env.llm_threads, 16);
    EXPECT_EQ(env.llm_ctx, 8192);
    EXPECT_EQ(env.llm_gpulayers, 50);
}

TEST_F(EnvTest, LoadEnv_WithMissingFile_ShouldReturnDefaults) {
    // Arrange
    std::string non_existent_file = "non_existent_file.env";

    // Act
    Env env = load_env(std::wstring(non_existent_file.begin(), non_existent_file.end()));

    // Assert
    EXPECT_EQ(env.llm_host, "127.0.0.1");
    EXPECT_EQ(env.llm_port, 5001);
    EXPECT_EQ(env.llm_model_path, "../models/mistral-7b-instruct-v0.3/mistral-7b-instruct-v0.3.Q5_K_M.gguf");
    EXPECT_EQ(env.llm_threads, 8);
    EXPECT_EQ(env.llm_ctx, 4096);
    EXPECT_EQ(env.llm_gpulayers, 35);
}

TEST_F(EnvTest, LoadEnv_WithCommentsAndEmptyLines_ShouldIgnoreThem) {
    // Arrange
    std::string env_content =
        "# This is a comment\n"
        "\n"
        "LLM_HOST=test.example.com\n"
        "# Another comment\n"
        "LLM_PORT=9000\n"
        "\n"
        "LLM_THREADS=4\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, "test.example.com");
    EXPECT_EQ(env.kcpp_port, 9000);
    EXPECT_EQ(env.kcpp_threads, 4);
    // Other values should be defaults
    EXPECT_EQ(env.kcpp_model_path, "../models/mistral-7b-instruct-v0.3/mistral-7b-instruct-v0.3.Q5_K_M.gguf");
}

TEST_F(EnvTest, LoadEnv_WithWhitespace_ShouldTrimValues) {
    // Arrange
    std::string env_content =
        "KCPP_HOST=  spaced.host.com  \n"
        "KCPP_PORT=  3000  \n"
        "KCPP_MODEL_PATH=  /path/with spaces.gguf  \n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, "spaced.host.com");
    EXPECT_EQ(env.kcpp_port, 3000);
    EXPECT_EQ(env.kcpp_model_path, "/path/with spaces.gguf");
}

TEST_F(EnvTest, LoadEnv_WithInvalidPort_ShouldThrow) {
    // Arrange
    std::vector<std::string> test_cases = {
        "KCPP_PORT=0",
        "KCPP_PORT=-1",
        "KCPP_PORT=70000",
        "KCPP_PORT=not_a_number"
    };

    for (const auto& port_value : test_cases) {
        std::string env_content = port_value + "\n";
        std::string env_file = create_test_env_file(env_content);

        // Act & Assert
        EXPECT_THROW(
            load_env(std::wstring(env_file.begin(), env_file.end())),
            EnvError
        );
    }
}

TEST_F(EnvTest, LoadEnv_WithInvalidThreads_ShouldThrow) {
    // Arrange
    std::string env_content = "KCPP_THREADS=0\n";
    std::string env_file = create_test_env_file(env_content);

    // Act & Assert
    EXPECT_THROW(
        load_env(std::wstring(env_file.begin(), env_file.end())),
        EnvError
    );
}

TEST_F(EnvTest, LoadEnv_WithInvalidContext_ShouldThrow) {
    // Arrange
    std::string env_content = "KCPP_CTX=0\n";
    std::string env_file = create_test_env_file(env_content);

    // Act & Assert
    EXPECT_THROW(
        load_env(std::wstring(env_file.begin(), env_file.end())),
        EnvError
    );
}

TEST_F(EnvTest, LoadEnv_WithInvalidGpuLayers_ShouldThrow) {
    // Arrange
    std::string env_content = "KCPP_GPULAYERS=-1\n";
    std::string env_file = create_test_env_file(env_content);

    // Act & Assert
    EXPECT_THROW(
        load_env(std::wstring(env_file.begin(), env_file.end())),
        EnvError
    );
}

TEST_F(EnvTest, LoadEnv_WithInvalidIntegerValues_ShouldThrow) {
    // Arrange
    std::vector<std::string> test_cases = {
        "KCPP_PORT=not_a_number\n",
        "KCPP_THREADS=abc\n",
        "KCPP_CTX=12.34\n",
        "KCPP_GPULAYERS=1e10\n"
    };

    for (const auto& test_case : test_cases) {
        std::string env_file = create_test_env_file(test_case);

        // Act & Assert
        EXPECT_THROW(
            load_env(std::wstring(env_file.begin(), env_file.end())),
            EnvError
        );
    }
}

TEST_F(EnvTest, LoadEnv_WithPartialConfiguration_ShouldUseDefaultsForMissing) {
    // Arrange
    std::string env_content =
        "KCPP_HOST=partial.test\n"
        "KCPP_PORT=7777\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, "partial.test");
    EXPECT_EQ(env.kcpp_port, 7777);
    // These should be defaults
    EXPECT_EQ(env.kcpp_threads, 8);
    EXPECT_EQ(env.kcpp_ctx, 4096);
    EXPECT_EQ(env.kcpp_gpulayers, 35);
}

TEST_F(EnvTest, LoadEnv_WithUnicodePath_ShouldHandleCorrectly) {
    // Arrange
    std::string env_content = "KCPP_MODEL_PATH=C:/测试路径/model.gguf\n";
    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_model_path, "C:/测试路径/model.gguf");
}

TEST_F(EnvTest, LoadEnv_WithMultipleSameKeys_ShouldUseLastValue) {
    // Arrange
    std::string env_content =
        "KCPP_HOST=first.host\n"
        "KCPP_HOST=second.host\n"
        "KCPP_HOST=third.host\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, "third.host");
}

TEST_F(EnvTest, LoadEnv_WithBoundaryValues_ShouldAcceptValidRanges) {
    // Arrange
    std::string env_content =
        "KCPP_PORT=1\n"
        "KCPP_THREADS=1\n"
        "KCPP_CTX=1\n"
        "KCPP_GPULAYERS=0\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_port, 1);
    EXPECT_EQ(env.kcpp_threads, 1);
    EXPECT_EQ(env.kcpp_ctx, 1);
    EXPECT_EQ(env.kcpp_gpulayers, 0);
}

TEST_F(EnvTest, LoadEnv_WithMaxValidValues_ShouldAccept) {
    // Arrange
    std::string env_content =
        "KCPP_PORT=65535\n"
        "KCPP_THREADS=1000\n"
        "KCPP_CTX=100000\n"
        "KCPP_GPULAYERS=1000\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_port, 65535);
    EXPECT_EQ(env.kcpp_threads, 1000);
    EXPECT_EQ(env.kcpp_ctx, 100000);
    EXPECT_EQ(env.kcpp_gpulayers, 1000);
}

TEST_F(EnvTest, LoadEnv_WithMalformedLines_ShouldIgnore) {
    // Arrange
    std::string env_content =
        "KCPP_HOST=valid.host\n"
        "INVALID_LINE_FORMAT\n"
        "ANOTHER_INVALID_LINE\n"
        "KCPP_PORT=8080\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, "valid.host");
    EXPECT_EQ(env.kcpp_port, 8080);
}

TEST_F(EnvTest, LoadEnv_WithEmptyValues_ShouldHandleGracefully) {
    // Arrange
    std::string env_content =
        "KCPP_HOST=\n"
        "KCPP_PORT=\n";

    std::string env_file = create_test_env_file(env_content);

    // Act & Assert
    EXPECT_THROW(
        load_env(std::wstring(env_file.begin(), env_file.end())),
        EnvError
    );
}

TEST_F(EnvTest, LoadEnv_WithVeryLargeFiles_ShouldHandle) {
    // Arrange
    std::vector<std::string> lines;
    lines.push_back("KCPP_HOST=test.host");
    lines.push_back("KCPP_PORT=5001");

    // Add many empty lines and comments
    for (int i = 0; i < 1000; ++i) {
        lines.push_back("# Comment " + std::to_string(i));
        lines.push_back("");
    }
    lines.push_back("KCPP_THREADS=4");

    kcpp_test::TempFile temp_file(lines);
    std::string env_file = temp_file.get_path();

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, "test.host");
    EXPECT_EQ(env.kcpp_port, 5001);
    EXPECT_EQ(env.kcpp_threads, 4);
}

TEST_F(EnvTest, LoadEnv_WithSpecialCharacters_ShouldPreserve) {
    // Arrange
    std::string env_content =
        "KCPP_HOST=host-with_special.chars\n"
        "KCPP_MODEL_PATH=/path/with/üñíçødé/chars.gguf\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, "host-with_special.chars");
    EXPECT_EQ(env.kcpp_model_path, "/path/with/üñíçødé/chars.gguf");
}

TEST_F(EnvTest, LoadEnv_WithLongValues_ShouldHandle) {
    // Arrange
    std::string long_host = kcpp_test::generate_random_string(1000);
    std::string long_path = kcpp_test::generate_random_string(2000);

    std::string env_content =
        "KCPP_HOST=" + long_host + "\n"
        "KCPP_MODEL_PATH=" + long_path + "\n";

    std::string env_file = create_test_env_file(env_content);

    // Act
    Env env = load_env(std::wstring(env_file.begin(), env_file.end()));

    // Assert
    EXPECT_EQ(env.kcpp_host, long_host);
    EXPECT_EQ(env.kcpp_model_path, long_path);
}

}  // namespace kcpp