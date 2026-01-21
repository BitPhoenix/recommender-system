## Complete Learning Path: Building an Eightfold-Style Matching System

Original article: https://eightfold.ai/engineering-blog/ai-powered-talent-matching-the-tech-behind-smarter-and-fairer-hiring/

My chat link: https://claude.ai/share/1f4d7a8e-dab4-4b81-84be-cc2b5376bb48

### Phase 1: Foundations - Understanding the Data

**Step 1.1: Download and explore CMap dataset**
```bash
# Download from Zenodo
https://zenodo.org/records/15260189
```

**Step 1.2: Explore the data structure**
- Examine titles, promotions, specialization index files
- Understand the difference between validated vs unvalidated promotions
- Identify the Information Technology sector files

**Step 1.3: Filter to software engineering titles**
- Define include/exclude keyword lists
- Filter transitions where both source and target are software engineering roles
- Save filtered dataset

---

### Phase 2: Classical Content-Based Matching (Baseline)

**Step 2.1: Implement tf-idf representations**
- Convert job descriptions and resumes to tf-idf vectors
- Understand the bag-of-words assumption and its limitations

**Step 2.2: Build basic cosine similarity matching**
```python
# Baseline: tf-idf similarity
similarity = cosine_similarity(resume_tfidf, job_tfidf)
```

**Step 2.3: Evaluate baseline**
- Create test cases with obvious matches/mismatches
- Identify where tf-idf fails (synonyms, semantic meaning)

---

### Phase 3: Dense Semantic Embeddings (Step 1 of Eightfold)

**Step 3.1: Implement pretrained LLM embeddings**
- Use sentence-transformers (all-mpnet-base-v2 or similar)
- Embed full resume text → dense vector
- Embed full job description → dense vector

**Step 3.2: Compare against tf-idf baseline**
- Test cases where semantic similarity catches what tf-idf misses
- "Machine Learning Engineer" ≈ "Data Scientist" even without word overlap

**Step 3.3: Understand dimensionality reduction**
- Experiment with PCA/UMAP on embeddings
- Visualize how similar profiles cluster

---

### Phase 4: Token-Level Skill Embeddings (Step 2a of Eightfold)

**Step 4.1: Build skill vocabulary from CMap**
- Extract all unique skills from IT sector
- Clean and normalize skill names

**Step 4.2: Create skill embeddings**
- Option A: Use pretrained encoder on skill names
- Option B: Train Word2Vec/FastText on skill co-occurrence from resumes

**Step 4.3: Implement skill similarity scoring**
```python
# Aggregate candidate skills → single vector
candidate_skill_vector = mean([embed(s) for s in candidate.skills])

# Compare to job requirements
skill_similarity = cosine(candidate_skill_vector, job_skill_vector)
```

**Step 4.4: Add recency weighting**
- Separate all-time skills from recent skills
- Compute both similarity scores as distinct features

---

### Phase 5: Token-Level Title Embeddings (Step 2b of Eightfold)

**Step 5.1: Build title vocabulary from CMap**
- Extract all generalized titles from IT sector
- Map raw titles to standardized titles

**Step 5.2: Create title embeddings**
- Embed each unique title into vector space
- Verify that "Senior Software Engineer" is close to "Staff Engineer"

**Step 5.3: Implement current title similarity**
```python
title_similarity = cosine(
    embed(candidate.current_title),
    embed(job.title)
)
```

---

### Phase 6: Career Trajectory RNN for Titles (Step 2c of Eightfold)

**Step 6.1: Build transition graph from CMap promotions**
- Load all filtered software engineering transitions
- Create directed weighted graph (title → title)

**Step 6.2: Generate synthetic career sequences**
- Random walks on transition graph
- Weight by transition frequency
- Generate 50-100K sequences

**Step 6.3: Prepare training data**
- Create vocabulary (title → index mapping)
- Convert sequences to input/target pairs
- Split into train/val/test

**Step 6.4: Implement LSTM model**
```python
class TitleTrajectoryRNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim):
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, vocab_size)
```

**Step 6.5: Train the model**
- Cross-entropy loss on next title prediction
- Track accuracy and top-5 accuracy
- Save best checkpoint

**Step 6.6: Implement predicted title fit scoring**
```python
predicted_next_title = title_rnn.predict(candidate.title_history)
predicted_title_fit = cosine(predicted_next_title, job.title_embedding)
```

---

### Phase 7: Token-Level Company Embeddings (Step 2d of Eightfold)

**Step 7.1: Build company metadata database**
- Collect company names, descriptions, industries, sizes
- Create rich text descriptions for each company

**Step 7.2: Create company embeddings**
- Embed company descriptions (not just names)
- Verify clustering: Google ≈ Microsoft, Goldman ≈ JPMorgan

