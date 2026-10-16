**STATUS: ✅ IMPLEMENTATION COMPLETE (2025-10-24)**

All phases have been successfully implemented and built:
- ✅ Phase 1: Dependencies added (TinyXML2, CMake configuration)
- ✅ Phase 2: All API endpoints converted to XML (generate, models, health, version, errors)
- ✅ Phase 3: Grammar injection with fallback, test helpers updated
- ✅ Build: Successful compilation with MSVC (Release configuration)

See [DEVLOG.md](../DEVLOG.md) for detailed implementation notes.

---

# XML-only API Implementation Plan

This document describes the end-to-end plan to move the outer API to XML-only while guaranteeing the LLM tokenizes true XML and enforcing an XML-shaped output with a root-only grammar. The llama.cpp bridge remains JSON internally (transport only), invisible to clients.

Key code touchpoints:
- Request handling and XML response conversion:
  - [C++.void APIServer::handle_generate(const httplib::Request& req, httplib::Response& res)](src/api_server.cpp:100)
  - [C++.void APIServer::handle_models(const httplib::Request& req, httplib::Response& res)](src/api_server.cpp:166)
  - [C++.void APIServer::handle_health(const httplib::Request& req, httplib::Response& res)](src/api_server.cpp:188)
  - [C++.void APIServer::handle_version(const httplib::Request& req, httplib::Response& res)](src/api_server.cpp:213)
- llama.cpp bridge (kept JSON internally, grammar injected if supported):
  - [C++.LlamaResponse APIServer::forward_to_llamacpp(const LlamaRequest& request) const](src/api_server.cpp:233)
- Error helper replacement:
  - [C++.void APIServer::send_xml_error(httplib::Response& res, int status_code, const std::string& message)](src/api_server.cpp:309)
  - Declaration updated at [C++.void APIServer::send_xml_error(httplib::Response& res, int status_code, const std::string& message)](include/kcpp/api_server.hpp:79)
- First-party helpers updated to XML:
  - [C++.SmokeResult smoke_test(const std::string& host, int port)](src/http.cpp:37)
  - [C++.PerfResult perf_tokens_per_sec(const std::string& host, int port, int tokens)](src/http.cpp:118)
- Build configuration linking XML lib and needed dependencies:
  - [CMakeLists.txt](CMakeLists.txt)

## 1) External API Contract (XML-only)

- Clients must send application/xml. Non-XML requests return 415 Unsupported Media Type with an XML error payload.
- Request schema (Option A):
  - Required:
    - /request/prompt: CDATA containing the exact XML intended for the model (verbatim pass-through).
  - Optional with defaults:
    - /request/max_tokens (int, default 150)
    - /request/temperature (float, default 0.8)
    - /request/top_p (float, default 0.9)
- Success response:
  - Content-Type: application/xml
  - Body:
    <response>
      <text>...escaped model output...</text>
      <tokens_used>...</tokens_used>
      <success>true</success>
    </response>
- Error response:
  - Content-Type: application/xml
  - Body:
    <error>
      <message>...</message>
      <status_code>...</status_code>
    </error>

Notes:
- CDATA is mandatory for verbatim preservation of XML prompt bytes (prevents entity-decoding or normalization by the XML parser).
- Responses escape special characters in <text> by default (no CDATA in responses to avoid edge cases).

## 2) What the model sees (prompt fidelity)

- The wrapper extracts the prompt from <prompt><![CDATA[...]]></prompt> and uses that string verbatim for the llama.cpp request field prompt.
- The JSON encoding in the internal HTTP call is transport-only; llama.cpp reconstructs the exact string. The LLM tokenizes the true XML content.

## 3) Output shape enforcement (grammar)

- Objective: Enforce model outputs wrapped with a root-only <answer>...</answer>.
- Integration point: If the llama.cpp /completion endpoint supports grammar parameters, include:
  - grammar_type: "gbnf"
  - grammar: the minimal grammar (see Section 8).
- Fallback: If unsupported, rely on prompting and log a warning when output does not match the expected root element.

## 4) Build and Dependencies

We add TinyXML2 and re-enable linking for required dependencies via CMake find_package calls. Ensure dependencies are available via your package manager (e.g., vcpkg integration) or system installation.

- Updated CMake:
  - [CMakeLists.txt](CMakeLists.txt)
    - find_package(cpr CONFIG REQUIRED)
    - find_package(nlohmann_json CONFIG REQUIRED)
    - find_package(spdlog CONFIG REQUIRED)
    - find_package(fmt CONFIG REQUIRED)
    - find_package(httplib CONFIG REQUIRED)
    - find_package(tinyxml2 CONFIG REQUIRED)
    - target_link_libraries(kcppctl PRIVATE cpr::cpr nlohmann_json::nlohmann_json fmt::fmt spdlog::spdlog httplib::httplib tinyxml2::tinyxml2 Ws2_32)

