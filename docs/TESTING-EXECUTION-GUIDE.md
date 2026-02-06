# Testing Execution Guide - AI Agent Security Platform

**Quick Reference**: Step-by-step testing commands and procedures  
**Last Updated**: January 29, 2026  

## 🚀 Quick Start Testing

### Prerequisites
```powershell
# Ensure server is running
npm start
# Server should be running on http://localhost:3001
```

## 📋 Phase 1A Testing Checklist

### ✅ 1. Health Check Test
```powershell
# Basic health check
Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET

# Timed health check
$time = Measure-Command { Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET }
Write-Host "Health Check Time: $($time.TotalMilliseconds)ms"
```
**Expected**: Status=healthy, Response time <50ms

### ✅ 2. Security Evaluation Tests

#### Allow Decision Test
```powershell
$headers = @{'X-API-Key' = 'test-api-key-12345'; 'Content-Type' = 'application/json'}
$body = @{
  agentId = 'test-agent'
  toolName = 'web-search'
  parameters = @{query = 'AI security'}
} | ConvertTo-Json

$time = Measure-Command { 
  $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Headers $headers -Body $body
}
Write-Host "Allow Decision Time: $($time.TotalMilliseconds)ms"
Write-Host "Action: $($result.decision.action)"
```
**Expected**: Action=allow, Risk=low, Time <50ms

#### Deny Decision Test
```powershell
$body = @{
  agentId = 'test-agent'
  toolName = 'system-command'
  parameters = @{cmd = 'rm -rf /'}
} | ConvertTo-Json

$time = Measure-Command { 
  $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Headers $headers -Body $body
}
Write-Host "Deny Decision Time: $($time.TotalMilliseconds)ms"
Write-Host "Action: $($result.decision.action)"
```
**Expected**: Action=deny, Risk=critical, Time <50ms

#### Transform Decision Test
```powershell
$body = @{
  agentId = 'test-agent'
  toolName = 'file-write'
  parameters = @{path = '/tmp/test.txt'; content = 'test data'}
} | ConvertTo-Json

$time = Measure-Command { 
  $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Headers $headers -Body $body
}
Write-Host "Transform Decision Time: $($time.TotalMilliseconds)ms"
Write-Host "Action: $($result.decision.action)"
```
**Expected**: Action=transform, Transformed request present, Time <50ms

### ✅ 3. Policy Management Test
```powershell
$time = Measure-Command { 
  $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/security/policies' -Method GET -Headers $headers
}
Write-Host "Policy Retrieval Time: $($time.TotalMilliseconds)ms"
Write-Host "Policies Count: $($result.policies.count)"
```
**Expected**: Count=8, Time <30ms

### ✅ 4. Audit Trail Test
```powershell
$time = Measure-Command { 
  $result = Invoke-RestMethod -Uri 'http://localhost:3001/api/security/audit/test-agent' -Method GET -Headers $headers
}
Write-Host "Audit Retrieval Time: $($time.TotalMilliseconds)ms"
Write-Host "Audit Entries: $($result.auditTrail.total)"
```
**Expected**: Entries >0, Time <40ms

### ✅ 5. Authentication Test
```powershell
# Test missing API key
try {
  Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Body '{}'
} catch {
  Write-Host "Expected 401 Error: $($_.Exception.Response.StatusCode)"
}

# Test invalid API key
$badHeaders = @{'X-API-Key' = 'short'; 'Content-Type' = 'application/json'}
try {
  Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Headers $badHeaders -Body '{}'
} catch {
  Write-Host "Expected 401 Error: $($_.Exception.Response.StatusCode)"
}
```
**Expected**: Both should return 401 Unauthorized

### ✅ 6. End-to-End Agent Test
```powershell
# Run the example agent
node examples/simple-agent.js
```
**Expected**: 4 scenarios complete, audit trail with 4 entries

## 🔥 Load Testing

## 🔥 Load Testing

### Comprehensive Load Testing Results

**Test Environment**: Local Windows laptop, PowerShell testing
**Date**: January 29, 2026
**Server**: http://localhost:3001

