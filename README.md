# Postman to Playwright Generator

A CLI utility that converts **Postman API Collections (v2.1)** into structured, maintainable, and production-ready **Playwright API automation frameworks**.

The **Postman to Playwright Generator** parses exported Postman collection JSON files, organizes API requests into domain-driven service modules, and generates strongly typed Playwright API clients and executable test specifications.

---

## 🚀 Features

### 🏗️ Domain-Driven API Architecture

Automatically organizes API endpoints into dedicated client classes based on the Postman folder structure and API endpoint patterns.

Example generated clients:

```text
api/
├── auth.client.ts
├── user.client.ts
├── approval.client.ts
└── iam.client.ts
```

This approach promotes:

* Separation of concerns
* Reusable API clients
* Domain-based organization
* Maintainable automation code
* Reduced duplication across tests

---

### 🔄 Postman Collection Conversion

Converts Postman Collection **v2.1** requests into Playwright API automation components.

The generator processes:

* HTTP methods
* Request URLs
* Request headers
* Query parameters
* Path parameters
* Request bodies
* Postman variables
* Collection/folder hierarchy

---

### 🔧 Parameter & Variable Handling

Converts Postman variables and path parameters into Playwright-compatible URL templates.

For example, a Postman request:

```text
{{baseUrl}}/users/{{userId}}
```

can be represented as:

```text
/users/:userId
```

This allows generated API clients to expose reusable methods instead of hard-coded request definitions.

---

### 📦 Payload & Query Parameter Handling

Request information is preserved during conversion, including:

* JSON request bodies
* Form data
* Query parameters
* Path parameters
* HTTP methods
* Request headers

---

### 🔐 Authentication Fixture

The generator creates a reusable authentication fixture:

```text
tests/
└── fixtures/
    └── auth.fixture.ts
```

The authentication fixture can:

* Authenticate through the login API
* Create an authenticated `APIRequestContext`
* Reuse authentication across tests
* Reduce unnecessary login requests
* Centralize authentication logic

This allows individual test specifications to focus on business scenarios rather than authentication setup.

---

### ⚙️ Environment Configuration

The generator creates:

```text
playwright.config.ts
.env.example
```

Environment-specific configuration can be supplied through environment variables, allowing the same automation suite to run against multiple environments without modifying test code.

---

## 📁 Generated Project Structure

Running the converter against a Postman Collection generates a structure similar to:

```text
.
├── collection.json
├── convert.mjs
├── playwright.config.ts
├── .env.example
│
├── api/
│   ├── auth.client.ts
│   ├── user.client.ts
│   ├── approval.client.ts
│   └── iam.client.ts
│
└── tests/
    ├── fixtures/
    │   └── auth.fixture.ts
    │
    └── api/
        ├── auth.spec.ts
        ├── user.spec.ts
        ├── approval.spec.ts
        └── iam.spec.ts
```

### File and Directory Description

| Path                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `collection.json`      | Exported Postman Collection v2.1                 |
| `convert.mjs`          | Core conversion engine                           |
| `playwright.config.ts` | Playwright configuration                         |
| `.env.example`         | Environment variable template                    |
| `api/`                 | Generated domain-specific API clients            |
| `tests/api/`           | Generated Playwright API test specifications     |
| `tests/fixtures/`      | Shared Playwright fixtures                       |
| `auth.fixture.ts`      | Authentication and authenticated request context |

---

## 📋 Prerequisites

Before using the generator, make sure the following are installed.

### Node.js

* Node.js **18.x or higher**
* Recommended: Node.js **20+**
* Tested with Node.js **20** and **24**

Verify your installation:

```bash
node --version
npm --version
```

### Postman

You need:

* Postman installed locally
* A Postman API Collection
* Collection exported in **v2.1** format

---

# 🚀 Quick Start

## 1. Export Your Postman Collection

In Postman:

1. Right-click the collection you want to convert.
2. Select **Export**.
3. Select **Collection v2.1**.
4. Save the exported collection as:

```text
collection.json
```

Place the file in the same directory as `convert.mjs`.

---

## 2. Run the Converter

Place the converter and exported collection in the same directory:

```text
.
├── collection.json
└── convert.mjs
```

Run:

```bash
node convert.mjs
```

The generator will parse the Postman collection and generate the Playwright API automation structure.

---

## 3. Configure Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Update `.env` with your target environment:

```env
BASE_URL=https://api.yourdomain.com
API_USERNAME=admin@yourdomain.com
API_PASSWORD=YourSecurePassword123!
```

> **Security:** Never commit `.env` files containing real credentials, tokens, passwords, API keys, or secrets to source control.

Add `.env` to `.gitignore`.

---

## 4. Install Playwright

If Playwright is not already installed:

```bash
npm init playwright@latest
```

Alternatively:

```bash
npm install -D @playwright/test
```

---

## 5. Run the Generated Tests

Execute the generated API test suite:

```bash
npx playwright test
```

Run tests using Playwright UI Mode:

