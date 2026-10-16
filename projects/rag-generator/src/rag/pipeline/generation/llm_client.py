"""
LLM Client Module

Implements the LLM API client based on the example_project setup.
Uses OpenAI client with OpenRouter configuration for LLM API calls.
"""

import openai
import tiktoken
import logging
import os
import time
import random
from typing import List, Dict, Any, Optional, Union
from openai.types.chat import ChatCompletionMessageParam

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Retry configuration
DEFAULT_BASE_DELAY = 1.0  # Base delay in seconds for exponential backoff
DEFAULT_MAX_DELAY = 60.0  # Maximum delay in seconds
DEFAULT_JITTER = True     # Whether to add random jitter to delays


class LLMClient:
    """LLM client for making API calls to OpenRouter/OpenAI compatible APIs."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        timeout: float = 120.0,
        max_retries: int = 2
    ):
        """Initialize LLM client with automatic provider detection.

        Args:
            api_key: API key (uses env var if not provided)
            base_url: API base URL (auto-detected if not provided)
            model: Model name to use (auto-detected if not provided)
            temperature: Temperature for response generation
            max_tokens: Maximum tokens in response
            timeout: Request timeout in seconds
            max_retries: Number of retries for failed requests
        """
        # Auto-detect provider based on available API keys
        openai_api_key = os.getenv('OPENAI_API_KEY')
        openrouter_api_key = os.getenv('OPENROUTER_API_KEY')

        # Determine provider and configuration
        if openai_api_key and (api_key == openai_api_key or api_key is None):
            # Use OpenAI
            self.provider = "openai"
            self.api_key = openai_api_key
            self.base_url = base_url or os.getenv('OPENAI_BASE_URL', "https://api.openai.com/v1")
            self.model = model or os.getenv('OPENAI_MODEL', "gpt-4o-mini")
        elif openrouter_api_key and (api_key == openrouter_api_key or api_key is None):
            # Use OpenRouter
            self.provider = "openrouter"
            self.api_key = openrouter_api_key
            self.base_url = base_url or os.getenv('OPENROUTER_BASE_URL', "https://openrouter.ai/api/v1")
            self.model = model or os.getenv('OPENROUTER_MODEL', "openrouter/mistral/mistral-small")
        elif api_key:
            # Use provided API key with auto-detection
            if "openrouter.ai" in (base_url or ""):
                self.provider = "openrouter"
                self.api_key = api_key
                self.base_url = base_url or "https://openrouter.ai/api/v1"
                self.model = model or "openrouter/mistral/mistral-small"
            else:
                self.provider = "openai"
                self.api_key = api_key
                self.base_url = base_url or "https://api.openai.com/v1"
                self.model = model or "gpt-4o-mini"
        else:
            raise ValueError(
                "No API key found. Please set either OPENAI_API_KEY or OPENROUTER_API_KEY environment variable, "
                "or provide api_key parameter."
            )

        # Configure OpenAI client with provider-specific settings
        client_kwargs = {
            "api_key": self.api_key,
            "base_url": self.base_url,
            "timeout": timeout,
            "max_retries": max_retries
        }

        # Add OpenRouter-specific headers
        if self.provider == "openrouter":
            client_kwargs["default_headers"] = {
                "HTTP-Referer": "https://example.com",
                "X-Title": "Lore RAG"
            }

        self.client = openai.OpenAI(**client_kwargs)

        self.temperature = temperature
        self.max_tokens = max_tokens

        # Initialize tokenizer
        self._setup_tokenizer()

        logger.info(f"LLM client initialized with provider: {self.provider}, model: {self.model}")

    def _calculate_retry_delay(self, attempt: int, base_delay: float = DEFAULT_BASE_DELAY,
                              max_delay: float = DEFAULT_MAX_DELAY, jitter: bool = DEFAULT_JITTER) -> float:
        """Calculate delay for exponential backoff with optional jitter.

        Args:
            attempt: Current attempt number (0-based)
            base_delay: Base delay in seconds
            max_delay: Maximum delay in seconds
            jitter: Whether to add random jitter

        Returns:
            Delay in seconds
        """
        delay = min(base_delay * (2 ** attempt), max_delay)

        if jitter:
            # Add up to 25% jitter
            jitter_amount = delay * 0.25 * random.random()
            delay += jitter_amount

        return delay

    def _setup_tokenizer(self):
        """Setup appropriate tokenizer based on model."""
        try:
            # Map models to their appropriate encodings
            model_encodings = {
                "gpt-4": "cl100k_base",
                "gpt-3.5": "cl100k_base",
                "gpt-4-turbo": "cl100k_base",
                "claude": "cl100k_base",
                "anthropic": "cl100k_base",
                "gemini": "cl100k_base",
                "llama": "cl100k_base",
                "mistral": "cl100k_base",
                "default": "cl100k_base"
            }

            # Determine encoding based on model name
            encoding_name = "cl100k_base"  # Default
            model_lower = self.model.lower()

            for key in model_encodings:
                if key in model_lower:
                    encoding_name = model_encodings[key]
                    break

            self.encoding = tiktoken.get_encoding(encoding_name)
            logger.info(f"Initialized tokenizer with encoding: {encoding_name}")

        except Exception as e:
            logger.warning(f"Could not setup tokenizer: {e}. Using character estimates.")
            self.encoding = None

    def count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken or fallback to character estimate."""
        if self.encoding:
            try:
                return len(self.encoding.encode(text))
            except Exception as e:
                logger.warning(f"Error counting tokens with tiktoken: {e}")

        # Fallback to character estimate (1 token ≈ 3 characters for English text)
        return len(text) // 3

    def generate(
        self,
        system_prompt: str,
        assistant_prompt: str,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        presence_penalty: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        **kwargs
    ) -> str:
        """Generate response using LLM API with overrides and retry logic.

        Args:
            system_prompt: System message for context
            assistant_prompt: User message with query
            temperature: Override default temperature (0.0-2.0)
            top_p: Override nucleus sampling (0.0-1.0)
            max_tokens: Override max tokens in response
            stop: List of stop sequences
            presence_penalty: Override presence penalty (-2.0-2.0)
            frequency_penalty: Override frequency penalty (-2.0-2.0)
            **kwargs: Additional parameters

        Returns:
            Generated response text
        """
        # Use provided overrides or fall back to instance defaults
        request_temperature = temperature if temperature is not None else self.temperature
        request_max_tokens = max_tokens if max_tokens is not None else self.max_tokens
        request_top_p = top_p
        request_stop = stop
        request_presence_penalty = presence_penalty
        request_frequency_penalty = frequency_penalty

        # Context window configuration
        context_windows = {
            "gpt-4o-mini": 128000,
            "mistral-small": 32000,
            "default": 8000
        }

        # Determine context window for current model
        model_key = self.model.lower()
        if "gpt-4o-mini" in model_key:
            context_window = context_windows["gpt-4o-mini"]
        elif "mistral-small" in model_key:
            context_window = context_windows["mistral-small"]
        else:
            context_window = context_windows["default"]

        # Estimate token usage for system and user prompts
        system_tokens = self.count_tokens(system_prompt)
        user_tokens = self.count_tokens(assistant_prompt)
        prompt_tokens = system_tokens + user_tokens

        # Check if we're near context limit (85% threshold)
        context_threshold = int(context_window * 0.85)
        estimated_total_tokens = prompt_tokens + request_max_tokens

        logger.info(f"Token budget: prompt={prompt_tokens}, max_response={request_max_tokens}, "
                   f"context_window={context_window}, estimated_total={estimated_total_tokens}")

        if estimated_total_tokens > context_threshold:
            logger.warning(f"Estimated token usage ({estimated_total_tokens}) exceeds 85% of context window ({context_threshold}). "
                          "Consider reducing prompt size or max_tokens.")

            # If we're very close to the limit, reduce max_tokens to fit within budget
            if prompt_tokens > context_threshold * 0.9:
                # Very large prompt - truncate max_tokens significantly
                safe_max_tokens = max(100, context_threshold - prompt_tokens - 100)  # Leave buffer for response overhead
                logger.warning(f"Reducing max_tokens from {request_max_tokens} to {safe_max_tokens} to fit within context window")
                request_max_tokens = safe_max_tokens

        # Build request parameters
        request_params = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": assistant_prompt}
            ],
            "max_tokens": request_max_tokens,
            "temperature": request_temperature
        }

        # Add optional parameters if provided
        if request_top_p is not None:
            request_params["top_p"] = request_top_p
        if request_stop is not None:
            request_params["stop"] = request_stop
        if request_presence_penalty is not None:
            request_params["presence_penalty"] = request_presence_penalty
        if request_frequency_penalty is not None:
            request_params["frequency_penalty"] = request_frequency_penalty

        max_retries = 3  # Default retry count
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Making LLM request with model: {self.model} (attempt {attempt + 1}/{max_retries + 1})")

                # Make API call
                response = self.client.chat.completions.create(**request_params)

                # Extract response content
                response_content = response.choices[0].message.content
                if response_content is None:
                    logger.warning("LLM returned None response")
                    return ""

                response_content = response_content.strip()

                if not response_content:
                    logger.warning("LLM returned empty response")
                    return ""

                logger.info(f"LLM response received successfully ({len(response_content)} chars)")
                return response_content

            except openai.AuthenticationError as e:
                logger.error(f"Authentication error: {e}")
                raise Exception(f"LLM authentication failed. Check your API key.")

            except openai.RateLimitError as e:
                logger.warning(f"Rate limit error on attempt {attempt + 1}: {e}")
                last_exception = e

                if attempt < max_retries:
                    # Check for Retry-After header
                    retry_after = getattr(e, 'response', None)
                    if retry_after and 'retry-after' in retry_after.headers:
                        delay = float(retry_after.headers['retry-after'])
                    else:
                        delay = self._calculate_retry_delay(attempt)

                    logger.info(f"Retrying after {delay:.2f} seconds due to rate limit...")
                    time.sleep(delay)
                    continue
                else:
                    raise Exception(f"LLM rate limit exceeded after {max_retries + 1} attempts. Please try again later.")

            except (openai.APITimeoutError, openai.APIConnectionError) as e:
                logger.warning(f"Timeout/Connection error on attempt {attempt + 1}: {e}")
                last_exception = e

                if attempt < max_retries:
                    delay = self._calculate_retry_delay(attempt)
                    logger.info(f"Retrying after {delay:.2f} seconds due to timeout/connection error...")
                    time.sleep(delay)
                    continue
                else:
                    error_type = "timeout" if isinstance(e, openai.APITimeoutError) else "connection"
                    raise Exception(f"LLM {error_type} error after {max_retries + 1} attempts. Please check your connection.")

            except Exception as e:
                logger.error(f"Unexpected error on attempt {attempt + 1}: {e}")
                # Don't retry on unexpected errors
                raise Exception(f"LLM API error: {str(e)}")

        # This should never be reached, but just in case
        if last_exception:
            raise Exception(f"LLM request failed after all retries: {str(last_exception)}")
        else:
            raise Exception("LLM request failed after all retries.")


def create_llm_client() -> LLMClient:
    """Create LLM client with configuration from environment or defaults."""
    return LLMClient(
        api_key=os.getenv('OPENROUTER_API_KEY'),
        base_url=os.getenv('OPENROUTER_BASE_URL', "https://openrouter.ai/api/v1"),
        model=os.getenv('OPENROUTER_MODEL', "gpt-3.5-turbo"),
        temperature=float(os.getenv('LLM_TEMPERATURE', '0.7')),
        max_tokens=int(os.getenv('LLM_MAX_TOKENS', '1000')),
        timeout=float(os.getenv('LLM_TIMEOUT', '120.0')),
        max_retries=int(os.getenv('LLM_MAX_RETRIES', '2'))
    )