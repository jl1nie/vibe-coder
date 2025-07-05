#!/usr/bin/env node

/**
 * 📚 Comprehensive Documentation Validation System
 * 
 * コードとドキュメントの整合性を自動検証し、
 * 陳腐化を防ぐ包括的なシステム
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.projectRoot = process.cwd();
    this.packageJson = this.loadPackageJson();
    this.workspaceConfig = this.loadWorkspaceConfig();
  }

  loadPackageJson() {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    } catch (error) {
      this.addError('Failed to load package.json', error.message);
      return {};
    }
  }

  loadWorkspaceConfig() {
    try {
      const yamlContent = fs.readFileSync(path.join(this.projectRoot, 'pnpm-workspace.yaml'), 'utf8');
      return yamlContent;
    } catch (error) {
      this.addError('Failed to load pnpm-workspace.yaml', error.message);
      return '';
    }
  }

  addError(message, detail = '') {
    this.errors.push({ message, detail, type: 'error' });
    console.error(`❌ ERROR: ${message}${detail ? `: ${detail}` : ''}`);
  }

  addWarning(message, detail = '') {
    this.warnings.push({ message, detail, type: 'warning' });
    console.warn(`⚠️  WARNING: ${message}${detail ? `: ${detail}` : ''}`);
  }

  addInfo(message) {
    console.log(`ℹ️  INFO: ${message}`);
  }

  // === 1. Package Scripts と Documentation の整合性チェック ===
  validatePackageScripts() {
    console.log('🔍 Validating package scripts consistency...');
    
    const readmeContent = this.readFile('README.md');
    if (!readmeContent) return;

    // package.jsonのスクリプトがREADMEで文書化されているかチェック
    const scripts = this.packageJson.scripts || {};
    const importantScripts = [
      'vibe-coder', 'test', 'test:e2e', 'test:ux', 'test:local',
      'lint', 'format', 'typecheck', 'build', 'feedback',
      'docker:build', 'docker:push'
    ];

    importantScripts.forEach(script => {
      if (scripts[script]) {
        const scriptPattern = new RegExp(`npm run ${script}|pnpm ${script}|pnpm run ${script}`, 'g');
        if (!scriptPattern.test(readmeContent)) {
          this.addWarning(`Script "${script}" is not documented in README.md`);
        }
      } else {
        this.addError(`Important script "${script}" is missing from package.json`);
      }
    });

    // READMEで言及されているスクリプトが実際に存在するかチェック
    const npmRunMatches = readmeContent.match(/npm run (\w[\w:-]*)/g) || [];
    const pnpmMatches = readmeContent.match(/pnpm (?:run )?(\w[\w:-]*)/g) || [];
    
    [...npmRunMatches, ...pnpmMatches].forEach(match => {
      const script = match.replace(/npm run |pnpm run |pnpm /, '');
      if (script && !scripts[script] && !['install', 'ci', 'start', 'dev'].includes(script)) {
        this.addError(`Script "${script}" mentioned in README.md does not exist in package.json`);
      }
    });

    this.addInfo(`Validated ${Object.keys(scripts).length} package scripts`);
  }

  // === 2. 環境変数と設定の整合性チェック ===
  validateEnvironmentVariables() {
    console.log('🔍 Validating environment variables consistency...');
    
    const envExampleContent = this.readFile('.env.example');
    const readmeContent = this.readFile('README.md');
    const deploymentManualContent = this.readFile('DEPLOYMENT_MANUAL.md');
    
    if (!envExampleContent) {
      this.addError('.env.example file not found');
      return;
    }

    // .env.exampleから環境変数を抽出
    const envVars = envExampleContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.split('=')[0].trim())
      .filter(Boolean);

    // READMEとDEPLOYMENT_MANUALで全ての重要な環境変数が言及されているかチェック
    const criticalEnvVars = ['CLAUDE_API_KEY', 'GITHUB_TOKEN', 'VERCEL_TOKEN'];
    criticalEnvVars.forEach(envVar => {
      if (!envVars.includes(envVar)) {
        this.addError(`Critical environment variable ${envVar} not found in .env.example`);
      }
      
      if (readmeContent && !readmeContent.includes(envVar)) {
        this.addWarning(`Environment variable ${envVar} not documented in README.md`);
      }
      
      if (deploymentManualContent && !deploymentManualContent.includes(envVar)) {
        this.addWarning(`Environment variable ${envVar} not documented in DEPLOYMENT_MANUAL.md`);
      }
    });

    this.addInfo(`Validated ${envVars.length} environment variables`);
  }

  // === 3. Dependencies バージョンの整合性チェック ===
  validateDependencyVersions() {
    console.log('🔍 Validating dependency versions consistency...');
    
    // Catalog定義されたバージョンを抽出
    const catalogVersions = this.extractCatalogVersions();
    
    // 各ワークスペースのpackage.jsonを確認
    const workspaces = this.findWorkspaces();
    
    workspaces.forEach(workspace => {
      const workspacePackageJson = this.loadWorkspacePackageJson(workspace);
      if (!workspacePackageJson) return;

      const allDeps = {
        ...workspacePackageJson.dependencies,
        ...workspacePackageJson.devDependencies
      };

      Object.entries(allDeps).forEach(([dep, version]) => {
        if (version === 'catalog:') {
          if (!catalogVersions[dep]) {
            this.addError(`Dependency "${dep}" uses catalog: but not defined in pnpm-workspace.yaml catalog`, workspace);
          }
        } else if (catalogVersions[dep] && version !== 'workspace:*') {
          this.addWarning(`Dependency "${dep}" should use catalog: instead of "${version}"`, workspace);
        }
      });
    });

    this.addInfo(`Validated dependency versions across ${workspaces.length} workspaces`);
  }

  // === 4. ドキュメント間の相互参照チェック ===
  validateCrossReferences() {
    console.log('🔍 Validating cross-references between documents...');
    
    const docs = [
      'README.md', 'DEPLOYMENT_MANUAL.md', 'SECURITY.md', 
      'CONFIG_DOCUMENTATION.md', 'USER_TEST_GUIDE.md'
    ];

    docs.forEach(doc => {
      const content = this.readFile(doc);
      if (!content) return;

      // 他のドキュメントへの参照をチェック
      const references = content.match(/\[.*?\]\(\.\/.*?\.md\)/g) || [];
      references.forEach(ref => {
        const filePath = ref.match(/\(\.\/(.+?)\)/)?.[1];
        if (filePath && !fs.existsSync(path.join(this.projectRoot, filePath))) {
          this.addError(`Broken reference in ${doc}: ${filePath} does not exist`);
        }
      });

      // セクション参照の整合性チェック
      const sectionRefs = content.match(/\[.*?\]\(#.*?\)/g) || [];
      const headers = content.match(/^#{1,6}\s+(.+)$/gm) || [];
      const headerIds = headers.map(h => 
        h.replace(/^#{1,6}\s+/, '').toLowerCase()
          .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      );

      sectionRefs.forEach(ref => {
        const sectionId = ref.match(/\(#(.+?)\)/)?.[1];
        if (sectionId && !headerIds.includes(sectionId)) {
          this.addWarning(`Potentially broken section reference in ${doc}: #${sectionId}`);
        }
      });
    });

    this.addInfo(`Validated cross-references across ${docs.length} documents`);
  }

  // === 5. API Documentation と Code の整合性チェック ===
  validateApiDocumentation() {
    console.log('🔍 Validating API documentation consistency...');
    
    // APIエンドポイントの実装をスキャン
    const apiFiles = this.findFiles('packages/*/src/routes/*.ts');
    const endpoints = [];

    apiFiles.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      // Express.jsのルート定義を抽出
      const routes = content.match(/router\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g) || [];
      routes.forEach(route => {
        const match = route.match(/router\.(\w+)\(['"`]([^'"`]+)['"`]/);
        if (match) {
          endpoints.push({ method: match[1].toUpperCase(), path: match[2], file });
        }
      });
    });

    // README.mdやデプロイメントマニュアルでAPIが文書化されているかチェック
    const readmeContent = this.readFile('README.md');
    const deploymentContent = this.readFile('DEPLOYMENT_MANUAL.md');

    endpoints.forEach(endpoint => {
      const pattern = new RegExp(`${endpoint.path.replace(/:/g, '\\:')}`, 'g');
      if (readmeContent && !pattern.test(readmeContent)) {
        this.addWarning(`API endpoint ${endpoint.method} ${endpoint.path} not documented in README.md`);
      }
    });

    this.addInfo(`Validated ${endpoints.length} API endpoints`);
  }

  // === 6. Configuration Examples の妥当性チェック ===
  validateConfigurationExamples() {
    console.log('🔍 Validating configuration examples...');
    
    const readmeContent = this.readFile('README.md');
    if (!readmeContent) return;

    // JSON設定例を抽出して検証
    const jsonBlocks = readmeContent.match(/```json\n([\s\S]*?)\n```/g) || [];
    
    jsonBlocks.forEach((block, index) => {
      const jsonContent = block.replace(/```json\n|\n```/g, '');
      try {
        const parsed = JSON.parse(jsonContent);
        
        // プレイリスト設定の検証
        if (parsed.schema === 'vibe-coder-playlist-v1') {
          this.validatePlaylistSchema(parsed, `JSON block ${index + 1} in README.md`);
        }
      } catch (error) {
        this.addError(`Invalid JSON in README.md block ${index + 1}`, error.message);
      }
    });

    // YAML設定例の検証（もしあれば）
    const yamlBlocks = readmeContent.match(/```ya?ml\n([\s\S]*?)\n```/g) || [];
    yamlBlocks.forEach((block, index) => {
      // 基本的な構文チェック（簡易）
      const yamlContent = block.replace(/```ya?ml\n|\n```/g, '');
      if (yamlContent.includes('\t')) {
        this.addWarning(`YAML block ${index + 1} in README.md contains tabs (should use spaces)`);
      }
    });

    this.addInfo(`Validated ${jsonBlocks.length} JSON and ${yamlBlocks.length} YAML configuration examples`);
  }

  // === 7. Version Information の整合性チェック ===
  validateVersionInformation() {
    console.log('🔍 Validating version information consistency...');
    
    const packageVersion = this.packageJson.version;
    const readmeContent = this.readFile('README.md');
    
    // READMEでバージョンが古い形式で言及されていないかチェック
    if (readmeContent) {
      const versionMentions = readmeContent.match(/v?\d+\.\d+\.\d+/g) || [];
      versionMentions.forEach(version => {
        if (version !== packageVersion && version !== `v${packageVersion}`) {
          this.addWarning(`Potentially outdated version "${version}" mentioned in README.md (current: ${packageVersion})`);
        }
      });
    }

    // Node.jsバージョン要件の整合性チェック
    const nodeVersion = this.packageJson.engines?.node;
    if (nodeVersion && readmeContent) {
      if (!readmeContent.includes(nodeVersion)) {
        this.addWarning(`Node.js version requirement "${nodeVersion}" not reflected in README.md`);
      }
    }

    this.addInfo(`Validated version information (current: ${packageVersion})`);
  }

  // === Helper Methods ===
  readFile(filePath) {
    try {
      return fs.readFileSync(path.join(this.projectRoot, filePath), 'utf8');
    } catch (error) {
      return null;
    }
  }

  findFiles(pattern) {
    try {
      const command = `find . -path "${pattern}" -type f 2>/dev/null`;
      const output = execSync(command, { encoding: 'utf8', cwd: this.projectRoot });
      return output.trim().split('\n').filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  findWorkspaces() {
    try {
      const output = execSync('pnpm list -r --depth -1 --parseable', { 
        encoding: 'utf8', 
        cwd: this.projectRoot 
      });
      return output.trim().split('\n').filter(line => line !== this.projectRoot);
    } catch (error) {
      // Fallback: workspace定義から推測
      const packages = ['packages/host', 'packages/shared', 'packages/signaling', 'apps/web'];
      return packages.filter(pkg => fs.existsSync(path.join(this.projectRoot, pkg, 'package.json')));
    }
  }

  loadWorkspacePackageJson(workspace) {
    try {
      const packagePath = workspace.includes('package.json') ? workspace : path.join(workspace, 'package.json');
      return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (error) {
      return null;
    }
  }

  extractCatalogVersions() {
    const catalog = {};
    const lines = this.workspaceConfig.split('\n');
    let inCatalog = false;

    lines.forEach(line => {
      if (line.trim() === 'catalog:') {
        inCatalog = true;
        return;
      }
      
      if (inCatalog && line.startsWith('  ') && line.includes(':')) {
        const match = line.match(/^\s+([^:]+):\s*(.+)$/);
        if (match) {
          const [, name, version] = match;
          catalog[name.replace(/'/g, '')] = version.trim();
        }
      } else if (inCatalog && !line.startsWith(' ')) {
        inCatalog = false;
      }
    });

    return catalog;
  }

  validatePlaylistSchema(playlist, context) {
    const requiredFields = ['schema', 'metadata', 'commands'];
    requiredFields.forEach(field => {
      if (!playlist[field]) {
        this.addError(`Missing required field "${field}" in playlist schema`, context);
      }
    });

    if (playlist.metadata) {
      const metadataFields = ['name', 'author'];
      metadataFields.forEach(field => {
        if (!playlist.metadata[field]) {
          this.addError(`Missing required metadata field "${field}" in playlist`, context);
        }
      });
    }

    if (Array.isArray(playlist.commands)) {
      playlist.commands.forEach((command, index) => {
        const cmdFields = ['icon', 'label', 'command'];
        cmdFields.forEach(field => {
          if (!command[field]) {
            this.addError(`Missing required field "${field}" in command ${index + 1}`, context);
          }
        });

        // Claude Codeコマンドの形式チェック
        if (command.command && command.command.includes('claude-code ')) {
          if (command.command.match(/claude-code\s+["'].*["']/)) {
            this.addError(`Incorrect Claude Code command format in command ${index + 1}: should not use quotes around prompt`, context);
          }
        }
      });
    }
  }

  // === Main Validation Runner ===
  async validateAll() {
    console.log('📚 Starting comprehensive documentation validation...\n');

    this.validatePackageScripts();
    this.validateEnvironmentVariables();
    this.validateDependencyVersions();
    this.validateCrossReferences();
    this.validateApiDocumentation();
    this.validateConfigurationExamples();
    this.validateVersionInformation();

    // === Report Results ===
    console.log('\n📊 Validation Results:');
    console.log(`✅ Completed: ${7} validation categories`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings Details:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.message}${warning.detail ? `: ${warning.detail}` : ''}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors Details:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}${error.detail ? `: ${error.detail}` : ''}`);
      });
    }

    // Generate JSON report for CI
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        categoriesValidated: 7
      },
      errors: this.errors,
      warnings: this.warnings
    };

    fs.writeFileSync(
      path.join(this.projectRoot, 'docs-validation-report.json'), 
      JSON.stringify(report, null, 2)
    );

    console.log('\n📄 Report saved to docs-validation-report.json');

    // Exit with appropriate code
    if (this.errors.length > 0) {
      console.log('\n💥 Validation failed due to errors!');
      process.exit(1);
    } else if (this.warnings.length > 0) {
      console.log('\n⚠️  Validation completed with warnings.');
      process.exit(0);
    } else {
      console.log('\n🎉 All documentation validation checks passed!');
      process.exit(0);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DocumentationValidator();
  validator.validateAll().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

module.exports = DocumentationValidator;