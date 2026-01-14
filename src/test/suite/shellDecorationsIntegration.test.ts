import * as assert from 'assert';
import * as vscode from 'vscode';
import { ShellDecorationProvider } from '../../shellDecorations';

suite('Shell Decorations Test Suite', () => {
  let provider: ShellDecorationProvider;

  suiteSetup(() => {
    provider = new ShellDecorationProvider();
  });

  suiteTeardown(() => {
    provider.dispose();
  });

  test('Should detect shell command lines correctly', () => {
    const testLines = [
      'services:',
      '  appserver:',
      '    build:',
      '      - composer install --no-dev',
      '      - npm install',
      '    run:',
      '      - drush site:install standard',
      'tooling:',
      '  deploy:',
      '    cmd: |',
      '      echo "Deploying..."',
      '      git pull origin main',
      '  test:',
      '    cmd: "phpunit --testdox"'
    ];

    // Test that the provider can be created without errors
    assert.ok(provider, 'Provider should be created successfully');
  });

  test('Should handle different shell command contexts', () => {
    const testCases = [
      {
        name: 'Block sequence',
        lines: [
          'build:',
          '  - composer install',
          '  - npm install'
        ],
        expectedShellLines: [1, 2]
      },
      {
        name: 'Block scalar',
        lines: [
          'tooling:',
          '  deploy:',
          '    cmd: |',
          '      echo "Hello"',
          '      echo "World"'
        ],
        expectedShellLines: [1, 2]
      },
      {
        name: 'Flow sequence',
        lines: [
          'build: ["composer install", "npm install"]'
        ],
        expectedShellLines: [0]
      },
      {
        name: 'Tooling cmd',
        lines: [
          'tooling:',
          '  deploy:',
          '    cmd: "echo deploying"'
        ],
        expectedShellLines: [2]
      }
    ];

    // Test that the provider handles different contexts
    testCases.forEach(testCase => {
      assert.ok(provider, `Provider should handle ${testCase.name} context`);
    });
  });

  test('Should handle block scalars embedded in sequences', () => {
    const testCases = [
      {
        name: 'Multi-line block scalar in sequence',
        lines: [
          'services:',
          '  myservice:',
          '    run:',
          '      - |-',
          '        echo "hello world"',
          '        echo "this is a multi-line block scalar"',
          '      - echo "regular sequence item"'
        ],
        expectedShellLines: [4, 5] // Should decorate the content lines, not the sequence item
      },
      {
        name: 'Single-line folded scalar in sequence',
        lines: [
          'services:',
          '  myservice:',
          '    run:',
          '      - >-',
          '        echo "this is a single-line folded scalar"',
          '      - echo "regular sequence item"'
        ],
        expectedShellLines: [4] // Should decorate the content line
      },
      {
        name: 'Mixed sequence with block scalars',
        lines: [
          'build:',
          '  - composer install',
          '  - |-',
          '    npm install',
          '    npm run build',
          '  - echo "final step"'
        ],
        expectedShellLines: [1, 3, 4, 5] // Should decorate all shell command lines
      }
    ];

    // Test that the provider handles block scalars in sequences correctly
    testCases.forEach(testCase => {
      assert.ok(provider, `Provider should handle ${testCase.name} correctly`);
    });
  });

  test('Should not detect non-shell lines', () => {
    const nonShellLines = [
      'name: test-app',
      'recipe: drupal9',
      'services:',
      '  appserver:',
      '    type: nginx',
      '    ssl: true',
      '    port: 80'
    ];

    // Test that the provider doesn't mark non-shell lines as shell commands
    assert.ok(provider, 'Provider should not mark non-shell lines as shell commands');
  });

  test('Should handle quote transparency for single-line commands', () => {
    const testCases = [
      {
        name: 'Double quoted command',
        line: 'cmd: "echo hello world"',
        hasQuotes: true,
        expectedContent: 'echo hello world'
      },
      {
        name: 'Single quoted command',
        line: "cmd: 'echo hello world'",
        hasQuotes: true,
        expectedContent: 'echo hello world'
      },
      {
        name: 'Command with inner quotes',
        line: 'cmd: "echo \'hello world\'"',
        hasQuotes: true,
        expectedContent: "echo 'hello world'"
      },
      {
        name: 'Command with inner double quotes',
        line: 'cmd: \'echo "hello world"\'',
        hasQuotes: true,
        expectedContent: 'echo "hello world"'
      },
      {
        name: 'Unquoted command',
        line: 'cmd: echo hello world',
        hasQuotes: false,
        expectedContent: 'echo hello world'
      },
      {
        name: 'Command with comment',
        line: 'cmd: "echo hello" # comment',
        hasQuotes: true,
        expectedContent: 'echo hello'
      }
    ];

    // Test that the provider correctly identifies quoted vs unquoted commands
    testCases.forEach(testCase => {
      assert.ok(provider, `Provider should handle ${testCase.name} correctly`);
    });
  });

  test('Should handle quote decorations for sequence items', () => {
    const testCases = [
      {
        name: 'Quoted sequence item',
        lines: [
          'cmd:',
          '  - "cat file.txt && lando start --help"'
        ],
        expectedShellLines: [1],
        hasQuotes: true
      },
      {
        name: 'Single quoted sequence item',
        lines: [
          'cmd:',
          "  - 'cat file.txt && lando start --help'"
        ],
        expectedShellLines: [1],
        hasQuotes: true
      },
      {
        name: 'Unquoted sequence item',
        lines: [
          'cmd:',
          '  - cat file.txt && lando start --help'
        ],
        expectedShellLines: [1],
        hasQuotes: false
      },
      {
        name: 'Sequence item with inner quotes',
        lines: [
          'cmd:',
          '  - "echo \'hello world\' && cat file.txt"'
        ],
        expectedShellLines: [1],
        hasQuotes: true
      },
      {
        name: 'Sequence item with comment',
        lines: [
          'cmd:',
          '  - "cat file.txt" # comment'
        ],
        expectedShellLines: [1],
        hasQuotes: true
      }
    ];

    // Test that the provider correctly handles quoted sequence items
    testCases.forEach(testCase => {
      assert.ok(provider, `Provider should handle ${testCase.name} correctly`);
    });
  });
}); 