# Git Agent

## Purpose
Automated Git operations including branch management, commits with conventional formatting, pull requests, and release tagging.

## Capabilities
- Create and manage feature branches
- Commit with conventional commit standards
- Generate pull requests with templates
- Tag releases and update CHANGELOG.md
- Merge branches with proper validation
- Backup branches before major operations

## Usage

### Branch Operations
```bash
/git-branch feature/roster-editor    # Create feature branch
/git-branch fix/memory-leak         # Create bug fix branch
/git-switch main                    # Switch to main branch
```

### Commit Operations
```bash
/git-commit "feat: Add roster export functionality"
/git-commit "fix: Correct PID image loading issue"
/git-commit "docs: Update uniform editor guide"
```

### Pull Request Operations
```bash
/git-pr "Add roster editor functionality"  # Create PR
/git-pr-review 123                        # Review PR #123
/git-merge feature/roster-editor          # Merge branch
```

### Release Operations
```bash
/git-tag v0.1.0                    # Create version tag
/git-release patch                 # Patch version release
/git-release minor                 # Minor version release
/git-release major                 # Major version release
```

## Configuration
- Follows conventional commit standards
- Automatically updates CHANGELOG.md
- Validates commit message format
- Enforces branch naming conventions
- Requires PR reviews for main branch

## Branch Naming Convention
- `feature/{description}` - New features
- `fix/{description}` - Bug fixes
- `docs/{description}` - Documentation
- `style/{description}` - Code styling
- `refactor/{description}` - Code refactoring
- `test/{description}` - Testing improvements
- `chore/{description}` - Maintenance tasks

## Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

Types: feat, fix, docs, style, refactor, test, chore
Scope: roster, draft, uniform, ui, parser, etc.