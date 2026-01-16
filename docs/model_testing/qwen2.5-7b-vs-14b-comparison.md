# Qwen2.5 Model Comparison: 7B vs 14B vs 32B Instruct

**Date:** 2026-01-16
**Models Tested:** `qwen2.5:7b-instruct`, `qwen2.5:14b-instruct`, `qwen2.5:32b-instruct`
**Runtime:** Ollama (local, Mac Studio)

## Purpose

Evaluate the difference between 7B, 14B, and 32B parameter models for generating conflict explanations in the constraint advisor feature. The prompts test multi-step reasoning, trade-off analysis, and causal chain understanding in the hiring/staffing domain.

---

## Performance Summary

| Model | Test 1 | Test 2 | Test 3 | Average |
|-------|--------|--------|--------|---------|
| **7B** | 15.5s | 9.0s | 10.4s | **11.6s** |
| **14B** | 9.2s | 15.8s | 14.7s | **13.2s** |
| **32B** | 15.8s | 23.4s | 22.7s | **20.6s** |

*Note: Times vary based on response length. 14B was faster on Test 1 due to shorter response.*

---

## Test 1: Multi-Step Reasoning

### Prompt

> A search finds 3 staff engineers: one earns $180k in Pacific timezone, one earns $95k in Eastern timezone, and one earns $150k in Central timezone. The budget is $100k and the team needs Eastern or Central timezone overlap. Which engineers are viable candidates and why might this search return zero results after filtering?

### Execution Times

| Model | Time |
|-------|------|
| 7B | 15.5s |
| 14B | 9.2s |
| 32B | 15.8s |

### Responses

<details>
<summary><strong>7B Response</strong> (click to expand)</summary>

Given your criteria, let's break down the situation:

1. **Budget Constraint**: You have a budget of $100k per engineer.
2. **Timezone Requirement**: The team needs Eastern or Central timezone overlap.

### Analysis of Current Engineers

- **Pacific Timezone Engineer**: Earnings = $180k
  - This engineer does not meet the budget constraint and cannot be considered due to their high earnings.

- **Eastern Timezone Engineer**: Earnings = $95k
  - This engineer meets both the budget constraint ($95k < $100k) and the timezone requirement (Eastern timezone).

- **Central Timezone Engineer**: Earnings = $150k
  - This engineer does not meet the budget constraint due to their high earnings.

### Viable Candidates

After filtering, only one engineer meets both criteria:
- The Eastern Timezone Engineer earns $95k and is in the correct timezone (Eastern).

### Why Might This Search Return Zero Results After Filtering?

If no engineers are found that meet these specific criteria, it could be due to a few reasons:

1. **Incorrect Budget or Criteria**: Double-check the budget amount and the requirement for Eastern or Central time overlap.
2. **Search Constraints**: Ensure there are no additional filters (e.g., years of experience) that might have inadvertently excluded potential candidates.
3. **Candidate Availability**: There might be very limited availability of engineers who meet both the budget constraints and timezone requirements.

In conclusion, based on the provided data, only the Eastern Timezone Engineer is a viable candidate. If the search returns zero results after filtering, it would likely indicate that no other candidates in your current search pool meet both the budget and timezone criteria.

</details>

<details>
<summary><strong>14B Response</strong> (click to expand)</summary>

Given the constraints of a budget of $100k and the requirement for an engineer who works in either the Eastern or Central time zones, let's evaluate each candidate based on these criteria:

1. **Engineer earning $180k (Pacific Time Zone)**:
   - This engineer does not meet the budget constraint since they earn more than $100k.
   - Moreover, this engineer is located in the Pacific timezone which doesn't align with the required Eastern or Central timezone overlap.

2. **Engineer earning $95k (Eastern Time Zone)**:
   - This engineer meets both the budget constraint and the timezone requirement since they earn $95k, which is within the budget of $100k, and work in the Eastern time zone.

3. **Engineer earning $150k (Central Time Zone)**:
   - Although this engineer works in the Central timezone, their salary ($150k) exceeds the budget of $100k.

Based on these evaluations, only one candidate meets both criteria:

- The **engineer earning $95k in the Eastern time zone** is a viable candidate because they fit within the budget and work in an acceptable timezone.