**Step 7.3: Implement company similarity scoring**
```python
# Recency-weighted aggregation
weights = [0.5 ** (n - i - 1) for i in range(n)]
candidate_company_vector = weighted_mean(company_embeddings, weights)

company_similarity = cosine(candidate_company_vector, job.company_embedding)
```

---

### Phase 8: Career Trajectory RNN for Companies (Hireability)

**Step 8.1: Prepare company transition data**
- This is harder - CMap may not have direct company transitions
- Options: infer from title transitions, use external data, or simulate

**Step 8.2: Generate company sequences**
- Similar process to title sequences
- May need to supplement with synthetic data based on known patterns

**Step 8.3: Implement Company Trajectory RNN**
```python
class CompanyTrajectoryRNN(nn.Module):
    # Similar architecture to title RNN
    # Output: embedding in company space (not classification)
```

**Step 8.4: Train with embedding-based loss**
```python
# Loss = 1 - cosine_similarity(predicted_embedding, actual_next_company_embedding)
```

**Step 8.5: Implement hireability scoring**
```python
predicted_next_company = company_rnn.predict(candidate.company_history)
hireability = cosine(predicted_next_company, job.company_embedding)
```

---

### Phase 9: Feature Engineering and Combination

**Step 9.1: Enumerate all features**
```python
features = {
    # Dense embeddings (Phase 3)
    'semantic_similarity': ...,
    
    # Skill features (Phase 4)
    'skill_similarity': ...,
    'recent_skill_similarity': ...,
    
    # Title features (Phase 5-6)
    'current_title_similarity': ...,
    'predicted_title_fit': ...,
    
    # Company features (Phase 7-8)
    'company_similarity': ...,
    'hireability': ...,
    
    # Interaction features
    'skill_title_interaction': ...,
    'experience_skill_interaction': ...,
}
```

**Step 9.2: Add structured features**
- Years of experience
- Education level match
- Location match
- Salary alignment

**Step 9.3: Create feature extraction pipeline**
- Standardize all features to consistent scale
- Handle missing values
- Document each feature's meaning

---

### Phase 10: Scoring Model - Simple Baseline

**Step 10.1: Implement hand-tuned weighted sum**
```python
weights = {
    'skill_similarity': 0.25,
    'semantic_similarity': 0.15,
    'current_title_similarity': 0.15,
    # ...
}
score = sum(w * features[k] for k, w in weights.items())
```

**Step 10.2: Create evaluation dataset**
- Collect or simulate candidate-job pairs with outcomes
- Define what "success" means (hired, interviewed, messaged back)

**Step 10.3: Tune weights manually**
- Evaluate ranking quality
- Adjust weights based on failure analysis

---

### Phase 11: Scoring Model - Learned Weights

**Step 11.1: Collect labeled data**
- You need (candidate, job, outcome) triples
- Start with whatever signal you have (even synthetic)

**Step 11.2: Train logistic regression**
```python
from sklearn.linear_model import LogisticRegression

X = np.array([extract_features(c, j) for c, j in pairs])
y = np.array([outcome for _, _, outcome in pairs])

model = LogisticRegression()
model.fit(X, y)

# Learned weights
print(dict(zip(feature_names, model.coef_[0])))
```

**Step 11.3: Analyze feature importance**
- Which features matter most?
- Are any features redundant?

---

### Phase 12: Scoring Model - Gradient Boosted Trees

**Step 12.1: Train GBDT model**
```python
from lightgbm import LGBMClassifier

model = LGBMClassifier(
    n_estimators=500,
    learning_rate=0.05,
    num_leaves=31,
)
model.fit(X_train, y_train)
```

**Step 12.2: Evaluate and compare to linear model**
- Does GBDT capture non-linear interactions?
- Check for overfitting

**Step 12.3: Analyze feature importance**
```python
importance = dict(zip(feature_names, model.feature_importances_))
```

---

### Phase 13: Calibration and Star Ratings

**Step 13.1: Understand calibration**
- Predicted probability should match actual success rate
- If model says 70% match, ~70% of those should succeed

**Step 13.2: Implement calibration**
```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_model = CalibratedClassifierCV(model, method='isotonic')
calibrated_model.fit(X_val, y_val)
```

**Step 13.3: Convert probabilities to star ratings**
```python
def prob_to_stars(prob):
    stars = round(prob * 5 * 2) / 2  # 0.5 increments
    return max(0.5, min(5.0, stars))
```

**Step 13.4: Validate star distribution**
- Are ratings distributed reasonably?
- Do 5-star candidates actually succeed more?

---

### Phase 14: Explainability

**Step 14.1: Implement feature contribution explanations**
```python
def explain_match(candidate, job, score, features):
    explanations = []
    
    if features['skill_similarity'] > 0.8:
        explanations.append("Strong skill match")
    if features['predicted_title_fit'] > 0.7:
        explanations.append("Natural career progression to this role")
    if features['company_similarity'] > 0.7:
        explanations.append("Experience at similar companies")
    
    return explanations
```