#### Load Test 1: Server Health Verification
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
```
**Result**: ✅ PASSED
- Status: healthy
- Service: AI Agent Security Platform  
- Version: 0.1.0

#### Load Test 2: Baseline Performance (Single Request)
```powershell
# 5 sequential requests for average
$times = @(); for($i=1; $i -le 5; $i++) { 
  $time = Measure-Command { Invoke-RestMethod -Uri "http://localhost:3001/health" }
  $times += $time.TotalMilliseconds 
}
```
**Result**: ✅ PASSED
- Average: 5ms
- Range: 3.2ms - 10.4ms
- Status: Excellent baseline performance

#### Load Test 3: Concurrent Request Testing
```powershell
# Progressive load testing: 2, 5, 10 concurrent requests
$jobs = @(); for($i=1; $i -le 10; $i++) {
  $jobs += Start-Job -ScriptBlock { 
    Measure-Command { Invoke-RestMethod -Uri "http://localhost:3001/health" }
  }
}
```

**Results Summary**:
- **2 Concurrent**: 139ms average (128-150ms range)
- **5 Concurrent**: 145ms average (113-173ms range)  
- **10 Concurrent**: 136ms average (110-171ms range)
- **Status**: ✅ Stable performance across load levels

#### Load Test 4: Security Evaluation Under Load
```powershell
# 5 concurrent security evaluations
$headers = @{'X-API-Key' = 'test-api-key-12345'; 'Content-Type' = 'application/json'}
$body = @{agentId = 'load-test'; toolName = 'web-search'; parameters = @{query = 'test'}}
# Concurrent execution with Start-Job
```
**Result**: ✅ PASSED
- Average: 188ms for complex security evaluations
- All requests processed successfully
- No errors or timeouts

### Load Testing Analysis

**✅ Positive Findings**:
- **Server Stability**: No crashes or connection errors under load
- **Consistent Performance**: Response times stable across different load levels
- **Scalability**: Handles 10+ concurrent requests appropriately for local environment
- **Security Processing**: Complex evaluations work correctly under load

**📊 Performance Characteristics**:
- **Baseline**: ~5ms (excellent single request performance)
- **Concurrent Load**: ~135-145ms (reasonable for local laptop with PowerShell overhead)
- **Security Evaluation**: ~188ms (acceptable for complex policy evaluation)

**🎯 Local Development Context**:
- **Environment**: Windows laptop, localhost testing
- **Overhead**: PowerShell job management adds latency
- **Scalability**: Appropriate for development and testing phase
- **Production Expectation**: Much better performance with cloud deployment

## 📊 Performance Benchmarking

### Response Time Benchmarks
```powershell
# Comprehensive performance test
$tests = @(
  @{Name="Health Check"; Uri="http://localhost:3001/health"; Method="GET"; Headers=@{}; Body=""},
  @{Name="Security Allow"; Uri="http://localhost:3001/api/security/evaluate"; Method="POST"; Headers=$headers; Body=(@{agentId='perf-test'; toolName='web-search'; parameters=@{query='test'}} | ConvertTo-Json)},
  @{Name="Security Deny"; Uri="http://localhost:3001/api/security/evaluate"; Method="POST"; Headers=$headers; Body=(@{agentId='perf-test'; toolName='system-command'; parameters=@{cmd='ls'}} | ConvertTo-Json)},
  @{Name="Get Policies"; Uri="http://localhost:3001/api/security/policies"; Method="GET"; Headers=$headers; Body=""},
  @{Name="Get Audit"; Uri="http://localhost:3001/api/security/audit/perf-test"; Method="GET"; Headers=$headers; Body=""}
)

Write-Host "Performance Benchmark Results:"
Write-Host "================================"

foreach($test in $tests) {
  $times = @()
  for($i=1; $i -le 3; $i++) {
    $time = Measure-Command {
      if($test.Method -eq "GET") {
        Invoke-RestMethod -Uri $test.Uri -Method $test.Method -Headers $test.Headers
      } else {
        Invoke-RestMethod -Uri $test.Uri -Method $test.Method -Headers $test.Headers -Body $test.Body
      }
    }
    $times += $time.TotalMilliseconds
  }
  $avg = ($times | Measure-Object -Average).Average
  Write-Host "$($test.Name): $([math]::Round($avg, 2))ms"
}
```

## 🔒 Security Testing

### Input Validation Tests
```powershell
$headers = @{'X-API-Key' = 'test-api-key-12345'; 'Content-Type' = 'application/json'}

# Test malformed JSON
try {
  Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Headers $headers -Body '{"invalid": json}'
} catch {
  Write-Host "Malformed JSON Test: $($_.Exception.Response.StatusCode)"
}

