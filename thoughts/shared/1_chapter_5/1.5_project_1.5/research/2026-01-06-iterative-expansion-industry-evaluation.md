---
date: 2026-01-06T12:00:00-08:00
researcher: Claude
git_commit: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
branch: main
repository: recommender_system
topic: "Evaluation of Iterative Requirement Expansion Approach vs Industry Practices"
tags: [research, talent-marketplace, inference-engine, forward-chaining, skill-matching]
status: complete
last_updated: 2026-01-06
last_updated_by: Claude
---

# Research: Evaluation of Iterative Requirement Expansion for Talent Marketplace Filtering

**Date**: 2026-01-06T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
**Branch**: main
**Repository**: recommender_system

## Research Question

Is the iterative requirement expansion approach (forward-chaining inference engine) proposed in `2026-01-06-iterative-requirement-expansion.md` a good approach for online talent marketplace filtering? What issues exist with this approach, and how does it compare to what major talent marketplaces actually do?

## Summary

**Overall Assessment**: The approach is **architecturally sound and aligns with industry practices**, but has **notable gaps** that should be addressed. The core ideas—skill hierarchy inference, filter vs. boost distinction, user overrides, and explanation chains—are all validated by how major talent marketplaces operate. However, the plan lacks consideration of several production-critical concerns.

### Key Findings

| Aspect | Plan's Approach | Industry Practice | Alignment |
|--------|-----------------|-------------------|-----------|
| Skill inference from hierarchy | ✅ Forward chaining rules | LinkedIn uses Skills Graph with 200K+ relationship edges | ✅ Aligned |
| Filter vs. Boost distinction | ✅ Rules declare effect type | Indeed uses veto-based filtering + ML ranking | ✅ Aligned |
| User override wins | ✅ Explicit input blocks inference | Standard across platforms | ✅ Aligned |
| Explanation chains | ✅ Track provenance | Braintrust Match Summary, Eightfold explainability | ✅ Aligned |
| Skill-to-skill chains | ✅ kubernetes→docker | LinkedIn Skills Graph parent-child relationships | ✅ Aligned |
| Performance optimization | ❌ Not mentioned | RETE algorithm standard for production rule engines | ⚠️ Gap |
| Skill recency | ❌ Not considered | Eightfold weights recent skills higher | ⚠️ Gap |
| Embedding fallback | ❌ Not included | LinkedIn/Eightfold use semantic similarity | ⚠️ Gap |
| ML hybrid approach | ❌ Pure rule-based | Industry uses rules + ML together | ⚠️ Gap |

---

## Detailed Findings

### 1. The Core Approach is Industry-Validated

#### LinkedIn's Skills Graph (Most Similar Model)

LinkedIn operates the most documented skill inference system, which closely mirrors the proposed approach:

- **41,000 skills** across 26 languages with **374,000+ aliases** and **200,000+ skill relationship edges**
- **Hierarchical inference**: "When a member lists 'Supply Chain Automation,' the system infers knowledge of parent skill 'Supply Chain Engineering' and all upstream lineage skills"
- **Query expansion**: "Adds results with semantically similar titles, like 'Software Developer' for 'Software Engineer,' when the number of returned results from the original query is too small"

The plan's `kubernetes-requires-containers` rule pattern directly mirrors LinkedIn's approach: inferring prerequisite skills from declared skills.

