# Stateful Session XML Implementation Plan

**Status:** 🚧 IN PROGRESS (2025-10-24)  
**Goal:** Add XML with CDATA support to all stateful session endpoints  
**Related:** [STATEFUL_SESSION_IMPLEMENTATION_PLAN.md](STATEFUL_SESSION_IMPLEMENTATION_PLAN.md), [XML_API_IMPLEMENTATION_PLAN.md](XML_API_IMPLEMENTATION_PLAN.md)

---

## Overview

This plan extends the existing stateful session system to support both JSON and XML formats, enabling clients to use CDATA for verbatim XML content preservation in multi-turn conversations.

### Design Principles

1. **Content-Type Negotiation**: Support both `application/json` and `application/xml` based on request headers
2. **CDATA Preservation**: Use CDATA sections for persona and turn content in XML mode
3. **Backward Compatibility**: Keep existing JSON endpoints working unchanged
4. **Consistent Error Handling**: Return errors in the same format as the request (XML or JSON)
5. **Code Reuse**: Share session logic between JSON and XML handlers

---

## API Contracts

### 1. Create Session

#### XML Request
```http
POST /api/v1/session/create
Content-Type: application/xml
```

```xml
<session_request>
  <persona><![CDATA[You are Aldrin Ironwhisper, a merchant.
Location: tavern_main.
Inventory: dried meat, stale bread.]]></persona>
  <max_age_minutes>60</max_age_minutes>
  <max_context_tokens>8192</max_context_tokens>
  <temperature>0.7</temperature>
  <top_p>0.9</top_p>
  <stop_sequences>
    <stop>Note:</stop>
    <stop>Narrator:</stop>
    <stop>\n\n</stop>
  </stop_sequences>
</session_request>
```

#### XML Response (Success - 201)
```xml
<session_response>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
  <created_at>2025-10-24T22:00:00Z</created_at>
  <persona_tokens>145</persona_tokens>
  <max_context_tokens>8192</max_context_tokens>
  <success>true</success>
</session_response>
```

#### XML Error Response (400)
```xml
<error>
  <message>Missing required &lt;persona&gt; element</message>
  <status_code>400</status_code>
</error>
```

---

### 2. Append Turn

#### XML Request
```http
POST /api/v1/session/{session_id}/append
Content-Type: application/xml
```

```xml
<append_request>
  <turn><![CDATA[<conversation>
  <user id="42">What's for sale today?</user>
</conversation>]]></turn>
  <max_tokens>48</max_tokens>
  <temperature>0.7</temperature>
  <top_p>0.9</top_p>
</append_request>
```

#### XML Response (Success - 200)
```xml
<append_response>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
  <response><![CDATA[<conversation>
  <assistant>Got some dried meat and stale bread. Not much else worth mentioning.</assistant>
</conversation>]]></response>
  <tokens_used>18</tokens_used>
  <total_context_tokens>163</total_context_tokens>
  <context_utilization>0.02</context_utilization>
  <success>true</success>
</append_response>
```

---

### 3. Get Session

#### XML Request
```http
GET /api/v1/session/{session_id}
Accept: application/xml
```

#### XML Response (Success - 200)
```xml
<session_data>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
  <persona><![CDATA[You are Aldrin Ironwhisper...]]></persona>
  <turns>
    <turn index="0"><![CDATA[User: What's for sale?\n]]></turn>
    <turn index="1"><![CDATA[Assistant: Got some dried meat...\n]]></turn>
  </turns>
  <created_at>2025-10-24T22:00:00Z</created_at>
  <last_accessed>2025-10-24T22:05:00Z</last_accessed>
  <total_context_tokens>163</total_context_tokens>
  <max_context_tokens>8192</max_context_tokens>
  <success>true</success>
</session_data>
```

---

### 4. List Sessions

#### XML Request
```http
GET /api/v1/sessions?limit=100
Accept: application/xml
```

#### XML Response (Success - 200)
```xml
<sessions_list>
  <sessions>
    <session>
      <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
      <created_at>2025-10-24T22:00:00Z</created_at>
      <last_accessed>2025-10-24T22:05:00Z</last_accessed>
      <turn_count>4</turn_count>
      <context_tokens>163</context_tokens>
    </session>
  </sessions>
  <total_sessions>1</total_sessions>
</sessions_list>
```

---

### 5. Delete Session

#### XML Request
```http
DELETE /api/v1/session/{session_id}
Accept: application/xml
```

#### XML Response (Success - 200)
```xml
<delete_response>
  <deleted>true</deleted>
  <session_id>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</session_id>
</delete_response>
```

---

## Implementation Strategy

