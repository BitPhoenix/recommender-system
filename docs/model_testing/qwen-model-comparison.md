# Qwen Model Comparison: Qwen 2.5 vs Qwen 3

**Date:** 2026-01-16
**Models Tested:** 8 models (3 Qwen 2.5, 5 Qwen 3)
**Runtime:** Ollama (local, Mac Studio)
**Tests:** 6 prompts per model

## Purpose

Evaluate Qwen 2.5 and Qwen 3 model families for generating conflict explanations in the constraint advisor feature. The prompts test multi-step reasoning, trade-off analysis, causal chain understanding, RAG context usage, instruction following, and domain context injection.

---

## Performance Summary

### Response Times (seconds)

| Model | Test 1 | Test 2 | Test 3 | Test 4 | Test 5 | Test 6 | Average |
|-------|--------|--------|--------|--------|--------|--------|---------|
| **qwen2.5:7b** | 6.8s | 9.1s | 9.5s | 1.7s | 1.4s | 4.5s | **5.5s** |
| **qwen2.5:14b** | 8.5s | 14.6s | 16.3s | 3.9s | 2.2s | 6.7s | **8.7s** |
| **qwen2.5:32b** | 13.7s | 24.8s | 24.5s | 6.8s | 3.2s | 14.1s | **14.5s** |
| **qwen3:4b** | 35.7s | 49.3s | 24.1s | 7.1s | 2.5s | 16.8s | **22.6s** |
| **qwen3:8b** | 18.5s | 25.8s | 15.2s | 7.4s | 3.9s | 10.1s | **13.5s** |
| **qwen3:14b** | 64.9s | 34.2s | 22.5s | 8.4s | 4.3s | 12.7s | **24.5s** |
| **qwen3:30b-a3b** | 45.1s | 42.3s | 34.1s | 5.8s | 4.0s | 21.2s | **25.4s** |
| **qwen3:32b** | 81.5s | 77.0s | 58.6s | 19.5s | 10.1s | 26.3s | **45.5s** |

**Key Finding:** Qwen 2.5 models are significantly faster than Qwen 3 models at comparable sizes. The qwen2.5:7b is 4x faster than qwen3:8b on average.

---

## Test 1: Multi-Step Reasoning

### Prompt

> A search finds 3 staff engineers: one earns $180k in Pacific timezone, one earns $95k in Eastern timezone, and one earns $150k in Central timezone. The budget is $100k and the team needs Eastern or Central timezone overlap. Which engineers are viable candidates and why might this search return zero results after filtering?

### Analysis

| Model | Correct Answer | Reasoning Quality | Notes |
|-------|----------------|-------------------|-------|
| qwen2.5:7b | Yes (Eastern $95k) | Good | Clear step-by-step |
| qwen2.5:14b | Yes | Good | Mentions "slightly underpaid" - odd observation |
| qwen2.5:32b | Yes | Good | Most nuanced zero-result explanation |
| qwen3:4b | Yes | Verbose | Incorrectly interprets "or" as "and" for overlap |
| qwen3:8b | Yes | Good | Clear, correctly identifies potential filter errors |
| qwen3:14b | Yes | Good | Clear analysis with tables |
| qwen3:30b-a3b | Yes | Good | Identifies filter misconfiguration possibility |
| qwen3:32b | Yes | Good | Clear, identifies multiple zero-result causes |

**Verdict:** All models correctly identified the Eastern engineer ($95k) as the only viable candidate.

---

## Test 2: Trade-Off Analysis

### Prompt

> Explain the trade-offs when a hiring manager wants a 'staff-level React expert available immediately' but the talent pool shows most staff engineers have 3-month notice periods while mid-level engineers are available immediately. What constraints should be relaxed first and why?

### Analysis

| Model | Recommended Relaxation | Key Insights |
|-------|------------------------|--------------|
| qwen2.5:7b | Notice period | Internal upskilling, budget adjustments |
| qwen2.5:14b | Immediacy first | Phased onboarding, interim contractors |
| qwen2.5:32b | Immediacy first | Dual hiring strategy |
| qwen3:4b | Skill level | Very detailed (overly verbose), emphasizes time priority |
| qwen3:8b | Skill level first | Clear trade-off tables, hybrid solutions |
| qwen3:14b | Expertise level | Well-structured, considers hybrid approach |
| qwen3:30b-a3b | Start date (wait) | Argues against compromising expertise |
| qwen3:32b | Staff-level first | Detailed, acknowledges business context matters |

