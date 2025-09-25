# Madden Editor Suite - Project Context

## Project Overview
This is a professional desktop application for comprehensive Madden NFL game file editing. Built with Electron + React + TypeScript, it provides 17+ specialized editing tools with a focus on professional presentation and installer distribution.

## Project Goals
- Create a unified tool for editing all Madden file types
- Professional UI matching Madden's aesthetic (dark theme, sports styling)
- Comprehensive editing capabilities for retro and modern seasons
- Web scraping integration for historical data from pro-football-reference.com
- Professional installer with code signing (no antivirus false positives)
- Incremental release strategy with feature tracking

## Architecture

### Tech Stack
- **Frontend**: Electron 28+ + React 19 + TypeScript 5
- **UI Framework**: Tailwind CSS + Custom Components
- **State Management**: Zustand
- **Data Tables**: AG-Grid
- **3D Rendering**: Three.js (for uniform/field previews)
- **Image Processing**: Sharp
- **Database**: SQLite3 (local data cache)
- **Web Scraping**: Puppeteer + Playwright
- **Testing**: Jest + React Testing Library
- **Build**: Vite + Electron Forge

### Project Structure
```
src/
├── main/              # Electron main process
│   ├── ipc/          # IPC handlers for renderer communication
│   ├── parsers/      # Binary file parsers for each format
│   │   ├── roster/   # Roster file parser (.ros)
│   │   ├── franchise/# Franchise file parser (.fra)
│   │   ├── draft/    # Draft class parser (.dcl)
│   │   ├── uniform/  # Uniform file parser (.uni)
│   │   ├── dds/      # DDS texture parser
│   │   ├── field/    # Field texture parser
│   │   ├── stats/    # Stats file parser
│   │   ├── coach/    # Coach data parser
│   │   └── salary/   # Salary cap parser
│   └── database/     # SQLite operations
├── renderer/         # React frontend
│   ├── components/   # Reusable UI components
│   │   ├── Navigation/     # Main app navigation
│   │   ├── FileExplorer/   # Dynamic path file picker
│   │   ├── DataGrid/       # AG-Grid wrapper
│   │   ├── ColorPicker/    # Color selection (uniform editor)
│   │   └── Preview3D/      # 3D preview (Three.js)
│   ├── features/     # Feature modules (17 tools)
│   │   ├── roster/         # Player attribute editing
│   │   ├── draft/          # Draft class creation/editing
│   │   ├── coach/          # Coach profiles and records
│   │   ├── pid/            # Player image (PID) editor
│   │   ├── stats/          # Historical stats editor
│   │   ├── history/        # Season start date editor
│   │   ├── expansion/      # Expansion draft tool
│   │   ├── field/          # Stadium field customization
│   │   ├── salary/         # Salary cap management
│   │   ├── commentary/     # Commentary ID fixes
│   │   ├── weather/        # Weather controls
│   │   ├── uniform/        # Uniform color/texture editor
│   │   ├── visuals/        # Splash screens, scorebugs
│   │   ├── mods/           # Era mod switcher
│   │   └── export/         # File conversion tools
│   ├── hooks/        # Custom React hooks
│   ├── utils/        # Frontend utilities
│   └── types/        # TypeScript type definitions
├── scrapers/         # Web scraping modules
│   ├── pfr/         # Pro-football-reference.com scraper
│   └── historical/  # Historical data processors
└── shared/          # Shared code between main/renderer
    ├── types/       # Shared TypeScript types
    ├── constants/   # Application constants
    └── utils/       # Shared utilities
```

## Feature List (17 Tools)

### Phase 1: Core Tools (v0.1.0)
1. **Roster Editor** - Full player attribute editing with data grid
2. **Draft Class Editor** - Create/modify draft classes with player generation
3. **Coach Editor** - Edit coach attributes, records, and AI tendencies
4. **Export Tool** - Convert franchise to roster file format

### Phase 2: Enhanced Editing (v0.2.0)
5. **PID Editor** - In-game photo management and replacement
6. **Stats Editor** - Historical stats modification for retro accuracy
7. **Commentary Fix Tool** - Audio ID mapping corrections for proper names
8. **Salary Cap Editor** - Team salary cap management and penalties

### Phase 3: Retro Features (v0.3.0)
9. **History Editor** - Start franchise from past seasons
10. **Expansion Draft Tool** - Add new teams with custom draft rules
11. **Draft Helper** - Multi-team draft control and automation
12. **Weather Controls** - Game condition and weather modifications

### Phase 4: Visual Customization (v0.4.0)
13. **Field Editor** - Stadium field texture and logo customization
14. **Splash Screen Editor** - Custom loading screens and era branding
15. **Scorebug Editor** - Era-specific scoreboards and overlays
16. **Equipment Editor** - Period-accurate uniforms and equipment
17. **Uniform Editor** - Team uniform color/design/texture customization

### Phase 5: Advanced Features (v1.0.0)
- **Era Mod Switcher** - Quick switching between time periods
- **Web Scraping Integration** - Auto-import from pro-football-reference.com
- **Batch Processing** - Multi-file operations and team processing
- **Cloud Sync** - Settings and roster sharing (optional)