### Phase 1: Core XML Utilities
1. Add XML helper functions to `include/kcpp/api_server.hpp`
2. Implement CDATA extraction and creation utilities
3. Add Content-Type detection helpers
4. Implement format-aware error response function

### Phase 2: Endpoint Handlers
1. Modify `handle_session_create` to support both JSON and XML
2. Modify `handle_session_append` to support both formats
3. Update `handle_session_get` for XML responses
4. Update `handle_sessions_list` for XML responses
5. Update `handle_session_delete` for XML responses

### Phase 3: Testing & Documentation
1. Create test cases for XML session workflows
2. Update CLIENT_INTEGRATION_GUIDE.md with XML examples
3. Add PowerShell/curl examples
4. Integration testing with real backend

---

## Code Structure

### New Helper Functions in `api_server.hpp`

```cpp
class APIServer {
private:
    // Format detection
    bool is_xml_request(const httplib::Request& req) const;
    bool wants_xml_response(const httplib::Request& req) const;
    
    // XML parsing helpers
    std::string extract_cdata_or_text(tinyxml2::XMLElement* elem) const;
    std::vector<std::string> extract_stop_sequences(tinyxml2::XMLElement* root) const;
    
    // XML building helpers
    void add_cdata_element(tinyxml2::XMLDocument& doc, 
                          tinyxml2::XMLElement* parent,
                          const char* name, 
                          const std::string& content);
    void add_text_element(tinyxml2::XMLDocument& doc,
                         tinyxml2::XMLElement* parent,
                         const char* name,
                         const std::string& value);
    
    // Response helpers
    void send_response(httplib::Response& res,
                      int status_code,
                      const nlohmann::json& data,
                      bool use_xml);
    void send_error_response(httplib::Response& res,
                            int status_code,
                            const std::string& message,
                            bool use_xml);
};
```

### Handler Pattern

```cpp
void APIServer::handle_session_create(const httplib::Request& req, httplib::Response& res) {
    bool use_xml = is_xml_request(req);
    
    try {
        // Parse request (XML or JSON)
        std::string persona;
        int max_age_minutes = 60;
        int max_context_tokens = 8192;
        float temperature = 0.7f;
        float top_p = 0.9f;
        std::vector<std::string> stop_sequences;
        
        if (use_xml) {
            parse_session_create_xml(req, persona, max_age_minutes, 
                                    max_context_tokens, temperature, 
                                    top_p, stop_sequences);
        } else {
            parse_session_create_json(req, persona, max_age_minutes,
                                     max_context_tokens, temperature,
                                     top_p, stop_sequences);
        }
        
        // Common session creation logic
        ConversationSession session = create_session_internal(
            persona, max_age_minutes, max_context_tokens,
            temperature, top_p, stop_sequences
        );
        
        // Format response (XML or JSON)
        send_session_create_response(res, session, use_xml);
        
    } catch (const std::exception& e) {
        send_error_response(res, 500, e.what(), use_xml);
    }
}
```

---

## File Modifications

### 1. `include/kcpp/api_server.hpp`
- Add XML helper method declarations
- Add format detection methods
- Add dual-format response methods

### 2. `src/api_server.cpp`
- Implement XML parsing for all session endpoints
- Implement XML response building
- Add CDATA handling utilities
- Update existing handlers to support both formats

### 3. `docs/CLIENT_INTEGRATION_GUIDE.md`
- Add XML examples for all session endpoints
- Document Content-Type requirements
- Add migration guide for XML usage

### 4. `tests/integration/test_xml_sessions.cpp` (new)
- Test XML session creation
- Test XML append with CDATA
- Test XML retrieval
- Test format negotiation
- Test error responses in XML

---

## Testing Plan

### Unit Tests
```cpp
TEST_CASE("XML Session Creation", "[session][xml]") {
    // Test valid XML request
    // Test missing persona
    // Test invalid XML
    // Test CDATA extraction
}

TEST_CASE("XML Session Append", "[session][xml]") {
    // Test turn with CDATA
    // Test turn without CDATA
    // Test parameter overrides
}

TEST_CASE("Format Negotiation", "[session][xml]") {
    // Test Content-Type detection
    // Test Accept header handling
    // Test dual format support
}
```

### Integration Tests
```powershell
# Create session with XML
$xmlBody = @"
<session_request>
  <persona><![CDATA[<character><name>Test</name></character>]]></persona>
  <max_context_tokens>8192</max_context_tokens>
</session_request>
"@

$session = Invoke-RestMethod `
    -Uri "http://localhost:8080/api/v1/session/create" `
    -Method Post `
    -ContentType "application/xml" `
    -Body $xmlBody

# Append turn with XML
$turnXml = @"
<append_request>
  <turn><![CDATA[<conversation><user>Hello</user></conversation>]]></turn>
  <max_tokens>48</max_tokens>
</append_request>
"@

$response = Invoke-RestMethod `
    -Uri "http://localhost:8080/api/v1/session/$($session.session_id)/append" `
    -Method Post `
    -ContentType "application/xml" `
    -Body $turnXml
```

