import * as fs from 'fs';
import * as path from 'path';

function resolveDomain(folderOrName) {
  const lower = folderOrName.toLowerCase();
  if (lower.includes('auth') || lower.includes('login') || lower.includes('token')) return 'auth';
  if (lower.includes('user') || lower.includes('profile') || lower.includes('account')) return 'user';
  if (lower.includes('approval') || lower.includes('approve') || lower.includes('reject')) return 'approval';
  if (lower.includes('iam') || lower.includes('role') || lower.includes('permission') || lower.includes('policy')) return 'iam';
  return 'user';
}

function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9\s_]/g, '')
    .split(/[\s_]+/)
    .map((word, index) => 
      index === 0 
        ? word.toLowerCase() 
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
}

function extractEndpoints(items, currentDomain) {
  const endpoints = [];

  for (const item of items) {
    if (item.item && Array.isArray(item.item)) {
      const domain = resolveDomain(item.name);
      endpoints.push(...extractEndpoints(item.item, domain));
    } else if (item.request) {
      const domain = currentDomain || resolveDomain(item.name);
      const req = item.request;
      
      let rawUrl = '';
      let queryParams = {};
      
      if (typeof req.url === 'string') {
        rawUrl = req.url;
      } else if (req.url) {
        const pathSegments = req.url.path ? req.url.path.join('/') : '';
        rawUrl = '/' + pathSegments;
        if (req.url.query) {
          req.url.query.forEach(q => {
            if (q.key) queryParams[q.key] = q.value || '';
          });
        }
      }

      // Convert {{variable}} -> process.env.VARIABLE or :param
      const sanitizedPath = rawUrl.replace(/\{\{([^}]+)\}\}/g, ':$1');

      const headers = {};
      if (req.header) {
        req.header.forEach(h => {
          if (h.key && !h.key.startsWith('//')) {
            headers[h.key] = h.value;
          }
        });
      }

      let body = null;
      if (req.body && req.body.mode === 'raw' && req.body.raw) {
        try {
          body = JSON.parse(req.body.raw);
        } catch {
          body = req.body.raw;
        }
      }

      endpoints.push({
        domain,
        name: item.name,
        method: req.method ? req.method.toLowerCase() : 'get',
        path: sanitizedPath,
        headers,
        queryParams,
        body
      });
    }
  }

  return endpoints;
}

// 1. Generate Domain API Clients with process.env integration
function generateClientClass(domain, endpoints) {
  const className = domain.charAt(0).toUpperCase() + domain.slice(1) + 'Client';

  const methods = endpoints.map(ep => {
    const methodName = toCamelCase(ep.name || `${ep.method}_${ep.path}`);
    const hasBody = ['post', 'put', 'patch'].includes(ep.method) || ep.body !== null;
    
    const params = [];
    if (hasBody) params.push('data?: any');
    params.push('options: Record<string, any> = {}');

    const optionsObj = [];
    if (hasBody) optionsObj.push('data');
    if (Object.keys(ep.queryParams).length > 0) {
      optionsObj.push(`params: ${JSON.stringify(ep.queryParams, null, 6)}`);
    }
    if (Object.keys(ep.headers).length > 0) {
      optionsObj.push(`headers: ${JSON.stringify(ep.headers, null, 6)}`);
    }
    optionsObj.push('...options');

    const optionsStr = optionsObj.length > 0 
      ? `{\n      ${optionsObj.join(',\n      ')}\n    }` 
      : '{}';

    return `  async ${methodName}(${params.join(', ')}) {
    return await this.request.${ep.method}(\`${ep.path}\`, ${optionsStr});
  }`;
  }).join('\n\n');

  return `import { APIRequestContext } from '@playwright/test';

export class ${className} {
  constructor(private request: APIRequestContext) {}

${methods}
}
`;
}

// 2. Generate Spec Files leveraging Auth Fixture
function generateTestSpec(domain, endpoints) {
  const className = domain.charAt(0).toUpperCase() + domain.slice(1) + 'Client';

  const testCases = endpoints.map(ep => {
    const methodName = toCamelCase(ep.name || `${ep.method}_${ep.path}`);
    const hasBody = ['post', 'put', 'patch'].includes(ep.method) || ep.body !== null;
    const bodyArg = hasBody ? `${JSON.stringify(ep.body || {}, null, 6)}` : '';

    return `  test('${ep.name || ep.path} - ${ep.method.toUpperCase()}', async ({ authenticatedRequest }) => {
    const client = new ${className}(authenticatedRequest);
    const response = await client.${methodName}(${bodyArg});
    expect(response.ok()).toBeTruthy();
  });`;
  }).join('\n\n');

  return `import { test, expect } from '../fixtures/auth.fixture';
import { ${className} } from '../../api/${domain}.client';

test.describe('${domain.toUpperCase()} API Tests', () => {
${testCases}
});
`;
}