```bash
npx playwright test --ui
```

Run a specific test file:

```bash
npx playwright test tests/api/user.spec.ts
```

Run tests in headed mode:

```bash
npx playwright test --headed
```

---

# 🛠️ Generated Code Examples

## API Client

Example generated file:

```text
api/user.client.ts
```

```typescript
import { APIRequestContext } from '@playwright/test';

export class UserClient {
  constructor(private request: APIRequestContext) {}

  async getUserById(options: Record<string, any> = {}) {
    return await this.request.get(`/users/:id`, {
      ...options
    });
  }
}
```

The API client provides a reusable abstraction around Playwright's `APIRequestContext`.

This keeps request implementation details outside the test specifications.

---

## Test Specification

Example generated file:

```text
tests/api/user.spec.ts
```

```typescript
import { test, expect } from '../fixtures/auth.fixture';
import { UserClient } from '../../api/user.client';

test.describe('USER API Tests', () => {
  test('Get User Profile - GET', async ({ authenticatedRequest }) => {
    const client = new UserClient(authenticatedRequest);

    const response = await client.getUserById();

    expect(response.ok()).toBeTruthy();
  });
});
```

The generated test focuses on **business behavior and validation**, while the API client handles request implementation.

---

# 🏗️ Architecture

The generator follows a domain-driven conversion pipeline:

```text
┌──────────────────────────────┐
│     Postman Collection       │
│          v2.1 JSON           │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Parser / Converter      │
│                              │
│  • Endpoints                 │
│  • HTTP Methods              │
│  • Parameters                │
│  • Request Bodies            │
│  • Headers                   │
│  • Variables                 │
│  • Folder Structure          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Domain API Clients      │
│                              │
│  • AuthClient                │
│  • UserClient                │
│  • ApprovalClient            │
│  • IamClient                 │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   Playwright Test Specs      │
│                              │
│  • Authentication Fixture    │
│  • API Test Scenarios        │
│  • Assertions                │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│    Automated API Test Suite  │
└──────────────────────────────┘
```

### Architectural Principles

The generated framework follows these principles:

* **Separation of concerns**
* **Domain-driven organization**
* **Reusable API clients**
* **Centralized authentication**
* **Environment-independent tests**
* **Strong TypeScript typing**
* **Maintainable test specifications**

---

# 🌍 Multi-Environment Execution

The same generated test suite can be executed against different environments using environment variables.

### Development

```env
BASE_URL=https://dev-api.example.com
```

### QA

```env
BASE_URL=https://qa-api.example.com
```

### Staging

```env
BASE_URL=https://staging-api.example.com
```

The test code does not need to change when switching environments.

Environment-specific credentials and configuration can be supplied through `.env` or environment variables.

---

# 🤝 Contributing

Contributions, bug reports, documentation improvements, and feature requests are welcome.

## Reporting Issues

When reporting an issue, please include:

* Description of the problem
* Node.js version
* Playwright version
* Postman Collection version
* Relevant collection structure
* Error messages or stack traces
* Steps to reproduce the issue

Before sharing a Postman collection, logs, screenshots, or stack traces, remove any credentials, tokens, API keys, cookies, or other sensitive information.

---

## Pull Requests

To contribute:

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/my-new-feature
```

3. Make your changes.
4. Add or update tests where applicable.
5. Run the generated Playwright tests.
6. Verify the converter output.
7. Commit your changes.

```bash
git commit -m "Add support for XYZ"
```

8. Push your branch.
9. Open a pull request with a clear description of the changes.

---

# 📄 License

Add the project's license information here.

For example:

```text
MIT License
```

If the project uses the MIT License, include the complete `LICENSE` file in the repository.

---

# 🎯 Project Goals

The primary goal of **Postman to Playwright Generator** is to reduce the manual effort required to migrate existing Postman API collections into maintainable Playwright API automation suites.

The project helps teams:

* ♻️ Reuse existing Postman API collections
* ⚡ Accelerate API automation development
* 🏗️ Generate reusable API client abstractions
* 📦 Organize APIs by business domain
* 🔐 Centralize authentication
* 🌍 Support multiple environments
* 🧪 Build maintainable automated API test suites

---

## ⭐ Why Postman → Playwright?

Many teams already have hundreds or thousands of API requests documented and validated in Postman.

Migrating those collections manually to an automation framework can require significant engineering effort.

This project provides a bridge between the two ecosystems:

```text
Existing Postman Assets
          │
          ▼
┌────────────────────────┐
│ Postman Collection v2.1│
└────────────┬───────────┘
             │
             ▼
     Postman → Playwright
          Generator
             │
             ▼
┌────────────────────────┐
│ Domain API Clients     │
│ TypeScript             │
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐
│ Playwright API Tests   │
└────────────────────────┘
```

The result is a structured Playwright API automation foundation that teams can further customize according to their application's architecture, authentication model, API conventions, and testing requirements.

---

**Built to accelerate the transition from Postman collections to scalable Playwright API automation.**
