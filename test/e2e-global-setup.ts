/**
 * E2E Global Setup
 * Playwright global setup for E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E global setup...');

  // === Environment Setup ===
  process.env.NODE_ENV = 'test';
  process.env.CI = process.env.CI || 'false';
  process.env.E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  
  // === Test Data Preparation ===
  await prepareTestData();
  
  // === Mock Services Setup ===
  await setupMockServices();
  
  // === Browser Storage Setup ===
  await setupBrowserStorage();
  
  // === Health Checks ===
  await performHealthChecks();
  
  console.log('✅ E2E global setup completed');
}

/**
 * Prepare test data and fixtures
 */
async function prepareTestData(): Promise<void> {
  console.log('📁 Preparing test data...');
  
  const testDataDir = path.join(__dirname, '../e2e/fixtures');
  
  // Create test data directory if it doesn't exist
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Create test playlists
  const testPlaylists = [
    {
      schema: 'vibe-coder-playlist-v1',
      metadata: {
        name: 'Frontend Vibes',
        description: 'Essential frontend development commands',
        author: 'ui_ninja',
        version: '1.0.0',
        tags: ['frontend', 'react', 'ui'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
      commands: [
        {
          icon: '🎨',
          label: 'Polish',
          command: 'claude-code polish the UI and improve user experience',
          description: 'Enhance visual design and UX',
          category: 'ui',
        },
        {
          icon: '📱',
          label: 'Responsive',
          command: 'claude-code make the component responsive',
          description: 'Add responsive design',
          category: 'ui',
        },
        {
          icon: '⚡',
          label: 'Optimize',
          command: 'claude-code optimize component performance',
          description: 'Improve performance',
          category: 'performance',
        },
      ],
      stats: {
        downloads: 1542,
        ratings: { average: 4.8, count: 89 },
      },
    },
    {
      schema: 'vibe-coder-playlist-v1',
      metadata: {
        name: 'Backend Essentials',
        description: 'Core backend development commands',
        author: 'api_master',
        version: '2.1.0',
        tags: ['backend', 'api', 'database'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
      commands: [
        {
          icon: '🔐',
          label: 'Auth',
          command: 'claude-code implement authentication and authorization',
          description: 'Add auth system',
          category: 'security',
        },
        {
          icon: '💾',
          label: 'Database',
          command: 'claude-code design and implement database schema',
          description: 'Setup database',
          category: 'database',
        },
        {
          icon: '🚀',
          label: 'Deploy',
          command: 'claude-code prepare application for deployment',
          description: 'Deployment setup',
          category: 'devops',
        },
      ],
      stats: {
        downloads: 987,
        ratings: { average: 4.6, count: 54 },
      },
    },
  ];
  
  // Write test playlists
  for (const [index, playlist] of testPlaylists.entries()) {
    const filename = path.join(testDataDir, `test-playlist-${index + 1}.json`);
    fs.writeFileSync(filename, JSON.stringify(playlist, null, 2));
  }
  
  // Create test workspace files
  const testWorkspaceDir = path.join(testDataDir, 'test-workspace');
  if (!fs.existsSync(testWorkspaceDir)) {
    fs.mkdirSync(testWorkspaceDir, { recursive: true });
  }
  
  // Sample project files
  const sampleFiles = {
    'package.json': {
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        test: 'vitest',
      },
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    },
    'src/App.tsx': `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Test Application</h1>
      <p>This is a test application for E2E testing.</p>
    </div>
  );
}

export default App;`,
    'src/components/Button.tsx': `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary'
}) => {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};`,
  };
  
  for (const [filename, content] of Object.entries(sampleFiles)) {
    const filePath = path.join(testWorkspaceDir, filename);
    const fileDir = path.dirname(filePath);
    
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    fs.writeFileSync(filePath, fileContent);
  }
  
  console.log('✅ Test data prepared');
}

/**
 * Setup mock services for testing
 */
async function setupMockServices(): Promise<void> {
  console.log('🎭 Setting up mock services...');
  
  // Create mock signaling server script
  const mockSignalingServer = `
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock signal data storage
const signals = new Map();

// Mock playlist data
const mockPlaylists = ${JSON.stringify([
  {
    id: 'frontend-vibes',
    name: 'Frontend Vibes',
    author: 'ui_ninja',
    description: 'Essential frontend development commands',
    commands: 12,
    downloads: 1542,
    rating: 4.8,
    gistId: 'mock-gist-frontend',
  },
  {
    id: 'backend-essentials',
    name: 'Backend Essentials',
    author: 'api_master',
    description: 'Core backend development commands',
    commands: 8,
    downloads: 987,
    rating: 4.6,
    gistId: 'mock-gist-backend',
  },
], null, 2)};

// Signal endpoints
app.post('/api/signal', (req, res) => {
  const { type, serverId, data } = req.body;
  
  if (!type || !serverId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const key = \`\${type}:\${serverId}\`;
  signals.set(key, { data, timestamp: Date.now() });
  
  console.log(\`Stored signal: \${key}\`);
  res.json({ success: true });
});

app.get('/api/signal', (req, res) => {
  const { type, serverId } = req.query;
  const key = \`\${type}:\${serverId}\`;
  
  const signal = signals.get(key);
  if (signal && Date.now() - signal.timestamp < 60000) { // 1 minute TTL
    res.json({ data: signal.data });
  } else {
    res.json({ data: null });
  }
});

// Playlist endpoints
app.get('/api/playlists', (req, res) => {
  const { search } = req.query;
  let result = mockPlaylists;
  
  if (search) {
    result = mockPlaylists.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({ playlists: result });
});

app.get('/api/playlists/:id', (req, res) => {
  const playlist = mockPlaylists.find(p => p.id === req.params.id);
  if (playlist) {
    res.json(playlist);
  } else {
    res.status(404).json({ error: 'Playlist not found' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 8081;
app.listen(port, () => {
  console.log(\`Mock signaling server running on port \${port}\`);
});

// Cleanup old signals every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, signal] of signals.entries()) {
    if (now - signal.timestamp > 60000) {
      signals.delete(key);
    }
  }
}, 60000);
`;
  
  const mockServerPath = path.join(__dirname, '../test/mock-signaling-server.js');
  fs.writeFileSync(mockServerPath, mockSignalingServer);
  
  console.log('✅ Mock services setup completed');
}

/**
 * Setup browser storage with test data
 */
async function setupBrowserStorage(): Promise<void> {
  console.log('🏪 Setting up browser storage...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Setup localStorage with test data
  await page.addInitScript(() => {
    // Mock user preferences
    localStorage.setItem('vibe-coder-preferences', JSON.stringify({
      theme: 'dark',
      language: 'en',
      terminalFont: 'monospace',
      terminalFontSize: 14,
      voiceLanguage: 'en-US',
      soundEffects: true,
      hapticFeedback: true,
    }));
    
    // Mock connection history
    localStorage.setItem('vibe-coder-connections', JSON.stringify([
      {
        serverId: 'TEST-SERVER-123',
        lastConnected: Date.now() - 3600000, // 1 hour ago
        nickname: 'Test Server',
      },
      {
        serverId: 'DEV-SERVER-456',
        lastConnected: Date.now() - 86400000, // 1 day ago
        nickname: 'Development Server',
      },
    ]));
    
    // Mock saved playlists
    localStorage.setItem('vibe-coder-playlists', JSON.stringify([
      {
        id: 'default',
        name: 'Default Commands',
        commands: [
          {
            icon: '🔐',
            label: 'Login',
            command: 'claude-code add authentication to the app',
            description: 'Add login functionality',
            category: 'auth',
          },
          {
            icon: '🐛',
            label: 'Fix Bug',
            command: 'claude-code fix the reported bug',
            description: 'Debug and fix issues',
            category: 'debug',
          },
          {
            icon: '🎨',
            label: 'Style',
            command: 'claude-code improve the UI styling',
            description: 'Enhance visual design',
            category: 'ui',
          },
        ],
      },
    ]));
    
    // Mock command history
    localStorage.setItem('vibe-coder-command-history', JSON.stringify([
      'claude-code create a user profile component',
      'claude-code add error handling to the API',
      'claude-code write unit tests for the service',
      'claude-code optimize the database queries',
      'claude-code implement responsive design',
    ]));
    
    // Set test mode flag
    window.TEST_MODE = true;
    window.MOCK_WEBRTC = true;
    window.MOCK_SPEECH_RECOGNITION = true;
  });
  
  await browser.close();
  
  console.log('✅ Browser storage setup completed');
}

/**
 * Perform health checks on required services
 */
async function performHealthChecks(): Promise<void> {
  console.log('🏥 Performing health checks...');
  
  const healthChecks = [
    {
      name: 'PWA Development Server',
      url: 'http://localhost:3000',
      timeout: 30000,
    },
    {
      name: 'Host Server',
      url: 'http://localhost:8080/health',
      timeout: 30000,
    },
    {
      name: 'Mock Signaling Server',
      url: 'http://localhost:8081/health',
      timeout: 10000,
    },
  ];
  
  for (const check of healthChecks) {
    try {
      console.log(`Checking ${check.name}...`);
      
      // Wait for service to be ready
      let attempts = 0;
      const maxAttempts = Math.floor(check.timeout / 1000);
      
      while (attempts < maxAttempts) {
        try {
          const response = await fetch(check.url);
          if (response.ok) {
            console.log(`✅ ${check.name} is ready`);
            break;
          }
        } catch (error) {
          // Service not ready yet
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (attempts === maxAttempts) {
          throw new Error(`${check.name} did not become ready within ${check.timeout}ms`);
        }
      }
    } catch (error) {
      console.error(`❌ Health check failed for ${check.name}:`, error);
      
      // In CI, fail fast. In local development, warn but continue
      if (process.env.CI === 'true') {
        throw error;
      } else {
        console.warn(`⚠️ Continuing without ${check.name} - some tests may fail`);
      }
    }
  }
  
  console.log('✅ Health checks completed');
}

/**
 * Create test certificates for HTTPS (if needed)
 */
async function setupTestCertificates(): Promise<void> {
  console.log('🔒 Setting up test certificates...');
  
  const certsDir = path.join(__dirname, '../certs');
  const keyPath = path.join(certsDir, 'test-key.pem');
  const certPath = path.join(certsDir, 'test-cert.pem');
  
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }
  
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    try {
      // Generate self-signed certificate for testing
      execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 1 -nodes -subj "/CN=localhost"`, {
        stdio: 'ignore',
      });
      
      console.log('✅ Test certificates generated');
    } catch (error) {
      console.warn('⚠️ Could not generate test certificates - HTTPS tests may fail');
      console.warn('Install OpenSSL to enable HTTPS testing');
    }
  } else {
    console.log('✅ Test certificates already exist');
  }
}

/**
 * Setup test database (if needed)
 */
async function setupTestDatabase(): Promise<void> {
  console.log('🗄️ Setting up test database...');
  
  // For now, we're using in-memory storage for tests
  // This function is a placeholder for future database setup
  
  console.log('✅ Test database setup completed (in-memory)');
}

export default globalSetup;