---

## Content-Type Negotiation Rules

### Request Format Detection
1. Check `Content-Type` header
2. If `application/xml` → parse as XML
3. If `application/json` → parse as JSON
4. If missing or other → return 415 error

### Response Format Selection
1. For POST/PUT: Use request format
2. For GET/DELETE: Check `Accept` header
3. Default to JSON if no preference specified

### Error Response Format
Always match the request format when possible:
- XML request → XML error
- JSON request → JSON error
- Invalid format → XML error (as per existing pattern)

---

## Migration Path

### Backward Compatibility
✅ All existing JSON endpoints continue to work unchanged  
✅ No breaking changes to current clients  
✅ XML support is additive only  

### Adoption Strategy
1. **Phase 1**: Deploy with XML support enabled
2. **Phase 2**: Update documentation with XML examples
3. **Phase 3**: Encourage XML adoption for XML-heavy use cases
4. **Phase 4**: Monitor usage and optimize based on feedback

---

## Security Considerations

### XML Parsing Safety
1. **Entity Expansion Protection**: Disable external entities in TinyXML2
2. **Size Limits**: Enforce maximum request body size (existing)
3. **CDATA Validation**: Validate CDATA content doesn't contain `]]>`
4. **Nesting Limits**: Prevent deeply nested XML structures

### CDATA Sanitization
```cpp
std::string validate_cdata_content(const std::string& content) {
    // Reject CDATA content containing CDATA end marker
    if (content.find("]]>") != std::string::npos) {
        throw std::invalid_argument("CDATA content cannot contain ']]>'");
    }
    return content;
}
```

---

## Performance Considerations

### Parsing Performance
- **JSON**: ~15-20µs per request (nlohmann::json)
- **XML**: ~50-100µs per request (TinyXML2)
- **Impact**: Negligible compared to LLM inference time

### Memory Usage
- XML documents: ~2-3x size of JSON for same data
- CDATA sections: No escaping = smaller than escaped JSON
- **Net impact**: Minimal for typical session sizes

---

## PowerShell Client Examples

### Create Session
```powershell
$xmlBody = @"
<session_request>
  <persona><![CDATA[You are a helpful assistant.
You answer questions clearly and concisely.]]></persona>
  <max_context_tokens>8192</max_context_tokens>
  <temperature>0.7</temperature>
  <top_p>0.9</top_p>
</session_request>
"@

$session = Invoke-RestMethod `
    -Uri "http://localhost:8080/api/v1/session/create" `
    -Method Post `
    -ContentType "application/xml" `
    -Body $xmlBody

$sessionId = $session.session_response.session_id
```

### Append Turn
```powershell
$turnXml = @"
<append_request>
  <turn><![CDATA[What is the weather like today?]]></turn>
  <max_tokens>100</max_tokens>
</append_request>
"@

$response = Invoke-RestMethod `
    -Uri "http://localhost:8080/api/v1/session/$sessionId/append" `
    -Method Post `
    -ContentType "application/xml" `
    -Body $turnXml

Write-Host $response.append_response.response
```

---

## Success Criteria

1. ✅ All 5 session endpoints support XML with CDATA
2. ✅ Content-Type negotiation works correctly
3. ✅ CDATA content is preserved verbatim
4. ✅ Error responses match request format
5. ✅ Backward compatibility maintained (JSON still works)
6. ✅ Integration tests pass for XML workflows
7. ✅ Documentation updated with XML examples
8. ✅ No performance degradation for JSON clients

---

## Future Enhancements

### Phase 2 (Optional)
- Streaming support for XML responses (SSE with XML payloads)
- XML schema validation for requests
- XSLT transformations for response formatting
- Namespace support for extensibility

---

## Related Documents

- [STATEFUL_SESSION_IMPLEMENTATION_PLAN.md](STATEFUL_SESSION_IMPLEMENTATION_PLAN.md) - Original JSON session design
- [XML_API_IMPLEMENTATION_PLAN.md](XML_API_IMPLEMENTATION_PLAN.md) - Stateless XML implementation
- [CLIENT_INTEGRATION_GUIDE.md](CLIENT_INTEGRATION_GUIDE.md) - Client documentation

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-24  
**Implementation Status:** 🚧 In Progress