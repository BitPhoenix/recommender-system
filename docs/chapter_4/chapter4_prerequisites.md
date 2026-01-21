# Prerequisites for Chapter 4: Content-Based Recommender Systems

This guide covers the foundational machine learning and statistics concepts you need before reading Chapter 4. Each concept builds on the previous ones.

---

## Table of Contents

1. [Features and Feature Vectors](#1-features-and-feature-vectors)
2. [Supervised vs Unsupervised Learning](#2-supervised-vs-unsupervised-learning)
3. [What is a Classifier?](#3-what-is-a-classifier)
4. [Training Data vs Test Data](#4-training-data-vs-test-data)
5. [Overfitting and Underfitting](#5-overfitting-and-underfitting)
6. [Classification vs Regression](#6-classification-vs-regression)
7. [Probability Fundamentals](#7-probability-fundamentals)
8. [Basic Statistics](#8-basic-statistics)
9. [Vector Space Representations](#9-vector-space-representations)
10. [Putting It All Together](#10-putting-it-all-together)

---

## 1. Features and Feature Vectors

### What is a Feature?

A **feature** is a measurable property of something you're trying to analyze. Think of features as the "attributes" or "characteristics" that describe an item.

**Example: Describing a Movie**

| Feature | Value |
|---------|-------|
| Genre | Action |
| Runtime | 120 minutes |
| Year | 2019 |
| Has explosions | Yes |
| Director | Christopher Nolan |

Each row is a feature. The collection of all features for one item is called a **feature vector**.

### Feature Vector

A feature vector is simply a list of feature values represented as numbers. To create one, we convert all features to numerical form:

```
Movie: "Inception"
- Genre: Action → 1 (if we encode Action=1, Comedy=2, Drama=3, etc.)
- Runtime: 120 → 120
- Year: 2019 → 2019
- Has explosions: Yes → 1 (binary: Yes=1, No=0)

Feature vector: [1, 120, 2019, 1]
```

### Features vs Labels: A Critical Distinction

This is one of the most important concepts to understand clearly:

- **Features** are **inputs** - the characteristics you use to describe an item
- **Labels** are **outputs** - the thing you're trying to predict

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAINING EXAMPLE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   FEATURES (inputs)              LABEL (output)             │
│   ─────────────────              ─────────────              │
│   Genre: Action                                             │
│   Runtime: 120 min        →      User Rating: 5 stars       │
│   Director: Nolan                                           │
│   Year: 2020                                                │
│                                                             │
│   "What describes the item"      "What we want to predict"  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Think of it this way:
```
Features = the question (what do we know?)
Label = the answer (what are we trying to figure out?)
```

In recommender systems:
- **Features:** Movie genre, runtime, director, actors, keywords from description
- **Label:** The user's rating (5 stars, "liked", etc.)

The system uses features to *find patterns*, and those patterns help *predict labels* for new items.

### Why This Matters for Chapter 4

Content-based systems represent items (movies, products, documents) as feature vectors. The system learns which feature patterns a user likes based on their past ratings.

---

## 2. Supervised vs Unsupervised Learning

Machine learning algorithms fall into two broad categories based on whether they learn from labeled examples.

### Supervised Learning

The algorithm learns from **labeled examples** - data where you already know the correct answer.

```
Training data with labels:
┌─────────────────────────────────────────────────┐
│ Email Text                        │ Label      │
├─────────────────────────────────────────────────┤
│ "You've won a free iPhone!"       │ SPAM       │
│ "Meeting at 3pm tomorrow"         │ NOT SPAM   │
│ "Click here for free money"       │ SPAM       │
│ "Project update attached"         │ NOT SPAM   │
└─────────────────────────────────────────────────┘

The algorithm learns patterns that distinguish SPAM from NOT SPAM.
Then it can predict labels for new, unseen emails.
```

**Key idea:** You supervise the learning by providing correct answers.

### Unsupervised Learning

The algorithm finds patterns in data **without labels** - no correct answers are provided.

```
Data without labels:
┌─────────────────────────────────────────────────┐
│ Customer Age │ Annual Spending │ Visit Frequency│
├─────────────────────────────────────────────────┤
│ 25           │ $500            │ 12             │
│ 67           │ $2000           │ 4              │
│ 23           │ $450            │ 15             │
│ 70           │ $1800           │ 3              │
└─────────────────────────────────────────────────┘

The algorithm might discover: "There seem to be two groups -
young frequent shoppers who spend less, and older infrequent
shoppers who spend more."
```

**Key idea:** The algorithm discovers structure on its own.

### Why This Matters for Chapter 4

Content-based recommender systems use **supervised learning**. The "labels" are user ratings:

```
┌─────────────────────────────────────────────────┐
│ Movie Features                    │ User Rating │
├─────────────────────────────────────────────────┤
│ [Action, 120min, Nolan]           │ 5 stars     │  ← Label
│ [Comedy, 90min, Apatow]           │ 2 stars     │  ← Label
│ [Action, 140min, Cameron]         │ 4 stars     │  ← Label
└─────────────────────────────────────────────────┘

The system learns: "This user likes Action + longer runtime"
```

---

## 3. What is a Classifier?

A **classifier** is an algorithm that learns to assign items to categories (classes) based on their features.

### The Basic Idea

```
INPUT                      CLASSIFIER                 OUTPUT
─────                      ──────────                 ──────
Feature vector      →      Learned rules       →      Category
[fur, 4 legs,              "If has fur AND            "Dog"
 barks, wet nose]           barks → Dog"
```

### How a Classifier Learns

1. **Training phase:** Show the classifier many labeled examples
2. **Learning:** The classifier discovers patterns that distinguish categories
3. **Prediction phase:** Use learned patterns to classify new items

### Concrete Example: Email Spam Classifier

**Step 1: Training Data**
```
Email 1: "FREE MONEY click now!!!"           → SPAM
Email 2: "Can we reschedule our meeting?"    → NOT SPAM
Email 3: "You've WON a PRIZE"                → SPAM
Email 4: "Attached is the report you asked"  → NOT SPAM
... (thousands more examples)
```

**Step 2: Classifier Learns Patterns**
```
Learned rules (simplified):
- Words like "FREE", "WON", "PRIZE" → likely SPAM
- ALL CAPS words → likely SPAM
- Words like "meeting", "attached", "report" → likely NOT SPAM
```

**Step 3: Classify New Email**
```
New email: "CONGRATULATIONS you've won FREE tickets"

Classifier thinking:
- Contains "FREE" → SPAM signal
- Contains "won" → SPAM signal
- Has ALL CAPS → SPAM signal

Prediction: SPAM (confidence: 94%)
```

### Types of Classifiers (You'll See in Chapter 4)

| Classifier | How It Works |
|------------|--------------|
| **Nearest Neighbor** | Find training examples most similar to the new item; predict the most common label among them |
| **Naive Bayes** | Use probability theory to calculate which class is most likely given the features |
| **Rule-based** | Learn explicit IF-THEN rules from the data |

### Deep Dive: Nearest Neighbor and "Most Common Label"

The phrase "predict the most common label" means **majority vote**. Here's how it works step by step:

**Step 1: New item arrives (we don't know its label)**
```
New movie: [Action, 120min, Explosions]
Label: ??? (this is what we want to predict)
```

**Step 2: Find similar items in training data (using features)**
```
Search training data for movies with similar features...

Found 5 most similar movies:
   Similar Movie      │  Features                    │  Label
   ───────────────────┼──────────────────────────────┼────────────
   Movie A            │  [Action, 115min, Explosions]│  LIKED
   Movie B            │  [Action, 130min, Explosions]│  LIKED
   Movie C            │  [Action, 110min, Chase]     │  DISLIKED
   Movie D            │  [Action, 125min, Explosions]│  LIKED
   Movie E            │  [Action, 118min, Fight]     │  LIKED
```

**Step 3: Count labels from neighbors (majority vote)**
```
Labels from the 5 neighbors:
   LIKED: 4 votes
   DISLIKED: 1 vote

Most common label = LIKED (4 out of 5)
```

**Step 4: Predict**
```
Prediction for new movie: LIKED
```

### Majority Vote vs Average

The approach differs based on whether you're doing classification or regression:

**Classification (categorical labels) → Majority Vote**
```
Neighbors' labels: LIKED, LIKED, DISLIKED, LIKED, LIKED
Count: LIKED=4, DISLIKED=1
Prediction: LIKED (most common)
```

**Regression (numerical labels) → Average**
```
Neighbors' ratings: 5, 4, 2, 5, 4 stars
Average: (5+4+2+5+4) / 5 = 4.0
Prediction: 4.0 stars
```

### The Key Insight

Notice how features and labels play different roles:
- **Features** are used to *find* similar items (comparing Action to Action, 120min to 115min)
- **Labels** are used to *make the prediction* (counting LIKED vs DISLIKED)

You search by features, you predict by labels.

### Why This Matters for Chapter 4

In content-based systems, the classifier learns a **user profile**:

```
Training: Movies this user rated
─────────────────────────────────
[Action, Sci-fi, Long] → Liked (5 stars)
[Comedy, Short]        → Disliked (1 star)
[Action, Long]         → Liked (4 stars)

Classifier learns: "This user likes Action + Long movies"

Prediction: Should we recommend [Action, Sci-fi, Long] movie?
Classifier: "Yes, high probability of liking"
```

---

## 4. Training Data vs Test Data

### The Problem

How do you know if your classifier actually works? You can't just check if it correctly classifies the examples it learned from - of course it can do that, it memorized them!

You need to test on **new data the classifier has never seen**.

### The Solution: Split Your Data

```
All Available Data (1000 examples)
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   ┌──────────────────────────────┐ ┌────────────────────┐  │
│   │     Training Data            │ │    Test Data       │  │
│   │     (800 examples)           │ │    (200 examples)  │  │
│   │                              │ │                    │  │
│   │  Classifier learns           │ │  Evaluate how well │  │
│   │  from these                  │ │  classifier works  │  │
│   │                              │ │  on unseen data    │  │
│   └──────────────────────────────┘ └────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Why Separate Test Data Matters

**Bad approach:** Train and test on the same data
```
Train on: Examples 1-1000
Test on:  Examples 1-1000
Result:   98% accuracy!  ← Misleading! Just memorization.
```

**Good approach:** Train and test on different data
```
Train on: Examples 1-800
Test on:  Examples 801-1000 (never seen during training)
Result:   78% accuracy  ← Honest estimate of real-world performance
```

### Vocabulary

| Term | Meaning |
|------|---------|
| **Training set** | Data used to train/teach the classifier |
| **Test set** | Data held back to evaluate performance |
| **Validation set** | Optional third split used to tune settings (hyperparameters) |
| **Holdout** | The act of holding back some data for testing |

### Why This Matters for Chapter 4

When building a user profile from ratings:
- **Training data:** Movies the user has already rated
- **Test data:** Movies you want to predict ratings for (recommendations)

The system learns patterns from rated movies, then predicts ratings for unrated movies.

---

## 5. Overfitting and Underfitting

These are the two most common ways a machine learning model can fail.

### Overfitting: Memorizing Instead of Learning

**Overfitting** happens when a model learns the training data *too well* - including noise and random quirks that don't generalize to new data.

**Analogy: A student who memorizes test answers**

```
Training (memorizing past exams):
Q: "What year did WWII end?" → A: "1945"
Q: "What's the capital of France?" → A: "Paris"

Test (new exam with same topics but different questions):
Q: "What year did WWII begin?" → A: "1945" ← WRONG! Memorized, didn't learn.
```

The student memorized specific question-answer pairs instead of learning the underlying concepts. When a slightly different question appeared, they failed.

**Concrete Example: Movie Recommendations**

```
Training data (movies user rated):
┌────────────────────────────────────────────────────────────┐
│ Movie              │ Features                   │ Rating   │
├────────────────────────────────────────────────────────────┤
│ The Dark Knight    │ Action, Nolan, 2008, Bale  │ 5 stars  │
│ Inception          │ Action, Nolan, 2010, ---   │ 5 stars  │
│ Interstellar       │ Sci-fi, Nolan, 2014, ---   │ 5 stars  │
└────────────────────────────────────────────────────────────┘
```

**Good learning (generalizes):**
"User likes movies directed by Christopher Nolan"

**Overfitted learning (memorizes quirks):**
"User likes movies where the title starts with 'I' or 'The D',
released in even-numbered years, with exactly 1 word or 2 words
in the title..."

The overfitted model finds patterns that are just coincidences in this small dataset. When a new Nolan movie comes out called "Oppenheimer" (2023, odd year, different title pattern), the overfitted model might wrongly predict the user won't like it.

**Signs of overfitting:**
- Very high accuracy on training data (95%+)
- Much lower accuracy on test data (60%)
- The gap between training and test accuracy is large
- Model is too complex for the amount of data available

### Underfitting: Not Learning Enough

**Underfitting** happens when a model is too simple to capture the real patterns in the data.

**Analogy: A student who barely studied**

```
The real pattern: "WWII events happened between 1939-1945"

Underfitted learning: "History involves years"

Test question: "When did D-Day occur?"
Answer: "Sometime in a year" ← Too vague! Didn't learn enough detail.
```

**Concrete Example: Movie Recommendations**

```
Training data:
┌────────────────────────────────────────────────────────────┐
│ Movie              │ Features                   │ Rating   │
├────────────────────────────────────────────────────────────┤
│ The Dark Knight    │ Action, Nolan, Batman      │ 5 stars  │
│ Inception          │ Action, Nolan, Dreams      │ 5 stars  │
│ The Notebook       │ Romance, Cassavetes        │ 1 star   │
│ Titanic            │ Romance, Cameron           │ 2 stars  │
└────────────────────────────────────────────────────────────┘
```

**Good learning:**
"User likes Action movies, especially by Nolan. User dislikes Romance."

**Underfitted learning:**
"User rates movies somewhere between 1-5 stars"

The underfitted model learned almost nothing useful. It's too simple to capture the obvious pattern (Action=good, Romance=bad).

**Signs of underfitting:**
- Low accuracy on training data (55%)
- Low accuracy on test data (50%)
- Both accuracies are similarly bad
- Model is too simple to capture the patterns

### Comparing the Two Problems

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OVERFITTING vs UNDERFITTING                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   UNDERFITTING                              OVERFITTING                 │
│   ────────────                              ──────────                  │
│                                                                         │
│   Model is too SIMPLE                       Model is too COMPLEX        │
│                                                                         │
│   Learns: "Movies get ratings"              Learns: "Movies starting    │
│                                             with 'The' released on      │
│                                             Tuesdays in summer get      │
│                                             high ratings if the         │
│                                             director's name has 5       │
│                                             letters..."                 │
│                                                                         │
│   Misses obvious patterns                   Finds patterns that         │
│                                             don't really exist          │
│                                                                         │
│   Training accuracy: LOW (55%)              Training accuracy: HIGH     │
│   Test accuracy: LOW (50%)                  (98%)                       │
│   Gap: small                                Test accuracy: LOW (60%)    │
│                                             Gap: LARGE                  │
│                                                                         │
│   Problem: Not learning enough              Problem: Learning too much  │
│                                             (including noise)           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Goldilocks Zone: Just Right

The goal is to find a model that's complex enough to capture real patterns, but simple enough to ignore noise and coincidences.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   UNDERFITTING          JUST RIGHT              OVERFITTING             │
│                                                                         │
│   "Movies get           "User likes             "User likes movies      │
│   ratings"              Action, dislikes        with 'The' in title,    │
│                         Romance"                released in even        │
│                                                 years, by directors     │
│                                                 with 5-letter names..." │
│                                                                         │
│   Train: 55%            Train: 82%              Train: 98%              │
│   Test:  50%            Test:  80%              Test:  60%              │
│                                                                         │
│   ❌ Too simple         ✓ Generalizes well      ❌ Too complex          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Notice the "Just Right" model:
- Training and test accuracy are **close to each other** (small gap)
- Both are **reasonably high** (not perfect, but good)
- The model learned the **real pattern** without memorizing coincidences

### Why This Matters for Chapter 4

Content-based systems can overfit when:
- User has rated very few items (small training set)
- Model uses too many features
- System learns quirks of rated items, not general preferences

**Example:**
```
User rated 3 movies, all happen to star Tom Hanks:
- Forrest Gump (Drama) → 5 stars
- Cast Away (Drama) → 4 stars
- Saving Private Ryan (War) → 5 stars

Overfitted conclusion: "User loves Tom Hanks movies"
Better conclusion: "User likes Drama and serious films"

The Tom Hanks pattern is noise (coincidence), not signal.
```

Chapter 4 discusses **feature selection** as a way to prevent overfitting by removing noisy, uninformative features.

---

## 6. Classification vs Regression

Both are supervised learning tasks, but they predict different types of outputs.

### Classification: Predicting Categories

The output is a **discrete category** (class label).

```
Input: Email features
Output: SPAM or NOT SPAM (2 categories)

Input: Image features
Output: Cat, Dog, or Bird (3 categories)

Input: Movie features
Output: User will LIKE or DISLIKE (2 categories)
```

### Regression: Predicting Numbers

The output is a **continuous numerical value**.

```
Input: House features (size, location, age)
Output: Price ($350,000) - any number in a range

Input: Movie features
Output: Predicted rating (3.7 stars) - any value from 1 to 5

Input: Weather features
Output: Tomorrow's temperature (72.5°F)
```

### The Key Difference

```
Classification                    Regression
──────────────                    ──────────
Predict a category                Predict a number

"Is this spam?"                   "What rating will user give?"
Answer: Yes/No                    Answer: 3.7 out of 5

"What genre?"                     "What's the price?"
Answer: Action/Comedy/Drama       Answer: $14.99
```

### Why This Matters for Chapter 4

Content-based systems can be framed either way:

**As classification:**
```
Given movie features → Predict: LIKE or DISLIKE
(Binary classification)
```

**As regression:**
```
Given movie features → Predict: Rating from 1.0 to 5.0
(Numerical prediction)
```

Chapter 4 discusses both approaches. The Bayes classifier is for classification; regression models predict numerical ratings.

---

## 7. Probability Fundamentals

Chapter 4's Bayes classifier requires understanding basic probability. Here's what you need.

### Basic Probability

**Probability** measures how likely an event is, ranging from 0 (impossible) to 1 (certain).

```
P(event) = Number of ways event can happen / Total number of possible outcomes

P(heads on coin flip) = 1/2 = 0.5 = 50%
P(rolling 6 on die) = 1/6 ≈ 0.167 ≈ 16.7%
```

### Conditional Probability

**Conditional probability** is the probability of event A *given that* event B has occurred.

Written as: **P(A|B)** - read as "probability of A given B"

```
Example: Drawing cards

P(Red card) = 26/52 = 0.5

P(Red card | card is a Heart) = ?
Given it's a Heart, it's definitely red.
P(Red | Heart) = 1.0

P(Heart | Red card) = ?
Given it's red, it could be Heart or Diamond.
P(Heart | Red) = 13/26 = 0.5
```

### Bayes' Theorem

Bayes' theorem lets you flip conditional probabilities:

```
P(A|B) = P(B|A) × P(A) / P(B)
```

**Why is this useful?**

Sometimes you know P(B|A) but need P(A|B):

```
Problem: What's the probability a user LIKES a movie given its features?
         P(LIKE | features) = ???

What we can easily count from training data:
- P(features | LIKE) = Among liked movies, how often do these features appear?
- P(LIKE) = What fraction of movies does the user like overall?
- P(features) = How common are these features?

Bayes lets us compute P(LIKE | features) from these!
```

### Worked Example: Will the User Like This Action Movie?

Let's walk through a complete numerical example.

**The Training Data: 100 movies this user has rated**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S RATING HISTORY                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Total movies rated: 100                                   │
│                                                             │
│   Movies user LIKED: 40 out of 100                          │
│   Movies user DISLIKED: 60 out of 100                       │
│                                                             │
│   Action movies in total: 30 out of 100                     │
│   Action movies user LIKED: 24 out of 40 liked movies       │
│   Action movies user DISLIKED: 6 out of 60 disliked movies  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The Question:**
A new Action movie comes out. What's the probability the user will LIKE it?

We want: **P(LIKE | Action) = ?**

This reads as: "What's the probability of LIKE, given that we know it's Action?"

**The Challenge: Why Can't We Just Count Directly?**

You might think: "Just count! 24 out of 30 Action movies were liked. That's 80%. Done!"

And you'd be right for this simple case. But here's why Bayes matters:

```
Simple case (one feature):
    "What if it's Action?" → Count Action movies, see how many were liked.
    Easy to count directly.

Complex case (multiple features):
    "What if it's Action AND Sci-fi AND directed by Nolan AND over 2 hours?"
    There might be 0 or 1 movies matching ALL these features in your data.
    Can't count directly - not enough examples!
```

Bayes lets us combine evidence from individual features even when we don't have examples of the exact combination. But first, let's see how it works on the simple case.

**Counting Probabilities from Training Data:**

```
P(LIKE) = 40/100 = 0.40
    "Out of all 100 movies, user liked 40 of them"
    This is the BASE RATE of liking any movie.

P(Action | LIKE) = 24/40 = 0.60
    "Out of the 40 movies the user liked, 24 were Action"
    This answers: "If user liked a movie, how likely was it Action?"

P(Action) = 30/100 = 0.30
    "Out of all 100 movies, 30 were Action"
    This is how common Action movies are IN THE TRAINING DATA.
```

**Important Clarification:**

P(Action) = 0.30 does NOT mean "30% chance the new movie is Action" — we already KNOW it's Action!

P(Action) = 0.30 means "in our historical training data, 30% of movies were Action." Bayes needs this historical proportion to properly weight the evidence.

**Apply Bayes' Theorem:**

```
P(LIKE | Action) = P(Action | LIKE) × P(LIKE) / P(Action)

P(LIKE | Action) = 0.60 × 0.40 / 0.30

P(LIKE | Action) = 0.24 / 0.30

P(LIKE | Action) = 0.80 = 80%
```

**The Answer:** There's an 80% chance the user will like this Action movie.

**Sanity Check:**

Let's verify by counting directly (since we CAN count for this simple one-feature case):
- There were 30 Action movies total in training data
- User liked 24 of them
- 24/30 = 0.80 = 80% ✓

Bayes gave us the same answer!

**The Full Picture:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   What we WANT to know:        What we CAN easily count:    │
│   ─────────────────────        ─────────────────────────    │
│                                                             │
│   What we WANT:                What we CAN COUNT:           │
│   ─────────────                ──────────────────           │
│                                                             │
│   P(LIKE | Action) = ?         P(Action | LIKE) = 0.60      │
│                                  "Of liked movies, what %   │
│   "Given it's Action,            were Action?"              │
│   will they like it?"                                       │
│                                P(LIKE) = 0.40               │
│                                  "Base rate: user likes     │
│                                   40% of all movies"        │
│                                                             │
│                                P(Action) = 0.30             │
│                                  "In training data, 30%     │
│                                   of movies were Action"    │
│                                                             │
│              ┌─────────────────────────────┐                │
│              │      BAYES' THEOREM         │                │
│              │                             │                │
│              │  Flips the conditional!     │                │
│              │                             │                │
│              │  P(LIKE|Action) =           │                │
│              │  P(Action|LIKE) × P(LIKE)   │                │
│              │  ─────────────────────────  │                │
│              │        P(Action)            │                │
│              └─────────────────────────────┘                │
│                           │                                 │
│                           ▼                                 │
│                                                             │
│                  P(LIKE | Action) = 0.80                    │
│                  "80% chance they'll like it"               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why Bayes Matters (The Multi-Feature Case):**

In this simple one-feature example, direct counting works fine. But real movies have MANY features. When you ask:

*"Will user like an Action + Sci-fi + Nolan + 2hr+ movie?"*

You might have zero exact matches to count. Bayes (specifically Naive Bayes, covered next) lets you combine:
- P(Action | LIKE), P(Sci-fi | LIKE), P(Nolan | LIKE), P(2hr+ | LIKE)

...to estimate the answer even without exact matches. That's the real power.

### Independence

Two events are **independent** if one doesn't affect the probability of the other.

```
Independent:
- Coin flip 1 and coin flip 2 (first flip doesn't affect second)
- P(heads on flip 2 | heads on flip 1) = P(heads on flip 2) = 0.5

Not independent:
- Drawing cards without replacement
- P(second card is Ace | first card was Ace) ≠ P(second card is Ace)
  (Fewer aces left in deck!)
```

### The "Naive" in Naive Bayes

The Naive Bayes classifier assumes all features are **independent** given the class. This is usually false but simplifies calculations enormously.

**How Naive Bayes Handles Multiple Features:**

Remember the multi-feature question from earlier?

*"Will user like an Action + Sci-fi + Nolan + 2hr+ movie?"*

Naive Bayes multiplies the individual feature probabilities:

```
P(LIKE | Action, Sci-fi, Nolan, 2hr+)

    ∝ P(Action | LIKE) × P(Sci-fi | LIKE) × P(Nolan | LIKE) × P(2hr+ | LIKE) × P(LIKE)

    = 0.60 × 0.40 × 0.30 × 0.50 × 0.40

    = 0.0144
```

(We'd also calculate P(DISLIKE | Action, Sci-fi, Nolan, 2hr+) and compare.)

**Why is this "Naive"?**

The multiplication assumes each feature contributes independently. But what if features INTERACT?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     THE PROBLEM WITH "NAIVE"                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  REALITY: User's preferences have INTERACTIONS                          │
│                                                                         │
│  Example 1: User only likes Action movies when Nolan directs            │
│  ─────────────────────────────────────────────────────────────          │
│     Action + Nolan     → LOVE (5 stars)                                 │
│     Action + Other     → DISLIKE (2 stars)                              │
│     Drama + Nolan      → LIKE (4 stars)                                 │
│     Drama + Other      → LIKE (4 stars)                                 │
│                                                                         │
│  The combination matters! Action ONLY works with Nolan.                 │
│                                                                         │
│  Example 2: User only likes long movies if Nolan directs                │
│  ─────────────────────────────────────────────────────────────          │
│     2hr+ + Nolan       → LOVE (Nolan earns the runtime)                 │
│     2hr+ + Other       → DISLIKE (too long, boring)                     │
│     90min + Anyone     → Fine                                           │
│                                                                         │
│  Again, features interact - length tolerance depends on director.       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**What Naive Bayes Gets Wrong:**

```
Naive Bayes calculates:
    P(Action | LIKE) = 0.60    (user likes Action... sometimes)
    P(Nolan | LIKE) = 0.30     (user likes Nolan... sometimes)

    Multiplies them: 0.60 × 0.30 = 0.18

But the REAL pattern is:
    P(Action + Nolan | LIKE) = 0.90   (user LOVES this combo!)
    P(Action + Other | LIKE) = 0.10   (user dislikes this combo)

Naive Bayes can't see that Action+Nolan is special.
It treats "Action" and "Nolan" as separate, unrelated signals.
```

**So Why Use It?**

Despite being "wrong," Naive Bayes often works surprisingly well because:

1. **It still ranks correctly** - Even if the probabilities are off, Action+Nolan movies will still rank higher than Romance+Unknown Director movies

2. **It handles sparse data** - With 100 rated movies, you might have:
   - 30 Action movies (enough to estimate P(Action | LIKE))
   - 10 Nolan movies (enough to estimate P(Nolan | LIKE))
   - But only 2 Action+Nolan movies (not enough to estimate the combo directly!)

   Naive Bayes lets you use ALL your data, not just exact matches.

3. **It's fast and simple** - No complex interaction terms to learn

4. **It's a starting point** - More sophisticated models (like neural networks) can learn feature interactions, but need much more data

**The Trade-off:**

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   NAIVE BAYES                    COMPLEX MODELS            │
│   ───────────                    ──────────────            │
│   Assumes independence           Can learn interactions    │
│   Works with small data          Needs lots of data        │
│   Fast to train                  Slow to train             │
│   Often "good enough"            Can be very accurate      │
│   Probabilities are wrong        Probabilities are better  │
│   but rankings often correct     but needs more data       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 8. Basic Statistics

These statistical concepts appear throughout Chapter 4.

### Mean (Average)

The sum of values divided by the count.

```
Values: 2, 4, 6, 8, 10
Mean = (2 + 4 + 6 + 8 + 10) / 5 = 30 / 5 = 6
```

### Variance and Standard Deviation

**Variance** measures how spread out values are from the mean.

```
Values: 2, 4, 6, 8, 10    Mean = 6

Differences from mean: -4, -2, 0, +2, +4
Squared differences: 16, 4, 0, 4, 16
Variance = (16 + 4 + 0 + 4 + 16) / 5 = 8
```

**Standard deviation** is the square root of variance (same units as data).

```
Standard deviation = √8 ≈ 2.83
```

**Intuition:**
- Low variance/std dev → values clustered near mean
- High variance/std dev → values spread out

```
Low variance:           High variance:
  ││││                     │        │
  ││││                     │   ││   │
──┼┼┼┼──                 ──┼───┼┼───┼──
  mean                      mean
```

### Why This Matters for Chapter 4

- **Normalized deviation** (Section 4.3.4.4) uses standard deviation to measure feature importance
- **TF-IDF weighting** uses document frequency statistics
- Understanding how "spread out" ratings are helps identify discriminative features

---

## 9. Vector Space Representations

Chapter 4 represents documents (movie descriptions, product info) as vectors in a high-dimensional space.

### Documents as Vectors

Each unique word becomes a dimension. A document is a point in this space.

```
Vocabulary: [action, comedy, drama, love, explosion]
            (5 words = 5 dimensions)

Document 1: "action explosion action"
Vector 1:   [2, 0, 0, 0, 1]
            (action appears 2x, explosion 1x, others 0x)

Document 2: "love drama love love"
Vector 2:   [0, 0, 1, 3, 0]
            (drama 1x, love 3x)
```

### Cosine Similarity

How do you measure if two documents are similar? **Cosine similarity** measures the angle between vectors.

**First: What Dimension Space Are We In?**

If your vocabulary has 3 words, you're in 3D space (x, y, z):

```
Vocabulary: [action, comedy, drama]
                ↓       ↓      ↓
             x-axis  y-axis  z-axis

Doc A = [2, 0, 1] means:
  - x = 2 (action count)
  - y = 0 (comedy count)
  - z = 1 (drama count)
```

With 1000 words, you'd be in 1000-dimensional space (impossible to visualize, but the math works the same way).

**Second: Vectors as Arrows**

A vector is an arrow pointing from the origin (0,0,0) to a point in space.

Let's use 2D to visualize (imagine vocabulary = [action, comedy]):

```
        comedy (y-axis)
            │
          3 ┼
            │       ↗ Doc C = [1, 3]  "action comedy comedy comedy"
          2 ┼      ╱                   (mostly comedy)
            │     ╱
          1 ┼    ╱    ↗ Doc B = [2, 1]  "action action comedy"
            │   ╱    ╱                   (more action than comedy)
            │  ╱    ╱
          0 ┼─╱────╱─────────────────
            │╱    ╱    ↗ Doc A = [3, 0]  "action action action"
            ╱    ╱    ╱                   (pure action)
            └────┴────┴────┴────┴────
            0    1    2    3    4      action (x-axis)
```

Each document is an arrow from origin (0,0) to its point.

**Third: The Angle Between Arrows**

Cosine similarity measures the ANGLE between two arrows. Here are two vectors (arrows) starting from the same point:

```
            y
            │
            │         * B = [1, 3]
            │        /
            │       /
            │      /   ← Vector B (arrow from origin to point B)
            │     /
            │    /
            │   /  θ ← This is the angle between the two arrows
            │  / )
            │ /__)_____________________* A = [4, 1]
            │
            └───────────────────────── x
          origin
         (0, 0)

    Vector A = arrow from (0,0) to (4,1)
    Vector B = arrow from (0,0) to (1,3)
    θ (theta) = the angle between these two arrows
```

**Key insight: SMALLER angle = MORE similar direction = HIGHER cosine value**

**But what IS cosine? Why does smaller angle = larger cosine?**

Cosine comes from the unit circle (a circle with radius 1). For any angle θ:
- Draw a line from the center at that angle
- Where it hits the circle, the **x-coordinate is cos(θ)**

```
                          (0, 1)
                            │
                            │
              ╭─────────────┼─────────────╮
             ╱              │              ╲
            ╱               │               ╲
           ╱                │                ╲
          │                 │                 │
          │                 │                 │
 (-1, 0)  │─────────────────┼─────────────────│ (1, 0)
          │                 │                 │
          │                 │                 │
           ╲                │                ╱
            ╲               │               ╱
             ╲              │              ╱
              ╰─────────────┼─────────────╯
                            │
                          (0, -1)
```

Now trace what happens as the angle increases:

```
Angle = 0° (pointing right)
────────────────────────────
            │
      ──────┼────●  ← Point lands at (1, 0)
            │

    cos(0°) = 1.0  (the x-coordinate)


Angle = 45° (pointing diagonally)
────────────────────────────
            │  ●  ← Point lands at (0.71, 0.71)
            │ ╱
      ──────┼╱
            │

    cos(45°) ≈ 0.71  (the x-coordinate)


Angle = 90° (pointing up)
────────────────────────────
            ●  ← Point lands at (0, 1)
            │
      ──────┼──────
            │

    cos(90°) = 0  (the x-coordinate)
```

**The pattern:**

```
As angle goes:     0° → 45° → 90°
The x-coordinate:  1  → 0.7 → 0
Which is cosine:   1  → 0.7 → 0

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Angle:     0°     30°      45°      60°      90°           │
│             │       │        │        │        │             │
│  Cosine:   1.0    0.87     0.71     0.50     0.0            │
│             │       │        │        │        │             │
│             ▼       ▼        ▼        ▼        ▼             │
│         [identical] ───────────────────── [unrelated]       │
│          direction                         perpendicular    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**So why smaller angle = higher cosine?**

When two arrows point in almost the same direction:
- The angle between them is small (close to 0°)
- cos(small angle) is close to 1
- High similarity!

When two arrows point in very different directions:
- The angle between them is large (close to 90°)
- cos(large angle) is close to 0
- Low similarity!

```
┌─────────────────────────────────────────────────────────────────────┐
│  Angle between vectors  │  Cosine value  │  Meaning               │
├─────────────────────────────────────────────────────────────────────┤
│  0° (same direction)    │  cos(0°) = 1.0 │  Identical topics      │
│  45°                    │  cos(45°)≈ 0.7 │  Somewhat similar      │
│  90° (perpendicular)    │  cos(90°) = 0  │  Completely unrelated  │
│  180° (opposite)        │  cos(180°)= -1 │  Opposite topics       │
└─────────────────────────────────────────────────────────────────────┘
```

**Why does this make sense?**

```
Same direction (angle = 0°, cosine = 1.0):
─────────────────────────────────────────
    Doc A: "action action action"     → [3, 0, 0]
    Doc B: "action action"            → [2, 0, 0]

    Both arrows point along the action axis.
    Same topic, just different lengths.
    Angle between them = 0°

Perpendicular (angle = 90°, cosine = 0):
─────────────────────────────────────────
    Doc A: "action action action"     → [3, 0, 0]  (points along action axis)
    Doc C: "comedy comedy comedy"     → [0, 3, 0]  (points along comedy axis)

    Arrows point in completely different directions.
    No overlap in topic.
    Angle between them = 90°
```

**The Formula:**

```
Cosine similarity = (A · B) / (|A| × |B|)
```

This formula calculates the cosine of the angle between vectors A and B. Let's break down each part:

**Part 1: Dot Product (A · B)**

Multiply corresponding elements, then sum them:

```
A = [2, 0, 1]
B = [1, 0, 2]

A · B = (2×1) + (0×0) + (1×2)
      =   2   +   0   +   2
      = 4
```

**Part 2: Vector Length |A|**

The length of a vector is the square root of the sum of squared elements:

```
|A| = √(a₁² + a₂² + a₃² + ...)

For A = [2, 0, 1]:
|A| = √(2² + 0² + 1²)
    = √(4 + 0 + 1)
    = √5
    ≈ 2.24

For B = [1, 0, 2]:
|B| = √(1² + 0² + 2²)
    = √(1 + 0 + 4)
    = √5
    ≈ 2.24

For C = [0, 3, 0]:
|C| = √(0² + 3² + 0²)
    = √(0 + 9 + 0)
    = √9
    = 3
```

**Part 3: Put It Together**

```
Cosine(A, B) = (A · B) / (|A| × |B|)
             = 4 / (√5 × √5)
             = 4 / 5
             = 0.8
```

**Result ranges from:**
- 1.0 = identical direction (very similar)
- 0.0 = perpendicular (unrelated)
- -1.0 = opposite direction (very different)

**Full Example with Three Documents:**

```
Vocabulary: [action, comedy, drama]

Doc A: [2, 0, 1]  →  "action action drama"     (action movie with some drama)
Doc B: [1, 0, 2]  →  "action drama drama"      (drama movie with some action)
Doc C: [0, 3, 0]  →  "comedy comedy comedy"    (pure comedy)

Vector lengths:
|A| = √(2² + 0² + 1²) = √5
|B| = √(1² + 0² + 2²) = √5
|C| = √(0² + 3² + 0²) = √9 = 3
```

**Comparing A and B:**
```
Dot product:  A · B = (2×1) + (0×0) + (1×2) = 2 + 0 + 2 = 4
Lengths:      |A| × |B| = √5 × √5 = 5

Cosine(A, B) = 4 / 5 = 0.8  ← Similar! (both have action and drama)
```

**Comparing A and C:**
```
Dot product:  A · C = (2×0) + (0×3) + (1×0) = 0 + 0 + 0 = 0
Lengths:      |A| × |C| = √5 × 3 ≈ 6.7

Cosine(A, C) = 0 / 6.7 = 0  ← Unrelated! (no overlap in genres)
```

Notice: When the dot product is 0, the vectors share NO common words, so cosine = 0.

### Why Cosine Over Euclidean Distance?

**What Euclidean Distance Measures:**

Euclidean distance is the straight-line distance between two points in space - like measuring with a ruler.

```
        comedy
            │
            │
          2 ┼
            │
          1 ┼   ● Doc A [2, 1]
            │         ↖
            │           ↖  Euclidean distance = length of this line
            │             ↖
          0 ┼───────────────●──────
            0   1   2   3   4      action
                            Doc B [4, 0]
```

**The Problem with Euclidean Distance for Documents:**

Longer documents have more words, so their vectors are farther from the origin. This makes them seem "far" from shorter documents even when they're about the SAME topic.

```
Doc A: "action action"                    → [2, 0]  (short doc)
Doc B: "action action action action"      → [4, 0]  (long doc, same topic!)
Doc C: "action comedy"                    → [1, 1]  (different topic)

Euclidean distances from Doc A:
    To Doc B: √((4-2)² + (0-0)²) = √4 = 2.0
    To Doc C: √((1-2)² + (1-0)²) = √2 ≈ 1.4

Euclidean says: "Doc C is CLOSER to Doc A than Doc B is!"

But that's wrong! Doc A and Doc B are both purely about action.
Doc C is about a different topic (action + comedy).
```

**Why Cosine Fixes This:**

Cosine measures the ANGLE between vectors, not the distance between points. It asks: "Are these arrows pointing in the same direction?" not "Are these points close together?"

```
        comedy
            │
            │               Doc B [4, 0]
            │                   ●
            │                 ╱
            │               ╱   ← Same direction! Angle = 0°
            │             ╱
            │           ╱
            │         ● Doc A [2, 0]
            │       ╱
          0 ┼─────╱─────────────────
            0                        action
          origin

    Both arrows point along the action axis.
    The angle between them is 0°.
    cos(0°) = 1.0 = identical!
```

**Comparing All Three Documents with Cosine:**

```
Doc A: [2, 0]   (pure action)
Doc B: [4, 0]   (pure action, longer)
Doc C: [1, 1]   (action + comedy)

Cosine(A, B) = (2×4 + 0×0) / (2 × 4) = 8/8 = 1.0   ← Same topic!
Cosine(A, C) = (2×1 + 0×1) / (2 × √2) = 2/2.83 ≈ 0.71  ← Different topic

Cosine correctly identifies that A and B are about the same thing,
even though B is twice as long.
```

**Summary:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   EUCLIDEAN DISTANCE              COSINE SIMILARITY                 │
│   ──────────────────              ─────────────────                 │
│                                                                     │
│   Measures: how far apart         Measures: what direction          │
│   the points are                  the arrows point                  │
│                                                                     │
│   Problem: longer documents       Advantage: ignores length,        │
│   are farther from origin,        only cares about the              │
│   seem "different" from           pattern/proportion of words       │
│   shorter documents                                                 │
│                                                                     │
│   "action action" vs              "action action" vs                │
│   "action action action action"   "action action action action"     │
│   = distance of 2 (different!)    = cosine of 1.0 (identical!)      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

For comparing documents, we care about WHAT they're about (direction), not HOW LONG they are (distance from origin). That's why cosine is better.

### TF-IDF Weighting

**The Problem with Raw Word Counts:**

If we just count words, common words like "the", "a", "is" dominate the vector, even though they tell us nothing about what the document is about.

```
Movie description: "The action hero saves the day with the big explosion"

Raw word counts:
    "the"       → 3  (most frequent!)
    "action"    → 1
    "hero"      → 1
    "explosion" → 1

Problem: "the" appears 3 times but tells us NOTHING about the movie.
         "explosion" appears once but is actually meaningful!
```

**The Solution: TF-IDF**

TF-IDF downweights words that appear in many documents (they're not distinctive) and upweights words that appear in few documents (they're meaningful).

**Step 1: Term Frequency (TF)**

How often does this word appear in THIS document?

```
Document: "action action explosion"

TF("action") = 2    (appears twice)
TF("explosion") = 1 (appears once)
TF("the") = 0       (doesn't appear)
```

**Step 2: Inverse Document Frequency (IDF)**

How rare is this word across ALL documents?

```
IDF = log(Total documents / Documents containing this word)
```

**Wait, what is "log"?**

Logarithm (log) is the inverse of exponentiation. It asks: "What power do I raise 10 to in order to get this number?"

```
10¹ = 10      →    log(10) = 1
10² = 100     →    log(100) = 2
10³ = 1000    →    log(1000) = 3

In general: if 10ˣ = y, then log(y) = x
```

Some key values to know:
```
log(1) = 0        (because 10⁰ = 1)
log(10) = 1       (because 10¹ = 10)
log(100) = 2      (because 10² = 100)
log(5) ≈ 0.7
log(20) ≈ 1.3
```

**Why use log in IDF?**

Without log, the numbers get extreme and unmanageable:

```
Without log (raw ratio):
─────────────────────────
Word in 1 out of 1000 docs    → 1000/1 = 1000
Word in 10 out of 1000 docs   → 1000/10 = 100
Word in 100 out of 1000 docs  → 1000/100 = 10
Word in 1000 out of 1000 docs → 1000/1000 = 1

Problem: A rare word gets weight 1000, common word gets 1.
         That 1000x difference is way too extreme!
         Rare words would completely dominate everything.

With log (compressed):
──────────────────────
Word in 1 out of 1000 docs    → log(1000) = 3
Word in 10 out of 1000 docs   → log(100) = 2
Word in 100 out of 1000 docs  → log(10) = 1
Word in 1000 out of 1000 docs → log(1) = 0

Much better! The range is 0 to 3 instead of 1 to 1000.
Rare words are upweighted, but not absurdly so.
```

Log compresses the scale, making differences more gradual and manageable.

**Bonus: log(1) = 0 is convenient!**

When a word appears in ALL documents, the ratio is 1, and log(1) = 0.
This automatically zeros out words that appear everywhere - exactly what we want!

**Now the IDF calculation:**

Let's say we have 1000 movie descriptions:

```
"the" appears in 1000 out of 1000 documents (every single one)
IDF("the") = log(1000 / 1000) = log(1) = 0
             ↑
             Very common word → IDF = 0 → word gets zeroed out!

"action" appears in 200 out of 1000 documents
IDF("action") = log(1000 / 200) = log(5) ≈ 1.6
                ↑
                Somewhat common → moderate IDF

"explosion" appears in 50 out of 1000 documents
IDF("explosion") = log(1000 / 50) = log(20) ≈ 3.0
                   ↑
                   Rare word → high IDF → word is distinctive!
```

**Step 3: Combine Them (TF × IDF)**

```
TF-IDF = TF × IDF

For the document "action action explosion":

TF-IDF("the")       = 0 × 0    = 0      (common word, zeroed out)
TF-IDF("action")    = 2 × 1.6  = 3.2    (moderate weight)
TF-IDF("explosion") = 1 × 3.0  = 3.0    (high weight despite appearing once!)
```

**The Full Picture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TF-IDF CALCULATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Word        │ TF (count in doc) │ IDF (rarity)      │ TF-IDF (final)      │
│  ────────────┼───────────────────┼───────────────────┼──────────────────── │
│  "the"       │ 3                 │ 0 (in all docs)   │ 3 × 0 = 0           │
│  "action"    │ 2                 │ 1.6 (in 20%)      │ 2 × 1.6 = 3.2       │
│  "explosion" │ 1                 │ 3.0 (in 5%)       │ 1 × 3.0 = 3.0       │
│                                                                             │
│  Result: "explosion" (appears once) has nearly as much weight as            │
│          "action" (appears twice) because "explosion" is rarer!             │
│                                                                             │
│          "the" (appears 3 times) has ZERO weight because it's               │
│          in every document and tells us nothing distinctive.                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The Philosophy of TF-IDF:**

TF-IDF embodies a specific way of thinking about similarity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   "Compare things by what makes them DISTINCTIVE,                           │
│    not by what they have in COMMON."                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   All movie descriptions have words like "the", "a", "is", "movie"          │
│                                                                             │
│   These shared words tell us nothing about what makes each movie            │
│   different. They're like background noise.                                 │
│                                                                             │
│   TF-IDF asks: "What words does THIS document have that MOST                │
│   documents don't?" Those distinctive words are the signal.                 │
│                                                                             │
│   Two documents are similar if they share the same DISTINCTIVE              │
│   words - not if they both use common words like "the".                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Think of it like comparing people:
- Everyone has two eyes, a nose, a mouth → not distinctive, ignore these
- Unusual features (red hair, scar, tattoo) → distinctive, use these to identify

TF-IDF does the same for documents:
- Every document has "the", "is", "a" → not distinctive, downweight to ~0
- Few documents have "explosion", "spacecraft" → distinctive, upweight these

**Why This Matters:**

Without TF-IDF, two documents might look similar just because they both use common words like "the" and "is" a lot. With TF-IDF, similarity is based on meaningful, distinctive words.

```
Without TF-IDF:
    Doc A: "The the the action"     → [3, 1, 0]  (the, action, explosion)
    Doc B: "The the the comedy"     → [3, 0, 1]  (the, action, explosion...wait, wrong)

    These might look similar because of all the "the"s!

With TF-IDF:
    Doc A: "The the the action"     → [0, 3.2, 0]  (the=0, action weighted, explosion=0)
    Doc B: "The the the comedy"     → [0, 0, ...]

    Now "the" is zeroed out, and only meaningful words matter.
```

---

## 10. Putting It All Together

Now you can see how these concepts combine in content-based recommendation:

### The Full Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. FEATURE EXTRACTION                                          │
│     ─────────────────────                                       │
│     Movie descriptions → Vector space representation            │
│     "Exciting action thriller" → [0.8, 0, 0.3, ...]            │
│                                  (TF-IDF weighted)              │
│                           │                                     │
│                           ▼                                     │
│  2. TRAINING DATA                                               │
│     ─────────────                                               │
│     User's past ratings become labeled training examples        │
│     [0.8, 0, 0.3, ...] → 5 stars (liked)                       │
│     [0, 0.9, 0, ...]   → 2 stars (disliked)                    │
│                           │                                     │
│                           ▼                                     │
│  3. LEARN CLASSIFIER (User Profile)                             │
│     ─────────────────────────────                               │
│     Algorithm learns which feature patterns → high/low ratings  │
│     "Action-heavy + thriller = LIKE"                            │
│     "Comedy + romance = DISLIKE"                                │
│                           │                                     │
│                           ▼                                     │
│  4. PREDICT (on test data = unrated movies)                     │
│     ─────────────────────────────────────                       │
│     New movie: [0.7, 0.1, 0.4, ...]                             │
│     Classifier predicts: "Probably LIKE (predicted: 4.2 stars)" │
│                           │                                     │
│                           ▼                                     │
│  5. RECOMMEND                                                   │
│     ─────────                                                   │
│     Return top-k movies with highest predicted ratings          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Avoiding Overfitting

- **Feature selection** (Gini index, entropy) removes noisy features
- Keep enough training data (user needs to rate many items)
- Use simpler models when data is scarce

### Evaluating Success

- Split user's ratings into train/test sets
- Train on 80% of ratings
- Predict on held-out 20%
- Measure: How close are predicted ratings to actual ratings?

---

## Quick Reference Card

| Term | One-Line Definition |
|------|---------------------|
| **Feature** | A measurable property of an item (INPUT - what you know) |
| **Label** | The value you're trying to predict (OUTPUT - the answer) |
| **Feature vector** | List of feature values representing one item |
| **Classifier** | Algorithm that predicts labels from features |
| **Majority vote** | Predict the most common label among similar items |
| **Training data** | Labeled examples used to teach the model |
| **Test data** | Held-out examples to evaluate model performance |
| **Overfitting** | Model memorizes training data, fails on new data |
| **Underfitting** | Model too simple to capture real patterns |
| **Classification** | Predicting categories (spam/not spam) - use majority vote |
| **Regression** | Predicting numbers (3.7 stars) - use average |
| **P(A\|B)** | Probability of A given B occurred |
| **Bayes' theorem** | P(A\|B) = P(B\|A) × P(A) / P(B) |
| **Independence** | Events don't affect each other's probability |
| **Cosine similarity** | Angle-based similarity for vectors |
| **TF-IDF** | Word weighting that downweights common terms |

---

## You're Ready!

With these concepts understood, you can now read Chapter 4 and understand:

- Why item descriptions are converted to vectors (Section 4.3)
- How feature selection prevents overfitting (Section 4.3.4)
- How Naive Bayes predicts user preferences (Section 4.4.3)
- Why nearest neighbor finds similar items (Section 4.4.1)
- How TF-IDF improves recommendations (Section 4.3.2)

Good luck with Chapter 4!