**Source**: [LinkedIn Engineering Blog - Building the Skills Taxonomy](https://www.linkedin.com/blog/engineering/data/building-maintaining-the-skills-taxonomy-that-powers-linkedins-skills-graph)

#### Indeed's Veto-Based Filtering (Validates Filter vs. Boost)

Indeed explicitly separates hard filtering from ranking:

- **Veto rules**: "Do not show a job requiring professional licenses to job seekers who don't possess such licenses"
- **Output**: `ALLOW` or `VETO` (binary decision), not a ranking score
- **Rationale**: Hard requirements (licenses, location, salary) are enforced as vetoes; soft signals feed into subsequent ranking

This validates the plan's decision to have `effect: 'filter'` vs `effect: 'boost'` as distinct rule types.

**Source**: [Indeed Engineering Blog - Jobs Filter](https://engineering.indeedblog.com/blog/2019/09/jobs-filter/)

#### Braintrust's Match Summary (Validates Explanation Chains)

Braintrust explicitly explains match reasoning:

> "Match Summary explains why a talent or application is either a good or poor match for a job. This model systematically reviews the strongest positive and constructive elements contributing to the match score. The reasoning is clearly explained in English."

This validates the plan's emphasis on `derivationChain` and `explanation` fields.

**Source**: [Braintrust Blog - AI Matching Engine](https://www.usebraintrust.com/blog/introducing-braintrusts-ai-matching-engine)

---

### 2. Potential Issues and Gaps

#### Issue 1: No RETE Algorithm for Production Performance

**The Problem**: The plan mentions capping iterations at 10, but doesn't address the fundamental performance issue with forward chaining.

> "Whenever new facts are asserted into a system, many rules may need to be re-evaluated to determine which are satisfied by these facts. A brute-force implementation could simply re-evaluate all existing rules against the newly introduced facts. This approach would achieve a result but would exhibit very poor performance."

**Industry Solution**: The RETE algorithm, developed by Charles Forgy, constructs a network of nodes representing rule conditions and dependencies. This allows incremental evaluation rather than re-evaluating all rules on each iteration.

**Recommendation**: Consider using an existing RETE implementation (e.g., `json-rules-engine` in Node.js) rather than building a naive loop-based inference engine. With only ~15 rules initially this may not matter, but the architecture should support scaling.

**Source**: [FlexRule - Forward Chain Inference Engine with RETE](https://www.flexrule.com/archives/forward-chain-inference-engine-with-rete/)

#### Issue 2: Skill Recency Not Considered

**The Problem**: The plan treats all skills equally regardless of when they were acquired or used.

**Industry Practice**: Eightfold explicitly handles skill recency:

> "Recency measurement: Similarity using only recent experience skills"

An engineer who used Kubernetes 5 years ago but hasn't touched it since is different from someone actively using it. The proposed rules don't account for this.

**Recommendation**: Add a recency dimension to skill matching:
- Skills from recent roles (< 2 years) get full weight
- Older skills get decayed weight
- Filter rules could have a `requiresRecentUsage: boolean` flag

**Source**: [Eightfold Engineering Blog - AI-Powered Talent Matching](https://eightfold.ai/engineering-blog/ai-powered-talent-matching-the-tech-behind-smarter-and-fairer-hiring/)

#### Issue 3: No Embedding-Based Fallback

**The Problem**: Pure rule-based matching fails when:
- Skills are spelled differently
- Equivalent skills have different names
- New skills emerge that aren't in the taxonomy

**Industry Practice**: LinkedIn and Eightfold use embeddings:

> "LinkedIn uses LINE (Large-Scale Information Network Embeddings) trained on a modified Economic Graph where edge weights between entities according to the number of LinkedIn members that have the two entities listed together in their profile"

> "Eightfold embeds skills into N-dimensional vectors: 'Pandas lands closer to Python than to Panda.'"

**Recommendation**: Consider a hybrid approach:
1. First, apply rule-based inference (fast, explainable)
2. If results are sparse, fall back to embedding similarity (broader recall)
3. Mark embedding-derived matches differently in explanations

#### Issue 4: Filter Rules May Be Too Aggressive

**The Problem**: The plan includes hard filter rules like `scaling-requires-distributed` and `kubernetes-requires-containers`. These could exclude qualified candidates.

**Industry Trend**: Platforms are moving away from hard filters:

> "Eightfold explicitly uses soft ranking rather than hard filters: 'Rather than eliminating candidates lacking specific skills, the system ranks based on likelihood of engagement and success. Candidates without perfect credential matches can rank highly if their trajectory indicates readiness.'"

**Counterpoint**: The plan does acknowledge this tension:
> "Why not all boosts? For staffing decisions, users often prefer focused results over 'here's everyone, with good ones ranked higher'"

**Recommendation**: Make filter rules configurable or allow users to choose "strict mode" vs "discovery mode":
- **Strict mode**: Filter rules exclude candidates (current behavior)
- **Discovery mode**: Filter rules become strong boosts (0.9+ strength)

#### Issue 5: Rule Maintenance Burden Not Addressed

**The Problem**: The plan defines 15+ rules manually. As the skill taxonomy grows, maintaining accurate rules becomes exponential work.

**Industry Practice**: LinkedIn uses ML to suggest rules:

> "LinkedIn uses a fine-tuned BERT model called KGBert to predict skill relationship lineages at scale, outperforming previous models by 20%+ F1 score"

**Phenom uses statistical correlation**:
> "Statistical methods like Pearson correlation or Spearman rank correlation to measure the strength and direction of relationships between skills"

**Recommendation**: Build infrastructure for semi-automated rule generation:
1. Mine co-occurrence patterns from engineer profiles
2. Surface suggested rules for human review
3. Track rule effectiveness (do filter rules exclude too many? do boost rules improve ranking quality?)

#### Issue 6: No A/B Testing or Feedback Loop

**The Problem**: The plan doesn't mention how to validate whether rules are working.

**Industry Practice**: All major platforms use continuous learning:

> "True AI in recruiting technology learns from patterns over time, adjusting predictions based on results, not just rules."

**Recommendation**: Build metrics infrastructure:
- Track how often each rule fires
- Measure if filtered candidates would have been good matches (false negative rate)
- Measure if boosted candidates get selected more often (lift)
- Allow disabling poorly-performing rules automatically

---

### 3. What the Plan Gets Right

#### Decision 1: Filter vs. Boost is Domain-Appropriate

The plan's reasoning is sound:

> "Technical prerequisites genuinely are requirements—treating them as preferences dilutes result quality"

The `X-requires-Y` vs `X-prefers-Y` naming convention is self-documenting and aligns with how recruiters think about requirements.

#### Decision 2: User Override is Essential

> "When there's a conflict between what the user said and what we infer, the explicit statement wins."

This is table stakes for any inference system. Users must feel in control.

#### Decision 3: Explanation Chains Build Trust

> "Knowledge-based systems are only trusted when users understand their reasoning. Black-box recommendations feel arbitrary; explained recommendations feel intelligent."

This aligns with industry direction—Braintrust and modern ATS systems are building explainability as a differentiator.

#### Decision 4: Calling from Within expandSearchCriteria

Encapsulating the two-step process (direct mappings + inference) inside `expandSearchCriteria()` maintains a clean API for callers. This is good architectural hygiene.

---

### 4. Industry Comparison Matrix

| Platform | Rule-Based Inference | ML Matching | Skill Hierarchy | Explanations | Filter vs Rank |
|----------|---------------------|-------------|-----------------|--------------|----------------|
| **LinkedIn** | Skills Graph (41K skills) | GBDT, GLMix, DNNs | Polyhierarchical | Skills Match | L1 retrieval + L2 ranking |
| **Indeed** | Veto rules (licenses, salary) | TensorFlow Wide & Deep | Not documented | Limited | Veto-based filtering |
| **Eightfold** | Implicit skill inference | RNNs on career trajectories | Embedding-based | Feature explanations | Soft ranking only |
| **Braintrust** | AI Matching Engine | Yes | Yes | Match Summary | Score-based |
| **Toptal** | None (human matchers) | None | None | Human explains | Human decision |
| **This Plan** | Forward-chaining rules | None | Parent-child rules | Derivation chains | Filter + Boost |

---

### 5. Recommendations

#### High Priority (Before Production)

1. **Add rule effectiveness tracking**: Log every rule fire and measure outcomes
2. **Consider soft-mode for filters**: Allow users to choose strict vs discovery mode
3. **Add skill recency handling**: Weight recent skills higher

#### Medium Priority (Near-Term)

4. **Evaluate RETE algorithm**: If rules grow beyond ~50, consider proper rule engine
5. **Add embedding fallback**: For sparse results, expand via semantic similarity
6. **Build rule suggestion pipeline**: Use profile co-occurrence to suggest new rules

#### Lower Priority (Future)

7. **Hybrid ML approach**: Train models on user selection data to weight boosts
8. **Dynamic rule strength**: Learn optimal boost strengths from feedback
9. **A/B testing framework**: Compare rule sets for quality

---

## Code References

- Plan being evaluated: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-06-iterative-requirement-expansion.md`
- Current constraint expander: `recommender_api/src/services/constraint-expander.service.ts:60-313`
- Knowledge base config: `recommender_api/src/config/knowledge-base/`

## Architecture Insights

The plan's architecture is appropriate for an early-stage talent marketplace:
- Start with explicit, interpretable rules
- Track everything for later ML training
- Build explanations from day one
- Plan to evolve toward hybrid rule + ML approach

The key insight from industry research: **No major platform uses pure rules OR pure ML—they all use hybrid approaches**. The plan is a reasonable starting point that can evolve.

## Sources

### Engineering Blogs
- [LinkedIn: AI Behind Recruiter Search](https://www.linkedin.com/blog/engineering/recommendations/ai-behind-linkedin-recruiter-search-and-recommendation-systems)
- [LinkedIn: Building the Skills Taxonomy](https://www.linkedin.com/blog/engineering/data/building-maintaining-the-skills-taxonomy-that-powers-linkedins-skills-graph)
- [Indeed: Jobs Filter](https://engineering.indeedblog.com/blog/2019/09/jobs-filter/)
- [Eightfold: AI-Powered Talent Matching](https://eightfold.ai/engineering-blog/ai-powered-talent-matching-the-tech-behind-smarter-and-fairer-hiring/)

### Platform Documentation
- [Braintrust: AI Matching Engine](https://www.usebraintrust.com/blog/introducing-braintrusts-ai-matching-engine)
- [Phenom: AI Skills Ontologies](https://www.phenom.com/blog/ai-skills-ontologies-for-talent-management)

### Technical References
- [FlexRule: Forward Chain Inference Engine with RETE](https://www.flexrule.com/archives/forward-chain-inference-engine-with-rete/)
- [Wikipedia: Forward Chaining](https://en.wikipedia.org/wiki/Forward_chaining)
- [GeeksforGeeks: Forward and Backward Chaining](https://www.geeksforgeeks.org/artificial-intelligence/forward-chaining-and-backward-chaining-inference-in-rule-based-systems/)

### Job Matching Research
- [Job Matching: A New Challenge in Search (Medium)](https://medium.com/datasparq-technology/job-matching-a-new-challenge-in-search-ad6f7f0fc358)
- [Why Skill Inference Alone Falls Short (Credly)](https://learn.credly.com/blog/skill-inference-falls-short-in-competitive-job-market)
- [Understanding Skill-Matching Algorithms (i creatives)](https://www.icreatives.com/iblog/skill-matching-algorithms/)

## Open Questions

1. **Should filter rules be hard-coded or user-configurable?** LinkedIn allows recruiters to toggle "Must-have" vs "Nice-to-have" for skills.
2. **How to handle skills not in taxonomy?** The plan doesn't address engineers with skills outside the defined rule set.
3. **What's the right max iteration count?** 10 seems arbitrary—should this be measured based on actual rule chains?
4. **How to deprecate bad rules?** No process defined for disabling rules that produce poor results.
