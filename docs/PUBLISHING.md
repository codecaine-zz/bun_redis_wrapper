# Publishing Guide

This guide explains how to publish the `@codecaine-zz/bun-redis-wrapper` package to npm.

## Prerequisites

1. **npm Account**: Create an account at [npmjs.com](https://www.npmjs.com/)
2. **npm CLI**: Ensure you have npm installed (comes with Node.js)
3. **Authentication**: Log in to npm from your terminal

## Initial Setup

### 1. Login to npm

```bash
npm login
```

Enter your npm username, password, and email when prompted.

### 2. Verify Login

```bash
npm whoami
```

This should display your npm username.

## Publishing Steps

### 1. Update Version

Before each release, update the version in `package.json`:

```bash
# For patch releases (bug fixes): 1.0.0 -> 1.0.1
npm version patch

# For minor releases (new features): 1.0.0 -> 1.1.0
npm version minor

# For major releases (breaking changes): 1.0.0 -> 2.0.0
npm version major
```

Or manually edit the version in `package.json`.

### 2. Build the Package

```bash
bun run build
```

This will:
- Clean the `dist/` folder
- Compile TypeScript to JavaScript
- Generate `.d.ts` type definitions
- Create source maps

Verify the build:
```bash
ls -la dist/
```

You should see:
- `index.js` and `index.d.ts`
- `controllers/` directory with compiled controllers

### 3. Test Before Publishing

```bash
# Run all tests
bun test

# Optional: Test the package locally
npm pack
```

The `npm pack` command creates a `.tgz` file that you can inspect or install locally:
```bash
npm install ./codecaine-zz-bun-redis-wrapper-1.0.0.tgz
```

### 4. Publish to npm

For the first time (public package):
```bash
npm publish --access public
```

For subsequent releases:
```bash
npm publish
```

### 5. Verify Publication

Check your package on npm:
```
https://www.npmjs.com/package/@codecaine-zz/bun-redis-wrapper
```

## Automated Publishing Workflow

The `package.json` includes a `prepublishOnly` script that automatically:
1. Runs all tests
2. Builds the package

This ensures you never publish broken code.

## Installation by Users

Once published, users can install your package:

```bash
# Using bun
bun add @codecaine-zz/bun-redis-wrapper

# Using npm
npm install @codecaine-zz/bun-redis-wrapper

# Using pnpm
pnpm add @codecaine-zz/bun-redis-wrapper

# Using yarn
yarn add @codecaine-zz/bun-redis-wrapper
```

## Usage After Installation

```typescript
// Import core wrapper
import { createRedis, createNamespacedRedis } from "@codecaine-zz/bun-redis-wrapper";

// Import controllers
import {
  SessionController,
  CacheController,
  RateLimiterController
} from "@codecaine-zz/bun-redis-wrapper/controllers";

// Or import specific controller
import { SessionController } from "@codecaine-zz/bun-redis-wrapper/controllers/SessionController";
```

## Version Management

### Semantic Versioning

Follow [semver](https://semver.org/) guidelines:

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes (backward compatible)

### Pre-release Versions

For beta or alpha releases:

```bash
npm version prerelease --preid=beta
# 1.0.0 → 1.0.1-beta.0

npm publish --tag beta
```

Users can install pre-release versions:
```bash
bun add @codecaine-zz/bun-redis-wrapper@beta
```

## Unpublishing

**Warning**: Unpublishing is permanent and should be avoided.

Within 72 hours of publishing:
```bash
npm unpublish @codecaine-zz/bun-redis-wrapper@1.0.0
```

After 72 hours, you can only deprecate:
```bash
npm deprecate @codecaine-zz/bun-redis-wrapper@1.0.0 "This version has a critical bug"
```

## Package Scope

This package uses a scoped name: `@codecaine-zz/bun-redis-wrapper`

**Advantages:**
- ✅ Avoids naming conflicts
- ✅ Groups your packages together
- ✅ Can be private or public

**Note**: First-time scoped package publication requires `--access public` flag.

## Troubleshooting

### Error: "You must be logged in to publish packages"

```bash
npm login
npm whoami
```

### Error: "You do not have permission to publish"

- Verify package name isn't taken
- Check if you're logged in with correct account
- For scoped packages, use `--access public`

### Error: "Package name too similar to existing package"

- Choose a different package name
- Use a scoped name: `@your-username/package-name`

### Build Errors

```bash
# Clean and rebuild
bun run build:clean
bun run build:ts

# Check TypeScript errors
bun tsc --noEmit
```

## Package Contents

The published package includes:

```
dist/
├── index.js               # Main entry point
├── index.d.ts             # Type definitions
├── redis-wrapper.js       # Core wrapper
├── redis-wrapper.d.ts
└── controllers/
    ├── index.js
    ├── index.d.ts
    ├── SessionController.js
    ├── SessionController.d.ts
    ├── CacheController.js
    ├── CacheController.d.ts
    ├── RateLimiterController.js
    ├── RateLimiterController.d.ts
    ├── QueueController.js
    ├── QueueController.d.ts
    ├── StorageController.ts
    ├── StorageController.d.ts
    ├── AnalyticsController.js
    └── AnalyticsController.d.ts
README.md
LICENSE
```

## Best Practices

1. **Always test before publishing**: Run `bun test`
2. **Use semantic versioning**: Follow semver guidelines
3. **Update CHANGELOG**: Document changes for each version
4. **Test locally**: Use `npm pack` to test installation
5. **Keep README updated**: Ensure installation instructions are current
6. **Check .npmignore**: Don't ship unnecessary files
7. **Verify build**: Check `dist/` folder before publishing
8. **Tag releases**: Create Git tags for versions

## CI/CD Integration

Consider automating releases with GitHub Actions:

```yaml
# .github/workflows/publish.yml
name: Publish to npm
on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run build
      - uses: JS-DevTools/npm-publish@v1
        with:
          token: ${{ secrets.NPM_TOKEN }}
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/codecaine-zz/bun_redis_wrapper/issues
- npm Package: https://www.npmjs.com/package/@codecaine-zz/bun-redis-wrapper

## Quick Reference

```bash
# Complete publishing workflow
npm login                    # Login once
npm version patch            # Update version
bun test                     # Verify tests pass
bun run build               # Build the package
npm publish --access public  # Publish (first time)
npm publish                 # Publish (subsequent)

# Verify
npm view @codecaine-zz/bun-redis-wrapper
```

---

**Ready to publish?** Follow the steps above and your package will be live on npm! 🚀