## Development Standards

### Code Quality
- TypeScript strict mode enabled
- ESLint + Prettier formatting
- 85% test coverage minimum
- Jest + React Testing Library
- Visual regression tests for UI

### File Handling
- Always create backups before modifications
- Dynamic path selection (no hardcoded paths)
- Transaction support for multi-file operations
- Checksum validation after every operation
- Stream processing for large files (>10MB)

### Security
- Code signing certificate for installer
- Sandbox all file operations
- Input validation on all forms
- No hardcoded credentials or paths
- HTTPS-only for updates and scraping

### Performance Targets
- Startup time: < 3 seconds
- File parsing: < 500ms for roster files
- 3D preview: 60 FPS minimum
- UI responsiveness: < 100ms for operations
- Memory usage: < 150MB idle, < 500MB active

## File Formats

### Madden File Types
- `.ros` - Roster files (player data)
- `.fra` - Franchise files (full season data)
- `.dcl` - Draft class files
- `.uni` - Uniform configuration files
- `.dds` - DirectDraw Surface textures
- `.ast` - Asset package files
- `.col` - Color palette files
- `.fld` - Field texture files

### Binary Parsing Requirements
- Little-endian byte order
- Variable-length encoding for strings
- Checksum validation
- Version compatibility handling
- Mipmap support for textures

## Development Workflow

### Git Strategy
```
main                 # Stable releases only
├── develop         # Integration branch
│   ├── feature/*   # New features
│   ├── fix/*      # Bug fixes
│   └── release/*  # Release preparation
└── hotfix/*       # Emergency fixes
```

### Commit Convention
```
feat: Add roster export functionality
fix: Correct PID image loading issue
docs: Update uniform editor guide
style: Format texture manager component
refactor: Optimize binary parser performance
test: Add draft class validation tests
chore: Update dependencies
```

### Release Process
1. Weekly releases with incremental features
2. Automated testing on all commits
3. Code signing for all releases
4. Comprehensive changelog documentation
5. GitHub releases with installer packages

## Testing Strategy

### Test Structure
```
tests/
├── unit/
│   ├── parsers/    # Binary parser tests
│   ├── components/ # React component tests
│   └── utils/      # Utility function tests
├── integration/
│   ├── file-operations/     # File I/O tests
│   ├── texture-processing/  # Image processing tests
│   └── database/           # SQLite operation tests
├── e2e/
│   ├── roster-workflow.test.ts
│   ├── uniform-workflow.test.ts
│   └── draft-workflow.test.ts
├── visual/
│   └── ui-regression.test.ts
└── performance/
    └── benchmarks.test.ts
```

### Test Requirements
- Unit tests: 85% coverage minimum
- Integration tests: Critical user paths
- E2E tests: Complete workflows
- Performance tests: Each major feature
- Visual tests: UI components and 3D renders

## User Interface Guidelines

### Design Principles
- Dark theme matching Madden's aesthetic
- Professional sports application styling
- Clear navigation between tools
- Real-time previews for all changes
- Responsive design for different screen sizes

### Component Standards
- Consistent spacing and typography
- Loading states for async operations
- Error boundaries with user-friendly messages
- Keyboard shortcuts for power users
- Tooltips and help text for complex features

## Installation & Distribution

### Installer Requirements
- Windows Squirrel installer (primary)
- Code signing to prevent antivirus false positives
- User selectable installation directory
- Desktop shortcut creation
- Uninstaller with clean removal

### Auto-Update System
- Silent background updates
- Update notifications
- Rollback capability
- Delta updates for smaller downloads
- Update channel selection (stable/beta)

## Community Integration

### Existing Madden Modding Tools
- Research compatibility with existing editors
- Import/export with common formats
- Community asset sharing
- Plugin architecture for third-party tools
- Open-source components where appropriate

### Future Extensibility
- Plugin system for custom tools
- API for third-party integrations
- Community marketplace for assets
- Scripting support for automation
- Template sharing system

## Version History

### Tracking System
- CHANGELOG.md with detailed feature additions
- Semantic versioning (MAJOR.MINOR.PATCH)
- Release notes with screenshots
- Migration guides for breaking changes
- Feature deprecation warnings

### Documentation Requirements
- User guides with video tutorials
- API documentation for developers
- File format specifications
- Troubleshooting guides
- FAQ section with common issues

## Development Environment

### Required Tools
- Node.js 20 LTS
- npm 10+
- Git 2.40+
- Code signing certificate (for releases)
- Windows SDK (for native modules)

### Recommended Setup
- VS Code with extensions:
  - TypeScript + ESLint + Prettier
  - Jest Test Explorer
  - Electron debugging
  - Git integration
- Chrome DevTools for renderer debugging
- Electron debugging tools

This project represents a comprehensive solution for Madden NFL game file editing with professional presentation and distribution standards. The incremental release strategy ensures users receive working features quickly while maintaining high quality standards.