Windows local build prerequisites:
- Install CMake (e.g., winget install Kitware.CMake).
- Ensure vcpkg/VS toolchain provides CPR, TinyXML2, nlohmann_json, spdlog, fmt, httplib.
- Configure and build:
  - cmake -S . -B build
  - cmake --build build --config Release

## 5) Code Changes Overview

### 5.1 APIServer: Generate (XML input, XML output)
- [C++.void APIServer::handle_generate(const httplib::Request& req, httplib::Response& res)](src/api_server.cpp:100)
  - Validate Content-Type: application/xml; else 415 via [C++.send_xml_error(...)](src/api_server.cpp:309).
  - Parse XML body with TinyXML2.
  - Extract /request/prompt:
    - If first child is CDATA: use CDATA content verbatim.
    - Else if text node: accept with warning (not byte-for-byte safe); recommend CDATA in docs.
    - Else: reject with XML error (400).
  - Extract optional fields: /request/max_tokens, /request/temperature, /request/top_p with defaults.
  - Build LlamaRequest and call [C++.forward_to_llamacpp()](src/api_server.cpp:233).
  - On success: build XML <response> with escaped <text>.
  - On failure: build XML <error>.

### 5.2 APIServer: Models/Health/Version (XML outputs)
- [C++.void APIServer::handle_models(...)](src/api_server.cpp:166)
- [C++.void APIServer::handle_health(...)](src/api_server.cpp:188)
- [C++.void APIServer::handle_version(...)](src/api_server.cpp:213)
  - Replace JSON with XML construction and set Content-Type: application/xml.

### 5.3 APIServer: Error helper (XML)
- Implementation: [C++.void APIServer::send_xml_error(httplib::Response& res, int status_code, const std::string& message)](src/api_server.cpp:309)
- Declaration replacement in header: [C++.void APIServer::send_xml_error(httplib::Response& res, int status_code, const std::string& message)](include/kcpp/api_server.hpp:79)

### 5.4 llama.cpp bridge: grammar injection (internal JSON only)
- [C++.LlamaResponse APIServer::forward_to_llamacpp(const LlamaRequest& request) const](src/api_server.cpp:233)
  - Add an internal attempt with grammar fields:
    - "grammar_type": "gbnf"
    - "grammar": "<see Section 8>"
  - If the HTTP response is non-200, retry without grammar (fallback).
  - Parse JSON response fields:
    - content (string) - model output text
    - tokens_predicted (int) - token usage

### 5.5 First-party helpers: switch to XML
- [C++.SmokeResult smoke_test(const std::string& host, int port)](src/http.cpp:37)
  - Build XML request with Option A schema (prompt as CDATA).
  - POST application/xml to /api/v1/generate.
  - Parse <response>/<text> from XML response.
- [C++.PerfResult perf_tokens_per_sec(const std::string& host, int port, int tokens)](src/http.cpp:118)
  - Same conversion to XML request/response.
  - Count tokens from <text> (word-based approximation remains acceptable).

## 6) XML Utilities

- XML escaping helper for responses (used in handlers and error helper):
  - Escape: &, <, >, ", '.
- Input CDATA policy:
  - Require CDATA for prompt to preserve verbatim XML bytes.
  - If plain text is provided, proceed with warning (documented as non-verbatim fallback).

## 7) Error Handling

- All error payloads are XML:
  - <error><message>...</message><status_code>...</status_code></error>
- Typical failure modes:
  - Non-XML Content-Type → 415.
  - XML parse errors → 400.
  - Missing <request> root or <prompt> → 400.
  - llama.cpp bridge HTTP failure → 5xx.
  - Uncaught exceptions → 500.

## 8) Grammar (initial root-only GBNF)

Intent: Require outputs in the form <answer>...</answer>. Inner content not validated on day-one to keep grammar short and robust.

- Injected when calling llama.cpp /completion (if supported):

Grammar (string form; kept minimal, excludes angle brackets inside body):

root ::= answer
answer ::= "<answer>" body "</answer>"
body ::= { ANY_NO_ANGLE }*
ANY_NO_ANGLE ::= "\t" | "\n" | "\r" | " " | "!" | "\"" | "#" | "$" | "%" | "&" | "'" | "(" | ")" | "*" | "+" | "," | "-" | "." | "/" |
"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" |
":" | ";" | "=" | "?" | "@" |
"A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" |
"[" | "\\" | "]" | "^" | "_" | "`" |
"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" |
"{" | "|" | "}" | "~"

Notes:
- This intentionally forbids < and > inside body to prevent malformed nested tags until we introduce a richer subset XML grammar in a next iteration.
- If you require nested tags now, we can replace body with a recursive XML subset grammar (cost: more complexity and testing).

## 9) Security, Limits, and Robustness