The search might return zero results after filtering due to:
- Insufficient number of candidates meeting all criteria (e.g., there's only one candidate who fits both salary and location requirements).
- The strictness of the constraints, especially the limited budget that excludes highly qualified engineers based on their salary.
- Potential for human oversight or misconfiguration in the search parameters, such as not allowing a sufficient range in salaries or incorrectly filtering time zones.

</details>

<details>
<summary><strong>32B Response</strong> (click to expand)</summary>

Based on your criteria for hiring a staff engineer within a budget of $100k, with the requirement that they must be in either the Eastern or Central time zones, let's analyze the given options:

1. **Pacific Time Zone Engineer:** Earning $180k - This engineer exceeds the budget and is not in an eligible timezone (Eastern or Central), so they are not a viable candidate.

2. **Eastern Time Zone Engineer:** Earning $95k - This engineer meets both criteria: their salary falls within the budget ($95k < $100k) and they work in the Eastern time zone, which is acceptable.

3. **Central Time Zone Engineer:** Earning $150k - Although this engineer works in a Central time zone (which would meet your timezone requirement), their salary of $150k exceeds the budget limit of $100k, making them not viable either.

From these options:
- The only viable candidate is the staff engineer earning $95k in the Eastern Time Zone as they are within both the budget and the required time zone criteria.

However, **this search might return zero results after filtering** if there were no candidates found who simultaneously met all three conditions: salary under or equal to $100k, located in either Eastern or Central timezone. In this specific scenario, only one candidate meets these conditions (Eastern Time Zone Engineer earning $95k), but if that particular individual was excluded for any reason during the filtering process (such as being unavailable or having other constraints not mentioned), the search might indeed return zero viable candidates based on your strict criteria.

</details>

### Analysis

| Criteria | 7B | 14B | 32B |
|----------|-----|------|------|
| **Correct answer** | Yes | Yes | Yes |
| **Reasoning steps shown** | Explicit, step-by-step | Condensed | Clear, balanced |
| **Verbosity** | ~280 words | ~250 words | ~250 words |
| **Structure** | Headers + bullets | Numbered list | Numbered + summary |
| **Unique insight** | Mentions additional filters | Mentions misconfiguration | Considers candidate unavailability |

**Verdict:** All three models correctly identified the $95k Eastern engineer as the only viable candidate. The 32B model provided the most nuanced explanation for why zero results might occur (candidate unavailability). The 14B was fastest due to shorter output.

---

## Test 2: Trade-Off Analysis

### Prompt

> Explain the trade-offs when a hiring manager wants a 'staff-level React expert available immediately' but the talent pool shows most staff engineers have 3-month notice periods while mid-level engineers are available immediately. What constraints should be relaxed first and why?

### Execution Times

| Model | Time |
|-------|------|
| 7B | 9.0s |
| 14B | 15.8s |
| 32B | 23.4s |

### Responses

<details>
<summary><strong>7B Response</strong> (click to expand)</summary>

When a hiring manager desires a "staff-level React expert" who is immediately available, several trade-offs need to be considered in light of the current talent pool:

1. **Skill Level vs. Availability**:
   - **Immediate Availability**: Mid-level engineers are currently available but may not have the depth or breadth of expertise needed for a "staff-level" position.
   - **3-Month Notice Period**: Staff-level engineers with the desired skill set might be in high demand and could require a longer notice period, which may delay their start date.

2. **Timeframe vs. Cost**:
   - Hiring mid-level engineers would likely be faster but may not meet all immediate requirements.
   - Extending the hiring process to find a staff-level engineer immediately available could increase costs due to potential temporary or interim solutions.

3. **Hiring Constraints**:
   - **Notice Period**: Relaxing this constraint might be challenging as it is often tied to legal and contractual agreements, but it's worth exploring if there are any flexibility options.
   - **Budget**: If the hiring budget allows for a more extended search period, it may accommodate finding an expert with no notice period. Otherwise, adjusting budgets or reallocating funds could help.

4. **Candidate Quality**:
   - Mid-level engineers might provide a good balance between speed and quality if trained appropriately, but this would require additional time and effort to develop their skills further.
   - Staff-level experts might bring immediate value but at the cost of delayed start dates and potentially higher salary expectations.

### Recommendations:

1. **Evaluate Immediate Needs**:
   - Assess whether the project timelines can accommodate a mid-level engineer with a short training period, or if the urgency truly requires a staff-level expert right away.

2. **Reconsider Notice Periods**:
   - Explore the possibility of relaxing notice periods for key positions to attract more candidates who might be willing to start sooner. This could involve negotiating terms, offering incentives, or adjusting internal processes.

3. **Internal Upskilling Options**:
   - Consider whether there are existing mid-level engineers who can be upskilled with specialized training in React and other necessary skills.

4. **Budget Adjustments**:
   - If the budget allows, consider allocating more resources to secure a staff-level expert immediately or investing in multiple mid-level engineers to gradually build a robust team.

5. **Flexibility in Hiring Timeline**:
   - Prioritize the most critical aspects of the project and decide if flexibility can be applied where possible without compromising quality too much.

By carefully evaluating these constraints, you can make informed decisions that balance immediate needs with long-term strategic goals.

</details>

<details>
<summary><strong>14B Response</strong> (click to expand)</summary>

When a hiring manager is looking for a "staff-level React expert" who can start immediately, but the majority of suitable candidates in the talent pool have a 3-month notice period, there's a clear mismatch between the immediate need and the candidate availability. This situation requires careful consideration of the constraints involved to find an optimal solution that aligns with both the business needs and the candidate's career progression.

### Trade-offs

1. **Quality vs. Urgency**:
   - Hiring a mid-level engineer who is available immediately may compromise on the depth and breadth of experience required for staff-level expertise.
   - Onboarding someone less experienced can slow down project timelines if they need extensive training or mentoring to reach full productivity.

2. **Candidate Satisfaction vs. Company Needs**:
   - Candidates with notice periods are often in high demand, requiring negotiation and sometimes competing offers from other companies.
   - A mid-level engineer might be open to a quick start but may not have the same level of expertise required for staff-level work, potentially impacting job satisfaction and long-term retention.

3. **Cost vs. Skill**:
   - Staff-level engineers often command higher salaries due to their experience and proficiency.
   - Hiring someone less experienced may result in lower immediate costs but could lead to longer-term inefficiencies if the engineer cannot meet productivity demands without significant support or training.

### Constraints to Relax First

1. **Immediate Start Requirement**:
   - Relaxing this constraint might be most effective, as it allows for hiring a more qualified candidate who can provide higher value and greater expertise over time.
   - Consider bringing on a staff-level React expert with a notice period but ensuring they will transition seamlessly into the role when available (e.g., setting up temporary project support or cross-training).

2. **Position Level**:
   - While maintaining high standards, consider whether there's room to be flexible regarding the exact level of expertise needed.
   - Hiring someone slightly below staff-level who has a strong potential for rapid growth might work if you can provide robust training and mentorship.

3. **Notice Period Negotiation**:
   - Some candidates may be willing to reduce their notice period or start part-time before transitioning fully, especially if presented with a compelling offer.
   - Discussing this openly during the hiring process could yield positive outcomes where both parties are satisfied.

### Recommended Approach

1. **Short-term Solutions**:
   - Consider interim hires (contractors, freelancers) to bridge the gap until the staff-level candidate can start.
   - Utilize internal resources or cross-train current mid-level engineers in React to maintain project momentum.

2. **Long-term Planning**:
   - Develop a more structured training and mentorship program for mid-level engineers aiming to advance to staff level.
   - Engage with candidates early in their career trajectories to build long-term relationships and reduce the impact of notice periods through phased onboarding processes.

By carefully weighing these trade-offs, you can find a balanced solution that meets immediate needs while investing in the future growth of your engineering team.

</details>

<details>
<summary><strong>32B Response</strong> (click to expand)</summary>

In the scenario where a hiring manager seeks to onboard a 'staff-level React expert immediately,' there are several trade-offs involved when considering that most suitable candidates have 3-month notice periods, whereas mid-level engineers can start right away. Here's an analysis of these trade-offs and the constraints that might need to be relaxed:

### Constraints Involved
1. **Experience Level**: Staff-level engineers typically offer more depth in their expertise and leadership abilities compared to mid-level engineers.
2. **Time Availability**: The immediate availability of candidates versus those needing a notice period impacts project timelines.
3. **Cost**: Higher-level staff may command higher salaries, and there could be additional costs associated with expedited hiring processes.

### Trade-offs
1. **Expertise vs. Immediate Impact**:
   - Staff engineers are expected to have a deep understanding of React patterns, architecture, and best practices. They can lead projects and mentor other team members effectively.
   - Mid-level engineers might not offer the same level of expertise but could start contributing immediately without waiting for notice periods.

2. **Project Timelines**:
   - Delaying hiring by 3 months due to a notice period might delay critical project milestones, potentially affecting deadlines and customer satisfaction.
   - An immediate hire can help meet short-term objectives, even if it means a gradual ramp-up in terms of expertise.

### Relaxation Strategy
The first constraint that should be relaxed is the **immediate availability** requirement. Here's why:
1. **Value Addition Over Time**: Although mid-level engineers might start contributing right away, their initial contributions might lack the strategic depth and leadership provided by staff-level experts. This could lead to a less efficient use of resources in the long term.
2. **Long-term Goals vs. Immediate Needs**: If the project's success depends on immediate performance, it might be critical to onboard mid-level engineers now and plan for bringing in more experienced staff later.
3. **Cost Considerations**: While expedited hiring might incur additional costs (such as referral bonuses or higher salaries), these expenses should be weighed against potential delays in project timelines caused by waiting for the notice period.

### Suggested Actions
- **Dual Hiring Strategy**: Start with mid-level engineers to ensure immediate project coverage and simultaneously continue the search for a staff-level expert who can join after their notice period.
- **Bridge Resources**: Utilize temporary or contract-based resources to bridge any skill gaps during the transition period until a permanent staff-level hire is onboarded.

By relaxing the immediacy requirement, you align your hiring strategy with long-term project goals and ensure that you benefit from both immediate contributions and future leadership.

</details>

### Analysis

| Criteria | 7B | 14B | 32B |
|----------|-----|------|------|
| **Correct recommendation** | Yes (relax notice period) | Yes (relax immediacy) | Yes (relax immediacy) |
| **Trade-offs identified** | 4 areas | 3 areas + recommended approach | 2 core areas, focused |
| **Unique insights** | Internal upskilling | Interim contractors, phased onboarding | Dual hiring strategy |
| **Verbosity** | ~450 words | ~550 words | ~400 words |
| **Structure quality** | Good, some redundancy | Comprehensive, well-organized | Focused, actionable |

**Verdict:** All three models arrived at the correct conclusion. The 32B model was most concise and actionable with a clear "dual hiring strategy" recommendation. The 14B model was most comprehensive but verbose. The 7B model had good coverage but some redundancy.

---

## Test 3: Causal Chain Reasoning

### Prompt

> If a constraint advisor detects that 'seniority=staff' and 'budget<120k' conflict, explain the causal chain: what market dynamics cause this, what implicit assumptions are being violated, and suggest two different resolution strategies with their trade-offs.

### Execution Times

| Model | Time |
|-------|------|
| 7B | 10.4s |
| 14B | 14.7s |
| 32B | 22.7s |

### Responses

<details>
<summary><strong>7B Response</strong> (click to expand)</summary>

To address the scenario where a constraint advisor detects a conflict between "seniority=staff" and "budget<120k," we need to break down potential causes, implicit assumptions, and possible resolutions.

### Market Dynamics and Implicit Assumptions

#### 1. Market Dynamics:
- **High-Seniority Staff**: Typically, more senior staff members (such as experienced managers or directors) are paid higher salaries due to their expertise, experience, and the value they bring.
- **Budget Constraints**: Organizations often have budget constraints that limit how much they can spend on individual positions.

#### 2. Implicit Assumptions:
- The assumption is that "seniority=staff" implies a certain minimum salary threshold, which is higher than $120k in this context.
- Conversely, the condition "budget<120k" suggests that no position should be funded at or above this amount.

### Causal Chain
1. **Seniority and Salaries**: The company's HR policies state that senior staff are expected to command salaries above a certain threshold (say $130k - $140k).
2. **Budget Allocation**: The company's budget is limited, and there may be specific projects or roles within this budget.
3. **Conflict Detection**: When the constraint advisor detects a conflict between "seniority=staff" and "budget<120k," it means that allocating a position to a senior staff member under these conditions would exceed the available budget.

### Resolution Strategies

#### 1. Adjust Seniority Criteria
**Strategy:** Modify the seniority criteria to fit within the budget constraints.
- **Implementation**: For example, redefine what "senior" means to allow for more flexibility in salary ranges or introduce a sliding scale based on years of experience and performance.
- **Trade-offs**:
  - This approach may reduce overall job satisfaction among high-performing employees who are classified as junior staff due to budget constraints.
  - There might be a risk that the organization loses experienced talent if they cannot offer competitive salaries.

#### 2. Adjust Budget Allocation
**Strategy:** Modify the budget allocation process to accommodate higher seniority roles.
- **Implementation**: This could involve:
    - Seeking additional funding for high-value positions.
    - Prioritizing certain projects or departments where hiring more senior staff is critical and justifiable.
    - Implementing a phased approach, where some roles can be filled with less senior staff initially while others require higher-seniority candidates.
- **Trade-offs**:
  - Increasing the budget may strain financial resources and affect other areas of the organization.
  - There could be delays in hiring due to the need for additional approval processes or fundraising.

### Conclusion
Both strategies have their own set of trade-offs. Adjusting seniority criteria allows for more flexibility but may impact employee morale, while adjusting the budget provides a clearer path forward but requires careful financial management and possibly additional resources. The choice between these strategies would depend on the specific context of the organization, its financial situation, and strategic priorities.

</details>

<details>
<summary><strong>14B Response</strong> (click to expand)</summary>

When a constraint advisor detects a conflict between "seniority=staff" and "budget<120k," it suggests that hiring staff-level employees within the budget limit of 120k is not feasible under current market dynamics. This scenario often occurs due to several underlying factors:

### Market Dynamics:
1. **Supply and Demand**: In a tight labor market, particularly for positions requiring specific skills or experience levels like "staff," there might be more demand than supply, driving up the cost of hiring qualified individuals.
2. **Competitive Bidding**: Other companies may offer higher salaries to attract talent in short supply, raising the bar for minimum acceptable salary packages.
3. **Skill Level and Experience**: Staff-level employees often have specific skills that are not readily available at lower price points due to their experience or specialized training.

### Implicit Assumptions Being Violated:
1. **Cost Efficiency**: The assumption might be that staff-level positions can be filled within a budget of 120k, which is now unrealistic given market conditions.
2. **Skill Acquisition Cost**: There may have been an underestimation of the true cost to acquire employees with specific skills and experience levels.
3. **Market Flexibility**: The company might have assumed greater flexibility in hiring practices (e.g., reducing salary expectations) than what current market dynamics allow.

### Resolution Strategies:

#### Strategy 1: Increase Budget Cap
**Description**: Raise the budget cap for staff-level hires to reflect current market conditions, ensuring that qualified candidates are not overlooked due to financial constraints.
- **Pros**:
    - Ensures hiring of high-quality talent without compromising on skill or experience levels.
    - May help in retaining top performers and reducing turnover rates.
- **Cons**:
    - Immediate increase in labor costs which might impact short-term profitability.
    - Could lead to higher operational expenses if not managed properly, affecting overall financial health.

#### Strategy 2: Hire Entry-Level with Training
**Description**: Consider hiring entry-level employees or those just below the staff level and invest in training them to meet the position requirements over time. This strategy is often referred to as "growing your own."
- **Pros**:
    - Cost-effective approach initially, as entry-level salaries are generally lower.
    - Can result in a more loyal workforce due to long-term development investment.
    - Tailored skill set development ensures alignment with company's specific needs and culture.
- **Cons**:
    - Longer onboarding period and ramp-up time until the employees reach full productivity.
    - Initial loss of efficiency as new hires are less experienced, potentially impacting short-term performance.

### Conclusion
Addressing conflicts between hiring constraints and market realities requires a nuanced approach that balances financial prudence with operational needs. Both strategies have their trade-offs and require careful consideration based on the organization's long-term goals and current strategic priorities.

</details>

<details>
<summary><strong>32B Response</strong> (click to expand)</summary>

To understand the causal chain behind the detected conflict between 'seniority=staff' and 'budget<120k', we need to dissect both the underlying market dynamics and any implicit assumptions that may be influencing this scenario.

### Market Dynamics:
1. **Supply and Demand for Talent**: In competitive job markets, senior-level positions often command higher salaries due to their experience and expertise. This creates a demand-driven salary structure where staff with higher seniority expect correspondingly high compensation.
2. **Economic Pressures on Budgets**: Companies might have budget constraints influenced by economic conditions or business strategies that aim for cost-saving measures. These pressures can lead to setting lower budgets, which may not align well with hiring requirements for skilled and experienced personnel.

### Implicit Assumptions:
1. **Seniority Implies Higher Salary Expectations**: There's an assumption that staff labeled as 'senior' would have higher salary expectations due to their experience and the market value of their skills.
2. **Budget Constraints Reflect Overall Financial Health**: Another implicit assumption is that a low budget cap (<$120k) indicates a financial constraint or strategy to minimize spending, which may not support hiring senior-level talent.

### Resolution Strategies with Trade-offs:

#### Strategy 1: Adjust the Budget
**Resolution**: Increase the budget limit to attract and retain senior staff members.
- **Pros**: This approach can help in attracting more experienced individuals who are necessary for critical roles. It aligns better with market demands and expectations, potentially leading to higher productivity and quality of work.
- **Cons**: Increasing the budget might strain the overall financial health of the company if not managed alongside other cost-saving measures or revenue generation efforts.

#### Strategy 2: Adjust Seniority Requirements
**Resolution**: Lower the seniority requirement for positions that fall within the <$120k budget.
- **Pros**: This allows hiring staff with less experience but still within budget constraints. It can be beneficial if the role is more about entry-level or mid-career development rather than requiring extensive senior-level expertise immediately.
- **Cons**: The downside might include slower ramp-up times for new hires and potentially a gap in critical knowledge that only experienced individuals possess.

### Conclusion:
The conflict between 'seniority=staff' and 'budget<120k' is rooted in market-driven salary expectations clashing with financial constraints. Addressing this requires careful consideration of both budget flexibility and role-specific requirements, each approach carrying its own set of trade-offs based on the organization's broader strategic goals and economic context.

</details>

### Analysis

| Criteria | 7B | 14B | 32B |
|----------|-----|------|------|
| **Domain understanding** | Poor - interpreted "staff" as generic seniority | Better - understood "staff-level" as specific role | Good - understood "senior-level positions" |
| **Market dynamics** | Generic HR perspective | Strong (supply/demand, competitive bidding, skill costs) | Good (supply/demand, economic pressures) |
| **Implicit assumptions** | Basic | Thorough (cost efficiency, skill acquisition, market flexibility) | Clear (salary expectations, budget constraints) |
| **Resolution strategies** | Reasonable but generic | Strong ("grow your own" training approach) | Clear and balanced |
| **Causal chain clarity** | Weak | Good | Good |

**Critical Finding:** The 7B model still showed confusion about "staff" terminology, using generic "senior staff members (such as experienced managers or directors)." The 14B and 32B models both better understood "staff-level" as a specific role category with associated salary expectations. The 14B model provided the most actionable alternative strategy ("grow your own").

**Verdict:** The 14B model performed best on this test with the clearest market dynamics explanation and most practical resolution strategies. The 32B model was solid but less detailed. The 7B model struggled with domain terminology.

---

## Summary

| Test | 7B | 14B | 32B | Winner |
|------|-----|------|------|--------|
| Multi-step reasoning | Correct, verbose (15.5s) | Correct, concise (9.2s) | Correct, nuanced (15.8s) | **14B** (speed) / **32B** (quality) |
| Trade-off analysis | Good, redundant (9.0s) | Comprehensive (15.8s) | Focused, actionable (23.4s) | **32B** (actionability) |
| Causal chain reasoning | Weak domain understanding (10.4s) | Strong analysis (14.7s) | Good analysis (22.7s) | **14B** (best balance) |

### Overall Performance

| Metric | 7B | 14B | 32B |
|--------|-----|------|------|
| **Average response time** | 11.6s | 13.2s | 20.6s |
| **Domain understanding** | Poor | Good | Good |
| **Output quality** | Acceptable | Strong | Strong |
| **Conciseness** | Verbose | Balanced | Most concise |
| **Actionability** | Generic | Good | Best |

---

## Recommendations for Production Use

### Model Selection

1. **For simple explanations (single constraint conflicts):** Use **7B** for fastest response times. The domain confusion is less impactful when context is clear.

2. **For complex explanations (multiple constraints, trade-offs):** Use **14B** as the best balance of quality, speed, and depth of analysis.

3. **For user-facing summaries where conciseness matters:** Consider **32B** if the ~20s latency is acceptable, as it produces the most focused, actionable output.

### Prompt Engineering Required

All models struggled with "staff engineer" terminology to varying degrees. Production prompts should include domain context:

```
Context: In software engineering hiring, seniority levels are (from junior to senior):
- junior (0-2 years, typically $60-90k)
- mid (2-5 years, typically $90-120k)
- senior (5-10 years, typically $120-160k)
- staff (10+ years, typically $160-200k+)

"Staff" refers to "staff engineer" - a senior individual contributor role.
```

### Latency Considerations

| Use Case | Recommended Model | Expected Latency |
|----------|-------------------|------------------|
| Real-time UI feedback | 7B | ~10-15s |
| Background explanation generation | 14B | ~13-16s |
| Detailed analysis reports | 32B | ~20-25s |

### Validation

Consider validating LLM outputs against known constraint patterns before displaying to users, since all models can produce plausible-sounding but subtly incorrect explanations when domain context is missing.
