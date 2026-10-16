#include <gtest/gtest.h>
#include <gmock/gmock.h>

TEST(SimpleTest, BasicArithmetic) {
    EXPECT_EQ(1 + 1, 2);
    EXPECT_EQ(2 * 3, 6);
    EXPECT_EQ(10 / 2, 5);
}

TEST(SimpleTest, StringOperations) {
    std::string hello = "Hello";
    std::string world = " World";
    std::string result = hello + world;

    EXPECT_EQ(result, "Hello World");
    EXPECT_EQ(hello.length(), 5);
    EXPECT_EQ(world.length(), 6);
}

TEST(SimpleTest, BooleanLogic) {
    EXPECT_TRUE(true);
    EXPECT_FALSE(false);
    EXPECT_TRUE(1 == 1);
    EXPECT_FALSE(1 == 2);
}

class SimpleFixture : public ::testing::Test {
protected:
    void SetUp() override {
        value = 42;
    }

    void TearDown() override {
        value = 0;
    }

    int value;
};

TEST_F(SimpleFixture, FixtureTest) {
    EXPECT_EQ(value, 42);
    value = 100;
    EXPECT_EQ(value, 100);
}

TEST_F(SimpleFixture, AnotherFixtureTest) {
    EXPECT_EQ(value, 42); // Should be reset by SetUp
    EXPECT_NE(value, 0);
}