**Verdict:** Models split between relaxing skill level vs. timeline. Qwen3:30b-a3b provided the most contrarian view, arguing to wait for quality.

---

## Test 3: Causal Chain Reasoning

### Prompt

> If a constraint advisor detects that 'seniority=staff' and 'budget<120k' conflict, explain the causal chain: what market dynamics cause this, what implicit assumptions are being violated, and suggest two different resolution strategies with their trade-offs.

### Analysis

| Model | Domain Understanding | Market Dynamics | Resolution Quality |
|-------|---------------------|-----------------|-------------------|
| qwen2.5:7b | Poor (generic HR) | Generic | Reasonable but generic |
| qwen2.5:14b | Better | Good (supply/demand, competitive bidding) | Strong ("grow your own") |
| qwen2.5:32b | Good | Good (supply/demand, economic pressures) | Clear and balanced |
| qwen3:4b | Good | Good with tables | Detailed resolution strategies |
| qwen3:8b | Good | Good | Hybrid model suggestion |
| qwen3:14b | Good | Good (labor market expectations) | Clear two strategies |
| qwen3:30b-a3b | Good | Good with market data references | Very detailed with trade-off tables |
| qwen3:32b | Good | Good | Clear salary-seniority correlation |

**Verdict:** Larger models showed better domain understanding. The qwen2.5:7b struggled with "staff engineer" terminology.

---

## Test 4: RAG-Contextualized Prompt (Production-like)

### System Prompt

> You are an expert in tech talent acquisition... Keep your response concise (2-4 sentences).

### Prompt Summary

Statistics provided about expert React engineers (12 at expert level), salary constraints ($100k), and timezone distribution.

### Analysis

| Model | Sentence Count | Uses Statistics | Actionable Suggestion |
|-------|---------------|-----------------|----------------------|
| qwen2.5:7b | 2 | Yes (12 engineers, 28 in budget) | Yes (lower proficiency or raise salary) |
| qwen2.5:14b | 3 | Yes | Yes (relax salary to $120k-$130k) |
| qwen2.5:32b | 3 | Yes | Yes (relax salary or accept lower proficiency) |
| qwen3:4b | 3 | Yes | Yes (increase cap or adjust to "advanced") |
| qwen3:8b | 3 | Yes | Yes (relax salary to $120k or expand timezones) |
| qwen3:14b | 3 | Yes | Yes (consider mid-level, 45 available) |
| qwen3:30b-a3b | 3 | Yes | Yes (relax to "proficient" or increase budget) |
| qwen3:32b | 4 | Yes | Yes (relax expert requirement or increase salary) |

**Verdict:** All models correctly used the provided statistics and gave actionable suggestions. Most were concise (2-4 sentences).

---

## Test 5: Conciseness Instruction Following

### System Prompt

> You are a hiring assistant. Respond in exactly 2 sentences, no more.

### Prompt

> Why might a search for "staff engineer with Kubernetes expertise earning under $130k in Pacific timezone" return zero results?

### Results

| Model | Sentence Count | Followed Instruction |
|-------|---------------|---------------------|
| qwen2.5:7b | 2 | **Yes** |
| qwen2.5:14b | 2 | **Yes** |
| qwen2.5:32b | 2 | **Yes** |
| qwen3:4b | 2 | **Yes** |
| qwen3:8b | 2 | **Yes** |
| qwen3:14b | 2 | **Yes** |
| qwen3:30b-a3b | 2 | **Yes** |
| qwen3:32b | 2 | **Yes** |

**Verdict:** All 8 models correctly followed the 2-sentence constraint. This is a strong result for instruction following.

---

## Test 6: Domain Context Injection

### Prompt

Provided context defining seniority levels with salary ranges:
- senior: 5-10 years experience, typical salary $120k-$160k

Asked why searching for "senior engineer" with "$100k" budget returns 0 results.

### Results

