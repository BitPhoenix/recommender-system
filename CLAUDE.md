# Claude Instructions

## Development Environment

The API server runs via Tilt in a Kubernetes cluster (minikube). **Do not start any servers manually** - they are already running when working on this project.

- Run `./bin/tilt-start.sh` to start all services (Neo4j, API, Client)
- API available at: `http://localhost:4025`
- Neo4j available at: `bolt://localhost:7687` and `http://localhost:7474`
- Client available at: `http://localhost:5173`
- Ollama runs locally on macOS (via Homebrew or Ollama.app), not in a container

### Running Tests

Tests are run from the host machine (not inside containers). Ports are forwarded from the Kubernetes cluster:

```bash
cd recommender_api
npm test           # Unit and integration tests
npm run test:e2e   # E2E tests (requires Tilt running)
```

- **LLM-dependent tests**: Some integration tests require Ollama to be running locally. If Ollama is unavailable, these tests will skip gracefully.
- **Neo4j tests**: Integration tests connect to Neo4j via `localhost:7687` (port-forwarded from the cluster).

## Design Philosophy

**Prioritize correctness and clean design over simplicity or minimal changes.** When evaluating implementation approaches:

- **Embrace refactoring**: If the cleanest solution requires restructuring existing code, do it. Don't work around poor designs just to avoid touching existing code.
- **Breaking changes are acceptable**: Don't preserve backwards compatibility for its own sake. If a better API or interface design requires breaking changes, prefer the better design.
- **Choose the most correct solution**: Don't default to "simplest" or "fastest to implement." Evaluate options based on correctness, maintainability, and how well they fit the domain model.
- **Fix root causes**: Don't add workarounds or bandaids. If you encounter technical debt while implementing a feature, address it rather than working around it.
- **Design for the actual requirements**: Not for hypothetical future ones, but also not artificially constrained by "what's easiest right now."

When presenting options, don't weight "requires no refactoring" or "minimal changes" as advantages. The right solution is the one with the best design, regardless of how much existing code needs to change.

## Research Before Asking

**Look up answers in the codebase before asking the user.** Many questions can be answered by reading existing files:

- **Data questions**: Read seed files (`seeds/engineers.ts`, `seeds/skills.ts`, etc.) to understand what data exists, field values, relationships, and naming conventions
- **Configuration**: Check config files in `config/` for mappings, constants, and domain rules
- **Patterns**: Look at existing code for conventions and how similar features are implemented
- **Types**: Read type definitions to understand data structures and valid values

Only ask the user when the answer genuinely cannot be found in the codebase (e.g., business decisions, preferences, or requirements not yet documented).

## Learning from Corrections

When the user corrects a mistake or clarifies a preference:

1. Acknowledge the correction
2. Analyze whether this represents a pattern that could recur
3. If likely to recur, proactively suggest:
   - Adding a new rule to `.claude/rules/` (if it's a distinct topic or applies to specific file paths)
   - Editing an existing rule or CLAUDE.md (if it extends existing guidance)
   - Framing: "This seems like something that could come up again. Would you like me to add a rule for this?"

Don't suggest rules for one-off corrections or highly context-specific situations.

### Rule File Convention

When adding to rule files, use this structure to distinguish user-created vs claude-suggested content:

```markdown
# Rule Topic

(User's canonical rules at the top)

---

## Claude Suggested

> Added YYYY-MM-DD: Brief context about why this was suggested

### Suggested Rule Name
Rule content...
```

- **User content**: Main body of the file (no special markers)
- **Claude suggestions**: Under `## Claude Suggested` heading with date and context
- **Promotion**: User can move suggestions up and remove the marker to "promote" them
- **New files**: If creating an entirely new rule file, place it in `.claude/rules/` with only a `## Claude Suggested` section until the user promotes the content