# Test missing required fields
try {
  Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Headers $headers -Body '{}'
} catch {
  Write-Host "Missing Fields Test: $($_.Exception.Response.StatusCode)"
}

# Test oversized request
$largeBody = @{
  agentId = 'test'
  toolName = 'test'
  parameters = @{data = 'x' * 1000000}  # 1MB of data
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri 'http://localhost:3001/api/security/evaluate' -Method POST -Headers $headers -Body $largeBody
} catch {
  Write-Host "Oversized Request Test: $($_.Exception.Response.StatusCode)"
}
```

## 🧪 Advanced Testing Scenarios

### Policy Validation Test
```powershell
$testPolicy = @{
  policies = @(
    @{
      name = "test-policy"
      description = "Test policy for validation"
      conditions = @(
        @{type = "tool_name"; pattern = "test-*"}
      )
      action = "allow"
      reason = "Test policy allows test tools"
    }
  )
} | ConvertTo-Json -Depth 10

$result = Invoke-RestMethod -Uri 'http://localhost:3001/api/security/policies/validate' -Method POST -Headers $headers -Body $testPolicy
Write-Host "Policy Validation: Valid=$($result.validation.valid)"
```

### Error Recovery Test
```powershell
# Test behavior when policy file is corrupted (simulate)
# This would require temporarily modifying the policy file
Write-Host "Error Recovery Test: Manual test required"
Write-Host "1. Backup src/config/policies.json"
Write-Host "2. Replace with invalid JSON"
Write-Host "3. Restart server"
Write-Host "4. Test security evaluation (should use default policies)"
Write-Host "5. Restore backup"
```

## 📈 Test Result Analysis

### Performance Analysis Script
```powershell
function Analyze-TestResults {
  param($results)
  
  $avg = ($results | Measure-Object -Average).Average
  $max = ($results | Measure-Object -Maximum).Maximum
  $min = ($results | Measure-Object -Minimum).Minimum
  $p95 = $results | Sort-Object | Select-Object -Index ([math]::Floor($results.Count * 0.95))
  
  Write-Host "Performance Analysis:"
  Write-Host "Average: $([math]::Round($avg, 2))ms"
  Write-Host "Min: $([math]::Round($min, 2))ms"
  Write-Host "Max: $([math]::Round($max, 2))ms"
  Write-Host "95th Percentile: $([math]::Round($p95, 2))ms"
  
  if($avg -lt 50) { Write-Host "✅ EXCELLENT performance" -ForegroundColor Green }
  elseif($avg -lt 100) { Write-Host "✅ GOOD performance" -ForegroundColor Yellow }
  else { Write-Host "❌ NEEDS OPTIMIZATION" -ForegroundColor Red }
}
```

## 🎯 Test Automation

### Automated Test Suite
```powershell
# Save as test-suite.ps1
function Run-TestSuite {
  Write-Host "🧪 Starting AI Agent Security Platform Test Suite"
  Write-Host "=================================================="
  
  $passed = 0
  $failed = 0
  
  # Health Check
  try {
    $result = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
    if($result.status -eq "healthy") {
      Write-Host "✅ Health Check: PASSED" -ForegroundColor Green
      $passed++
    } else {
      Write-Host "❌ Health Check: FAILED" -ForegroundColor Red
      $failed++
    }
  } catch {
    Write-Host "❌ Health Check: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
  }
  
  # Add more tests here...
  
  Write-Host "=================================================="
  Write-Host "Test Results: $passed passed, $failed failed"
  
  if($failed -eq 0) {
    Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
    return $true
  } else {
    Write-Host "💥 SOME TESTS FAILED!" -ForegroundColor Red
    return $false
  }
}

# Run the test suite
Run-TestSuite
```

## 📋 Test Reporting

### Generate Test Report
```powershell
function Generate-TestReport {
  $report = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    phase = "1A"
    tests = @()
    summary = @{
      total = 0
      passed = 0
      failed = 0
      performance = @{}
    }
  }
  
  # Add test results to report
  # Export to JSON
  $report | ConvertTo-Json -Depth 10 | Out-File "test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
  
  Write-Host "Test report generated: test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
}
```

---

**Usage**: Copy and paste commands into PowerShell for immediate testing  
**Automation**: Save scripts as .ps1 files for repeated execution  
**Integration**: Include in CI/CD pipelines for automated validation