// 3. Generate Auth Fixture
function generateAuthFixture() {
  return `import { test as base, request, APIRequestContext } from '@playwright/test';
import { AuthClient } from '../../api/auth.client';

type AuthFixture = {
  authenticatedRequest: APIRequestContext;
  authToken: string;
};

let cachedToken: string | null = null;

export const test = base.extend<AuthFixture>({
  authToken: async ({}, use) => {
    if (!cachedToken) {
      const context = await request.newContext({
        baseURL: process.env.BASE_URL || 'https://api.example.com',
      });
      const authClient = new AuthClient(context);
      
      // Update payload fields according to your API contract
      const response = await authClient.login({
        username: process.env.API_USERNAME || 'admin',
        password: process.env.API_PASSWORD || 'password123',
      });

      const body = await response.json();
      cachedToken = body.token || body.accessToken || '';
      await context.dispose();
    }
    await use(cachedToken);
  },

  authenticatedRequest: async ({ authToken }, use) => {
    const authContext = await request.newContext({
      baseURL: process.env.BASE_URL || 'https://api.example.com',
      extraHTTPHeaders: {
        'Authorization': \`Bearer \${authToken}\`,
        'Content-Type': 'application/json',
      },
    });

    await use(authContext);
    await authContext.dispose();
  },
});

export { expect } from '@playwright/test';
`;
}

// 4. Generate playwright.config.ts
function generatePlaywrightConfig() {
  return `import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests/api',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'https://api.example.com',
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    trace: 'on-first-retry',
  },
});
`;
}

// 5. Generate .env.example
function generateEnvExample() {
  return `# Environment Configuration
BASE_URL=https://api.example.com
API_USERNAME=admin@example.com
API_PASSWORD=SecretPassword123!
`;
}

// Main Converter Runner
function runConverter(collectionPath) {
  if (!fs.existsSync(collectionPath)) {
    console.error(`\nError: collection.json not found at ${collectionPath}`);
    console.error(`Please place your exported Postman collection in ${process.cwd()} and name it 'collection.json'.\n`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(collectionPath, 'utf-8');
  const collection = JSON.parse(rawData);

  const endpoints = extractEndpoints(collection.item || []);

  const targetDomains = ['auth', 'user', 'approval', 'iam'];
  const grouped = { auth: [], user: [], approval: [], iam: [] };

  endpoints.forEach(ep => {
    if (grouped[ep.domain]) {
      grouped[ep.domain].push(ep);
    } else {
      grouped['user'].push(ep);
    }
  });

  const apiDir = path.join(process.cwd(), 'api');
  const testsDir = path.join(process.cwd(), 'tests', 'api');
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

  fs.mkdirSync(apiDir, { recursive: true });
  fs.mkdirSync(testsDir, { recursive: true });
  fs.mkdirSync(fixturesDir, { recursive: true });

  // Output Domain API Clients and Spec Files
  targetDomains.forEach(domain => {
    const domainEndpoints = grouped[domain];

    const clientCode = generateClientClass(domain, domainEndpoints);
    const clientPath = path.join(apiDir, `${domain}.client.ts`);
    fs.writeFileSync(clientPath, clientCode);
    console.log(`[Created] ${path.relative(process.cwd(), clientPath)}`);

    const specCode = generateTestSpec(domain, domainEndpoints);
    const specPath = path.join(testsDir, `${domain}.spec.ts`);
    fs.writeFileSync(specPath, specCode);
    console.log(`[Created] ${path.relative(process.cwd(), specPath)}`);
  });

  // Output Auth Fixture
  const fixturePath = path.join(fixturesDir, 'auth.fixture.ts');
  fs.writeFileSync(fixturePath, generateAuthFixture());
  console.log(`[Created] ${path.relative(process.cwd(), fixturePath)}`);

  // Output Playwright Config
  const configPath = path.join(process.cwd(), 'playwright.config.ts');
  fs.writeFileSync(configPath, generatePlaywrightConfig());
  console.log(`[Created] ${path.relative(process.cwd(), configPath)}`);

  // Output .env.example
  const envPath = path.join(process.cwd(), '.env.example');
  fs.writeFileSync(envPath, generateEnvExample());
  console.log(`[Created] ${path.relative(process.cwd(), envPath)}`);

  console.log('\nConversion completed successfully!');
}

runConverter(path.join(process.cwd(), 'collection.json'));