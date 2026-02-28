/**
 * Unit tests for Lando Documentation Module
 * 
 * These tests verify the pure logic of the documentation module
 * without requiring VS Code APIs.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
  LANDO_DOCUMENTATION,
  DOCUMENTATION_CATEGORIES,
  LandoAppInfo,
  getContextAwareDocumentation,
  findRecipeDocumentation,
  findServiceDocumentation,
  getDocumentationByCategory,
  getAllCategories
} from './landoDocumentation';

suite('Lando Documentation Module', () => {
  
  suite('LANDO_DOCUMENTATION data structure', () => {
    
    test('should have documentation entries', () => {
      assert.ok(LANDO_DOCUMENTATION.length > 0, 'Should have documentation entries');
    });

    test('should have HTTPS URLs for all entries', () => {
      for (const doc of LANDO_DOCUMENTATION) {
        assert.ok(
          doc.url.startsWith('https://'),
          `URL should use HTTPS: ${doc.url}`
        );
      }
    });

    test('should have URLs pointing to valid Lando-related domains', () => {
      const validDomains = ['docs.lando.dev', 'github.com/lando', 'launchpass.com'];
      
      for (const doc of LANDO_DOCUMENTATION) {
        const isValidDomain = validDomains.some(domain => doc.url.includes(domain));
        assert.ok(
          isValidDomain,
          `URL should point to a valid Lando-related domain: ${doc.url}`
        );
      }
    });

    test('should have icons for all entries', () => {
      for (const doc of LANDO_DOCUMENTATION) {
        assert.ok(doc.icon, `Entry should have icon: ${doc.label}`);
        assert.ok(
          doc.icon.startsWith('$('),
          `Icon should be VS Code codicon format: ${doc.icon}`
        );
      }
    });
  });

  suite('DOCUMENTATION_CATEGORIES', () => {
    
    test('should have all expected categories', () => {
      const expectedCategories = [
        'getting-started',
        'configuration',
        'tooling',
        'recipes',
        'services',
        'troubleshooting'
      ];

      for (const category of expectedCategories) {
        const found = DOCUMENTATION_CATEGORIES.find(c => c.key === category);
        assert.ok(found, `Should have category: ${category}`);
      }
    });

    test('all category icons should use VS Code codicon format', () => {
      for (const cat of DOCUMENTATION_CATEGORIES) {
        assert.ok(cat.icon.startsWith('$('), `Icon should be VS Code codicon format: ${cat.icon}`);
      }
    });
  });

  suite('Recipe documentation coverage', () => {
    
    test('should have documentation for popular CMS recipes', () => {
      const popularRecipes = ['drupal', 'wordpress', 'backdrop', 'joomla'];
      
      for (const recipe of popularRecipes) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'recipes' && d.keywords?.some(k => k.includes(recipe))
        );
        assert.ok(doc, `Should have documentation for ${recipe}`);
      }
    });

    test('should have documentation for framework recipes', () => {
      const frameworks = ['laravel', 'symfony'];
      
      for (const framework of frameworks) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'recipes' && d.keywords?.some(k => k.includes(framework))
        );
        assert.ok(doc, `Should have documentation for ${framework}`);
      }
    });

    test('should have documentation for stack recipes', () => {
      const stacks = ['lamp', 'lemp', 'mean'];
      
      for (const stack of stacks) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'recipes' && d.keywords?.some(k => k.includes(stack))
        );
        assert.ok(doc, `Should have documentation for ${stack}`);
      }
    });

    test('should have documentation for hosting platform recipes', () => {
      const platforms = ['pantheon', 'acquia', 'platformsh', 'lagoon'];
      
      for (const platform of platforms) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'recipes' && d.keywords?.some(k => k.includes(platform))
        );
        assert.ok(doc, `Should have documentation for ${platform}`);
      }
    });
  });

  suite('Service documentation coverage', () => {
    
    test('should have documentation for database services', () => {
      const databases = ['mysql', 'mariadb', 'postgres', 'mongodb'];
      
      for (const db of databases) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'services' && d.keywords?.some(k => k.includes(db))
        );
        assert.ok(doc, `Should have documentation for ${db}`);
      }
    });

    test('should have documentation for cache services', () => {
      const caches = ['redis', 'memcached', 'varnish'];
      
      for (const cache of caches) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'services' && d.keywords?.some(k => k.includes(cache))
        );
        assert.ok(doc, `Should have documentation for ${cache}`);
      }
    });

    test('should have documentation for web server services', () => {
      const webServers = ['nginx', 'apache'];
      
      for (const server of webServers) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'services' && d.keywords?.some(k => k.includes(server))
        );
        assert.ok(doc, `Should have documentation for ${server}`);
      }
    });

    test('should have documentation for runtime services', () => {
      const runtimes = ['php', 'node'];
      
      for (const runtime of runtimes) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'services' && d.keywords?.some(k => k.includes(runtime))
        );
        assert.ok(doc, `Should have documentation for ${runtime}`);
      }
    });

    test('should have documentation for search services', () => {
      const searchServices = ['elasticsearch', 'solr'];
      
      for (const search of searchServices) {
        const doc = LANDO_DOCUMENTATION.find(
          d => d.category === 'services' && d.keywords?.some(k => k.includes(search))
        );
        assert.ok(doc, `Should have documentation for ${search}`);
      }
    });
  });

  suite('findRecipeDocumentation', () => {
    
    test('should find documentation for exact recipe match', () => {
      const doc = findRecipeDocumentation('drupal');
      assert.ok(doc, 'Should find Drupal documentation');
      assert.strictEqual(doc?.category, 'recipes');
    });

    test('should find documentation for versioned recipe', () => {
      const doc = findRecipeDocumentation('drupal10');
      assert.ok(doc, 'Should find documentation for drupal10');
      assert.ok(doc?.label.toLowerCase().includes('drupal'));
    });

    test('should find documentation case-insensitively', () => {
      const doc = findRecipeDocumentation('WORDPRESS');
      assert.ok(doc, 'Should find WordPress documentation');
    });

    test('should return undefined for unknown recipe', () => {
      const doc = findRecipeDocumentation('unknown-recipe');
      assert.strictEqual(doc, undefined, 'Should return undefined for unknown recipe');
    });
  });

  suite('findServiceDocumentation', () => {
    
    test('should find documentation for exact service match', () => {
      const doc = findServiceDocumentation('mysql');
      assert.ok(doc, 'Should find MySQL documentation');
      assert.strictEqual(doc?.category, 'services');
    });

    test('should find documentation for partial match', () => {
      const doc = findServiceDocumentation('postgresql');
      assert.ok(doc, 'Should find PostgreSQL documentation via keyword match');
    });

    test('should find documentation case-insensitively', () => {
      const doc = findServiceDocumentation('REDIS');
      assert.ok(doc, 'Should find Redis documentation');
    });

    test('should return undefined for unknown service', () => {
      const doc = findServiceDocumentation('unknown-service');
      assert.strictEqual(doc, undefined, 'Should return undefined for unknown service');
    });
  });

  suite('getContextAwareDocumentation', () => {
    
    test('should return empty array for undefined app', () => {
      const docs = getContextAwareDocumentation(undefined);
      assert.deepStrictEqual(docs, [], 'Should return empty array');
    });

    test('should return empty array for app with no recipe or services', () => {
      const docs = getContextAwareDocumentation({});
      assert.deepStrictEqual(docs, [], 'Should return empty array');
    });

    test('should return recipe documentation for app with recipe', () => {
      const app: LandoAppInfo = { recipe: 'drupal10' };
      const docs = getContextAwareDocumentation(app);
      
      assert.ok(docs.length > 0, 'Should return documentation');
      assert.ok(
        docs.some(d => d.label.includes('Drupal')),
        'Should include Drupal documentation'
      );
      assert.strictEqual(docs[0].category, 'context', 'Should have context category');
    });

    test('should return service documentation for app with services', () => {
      const app: LandoAppInfo = { services: ['mysql', 'redis'] };
      const docs = getContextAwareDocumentation(app);
      
      assert.ok(docs.length >= 2, 'Should return documentation for both services');
      assert.ok(
        docs.some(d => d.label.includes('MySQL')),
        'Should include MySQL documentation'
      );
      assert.ok(
        docs.some(d => d.label.includes('Redis')),
        'Should include Redis documentation'
      );
    });

    test('should return both recipe and service documentation', () => {
      const app: LandoAppInfo = { 
        recipe: 'wordpress',
        services: ['mysql', 'redis']
      };
      const docs = getContextAwareDocumentation(app);
      
      assert.ok(docs.length >= 3, 'Should return documentation for recipe and services');
      assert.ok(
        docs.some(d => d.label.includes('WordPress')),
        'Should include WordPress documentation'
      );
    });

    test('should not duplicate service documentation', () => {
      const app: LandoAppInfo = { services: ['mysql', 'database'] };
      const docs = getContextAwareDocumentation(app);
      
      const mysqlDocs = docs.filter(d => d.url.includes('mysql'));
      assert.ok(
        mysqlDocs.length <= 1,
        'Should not have duplicate MySQL documentation'
      );
    });

    test('should customize labels for context docs', () => {
      const app: LandoAppInfo = { recipe: 'laravel' };
      const docs = getContextAwareDocumentation(app);
      
      assert.ok(
        docs.some(d => d.label.includes('(Your Recipe)')),
        'Recipe doc should have customized label'
      );
    });

    test('should include service name in service doc labels', () => {
      const app: LandoAppInfo = { services: ['my-redis'] };
      const docs = getContextAwareDocumentation(app);
      
      if (docs.length > 0) {
        assert.ok(
          docs.some(d => d.label.includes('(my-redis)')),
          'Service doc should include service name in label'
        );
      }
    });

    test('should use star icons for context docs', () => {
      const app: LandoAppInfo = { 
        recipe: 'lamp',
        services: ['mysql']
      };
      const docs = getContextAwareDocumentation(app);
      
      assert.ok(
        docs.every(d => d.icon?.includes('star')),
        'Context docs should have star icons'
      );
    });
  });

  suite('getDocumentationByCategory', () => {
    
    test('should return all docs for a category', () => {
      const recipes = getDocumentationByCategory('recipes');
      
      assert.ok(recipes.length > 0, 'Should return recipe documentation');
      assert.ok(
        recipes.every(d => d.category === 'recipes'),
        'All returned docs should be recipes'
      );
    });

    test('should return empty array for category with no docs', () => {
      // 'context' is only used for context-aware docs, not in LANDO_DOCUMENTATION
      const contextDocs = getDocumentationByCategory('context');
      assert.deepStrictEqual(contextDocs, [], 'Should return empty array for context category');
    });
  });

  suite('getAllCategories', () => {
    
    test('should return all categories present in documentation', () => {
      const categories = getAllCategories();
      
      assert.ok(categories.includes('getting-started'), 'Should include getting-started');
      assert.ok(categories.includes('recipes'), 'Should include recipes');
      assert.ok(categories.includes('services'), 'Should include services');
      assert.ok(categories.includes('configuration'), 'Should include configuration');
      assert.ok(categories.includes('troubleshooting'), 'Should include troubleshooting');
    });

    test('should not include context category', () => {
      const categories = getAllCategories();
      assert.ok(!categories.includes('context'), 'Should not include context category');
    });
  });
});
