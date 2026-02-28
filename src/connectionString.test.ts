/**
 * Unit tests for the Connection String Generator Module
 * 
 * These tests verify that connection strings are generated correctly for
 * various database types supported by Lando.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
  extractDatabaseType,
  getProtocolForDatabaseType,
  isSupportedDatabaseType,
  encodePassword,
  encodeConnectionComponent,
  buildConnectionUrl,
  generateConnectionStrings,
  ConnectionStringInput,
} from './connectionString';

suite('Connection String Generator', () => {
  suite('extractDatabaseType', () => {
    test('should extract base type from versioned service type', () => {
      assert.strictEqual(extractDatabaseType('mysql:8.0'), 'mysql');
      assert.strictEqual(extractDatabaseType('postgres:14'), 'postgres');
      assert.strictEqual(extractDatabaseType('mariadb:10.6'), 'mariadb');
      assert.strictEqual(extractDatabaseType('mongo:4.4'), 'mongo');
    });

    test('should return base type when no version is specified', () => {
      assert.strictEqual(extractDatabaseType('mysql'), 'mysql');
      assert.strictEqual(extractDatabaseType('postgres'), 'postgres');
      assert.strictEqual(extractDatabaseType('mariadb'), 'mariadb');
    });

    test('should handle uppercase types', () => {
      assert.strictEqual(extractDatabaseType('MySQL:8.0'), 'mysql');
      assert.strictEqual(extractDatabaseType('POSTGRES'), 'postgres');
    });

    test('should return undefined for undefined input', () => {
      assert.strictEqual(extractDatabaseType(undefined), undefined);
    });

    test('should return undefined for empty string', () => {
      assert.strictEqual(extractDatabaseType(''), undefined);
    });
  });

  suite('getProtocolForDatabaseType', () => {
    test('should return mysql protocol for MySQL types', () => {
      assert.strictEqual(getProtocolForDatabaseType('mysql'), 'mysql');
      assert.strictEqual(getProtocolForDatabaseType('mariadb'), 'mysql');
    });

    test('should return postgresql protocol for PostgreSQL types', () => {
      assert.strictEqual(getProtocolForDatabaseType('postgres'), 'postgresql');
      assert.strictEqual(getProtocolForDatabaseType('postgresql'), 'postgresql');
    });

    test('should return mongodb protocol for MongoDB types', () => {
      assert.strictEqual(getProtocolForDatabaseType('mongo'), 'mongodb');
      assert.strictEqual(getProtocolForDatabaseType('mongodb'), 'mongodb');
    });

    test('should return undefined for unsupported types', () => {
      assert.strictEqual(getProtocolForDatabaseType('redis'), undefined);
      assert.strictEqual(getProtocolForDatabaseType('memcached'), undefined);
      assert.strictEqual(getProtocolForDatabaseType('php'), undefined);
    });

    test('should return undefined for undefined input', () => {
      assert.strictEqual(getProtocolForDatabaseType(undefined), undefined);
    });
  });

  suite('isSupportedDatabaseType', () => {
    test('should return true for supported database types', () => {
      assert.strictEqual(isSupportedDatabaseType('mysql:8.0'), true);
      assert.strictEqual(isSupportedDatabaseType('postgres:14'), true);
      assert.strictEqual(isSupportedDatabaseType('mariadb'), true);
      assert.strictEqual(isSupportedDatabaseType('mongo:4.4'), true);
    });

    test('should return false for unsupported types', () => {
      assert.strictEqual(isSupportedDatabaseType('php:8.2'), false);
      assert.strictEqual(isSupportedDatabaseType('nginx'), false);
      assert.strictEqual(isSupportedDatabaseType('redis'), false);
    });

    test('should return false for undefined input', () => {
      assert.strictEqual(isSupportedDatabaseType(undefined), false);
    });
  });

  suite('encodeConnectionComponent', () => {
    test('should encode special characters', () => {
      assert.strictEqual(encodeConnectionComponent('value@special'), 'value%40special');
      assert.strictEqual(encodeConnectionComponent('value:special'), 'value%3Aspecial');
      assert.strictEqual(encodeConnectionComponent('value/special'), 'value%2Fspecial');
      assert.strictEqual(encodeConnectionComponent('value?special'), 'value%3Fspecial');
      assert.strictEqual(encodeConnectionComponent('value#special'), 'value%23special');
    });

    test('should not encode safe characters', () => {
      assert.strictEqual(encodeConnectionComponent('simplevalue123'), 'simplevalue123');
      assert.strictEqual(encodeConnectionComponent('MyValue'), 'MyValue');
    });

    test('should handle empty string', () => {
      assert.strictEqual(encodeConnectionComponent(''), '');
    });
  });

  suite('encodePassword (deprecated)', () => {
    test('should encode special characters in passwords', () => {
      assert.strictEqual(encodePassword('pass@word'), 'pass%40word');
      assert.strictEqual(encodePassword('pass:word'), 'pass%3Aword');
      assert.strictEqual(encodePassword('pass/word'), 'pass%2Fword');
      assert.strictEqual(encodePassword('pass?word'), 'pass%3Fword');
      assert.strictEqual(encodePassword('pass#word'), 'pass%23word');
    });

    test('should not encode safe characters', () => {
      assert.strictEqual(encodePassword('password123'), 'password123');
      assert.strictEqual(encodePassword('MyP4ssw0rd'), 'MyP4ssw0rd');
    });

    test('should handle empty password', () => {
      assert.strictEqual(encodePassword(''), '');
    });
  });

  suite('buildConnectionUrl', () => {
    test('should build a MySQL connection URL', () => {
      const url = buildConnectionUrl('mysql', 'root', 'password', 'localhost', '3306', 'mydb');
      assert.strictEqual(url, 'mysql://root:password@localhost:3306/mydb');
    });

    test('should build a PostgreSQL connection URL', () => {
      const url = buildConnectionUrl('postgresql', 'postgres', 'secret', '127.0.0.1', '5432', 'testdb');
      assert.strictEqual(url, 'postgresql://postgres:secret@127.0.0.1:5432/testdb');
    });

    test('should URL-encode passwords with special characters', () => {
      const url = buildConnectionUrl('mysql', 'user', 'p@ss:word', 'localhost', '3306', 'db');
      assert.strictEqual(url, 'mysql://user:p%40ss%3Aword@localhost:3306/db');
    });

    test('should URL-encode usernames with special characters', () => {
      const url = buildConnectionUrl('mysql', 'user@domain', 'password', 'localhost', '3306', 'db');
      assert.strictEqual(url, 'mysql://user%40domain:password@localhost:3306/db');
    });

    test('should URL-encode database names with special characters', () => {
      const url = buildConnectionUrl('mysql', 'user', 'password', 'localhost', '3306', 'my/db');
      assert.strictEqual(url, 'mysql://user:password@localhost:3306/my%2Fdb');
    });

    test('should URL-encode all components with special characters', () => {
      const url = buildConnectionUrl('mysql', 'user@org', 'p@ss:word', 'localhost', '3306', 'db/test');
      assert.strictEqual(url, 'mysql://user%40org:p%40ss%3Aword@localhost:3306/db%2Ftest');
    });
  });

  suite('generateConnectionStrings', () => {
    test('should generate connection strings for MySQL service with full info', () => {
      const input: ConnectionStringInput = {
        serviceName: 'database',
        serviceType: 'mysql:8.0',
        creds: {
          user: 'lamp',
          password: 'lamp',
          database: 'lamp',
        },
        externalConnection: {
          host: '127.0.0.1',
          port: '32769',
        },
        internalConnection: {
          host: 'database',
          port: '3306',
        },
      };

      const results = generateConnectionStrings(input);

      assert.strictEqual(results.length, 2);

      // Check external connection string
      const external = results.find(r => r.type === 'external');
      assert.ok(external);
      assert.strictEqual(external.connectionString, 'mysql://lamp:lamp@127.0.0.1:32769/lamp');
      assert.strictEqual(external.protocol, 'mysql');
      assert.strictEqual(external.serviceName, 'database');
      assert.ok(external.label.includes('external'));

      // Check internal connection string
      const internal = results.find(r => r.type === 'internal');
      assert.ok(internal);
      assert.strictEqual(internal.connectionString, 'mysql://lamp:lamp@database:3306/lamp');
      assert.strictEqual(internal.protocol, 'mysql');
      assert.ok(internal.label.includes('internal'));
    });

    test('should generate connection strings for PostgreSQL service', () => {
      const input: ConnectionStringInput = {
        serviceName: 'postgres',
        serviceType: 'postgres:14',
        creds: {
          user: 'postgres',
          password: 'postgres',
          database: 'database',
        },
        externalConnection: {
          host: '127.0.0.1',
          port: '32770',
        },
      };

      const results = generateConnectionStrings(input);

      assert.strictEqual(results.length, 1);
      const external = results[0];
      assert.strictEqual(external.connectionString, 'postgresql://postgres:postgres@127.0.0.1:32770/database');
      assert.strictEqual(external.protocol, 'postgresql');
      assert.strictEqual(external.type, 'external');
    });

    test('should generate connection strings for MariaDB service', () => {
      const input: ConnectionStringInput = {
        serviceName: 'mariadb',
        serviceType: 'mariadb:10.6',
        creds: {
          user: 'mariadb',
          password: 'mariadb',
          database: 'mariadb',
        },
        externalConnection: {
          host: 'localhost',
          port: '32771',
        },
      };

      const results = generateConnectionStrings(input);

      assert.strictEqual(results.length, 1);
      // MariaDB uses mysql protocol
      assert.strictEqual(results[0].protocol, 'mysql');
      assert.ok(results[0].connectionString.startsWith('mysql://'));
    });

    test('should generate connection strings for MongoDB service', () => {
      const input: ConnectionStringInput = {
        serviceName: 'mongo',
        serviceType: 'mongo:4.4',
        creds: {
          user: 'admin',
          password: 'admin',
          database: 'admin',
        },
        externalConnection: {
          host: '127.0.0.1',
          port: '27017',
        },
      };

      const results = generateConnectionStrings(input);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].protocol, 'mongodb');
      assert.strictEqual(results[0].connectionString, 'mongodb://admin:admin@127.0.0.1:27017/admin');
    });

    test('should return empty array for non-database services', () => {
      const input: ConnectionStringInput = {
        serviceName: 'appserver',
        serviceType: 'php:8.2',
      };

      const results = generateConnectionStrings(input);
      assert.strictEqual(results.length, 0);
    });

    test('should return empty array when credentials are missing', () => {
      const input: ConnectionStringInput = {
        serviceName: 'database',
        serviceType: 'mysql:8.0',
        externalConnection: {
          host: '127.0.0.1',
          port: '3306',
        },
      };

      const results = generateConnectionStrings(input);
      assert.strictEqual(results.length, 0);
    });

    test('should return empty array when connection endpoints are missing', () => {
      const input: ConnectionStringInput = {
        serviceName: 'database',
        serviceType: 'mysql:8.0',
        creds: {
          user: 'root',
          password: 'root',
          database: 'mydb',
        },
      };

      const results = generateConnectionStrings(input);
      assert.strictEqual(results.length, 0);
    });

    test('should return empty array when credentials are incomplete', () => {
      const input: ConnectionStringInput = {
        serviceName: 'database',
        serviceType: 'mysql:8.0',
        creds: {
          user: 'root',
          // password and database missing
        },
        externalConnection: {
          host: '127.0.0.1',
          port: '3306',
        },
      };

      const results = generateConnectionStrings(input);
      assert.strictEqual(results.length, 0);
    });

    test('should handle passwords with special characters', () => {
      const input: ConnectionStringInput = {
        serviceName: 'database',
        serviceType: 'mysql:8.0',
        creds: {
          user: 'root',
          password: 'p@ss:w0rd/test?query#hash',
          database: 'mydb',
        },
        externalConnection: {
          host: '127.0.0.1',
          port: '3306',
        },
      };

      const results = generateConnectionStrings(input);
      assert.strictEqual(results.length, 1);
      // Password should be URL-encoded
      assert.ok(results[0].connectionString.includes('p%40ss%3Aw0rd%2Ftest%3Fquery%23hash'));
    });
  });
});
