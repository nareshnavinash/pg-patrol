# Contributing to PG Patrol

Thank you for your interest in contributing to PG Patrol! This guide will help you get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pg-patrol.git
   cd pg-patrol
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/my-feature
   ```

For detailed build instructions, see [BUILD.md](./BUILD.md).

## Development Workflow

1. Make your changes
2. Run the test suite: `npm test`
3. Build both targets to verify nothing is broken:
   ```bash
   npm run build:chrome
   npm run build:firefox
   ```
4. Commit your changes with a clear message
5. Push to your fork and open a Pull Request

## Coding Standards

- **TypeScript** — strict mode enabled; avoid `any` types
- **Testing** — all new features and bug fixes should include tests
- **Formatting** — follow the existing code style in the repository
- **Naming** — use descriptive variable and function names

## Testing Requirements

- All existing tests must pass before submitting a PR
- New features require unit tests at minimum
- Bug fixes should include a regression test

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Fill out the PR template completely
3. Link any related issues
4. Wait for review — maintainers may request changes

## Reporting Issues

- Use the provided issue templates for bugs, feature requests, and false positive reports
- Include as much detail as possible (browser, version, steps to reproduce)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.
