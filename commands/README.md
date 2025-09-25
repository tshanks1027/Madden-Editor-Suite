# Slash Commands Reference

## Overview
Custom slash commands for streamlining Madden Editor Suite development workflow. These commands integrate with our custom subagents to automate common development tasks.

## Command Categories

### Project Management
- `/init-project` - Initialize new project workspace
- `/clean-workspace` - Clean build artifacts and temporary files
- `/project-status` - Display current project status and statistics

### Git Operations
- `/git-branch [name]` - Create and switch to new feature branch
- `/git-commit [message]` - Commit with conventional format validation
- `/git-pr [title]` - Create pull request with template
- `/git-merge [branch]` - Merge branch with validation
- `/git-tag [version]` - Create version tag and update changelog

### Testing & Quality
- `/test [scope]` - Run test suite (unit/integration/e2e/all)
- `/test-coverage` - Generate test coverage report
- `/benchmark [feature]` - Run performance benchmarks
- `/lint-fix` - Fix all linting issues automatically
- `/format-all` - Format all code with Prettier

### Building & Packaging
- `/build [environment]` - Build application (dev/prod)
- `/package [platform]` - Package for distribution
- `/sign-code` - Code sign executables
- `/create-installer` - Generate Windows installer

### File Format Operations
- `/parse-file [path]` - Parse and analyze Madden file
- `/validate-file [path]` - Validate file integrity
- `/convert-format [from] [to] [path]` - Convert between formats
- `/backup-file [path]` - Create secure file backup

### Feature Development
- `/scaffold-feature [name]` - Create new feature module
- `/add-parser [format]` - Add new file format parser
- `/create-component [name]` - Generate React component
- `/add-test [target]` - Generate test suite for target

### Release Management
- `/release [type]` - Create release (patch/minor/major)
- `/draft-release [version]` - Create draft release
- `/publish-release [version]` - Publish release to GitHub
- `/notify-update [version]` - Notify users of new version

### Research & Documentation
- `/research-format [type]` - Research file format structure
- `/analyze-binary [path]` - Analyze binary file structure
- `/generate-docs [scope]` - Generate documentation
- `/update-readme` - Update README with current features

## Command Usage Examples

### Development Workflow
```bash
# Start new feature
/git-branch feature/uniform-editor
/scaffold-feature uniform-editor
/add-parser uniform
/create-component UniformPreview

# Development cycle
/test uniform
/lint-fix
/git-commit "feat(uniform): Add 3D preview component"

# Testing and validation
/test-coverage
/benchmark uniform-rendering
/validate-file sample-uniform.uni

# Release preparation
/build prod
/test e2e
/package windows
/create-installer
```

### Research Workflow
```bash
# Analyze new file format
/research-format roster-2025
/analyze-binary sample-roster.ros
/parse-file --debug roster-file.ros

# Document findings
/generate-docs parser-specs
/update-readme
/git-commit "docs(parser): Add roster format specification"
```

### Quality Assurance
```bash
# Pre-release validation
/test all
/test-coverage
/benchmark all-features
/lint-fix
/format-all

# Build validation
/build prod
/sign-code
/create-installer
/validate-installer
```

## Command Configuration

### Environment Variables
```bash
# Set in .env or system environment
MADDEN_TOOLS_PATH="C:/Games/Madden NFL 25"
BACKUP_DIRECTORY="./backups"
TEMP_DIRECTORY="./temp"
CODE_SIGN_CERT_PATH="./certificates/code-sign.p12"
```

### Command Aliases
```bash
# Short aliases for common commands
/t = /test
/b = /build
/gc = /git-commit
/gp = /git-pr
/pf = /parse-file
/vf = /validate-file
```

### Custom Configurations
```json
{
  "defaultTestScope": "unit",
  "autoBackup": true,
  "validateBeforeCommit": true,
  "signReleases": true,
  "notifyDiscord": true
}
```

## Integration with Subagents

### Git Agent Integration
```bash
/git-branch → agents/git-agent/create-branch.js
/git-commit → agents/git-agent/conventional-commit.js
/git-pr → agents/git-agent/create-pr.js
```

### Test Agent Integration
```bash
/test → agents/test-agent/run-tests.js
/benchmark → agents/test-agent/performance.js
/test-coverage → agents/test-agent/coverage.js
```

### Research Agent Integration
```bash
/research-format → agents/research-agent/analyze-format.js
/analyze-binary → agents/research-agent/binary-analysis.js
/parse-file → agents/research-agent/parse-and-validate.js
```

### Package Agent Integration
```bash
/build → agents/package-agent/build-app.js
/package → agents/package-agent/create-package.js
/sign-code → agents/package-agent/code-sign.js
/create-installer → agents/package-agent/installer.js
```

### Release Agent Integration
```bash
/release → agents/release-agent/create-release.js
/draft-release → agents/release-agent/draft.js
/publish-release → agents/release-agent/publish.js
/notify-update → agents/release-agent/notify-users.js
```

### Texture Agent Integration
```bash
/convert-texture → agents/texture-agent/convert-format.js
/optimize-texture → agents/texture-agent/optimize.js
/validate-dds → agents/texture-agent/validate-dds.js
```

### Scrape Agent Integration
```bash
/scrape-players → agents/scrape-agent/scrape-players.js
/scrape-coaches → agents/scrape-agent/scrape-coaches.js
/validate-data → agents/scrape-agent/validate-scraped.js
```

## Command Development

### Creating New Commands
1. **Define Command** - Add to commands registry
2. **Create Handler** - Implement command logic
3. **Add Documentation** - Update this README
4. **Add Tests** - Create command tests
5. **Update Integration** - Connect to relevant subagent

### Command Template
```typescript
interface Command {
  name: string;
  description: string;
  usage: string;
  parameters: Parameter[];
  handler: CommandHandler;
  subagent?: string;
}

interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  required: boolean;
  description: string;
}
```

### Error Handling
- **Validation** - Parameter validation before execution
- **Error Recovery** - Graceful error handling and recovery
- **User Feedback** - Clear error messages and suggestions
- **Logging** - Comprehensive command execution logging

## Security Considerations
- **Input Validation** - All parameters validated before execution
- **Path Traversal Protection** - File path validation
- **Permission Checks** - Verify user permissions for operations
- **Audit Logging** - Log all command executions for security