**Step 14.2: Implement SHAP values (optional)**
```python
import shap

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
```

**Step 14.3: Build explanation UI component**
- Show top 3-5 reasons for the match
- Highlight strengths and potential gaps

---

### Phase 15: End-to-End Pipeline Integration

**Step 15.1: Create unified embedding extraction**
```python
class ProfileEmbedder:
    def extract(self, profile) -> ProfileEmbeddings:
        # Dense embeddings
        # Token embeddings (skills, titles, companies)
        # Trajectory predictions
        pass

class PositionEmbedder:
    def extract(self, position) -> PositionEmbeddings:
        # Dense embeddings
        # Token embeddings
        pass
```

**Step 15.2: Create feature computation module**
```python
class FeatureComputer:
    def compute(self, profile_emb, position_emb) -> Dict[str, float]:
        # All pairwise features
        pass
```

**Step 15.3: Create scoring module**
```python
class Scorer:
    def score(self, features) -> Tuple[float, float, List[str]]:
        # Returns (probability, stars, explanations)
        pass
```

**Step 15.4: Create ranking API**
```python
class MatchingPipeline:
    def rank_candidates(self, candidates, job) -> List[RankedCandidate]:
        pass
    
    def find_jobs(self, candidate, jobs) -> List[RankedJob]:
        pass
```

---

### Phase 16: Evaluation Framework

**Step 16.1: Define metrics**
- Precision@K: Of top K candidates shown, how many were relevant?
- Recall@K: Of all relevant candidates, how many appeared in top K?
- NDCG: Normalized Discounted Cumulative Gain
- MRR: Mean Reciprocal Rank

**Step 16.2: Create evaluation dataset**
- Hold-out set of known good matches
- Include negative examples

**Step 16.3: Run ablation studies**
- What's the impact of each component?
- Dense embeddings only vs full system
- With vs without trajectory RNNs

**Step 16.4: Document baseline performance**
- Track metrics as you add features
- Identify biggest wins

---

### Phase 17: Advanced - Learning to Rank (Optional)

**Step 17.1: Understand LTR objectives**
- Pointwise: predict relevance score independently
- Pairwise: predict which candidate is better
- Listwise: optimize ranking directly

**Step 17.2: Implement pairwise training**
```python
# For each job, sample pairs (good_candidate, bad_candidate)
# Train: score(good) > score(bad) + margin
```

**Step 17.3: Try LightGBM LambdaRank**
```python
model = LGBMRanker(
    objective='lambdarank',
    metric='ndcg',
)
```

**Step 17.4: Compare to pointwise approach**
- Does LTR improve ranking metrics?
- Is the added complexity worth it?

---

### Phase 18: Advanced - Transformer Architecture (Optional)

**Step 18.1: Replace LSTM with Transformer**
```python
class TitleTrajectoryTransformer(nn.Module):
    def __init__(self, vocab_size, embed_dim, num_heads, num_layers):
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.pos_encoding = PositionalEncoding(embed_dim)
        self.transformer = nn.TransformerEncoder(...)
```

**Step 18.2: Compare performance to LSTM**
- Accuracy on next title prediction
- Training time and inference speed

**Step 18.3: Consider fine-tuning pretrained models**
- Take a pretrained BERT and fine-tune on career sequences
- Requires more data and compute

---

### Phase 19: Production Considerations

**Step 19.1: Optimize inference speed**
- Pre-compute and cache embeddings
- Batch processing for ranking
- Consider approximate nearest neighbor for large-scale retrieval

**Step 19.2: Design embedding update strategy**
- When do you recompute candidate embeddings?
- How do you handle new skills/titles not in vocabulary?

**Step 19.3: Plan for model updates**
- A/B testing framework
- Gradual rollout of new models
- Monitoring for drift

**Step 19.4: Handle cold start**
- New candidates with minimal history
- New jobs with unusual requirements
- Fallback strategies

---

### Summary: The Critical Path

If you want the fastest path to a working system:

```
Phase 2  → Basic tf-idf baseline
Phase 3  → Dense embeddings (big improvement)
Phase 4  → Skill token embeddings
Phase 5  → Title token embeddings  
Phase 9  → Feature combination
Phase 10 → Hand-tuned scoring
```

Then iterate with:

```
Phase 6  → Title trajectory RNN (adds "predicted fit")
Phase 11 → Learned scoring weights
Phase 12 → GBDT scoring model
Phase 13 → Calibration
Phase 14 → Explainability
```

Advanced/optional:

```
Phase 7-8   → Company embeddings and hireability
Phase 17    → Learning to Rank
Phase 18    → Transformer architecture
```