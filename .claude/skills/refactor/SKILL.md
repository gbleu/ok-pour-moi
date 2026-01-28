---
name: refactor
description: Analyze and refactor the codebase using knip (unused code), jscpd (duplication), and code-simplifier agent. Run with /refactor for full analysis.
---

# Refactor Skill

Comprehensive code quality analysis using:

1. **knip** - Unused files, exports, dependencies
2. **jscpd** - Code duplication detection
3. **code-simplifier** - Code simplification agent

## Execution Steps

### Step 1: Run knip

```bash
bun knip --no-progress
```

Detects unused files, exports, dependencies, and dev dependencies.

### Step 2: Run jscpd

```bash
bun jscpd src/ --min-lines 10 --min-tokens 100
```

Detects duplicated code blocks (copy-paste detection).

### Step 3: Present Findings

Format results as:

```
=== REFACTOR ANALYSIS ===

## Unused Code (knip)
- Files: [count] - [list]
- Exports: [count] - [list with locations]
- Dependencies: [count] - [list]

## Code Duplication (jscpd)
- Clones: [count]
- [For each clone: file:lines -> file:lines]

## Actions Available
1. Remove unused files/exports
2. Refactor duplicated code
3. Run code-simplifier on files
```

### Step 4: User Choice

Ask user which actions to take:

- **Remove unused** - Delete unused files, remove unused exports
- **Refactor duplicates** - Extract duplicated code into shared functions
- **Simplify code** - Spawn code-simplifier agent

### Step 5: Code Simplifier (if requested)

Use the Task tool to spawn the code-simplifier agent:

```
subagent_type: "code-simplifier:code-simplifier"
prompt: "Simplify and refine [specific files or areas]"
```

The agent will:

- Reduce complexity
- Eliminate redundancy
- Improve readability
- Preserve all functionality
