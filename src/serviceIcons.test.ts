/**
 * Unit tests for the Service Icons Module
 * 
 * These tests verify that service types are correctly mapped to 
 * VS Code ThemeIcons for intuitive visual representation.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
  getServiceIcon,
  getServiceIconId,
  getServiceCategory,
  isDatabaseService,
  isWebServer,
  getAllServiceIcons,
  DEFAULT_SERVICE_ICON,
  ServiceIconConfig,
} from './serviceIcons';

suite('Service Icons', () => {
  suite('getServiceIcon', () => {
    test('should return database icon for MySQL types', () => {
      const result = getServiceIcon('mysql');
      assert.strictEqual(result.icon, 'database');
      assert.strictEqual(result.category, 'Database');
    });

    test('should return database icon for MySQL with version', () => {
      const result = getServiceIcon('mysql:8.0');
      assert.strictEqual(result.icon, 'database');
      assert.strictEqual(result.category, 'Database');
    });

    test('should return database icon for MariaDB', () => {
      const result = getServiceIcon('mariadb:10.6');
      assert.strictEqual(result.icon, 'database');
      assert.strictEqual(result.category, 'Database');
    });

    test('should return database icon for PostgreSQL', () => {
      assert.strictEqual(getServiceIcon('postgres').icon, 'database');
      assert.strictEqual(getServiceIcon('postgresql:14').icon, 'database');
    });

    test('should return database icon for MongoDB', () => {
      assert.strictEqual(getServiceIcon('mongo').icon, 'database');
      assert.strictEqual(getServiceIcon('mongodb:4.4').icon, 'database');
    });

    test('should return globe icon for Nginx', () => {
      const result = getServiceIcon('nginx');
      assert.strictEqual(result.icon, 'globe');
      assert.strictEqual(result.category, 'Web Server');
    });

    test('should return globe icon for Apache', () => {
      const result = getServiceIcon('apache');
      assert.strictEqual(result.icon, 'globe');
      assert.strictEqual(result.category, 'Web Server');
    });

    test('should return code icon for PHP', () => {
      const result = getServiceIcon('php:8.2');
      assert.strictEqual(result.icon, 'code');
      assert.strictEqual(result.category, 'PHP');
    });

    test('should return code icon for appserver', () => {
      const result = getServiceIcon('appserver');
      assert.strictEqual(result.icon, 'code');
      assert.strictEqual(result.category, 'Application');
    });

    test('should return layers icon for Redis', () => {
      const result = getServiceIcon('redis');
      assert.strictEqual(result.icon, 'layers');
      assert.strictEqual(result.category, 'Cache');
    });

    test('should return layers icon for Memcached', () => {
      const result = getServiceIcon('memcached');
      assert.strictEqual(result.icon, 'layers');
    });

    test('should return search icon for Elasticsearch', () => {
      const result = getServiceIcon('elasticsearch');
      assert.strictEqual(result.icon, 'search');
      assert.strictEqual(result.category, 'Search');
    });

    test('should return search icon for Solr', () => {
      const result = getServiceIcon('solr');
      assert.strictEqual(result.icon, 'search');
    });

    test('should return mail icon for Mailhog', () => {
      const result = getServiceIcon('mailhog');
      assert.strictEqual(result.icon, 'mail');
      assert.strictEqual(result.category, 'Mail');
    });

    test('should return cloud icon for platform services', () => {
      assert.strictEqual(getServiceIcon('platformsh').icon, 'cloud');
      assert.strictEqual(getServiceIcon('pantheon').icon, 'cloud');
      assert.strictEqual(getServiceIcon('acquia').icon, 'cloud');
    });

    test('should return symbol-event icon for Node.js', () => {
      const result = getServiceIcon('node');
      assert.strictEqual(result.icon, 'symbol-event');
      assert.strictEqual(result.category, 'Node.js');
    });

    test('should return default icon for unknown service types', () => {
      const result = getServiceIcon('unknown-service');
      assert.deepStrictEqual(result, DEFAULT_SERVICE_ICON);
    });

    test('should return default icon for undefined input', () => {
      const result = getServiceIcon(undefined);
      assert.deepStrictEqual(result, DEFAULT_SERVICE_ICON);
    });

    test('should return default icon for empty string', () => {
      const result = getServiceIcon('');
      assert.deepStrictEqual(result, DEFAULT_SERVICE_ICON);
    });

    test('should handle uppercase service types', () => {
      const result = getServiceIcon('MYSQL:8.0');
      assert.strictEqual(result.icon, 'database');
    });

    test('should handle service types with complex version strings', () => {
      const result = getServiceIcon('php:8.2-apache');
      assert.strictEqual(result.icon, 'code');
    });
  });

  suite('getServiceIconId', () => {
    test('should return icon id for known service type', () => {
      assert.strictEqual(getServiceIconId('mysql'), 'database');
      assert.strictEqual(getServiceIconId('nginx'), 'globe');
      assert.strictEqual(getServiceIconId('php'), 'code');
    });

    test('should return default icon id for unknown service type', () => {
      assert.strictEqual(getServiceIconId('unknown'), DEFAULT_SERVICE_ICON.icon);
    });

    test('should return default icon id for undefined', () => {
      assert.strictEqual(getServiceIconId(undefined), DEFAULT_SERVICE_ICON.icon);
    });
  });

  suite('getServiceCategory', () => {
    test('should return category for known service type', () => {
      assert.strictEqual(getServiceCategory('mysql'), 'Database');
      assert.strictEqual(getServiceCategory('nginx'), 'Web Server');
      assert.strictEqual(getServiceCategory('php'), 'PHP');
      assert.strictEqual(getServiceCategory('redis'), 'Cache');
    });

    test('should return default category for unknown service type', () => {
      assert.strictEqual(getServiceCategory('unknown'), DEFAULT_SERVICE_ICON.category);
    });

    test('should return default category for undefined', () => {
      assert.strictEqual(getServiceCategory(undefined), DEFAULT_SERVICE_ICON.category);
    });
  });

  suite('isDatabaseService', () => {
    test('should return true for database services', () => {
      assert.strictEqual(isDatabaseService('mysql'), true);
      assert.strictEqual(isDatabaseService('mysql:8.0'), true);
      assert.strictEqual(isDatabaseService('mariadb'), true);
      assert.strictEqual(isDatabaseService('postgres'), true);
      assert.strictEqual(isDatabaseService('mongodb'), true);
      assert.strictEqual(isDatabaseService('mssql'), true);
    });

    test('should return false for non-database services', () => {
      assert.strictEqual(isDatabaseService('php'), false);
      assert.strictEqual(isDatabaseService('nginx'), false);
      assert.strictEqual(isDatabaseService('redis'), false);
      assert.strictEqual(isDatabaseService('node'), false);
    });

    test('should return false for unknown services', () => {
      assert.strictEqual(isDatabaseService('unknown'), false);
    });

    test('should return false for undefined', () => {
      assert.strictEqual(isDatabaseService(undefined), false);
    });
  });

  suite('isWebServer', () => {
    test('should return true for web server services', () => {
      assert.strictEqual(isWebServer('nginx'), true);
      assert.strictEqual(isWebServer('apache'), true);
      assert.strictEqual(isWebServer('tomcat'), true);
    });

    test('should return false for non-web-server services', () => {
      assert.strictEqual(isWebServer('mysql'), false);
      assert.strictEqual(isWebServer('php'), false);
      assert.strictEqual(isWebServer('redis'), false);
    });

    test('should return false for unknown services', () => {
      assert.strictEqual(isWebServer('unknown'), false);
    });

    test('should return false for undefined', () => {
      assert.strictEqual(isWebServer(undefined), false);
    });
  });

  suite('getAllServiceIcons', () => {
    test('should return a non-empty object', () => {
      const icons = getAllServiceIcons();
      assert.ok(Object.keys(icons).length > 0);
    });

    test('should include common service types', () => {
      const icons = getAllServiceIcons();
      assert.ok('mysql' in icons);
      assert.ok('nginx' in icons);
      assert.ok('php' in icons);
      assert.ok('redis' in icons);
    });

    test('should return a copy (not the original object)', () => {
      const icons1 = getAllServiceIcons();
      const icons2 = getAllServiceIcons();
      assert.notStrictEqual(icons1, icons2);
    });

    test('all icons should have required properties', () => {
      const icons = getAllServiceIcons();
      for (const [type, config] of Object.entries(icons)) {
        assert.ok(config.icon, `${type} should have an icon property`);
        assert.ok(config.category, `${type} should have a category property`);
        assert.ok(typeof config.icon === 'string', `${type} icon should be a string`);
        assert.ok(typeof config.category === 'string', `${type} category should be a string`);
      }
    });
  });

  suite('DEFAULT_SERVICE_ICON', () => {
    test('should have server icon', () => {
      assert.strictEqual(DEFAULT_SERVICE_ICON.icon, 'server');
    });

    test('should have Service category', () => {
      assert.strictEqual(DEFAULT_SERVICE_ICON.category, 'Service');
    });
  });
});