- UTF-8 only. Reject or normalize other encodings.
- Enforce maximum request body size (configurable). Ensure LLM context limits are respected.
- Do not normalize or pretty-print the prompt string; preserve as received (verbatim).
- Optional (debug): Log SHA-256 hash of the prompt just before forwarding to llama.cpp to verify pass-through integrity (omit actual prompt content from logs).

## 10) Testing Plan

Add/adjust tests to validate XML-only behavior:

- Request/Response happy paths:
  - POST valid XML with CDATA prompt to /api/v1/generate → assert 200, Content-Type: application/xml, check <response>/<text>, <tokens_used>, <success>.
  - GET /api/v1/models, /health, /api/v1/version → 200 and expected XML structures.
- Error cases:
  - Non-XML Content-Type on /generate → 415 with XML error.
  - Malformed XML → 400 with XML error (message contains parser error).
  - Missing <request> root or <prompt> → 400 with XML error.
  - Llama bridge non-200 → 5xx with XML error.
- Fidelity checks:
  - Send a known XML prompt in CDATA; compute a SHA-256 hash in test and ensure wrapper’s debug log shows the same hash before forwarding (manual verification when running with debug enabled).
- Grammar behavior (if supported):
  - When grammar is injected, verify outputs are wrapped with <answer>.

Note: Existing tests that rely on JSON mocks (e.g., tests/utils/mock_server.cpp) should be revised or disabled for this XML-only path; current CMake links only a simple unit test anyway.

## 11) Migration and Rollout

- API behavior: Immediately XML-only externally. Document breaking change and new schema (Option A).
- First-party clients updated to XML (smoke and perf helpers use XML).
- llama.cpp internal transport remains JSON. No client-visible JSON anywhere.
- Optional future: richer grammar for nested XML; optional fork of llama.cpp for XML transport on-wire if required (not necessary for model tokenization).

## 12) Operational Procedures

- Build (Windows):
  - Install CMake and dependencies (vcpkg or VS workloads).
  - cmake -S . -B build
  - cmake --build build --config Release
- Runtime:
  - Ensure llama.cpp server is reachable per configured host/port in the server config.
  - Confirm /health returns healthy and wrapper uses application/xml for all endpoints.
- Observability:
  - Logs include processing time and error causes.
  - Optional prompt hash in debug builds for integrity diagnostics.

## 13) Example Payloads

Request (generate):
<request>
  <prompt><![CDATA[
<conversation>
  <system role="assistant">You are a strict XML agent.</system>
  <user id="42">Explain CDATA vs escaping in XML.</user>
</conversation>
  ]]></prompt>
  <max_tokens>150</max_tokens>
  <temperature>0.8</temperature>
  <top_p>0.9</top_p>
</request>

Success response:
<response>
  <text>&lt;answer&gt;...&lt;/answer&gt;</text>
  <tokens_used>150</tokens_used>
  <success>true</success>
</response>

Error response:
<error>
  <message>Missing required &lt;prompt&gt; element</message>
  <status_code>400</status_code>
</error>

## 14) Risks and Mitigations

- Risk: Clients forget to use CDATA → prompt not verbatim.
  - Mitigation: Document CDATA requirement; return a warning header or log warning when CDATA is not used.
- Risk: Grammar unsupported by llama.cpp server build.
  - Mitigation: Fallback to prompting-only and log a warning; plan upgrade if needed.
- Risk: Dependency resolution on developer machines (CMake/vcpkg).
  - Mitigation: Provide clear setup steps; optionally include a vcpkg.json or toolchain file.

## 15) Completion Checklist

- Code:
  - [C++.handle_generate](src/api_server.cpp:100): XML-only parsing and response
  - [C++.handle_models](src/api_server.cpp:166): XML output
  - [C++.handle_health](src/api_server.cpp:188): XML output
  - [C++.handle_version](src/api_server.cpp:213): XML output
  - [C++.send_xml_error](src/api_server.cpp:309): XML errors
  - [C++.forward_to_llamacpp](src/api_server.cpp:233): grammar injection and fallback
  - [C++.smoke_test](src/http.cpp:37): XML request/response
  - [C++.perf_tokens_per_sec](src/http.cpp:118): XML request/response
  - [CMakeLists.txt](CMakeLists.txt): find_package and target_link_libraries updates
  - [C++.void APIServer::send_xml_error(httplib::Response& res, int status_code, const std::string& message)](include/kcpp/api_server.hpp:79) declaration
- Docs:
  - This document (schema, grammar, build, tests)
- Tests:
  - New/updated XML tests added; JSON expectations removed/updated.

## 16) Future Work (Optional)

- Subset XML grammar for nested tags (recursive grammar) for stricter correctness.
- Streaming design for XML (well-formed streaming with chunking or SSE framing).
- End-to-end XML transport in llama.cpp (fork) if on-wire XML is a hard requirement; not necessary for model tokenization.
