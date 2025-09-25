# Test Agent

## Purpose
Automated testing operations including unit tests, integration tests, E2E tests, and performance benchmarks for all 17 editing tools.

## Capabilities
- Run comprehensive test suites for specific features
- Performance benchmarks for file operations
- Visual regression testing for UI components
- Automated testing of binary parsers
- Coverage reporting and validation
- Continuous integration support

## Usage

### Test Execution
```bash
/test unit                         # Run all unit tests
/test integration                  # Run integration tests
/test e2e                         # Run end-to-end tests
/test performance                 # Run performance benchmarks
/test roster                      # Test roster editor specifically
/test uniform                     # Test uniform editor specifically
```

### Coverage Operations
```bash
/test-coverage                    # Generate coverage report
/test-coverage-check             # Validate coverage thresholds
/test-coverage-report            # Open HTML coverage report
```

### Specific Tool Testing
```bash
/test-parser roster              # Test roster file parser
/test-parser uniform             # Test uniform file parser
/test-ui roster-editor           # Test roster editor UI
/test-ui uniform-preview         # Test 3D uniform preview
```

### Performance Testing
```bash
/benchmark file-parsing          # Benchmark file parsing speed
/benchmark ui-rendering          # Benchmark UI rendering
/benchmark memory-usage          # Memory usage analysis
/benchmark startup-time          # Application startup benchmarks
```

## Test Categories

### Unit Tests
- Parser functions for all file formats
- Utility functions and helpers
- React component testing
- State management validation
- Binary data manipulation

### Integration Tests
- File I/O operations
- Database operations (SQLite)
- IPC communication between main/renderer
- Texture processing pipelines
- Web scraping modules

### End-to-End Tests
- Complete roster editing workflow
- Draft class creation and export
- Uniform customization process
- File backup and restoration
- Multi-tool operations

### Performance Tests
- File parsing speed (<500ms for rosters)
- UI rendering performance (60 FPS)
- Memory usage validation (<500MB active)
- Startup time verification (<3 seconds)
- Large file handling (>100MB franchises)

### Visual Regression Tests
- UI component consistency
- 3D rendering accuracy
- Color picker functionality
- Data grid appearance
- Dark theme compliance

## Coverage Requirements
- Unit Tests: 85% minimum coverage
- Integration Tests: Critical user paths
- E2E Tests: Major workflows
- Performance Tests: All major features
- Visual Tests: UI components

## Test Data
- Sample roster files for all Madden versions
- Draft class templates for testing
- Uniform texture samples
- Performance baseline data
- Mock web scraping responses

## CI/CD Integration
- Automated test runs on all commits
- Coverage validation before merges
- Performance regression detection
- Cross-platform testing (Windows focus)
- Automated error reporting