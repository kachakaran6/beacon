# Contributing to Beacon

Thank you for your interest in improving Beacon! We welcome contributions from developers of all skill levels.

---

## 🛠️ Development Setup

1. **Prerequisites**:
   - Node.js 20.x or higher
   - npm 10.x or higher
   - Windows 10 or 11 environment

2. **Fork & Clone**:
   ```bash
   git clone https://github.com/<your-username>/beacon.git
   cd beacon
   npm install
   ```

3. **Start Development**:
   ```bash
   npm run app:dev
   ```

---

## 🧪 Testing & Code Quality

Before opening a pull request, ensure all validation scripts pass:

```bash
# Run Vitest and Playwright test suites
npm test

# Run Oxlint linter
npm run lint

# Check brand integrity (ensures old names are not reintroduced)
npm run check:brand

# Test full production build
npm run app:build
```

---

## 📝 Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification in the imperative mood:

- `feat(component)`: A new feature
- `fix(component)`: A bug fix
- `docs`: Documentation only changes
- `chore`: Maintenance tasks, dependencies, tooling
- `ci`: CI/CD configuration and workflow updates
- `test`: Adding or correcting tests

Examples:
- `feat(position): add multi-monitor notch docking controls`
- `fix(timer): prevent tick drift during system sleep`
- `docs: update shortcuts table in README`

---

## 🚀 Submitting a Pull Request

1. Create a feature branch: `git checkout -b feat/your-feature-name`
2. Commit your changes following conventional commits
3. Push to your fork: `git push origin feat/your-feature-name`
4. Open a Pull Request targeting `main` on the primary repository.
5. Fill out the PR template and wait for CI checks to pass.
