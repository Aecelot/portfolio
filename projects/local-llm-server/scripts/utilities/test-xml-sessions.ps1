# Test Script for XML Session Support
# This script tests the XML format support for stateful sessions

param(
    [string]$BaseUrl = "http://localhost:8080",
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "=== Testing XML Session Support ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Create Session with XML
Write-Host "[Test 1] Creating session with XML format..." -ForegroundColor Yellow

$createXml = @"
<session_request>
  <persona><![CDATA[You are a helpful AI assistant specializing in code examples.
You provide clear, concise explanations with practical examples.]]></persona>
  <max_context_tokens>8192</max_context_tokens>
  <temperature>0.7</temperature>
  <top_p>0.9</top_p>
  <stop_sequences>
    <stop>Note:</stop>
    <stop>---</stop>
  </stop_sequences>
</session_request>
"@

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/session/create" `
        -Method Post `
        -ContentType "application/xml" `
        -Body $createXml
    
    if ($response.StatusCode -eq 201) {
        Write-Host "✓ Session created successfully" -ForegroundColor Green
        
        [xml]$sessionXml = $response.Content
        $sessionId = $sessionXml.session_response.session_id
        $personaTokens = $sessionXml.session_response.persona_tokens
        
        Write-Host "  Session ID: $sessionId" -ForegroundColor Gray
        Write-Host "  Persona Tokens: $personaTokens" -ForegroundColor Gray
        
        if ($Verbose) {
            Write-Host "  Response:" -ForegroundColor Gray
            Write-Host $response.Content -ForegroundColor DarkGray
        }
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed to create session: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Append Turn with XML containing nested XML in CDATA
Write-Host "[Test 2] Appending turn with XML containing nested XML..." -ForegroundColor Yellow

$appendXml = @"
<append_request>
  <turn><![CDATA[<question>
  <context>I'm learning about XML and CDATA</context>
  <code language="xml">
    <example>
      <![CDATA[This is nested XML]]>
    </example>
  </code>
  <ask>Can you explain when to use CDATA in XML?</ask>
</question>]]></turn>
  <max_tokens>150</max_tokens>
  <temperature>0.7</temperature>
</append_request>
"@

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/session/$sessionId/append" `
        -Method Post `
        -ContentType "application/xml" `
        -Body $appendXml
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Turn appended successfully" -ForegroundColor Green
        
        [xml]$appendXml = $response.Content
        $responseText = $appendXml.append_response.response
        $tokensUsed = $appendXml.append_response.tokens_used
        $contextUtil = $appendXml.append_response.context_utilization
        
        Write-Host "  Tokens Used: $tokensUsed" -ForegroundColor Gray
        Write-Host "  Context Utilization: $([math]::Round([double]$contextUtil * 100, 2))%" -ForegroundColor Gray
        Write-Host "  Response Preview: $($responseText.Substring(0, [Math]::Min(100, $responseText.Length)))..." -ForegroundColor Gray
        
        if ($Verbose) {
            Write-Host "  Full Response:" -ForegroundColor Gray
            Write-Host $responseText -ForegroundColor DarkGray
        }
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed to append turn: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Get Session with XML response
Write-Host "[Test 3] Retrieving session with XML format..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/session/$sessionId" `
        -Method Get `
        -Headers @{"Accept" = "application/xml"}
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Session retrieved successfully" -ForegroundColor Green
        
        [xml]$sessionXml = $response.Content
        $turnCount = $sessionXml.session_data.turns.turn.Count
        $totalTokens = $sessionXml.session_data.total_context_tokens
        
        Write-Host "  Turn Count: $turnCount" -ForegroundColor Gray
        Write-Host "  Total Context Tokens: $totalTokens" -ForegroundColor Gray
        
        if ($Verbose) {
            Write-Host "  Session Data:" -ForegroundColor Gray
            Write-Host $response.Content -ForegroundColor DarkGray
        }
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed to retrieve session: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 4: List Sessions with XML response
Write-Host "[Test 4] Listing sessions with XML format..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/sessions?limit=10" `
        -Method Get `
        -Headers @{"Accept" = "application/xml"}
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Sessions listed successfully" -ForegroundColor Green
        
        [xml]$listXml = $response.Content
        $totalSessions = $listXml.sessions_list.total_sessions
        
        Write-Host "  Total Sessions: $totalSessions" -ForegroundColor Gray
        
        if ($Verbose) {
            Write-Host "  Sessions List:" -ForegroundColor Gray
            Write-Host $response.Content -ForegroundColor DarkGray
        }
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed to list sessions: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 5: Second append to test conversation continuity
Write-Host "[Test 5] Appending second turn to test continuity..." -ForegroundColor Yellow

$append2Xml = @"
<append_request>
  <turn><![CDATA[Can you provide a code example?]]></turn>
  <max_tokens>100</max_tokens>
</append_request>
"@

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/session/$sessionId/append" `
        -Method Post `
        -ContentType "application/xml" `
        -Body $append2Xml
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Second turn appended successfully" -ForegroundColor Green
        
        [xml]$appendXml = $response.Content
        $tokensUsed = $appendXml.append_response.tokens_used
        $totalTokens = $appendXml.append_response.total_context_tokens
        
        Write-Host "  Tokens Used: $tokensUsed" -ForegroundColor Gray
        Write-Host "  Total Context Tokens: $totalTokens" -ForegroundColor Gray
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed to append second turn: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 6: Delete Session with XML response
Write-Host "[Test 6] Deleting session with XML format..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/session/$sessionId" `
        -Method Delete `
        -Headers @{"Accept" = "application/xml"}
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Session deleted successfully" -ForegroundColor Green
        
        [xml]$deleteXml = $response.Content
        $deleted = $deleteXml.delete_response.deleted
        
        Write-Host "  Deleted: $deleted" -ForegroundColor Gray
        
        if ($Verbose) {
            Write-Host "  Response:" -ForegroundColor Gray
            Write-Host $response.Content -ForegroundColor DarkGray
        }
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed to delete session: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 7: Error handling - Invalid XML
Write-Host "[Test 7] Testing error handling with invalid XML..." -ForegroundColor Yellow

$invalidXml = @"
<session_request>
  <persona>Missing CDATA wrapper</persona>
</session_request
"@

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/session/create" `
        -Method Post `
        -ContentType "application/xml" `
        -Body $invalidXml `
        -ErrorAction SilentlyContinue
    
    Write-Host "✗ Should have failed with invalid XML" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✓ Correctly rejected invalid XML (400 Bad Request)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Test 8: Format negotiation - JSON request still works
Write-Host "[Test 8] Testing format negotiation (JSON still works)..." -ForegroundColor Yellow

$jsonBody = @{
    persona = "Test assistant`n"
    max_context_tokens = 8192
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/v1/session/create" `
        -Method Post `
        -ContentType "application/json" `
        -Body $jsonBody
    
    if ($response.StatusCode -eq 201) {
        Write-Host "✓ JSON format still works correctly" -ForegroundColor Green
        
        $jsonResponse = $response.Content | ConvertFrom-Json
        $jsonSessionId = $jsonResponse.session_id
        
        Write-Host "  JSON Session ID: $jsonSessionId" -ForegroundColor Gray
        
        # Cleanup
        Invoke-WebRequest `
            -Uri "$BaseUrl/api/v1/session/$jsonSessionId" `
            -Method Delete `
            -ErrorAction SilentlyContinue | Out-Null
    } else {
        Write-Host "✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Failed JSON format test: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== All Tests Passed! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✓ XML session creation" -ForegroundColor Green
Write-Host "  ✓ XML turn append with CDATA" -ForegroundColor Green
Write-Host "  ✓ XML session retrieval" -ForegroundColor Green
Write-Host "  ✓ XML sessions listing" -ForegroundColor Green
Write-Host "  ✓ XML session deletion" -ForegroundColor Green
Write-Host "  ✓ Error handling for invalid XML" -ForegroundColor Green
Write-Host "  ✓ Format negotiation (JSON compatibility)" -ForegroundColor Green
Write-Host ""