| Model | Correctly Cited $120k-$160k | Explanation Quality |
|-------|---------------------------|---------------------|
| qwen2.5:7b | **Yes** | Good - explained mismatch clearly |
| qwen2.5:14b | **Yes** | Good - suggested alternatives |
| qwen2.5:32b | **Yes** | Good - detailed recommendations |
| qwen3:4b | **Yes** | Very detailed with tables |
| qwen3:8b | **Yes** | Good with recommendations |
| qwen3:14b | **Yes** | Clear explanation with key takeaway |
| qwen3:30b-a3b | **Yes** | Very detailed, emphasized system rules |
| qwen3:32b | **Yes** | Clear and actionable |

**Verdict:** All 8 models correctly referenced the provided salary ranges ($120k-$160k for senior) rather than hallucinating different numbers. This demonstrates strong context grounding.

---

## Overall Performance

| Metric | qwen2.5:7b | qwen2.5:14b | qwen2.5:32b | qwen3:4b | qwen3:8b | qwen3:14b | qwen3:30b-a3b | qwen3:32b |
|--------|------------|-------------|-------------|----------|----------|-----------|---------------|-----------|
| **Avg Response Time** | 5.5s | 8.7s | 14.5s | 22.6s | 13.5s | 24.5s | 25.4s | 45.5s |
| **Domain Understanding** | Poor | Good | Good | Good | Good | Good | Good | Good |
| **Instruction Following** | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| **Context Grounding** | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| **Conciseness** | Good | Good | Good | Poor (verbose) | Good | Good | Good | Good |
| **Output Quality** | Acceptable | Strong | Strong | Good (verbose) | Good | Good | Very Good | Strong |

---

## Key Findings

### 1. Speed: Qwen 2.5 is Dramatically Faster

| Size Comparison | Qwen 2.5 | Qwen 3 | Speed Ratio |
|-----------------|----------|--------|-------------|
| Small (~7-8B) | 5.5s | 13.5s | **2.5x slower** |
| Medium (~14B) | 8.7s | 24.5s | **2.8x slower** |
| Large (~32B) | 14.5s | 45.5s | **3.1x slower** |

The Qwen 3 models consistently produce longer, more verbose responses, which accounts for much of the speed difference.

### 2. Quality: Similar with Different Styles

- **Qwen 2.5**: More concise, gets to the point faster
- **Qwen 3**: More verbose, includes tables/formatting, more "thorough" explanations
- Both families correctly handle domain context injection and instruction following

### 3. MoE Model (qwen3:30b-a3b)

- Despite only 3B active parameters, produces high-quality output
- Slower than expected given active parameter count (similar to qwen3:14b)
- Memory footprint similar to qwen2.5:32b but slower performance

### 4. Verbosity Concern

Qwen 3 models, especially smaller ones (4b, 8b), tend to produce extremely verbose responses with excessive formatting (tables, bullet points, emojis). This may not be desirable for production use where conciseness matters.

---

## Recommendations for Production Use

### Best Overall: qwen2.5:14b-instruct

- **Best balance** of speed, quality, and conciseness
- 8.7s average response time is acceptable for background processing
- Good domain understanding without excessive verbosity

### For Speed-Critical Applications: qwen2.5:7b-instruct

- Fastest at 5.5s average
- Acceptable quality for simple explanations
- Consider prompt engineering to improve domain understanding

### For Maximum Quality (Latency-Tolerant): qwen2.5:32b-instruct

- Best quality from Qwen 2.5 family
- 14.5s average is manageable for non-real-time use
- More concise than Qwen 3 alternatives

### Not Recommended for Production

- **Qwen 3 models**: Too slow for the marginal quality improvement
- **qwen3:4b**: Extremely verbose and slower than larger Qwen 2.5 models
- **qwen3:32b**: 45.5s average is too slow for most use cases

### Latency Guidelines

| Use Case | Recommended Model | Expected Latency |
|----------|-------------------|------------------|
| Real-time UI feedback | qwen2.5:7b | ~5-10s |
| Background explanation generation | qwen2.5:14b | ~8-15s |
| Batch processing / detailed reports | qwen2.5:32b | ~15-25s |

---

## Appendix: Test Results Files

All raw test results are saved in `docs/model_testing/results/`:

- `qwen2.5-7b-instruct-*.json`
- `qwen2.5-14b-instruct-*.json`
- `qwen2.5-32b-instruct-*.json`
- `qwen3-4b-*.json`
- `qwen3-8b-*.json`
- `qwen3-14b-*.json`
- `qwen3-30b-a3b-*.json`
- `qwen3-32b-*.json`

Each file contains full response text, timing data, and metadata.
