# RAG KPI Dashboard Specification

## Overview

This document outlines the comprehensive KPI tracking and dashboard implementation for the Lore RAG system, combining current system metrics with a runtime-first, on-device RAG KPI framework.

## Current System KPIs

### FAISS Index Performance Metrics
- **Accuracy Metrics**:
  - `overlap_at_10`: Fraction of relevant results in top-10 results (target: ≥0.90)
  - `recall_at_5`: Recall rate for top-5 results (target: ≥0.80)
  - `mean_reciprocal_rank`: MRR score across test queries (target: ≥0.75)

- **Performance Metrics**:
  - `query_latency_ms`: Average query time in milliseconds (target: <80ms)
  - `throughput_qps`: Queries per second capacity (target: >10 QPS)

- **Resource Metrics**:
  - `memory_usage_mb`: Index memory footprint (target: <150MB)
  - `index_size_mb`: On-disk index size (target: <100MB)
  - `build_time_seconds`: Index construction time (target: <30s)

### Retrieval System Metrics
- **Latency Targets**:
  - Single query p50: <80ms
  - Single query p95: <200ms
  - Reranking overhead: <100ms
  - Entity context overhead: <50ms

- **Quality Gates**:
  - Max 5 chunks per response
  - Max 1500 tokens per response
  - Max 6 entities in context
  - Primary canon only

## Runtime-First RAG KPIs

### 1) Player-facing Performance & Stability

| KPI | Formula/Collection | Target Band | Current Status |
|-----|-------------------|-------------|----------------|
| **End-to-end latency (ms)** | p50/p90/p95/p99 from request → final text | ≤2.0ms p95 | ⚠️ Needs measurement |
| **Frame impact (ms)** | Max spike during retrieval/generation | <0.5ms on game thread | ❌ Not implemented |
| **Stall rate (%)** | Interactions >150ms / total | <1% | ❌ Not implemented |
| **Cold start time (ms)** | First call after shard swap | <50ms | ❌ Not implemented |
| **TTFT (ms)** | Time-to-first-token for dialogue | <120ms | ⚠️ Needs LLM integration |

### 2) Retrieval Quality (Offline + Online)

| KPI | Formula/Collection | Target Band | Current Status |
|-----|-------------------|-------------|----------------|
| **Recall@k** | Relevant passages in top-k / total relevant | ≥0.95 baseline | ✅ overlap_at_10 |
| **MRR@k** | Mean Reciprocal Rank | ≥0.75 | ✅ Implemented |
| **MAP@k** | Mean Average Precision | ≥0.75 | ❌ Not implemented |
| **nDCG@k** | Normalized Discounted Cumulative Gain | ≥0.80 | ❌ Not implemented |
| **Entity coverage (%)** | Top-k results mentioning active entities | ≥70% | ⚠️ Partial implementation |
| **Path correctness (%)** | Valid narrative paths in results | ≥90% | ❌ Not implemented |

### 3) Evidence Use & Grounding

| KPI | Formula/Collection | Target Band | Current Status |
|-----|-------------------|-------------|----------------|
| **Evidence utilization (%)** | Outputs with ≥1 cited evidence / total | ≥85% | ❌ Not implemented |
| **Unsupported claim rate (%)** | Claims without evidence mapping | ≤1% | ❌ Not implemented |
| **Canon violation rate (ppm)** | Violations per million tokens | <50 | ❌ Not implemented |
| **Context waste (%)** | Unused tokens in prompt | <20% | ❌ Not implemented |

### 4) Retrieval System Efficiency

| KPI | Formula/Collection | Target Band | Current Status |
|-----|-------------------|-------------|----------------|
| **Cache hit rate (%)** | Successful cache lookups / total | ≥35% | ❌ Not implemented |
| **Fast-path usage (%)** | Entity→topN cache usage | ≥50% | ❌ Not implemented |
| **Prefilter effectiveness** | Candidate reduction ratio | >5:1 | ❌ Not implemented |
| **ANN efficiency** | Candidates/ms at efSearch=X | >100/ms | ✅ Partial (latency) |
| **Shard routing accuracy (%)** | Queries not requiring fallback | ≥95% | ❌ Not implemented |

### 5) Generation Efficiency

| KPI | Formula/Collection | Target Band | Current Status |
|-----|-------------------|-------------|----------------|
| **Tokens in/out per turn** | Input/output token counts | Track only | ⚠️ LLM dependent |
| **KV-cache reuse ratio (%)** | Reused tokens / total prefix | ≥60% | ❌ Not implemented |
| **Speculative decoding rate (%)** | Acceptance rate if used | ≥80% | ❌ Not implemented |
| **Grammar-constrained hit (%)** | First-pass validation success | ≥95% | ❌ Not implemented |

