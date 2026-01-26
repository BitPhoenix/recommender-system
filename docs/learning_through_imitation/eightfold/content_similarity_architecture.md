# Eightfold Content Similarity Architecture

## Overview

Eightfold does **not** use a single embedding comparison. Instead, they compute multiple similarity scores at different granularities and combine them as features for a scoring model.

## Two Levels of Embeddings

### 1. Dense Embeddings (Full Text)

Embed entire documents to capture overall semantic meaning:

```python
# Full resume text → dense vector
resume_embedding = encoder.encode(resume.full_text)

# Full job description → dense vector
job_embedding = encoder.encode(job.description)

# Overall semantic similarity
semantic_similarity = cosine(resume_embedding, job_embedding)
```

**What this captures:**
- Semantic meaning beyond keyword matching
- "Machine Learning Engineer" ≈ "Data Scientist" even without word overlap
- General domain alignment

**Limitations:**
- Loses granularity (can't tell which specific skills matched)
- A candidate with 3/10 required skills might score similarly to 8/10 if the text is semantically similar

### 2. Token-Level Embeddings (Extracted Features)

Embed specific extracted features separately, then compute per-feature similarities:

#### Skills

```python
# Each skill is embedded individually
skill_embeddings = {skill: encoder.encode(skill) for skill in skill_vocabulary}

# Aggregate candidate skills into single vector
candidate_skill_vector = mean([skill_embeddings[s] for s in candidate.skills])

# Aggregate job required skills
job_skill_vector = mean([skill_embeddings[s] for s in job.required_skills])

# Skill-specific similarity
skill_similarity = cosine(candidate_skill_vector, job_skill_vector)
```

Can also compute **recency-weighted** skill similarity:
```python
recent_skills = [s for s in candidate.skills if s.last_used_year >= current_year - 2]
recent_skill_vector = mean([skill_embeddings[s] for s in recent_skills])
recent_skill_similarity = cosine(recent_skill_vector, job_skill_vector)
```

#### Titles

```python
# Embed current title
current_title_similarity = cosine(
    encoder.encode(candidate.current_title),
    encoder.encode(job.title)
)
```

#### Companies

```python
# Company embeddings trained so similar companies cluster
# Google ≈ Microsoft, Goldman ≈ JPMorgan

# Recency-weighted aggregation of past companies
weights = [0.5 ** (n - i - 1) for i in range(n)]  # Recent companies weighted higher
candidate_company_vector = weighted_mean(
    [company_embeddings[c] for c in candidate.companies],
    weights
)

company_similarity = cosine(candidate_company_vector, job.company_embedding)
```

### 3. Trajectory Predictions (RNN-based)

Beyond static similarity, predict where the candidate is heading:

```python
# Title trajectory: given career history, what's their likely next role?
predicted_next_title = title_rnn.predict(candidate.title_history)
predicted_title_fit = cosine(predicted_next_title, job.title_embedding)

# Company trajectory (hireability): given company history, what type of company next?
predicted_next_company = company_rnn.predict(candidate.company_history)
hireability = cosine(predicted_next_company, job.company_embedding)
```

## Feature Combination

All similarity scores become **separate features** for a scoring model:

```python
features = {
    # Dense embeddings
    'semantic_similarity': 0.72,

    # Skill features
    'skill_similarity': 0.85,
    'recent_skill_similarity': 0.78,

    # Title features
    'current_title_similarity': 0.65,
    'predicted_title_fit': 0.71,

    # Company features
    'company_similarity': 0.45,
    'hireability': 0.52,

    # Structured features (non-embedding)
    'years_experience_match': 0.90,
    'location_match': 1.0,
    'education_match': 0.80,
}
```

## Scoring Models

### Cold Start: Hand-Tuned Weights

When you don't have labeled outcome data, use domain knowledge:

```python
weights = {
    'skill_similarity': 0.25,
    'recent_skill_similarity': 0.10,
    'semantic_similarity': 0.15,
    'current_title_similarity': 0.15,
    'predicted_title_fit': 0.10,
    'company_similarity': 0.05,
    'hireability': 0.05,
    'years_experience_match': 0.10,
    'location_match': 0.05,
}

score = sum(weights[k] * features[k] for k in weights)
```

**Advantages:**
- Works immediately with zero training data
- Transparent and explainable
- Easy to adjust based on recruiter feedback
- No risk of overfitting

**Setting initial weights:**
- Interview recruiters about what matters most
- Start with equal weights, adjust based on observed failures
- Domain-specific tuning (senior roles: weight trajectory higher; junior roles: weight skills higher)

### With Data: Learned Weights

Once you have labeled `(candidate, job, outcome)` triples:

```python
# Logistic regression learns optimal weights
from sklearn.linear_model import LogisticRegression

X = np.array([extract_features(c, j) for c, j in pairs])
y = np.array([outcome for _, _, outcome in pairs])

model = LogisticRegression()
model.fit(X, y)

# View learned weights
print(dict(zip(feature_names, model.coef_[0])))
```

"Outcome" signals (in order of quality):
1. Hired (ideal but rare)
2. Interviewed
3. Recruiter saved/shortlisted candidate
4. Recruiter messaged candidate
5. Recruiter clicked on candidate profile

### With More Data: Gradient Boosted Trees

Captures non-linear interactions between features:

```python
from lightgbm import LGBMClassifier

model = LGBMClassifier(
    n_estimators=500,
    learning_rate=0.05,
    num_leaves=31,
)
model.fit(X_train, y_train)
```

## Why This Architecture?

### Why not just embed everything together?

Concatenating all features into one text blob and embedding loses:
- **Granularity**: Can't tell which specific aspect matched
- **Explainability**: Can't say "strong skill match but weak title match"
- **Feature engineering**: Can't weight skills vs titles differently
- **Recency signals**: Can't emphasize recent experience

### Why both dense AND token-level embeddings?

They capture different signals:

| Approach | Strengths | Weaknesses |
|----------|-----------|------------|
| Dense (full text) | Semantic meaning, synonyms, context | Loses granularity |
| Token-level (skills) | Precise skill matching | Misses semantic similarity |
| Token-level (titles) | Career level alignment | Doesn't predict trajectory |
| RNN trajectory | Predicts fit based on career arc | Needs training data |

Using all of them as separate features lets the scoring model learn when each matters.

## Implementation Order

For a minimal viable system:
1. Dense embeddings (semantic_similarity)
2. Skill token embeddings (skill_similarity)
3. Title token embeddings (current_title_similarity)
4. Hand-tuned weighted scoring

Then iterate:
5. Recency-weighted skill similarity
6. Title trajectory RNN (predicted_title_fit)
7. Learned scoring weights (when you have outcome data)
8. Company embeddings and hireability (if relevant to your domain)
