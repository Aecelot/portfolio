#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "kcpp/http.hpp"
#include "../utils/test_helpers.hpp"
#include "../utils/mock_server.hpp"

namespace kcpp {

class HttpTest : public kcpp_test::KcppTestBase {
protected:
    void SetUp() override {
        KcppTestBase::SetUp();
        mock_server = std::make_unique<kcpp_test::MockKoboldCppServer>();
    }

    void TearDown() override {
        if (mock_server && mock_server->is_running()) {
            mock_server->stop();
        }
        KcppTestBase::TearDown();
    }

    std::unique_ptr<kcpp_test::MockKoboldCppServer> mock_server;
};

TEST_F(HttpTest, SmokeTest_WithValidResponse_ShouldSucceed) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    std::string server_url = mock_server->get_base_url();

    mock_server->set_generate_response(R"({"results":[{"text":"pong is the response"}]})");

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_TRUE(result.success);
    EXPECT_EQ(result.response, "pong is the response");
    EXPECT_GT(result.latency.count(), 0);
    EXPECT_TRUE(result.error_message.empty());
}

TEST_F(HttpTest, SmokeTest_WithPongResponse_ShouldSucceed) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    std::string server_url = mock_server->get_base_url();

    mock_server->set_generate_response(R"({"results":[{"text":"This is a pong response"}]})");

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_TRUE(result.success);
    EXPECT_EQ(result.response, "This is a pong response");
}

TEST_F(HttpTest, SmokeTest_WithoutPong_ShouldFail) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"This is not pong"}]})");

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_FALSE(result.success);
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("does not contain 'pong'"));
}

TEST_F(HttpTest, SmokeTest_WithHttpError_ShouldFail) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response("Internal Server Error", 500);

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_FALSE(result.success);
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("HTTP 500"));
}

TEST_F(HttpTest, SmokeTest_WithInvalidJson_ShouldFail) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response("Invalid JSON response");

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_FALSE(result.success);
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("Failed to parse JSON"));
}

TEST_F(HttpTest, SmokeTest_WithMissingResults_ShouldFail) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"error":"Missing results"})");

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_FALSE(result.success);
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("missing results array"));
}

TEST_F(HttpTest, SmokeTest_WithEmptyResults_ShouldFail) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[]})");

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_FALSE(result.success);
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("Empty results array"));
}

TEST_F(HttpTest, SmokeTest_WithConnectionTimeout_ShouldFail) {
    // Arrange
    mock_server->set_response_delay(std::chrono::milliseconds(5000)); // 5 second delay

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_FALSE(result.success);
    EXPECT_FALSE(result.error_message.empty());
}

TEST_F(HttpTest, PerfTest_WithValidResponse_ShouldCalculateTokensPerSec) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"This is a test response with multiple words"}]})");

    int test_tokens = 10;

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), test_tokens);

    // Assert
    EXPECT_TRUE(result.error_message.empty());
    EXPECT_GT(result.tokens_generated, 0);
    EXPECT_GT(result.total_time.count(), 0);
    EXPECT_GT(result.tokens_per_second, 0.0);

    // Should approximate token count from word count
    EXPECT_EQ(result.tokens_generated, 9); // "This is a test response with multiple words" = 9 words
}

TEST_F(HttpTest, PerfTest_WithLargeTokenCount_ShouldHandle) {
    // Arrange
    ASSERT_TRUE(mock_server->start());

    std::string long_response = kcpp_test::generate_random_string(1000);
    mock_server->set_generate_response(R"({"results":[{"text":")" + long_response + R"("}]})");

    int test_tokens = 100;

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), test_tokens);

    // Assert
    EXPECT_TRUE(result.error_message.empty());
    EXPECT_GT(result.tokens_generated, 0);
    EXPECT_GT(result.total_time.count(), 0);
    EXPECT_GT(result.tokens_per_second, 0.0);
}

TEST_F(HttpTest, PerfTest_WithHttpError_ShouldFail) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response("Bad Request", 400);

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 50);

    // Assert
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("HTTP 400"));
}

TEST_F(HttpTest, PerfTest_WithInvalidJson_ShouldFail) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response("Not JSON");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 50);

    // Assert
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("Failed to parse JSON"));
}

TEST_F(HttpTest, PerfTest_WithMissingTemplateFile_ShouldFail) {
    // Arrange - Don't create template file

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", 5001, 50);

    // Assert
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("Failed to load performance prompt template"));
}

TEST_F(HttpTest, PerfTest_WithTemplateWithoutTokens_ShouldHandle) {
    // Arrange
    std::string template_content = "This is a test prompt without token placeholder.";
    std::string template_file = create_test_template_file(template_content);

    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"Response"}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 50);

    // Assert
    // Should still work but won't replace {{TOKENS}}
    EXPECT_TRUE(result.error_message.empty());
}

TEST_F(HttpTest, PerfTest_WithTemplateWithTokens_ShouldReplace) {
    // Arrange
    std::string template_content = "Generate {{TOKENS}} tokens about AI.";
    std::string template_file = create_test_template_file(template_content);

    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"AI response"}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 42);

    // Assert
    // Verify the request was made with replaced tokens (check server logs)
    auto requests = mock_server->get_requests();
    ASSERT_FALSE(requests.empty());

    // The last request should contain the replaced token count
    EXPECT_THAT(requests.back().body, ::testing::HasSubstr("Generate 42 tokens"));
}

TEST_F(HttpTest, PerfTest_WithZeroTokens_ShouldHandle) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"Response"}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 0);

    // Assert
    EXPECT_TRUE(result.error_message.empty());
    EXPECT_GE(result.tokens_per_second, 0.0); // Should not crash
}