### 6) Memory & Footprint

| KPI | Formula/Collection | Target Band | Current Status |
|-----|-------------------|-------------|----------------|
| **Resident set size (MB)** | Current shard + caches | ≤150MB | ✅ memory_usage_mb |
| **Index density (B/vector)** | PQ codes + overhead | <50B | ⚠️ Needs calculation |
| **Cache footprint (MB)** | Cache memory usage | <50MB | ❌ Not implemented |

### 7) Content & Operations KPIs

| KPI | Formula/Collection | Target Band | Current Status |
|-----|-------------------|-------------|----------------|
| **Build time (min)** | Shard construction time | <5min | ✅ build_time_seconds |
| **Artifact validation (%)** | Pass rate for builds | 100% | ❌ Not implemented |
| **Locale coverage** | Strips per locale | ≥90% | ❌ Not implemented |

## Dashboard Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- [ ] API endpoints for KPI data serving (`/api/kpi/current`, `/api/kpi/history`)
- [ ] Real-time KPI data collection and aggregation
- [ ] Basic dashboard HTML page with medieval theme styling
- [ ] Manual refresh functionality

### Phase 2: Visualizations (Week 2)
- [ ] Interactive charts using Chart.js (client-side)
- [ ] Real-time KPI cards and status indicators
- [ ] Historical trend analysis
- [ ] Export functionality for KPI reports

### Phase 3: Advanced Features (Week 3)
- [ ] Alerting system for KPI thresholds
- [ ] Comparative analysis views
- [ ] Performance regression detection
- [ ] Integration with existing KPI monitoring scripts

### Priority Metrics for Dashboard

**🏆 Tier 1 (Critical - Implement First)**
1. Query latency (p50, p95, p99)
2. Recall@k and MRR@k scores
3. Cache hit rates
4. Memory usage and footprint
5. System health status

**🎯 Tier 2 (Important - Implement Second)**
1. Evidence utilization rates
2. Canon violation tracking
3. Build and load times
4. Throughput metrics (QPS)
5. Error rates and stability

**📊 Tier 3 (Nice-to-have - Future)**
1. Advanced grounding metrics
2. Speculative decoding efficiency
3. Locale coverage analysis
4. Player experience impact
5. Advanced regression detection

## Technical Architecture

### Data Collection Points
- **Index Layer**: FAISS evaluator metrics, build times, integrity checks
- **Retrieval Layer**: Query latency, cache performance, result quality
- **Generation Layer**: Token usage, TTFT, generation quality
- **System Layer**: Memory usage, error rates, resource utilization

### Dashboard Components
1. **KPI Cards**: Current values with trend indicators
2. **Charts**: Historical trends and comparative analysis
3. **Status Indicators**: Health checks and alerting
4. **Controls**: Manual refresh, export, filtering
5. **Navigation**: Links to chat interface and system tools

### Styling Requirements
- **Theme**: Medieval/fantasy aesthetic matching existing NPC server
- **Responsiveness**: Desktop and mobile-friendly layout
- **Accessibility**: Proper contrast ratios and keyboard navigation
- **Performance**: Lightweight CSS and optimized JavaScript

## Success Criteria

### MVP (Minimum Viable Product)
- [ ] Real-time KPI data display
- [ ] Historical trend visualization
- [ ] System health monitoring
- [ ] Manual refresh capability
- [ ] Export functionality

### Full Implementation
- [ ] All Tier 1 KPIs implemented and tracked
- [ ] Automated alerting for threshold breaches
- [ ] Integration with existing monitoring scripts
- [ ] Performance regression detection
- [ ] Mobile-responsive design

## Implementation Notes

- Leverage existing `faiss_evaluator.py` and KPI monitoring infrastructure
- Integrate with current Flask server architecture
- Use client-side Chart.js for responsive visualizations
- Implement manual refresh (no auto-refresh per requirements)
- Follow medieval/fantasy theming for consistent user experience
- Ensure all new endpoints follow existing API patterns

## Risk Mitigation

1. **Performance Impact**: Dashboard queries should not affect game performance
2. **Data Accuracy**: Implement proper error handling and data validation
3. **Scalability**: Design for growth as new KPIs are added
4. **Maintenance**: Keep dashboard code maintainable and well-documented
5. **Security**: Ensure KPI data doesn't expose sensitive information