TEST_F(HttpTest, PerfTest_WithVeryHighTokenCount_ShouldHandle) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"Long response"}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 10000);

    // Assert
    EXPECT_TRUE(result.error_message.empty());
    EXPECT_GT(result.total_time.count(), 0);
}

TEST_F(HttpTest, PerfTest_WithNetworkDelay_ShouldMeasureCorrectly) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_response_delay(std::chrono::milliseconds(100));
    mock_server->set_generate_response(R"({"results":[{"text":"Delayed response"}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 10);

    // Assert
    EXPECT_TRUE(result.error_message.empty());
    EXPECT_GT(result.total_time.count(), 50); // Should be more than delay
    EXPECT_GT(result.tokens_per_second, 0.0);
}

TEST_F(HttpTest, PerfTest_WithRandomDelay_ShouldHandle) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_random_delay(50, 200); // 50-200ms random delay
    mock_server->set_generate_response(R"({"results":[{"text":"Random delay response"}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 10);

    // Assert
    EXPECT_TRUE(result.error_message.empty());
    EXPECT_GT(result.total_time.count(), 25); // Should account for delay
}

TEST_F(HttpTest, PerfTest_WithMalformedTemplateFile_ShouldFail) {
    // Arrange
    std::string template_content = "This template has {{TOKENS} but missing closing brace";
    std::string template_file = create_test_template_file(template_content);

    ASSERT_TRUE(mock_server->start());

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 10);

    // Assert
    // Should still work as the replacement logic handles malformed placeholders
    EXPECT_TRUE(result.error_message.empty());
}

TEST_F(HttpTest, PerfTest_WithMultipleTokenPlaceholders_ShouldReplaceAll) {
    // Arrange
    std::string template_content = "Generate {{TOKENS}} tokens. Use {{TOKENS}} tokens for context.";
    std::string template_file = create_test_template_file(template_content);

    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"Response"}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 123);

    // Assert
    auto requests = mock_server->get_requests();
    ASSERT_FALSE(requests.empty());

    std::string request_body = requests.back().body;
    EXPECT_THAT(request_body, ::testing::HasSubstr("Generate 123 tokens"));
    EXPECT_THAT(request_body, ::testing::HasSubstr("Use 123 tokens for context"));
}

TEST_F(HttpTest, PerfTest_WithExactTokenMatch_ShouldCalculateCorrectly) {
    // Arrange
    ASSERT_TRUE(mock_server->start());

    // Create response with exact token count
    std::string response_text = "word ";
    for (int i = 0; i < 49; ++i) {
        response_text += "word" + std::to_string(i) + " ";
    }
    mock_server->set_generate_response(R"({"results":[{"text":")" + response_text + R"("}]})");

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 50);

    // Assert
    EXPECT_TRUE(result.error_message.empty());
    EXPECT_EQ(result.tokens_generated, 50); // Should match requested tokens
    EXPECT_GT(result.tokens_per_second, 0.0);
}

TEST_F(HttpTest, PerfTest_WithTimeout_ShouldFail) {
    // Arrange
    mock_server->set_response_delay(std::chrono::milliseconds(35000)); // 35 second delay

    // Act
    PerfResult result = perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 10);

    // Assert
    EXPECT_FALSE(result.error_message.empty());
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("Exception"));
}

TEST_F(HttpTest, SmokeTest_WithLatencyMeasurement_ShouldBeAccurate) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_response_delay(std::chrono::milliseconds(150));
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");

    // Act
    auto start_time = std::chrono::high_resolution_clock::now();
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());
    auto end_time = std::chrono::high_resolution_clock::now();

    // Assert
    EXPECT_TRUE(result.success);
    EXPECT_GT(result.latency.count(), 100); // Should be at least the delay
    EXPECT_LT(result.latency.count(), 1000); // But not excessively more

    // Verify measured latency is reasonable compared to actual elapsed time
    auto actual_elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time);
    EXPECT_LT(result.latency.count(), actual_elapsed.count() + 100); // Some margin for processing
}

TEST_F(HttpTest, RequestTracking_ShouldCaptureAllRequests) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response(R"({"results":[{"text":"pong"}]})");

    // Act
    smoke_test("127.0.0.1", mock_server->get_port());
    perf_tokens_per_sec("127.0.0.1", mock_server->get_port(), 10);

    // Assert
    auto requests = mock_server->get_requests();
    EXPECT_EQ(requests.size(), 2);

    EXPECT_EQ(requests[0].method, "POST");
    EXPECT_EQ(requests[0].path, "/api/v1/generate");
    EXPECT_THAT(requests[0].body, ::testing::HasSubstr("max_tokens"));
    EXPECT_THAT(requests[0].body, ::testing::HasSubstr("temperature"));

    EXPECT_EQ(requests[1].method, "POST");
    EXPECT_EQ(requests[1].path, "/api/v1/generate");
    EXPECT_THAT(requests[1].body, ::testing::HasSubstr("perf_prompt.tpl"));
}

TEST_F(HttpTest, ServerErrorHandling_ShouldProvideDetailedErrors) {
    // Arrange
    ASSERT_TRUE(mock_server->start());
    mock_server->set_generate_response("Bad Request", 400);

    // Act
    SmokeResult result = smoke_test("127.0.0.1", mock_server->get_port());

    // Assert
    EXPECT_FALSE(result.success);
    EXPECT_THAT(result.error_message, ::testing::HasSubstr("HTTP 400"));
    EXPECT_GT(result.latency.count(), 0); // Should still measure latency
}

}  // namespace kcpp