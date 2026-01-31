/**
 * Lando Documentation Module
 * 
 * Provides documentation links and context-aware documentation suggestions
 * for Lando users. This module contains pure logic with no VS Code dependencies,
 * making it independently testable.
 * 
 * @module landoDocumentation
 */

/**
 * Valid documentation categories
 */
export type LandoDocCategory = 
  | 'getting-started' 
  | 'recipes' 
  | 'services' 
  | 'configuration' 
  | 'troubleshooting' 
  | 'tooling' 
  | 'context';

/**
 * Represents a documentation link with metadata
 */
export interface LandoDocLink {
  /** Display label for the documentation item */
  label: string;
  /** Description of what this documentation covers */
  description: string;
  /** URL to the documentation */
  url: string;
  /** Category for grouping */
  category: LandoDocCategory;
  /** Optional icon for the Quick Pick item (VS Code codicon format) */
  icon?: string;
  /** Keywords for filtering (e.g., recipe names, service types) */
  keywords?: string[];
}

/**
 * Minimal app interface for context-aware documentation.
 * This avoids coupling to the full LandoApp interface.
 */
export interface LandoAppInfo {
  /** The recipe type (e.g., 'drupal10', 'wordpress', 'lamp') */
  recipe?: string;
  /** Service names defined in the config */
  services?: string[];
}

/**
 * Documentation category metadata for UI display
 */
export interface DocCategoryInfo {
  /** Category key */
  key: LandoDocCategory;
  /** Display label */
  label: string;
  /** VS Code codicon */
  icon: string;
}

/**
 * Documentation categories in display order
 */
export const DOCUMENTATION_CATEGORIES: DocCategoryInfo[] = [
  { key: 'getting-started', label: 'Getting Started', icon: '$(rocket)' },
  { key: 'configuration', label: 'Configuration', icon: '$(gear)' },
  { key: 'tooling', label: 'Tooling', icon: '$(tools)' },
  { key: 'recipes', label: 'Recipes', icon: '$(package)' },
  { key: 'services', label: 'Services', icon: '$(server)' },
  { key: 'troubleshooting', label: 'Troubleshooting', icon: '$(bug)' }
];

/**
 * Comprehensive Lando documentation links organized by category
 */
export const LANDO_DOCUMENTATION: LandoDocLink[] = [
  // Getting Started
  {
    label: 'Getting Started',
    description: 'Introduction to Lando and installation guide',
    url: 'https://docs.lando.dev/getting-started/',
    category: 'getting-started',
    icon: '$(rocket)'
  },
  {
    label: 'Installation',
    description: 'How to install Lando on your system',
    url: 'https://docs.lando.dev/install/',
    category: 'getting-started',
    icon: '$(desktop-download)'
  },
  {
    label: 'CLI Commands',
    description: 'Complete reference for Lando CLI commands',
    url: 'https://docs.lando.dev/cli/',
    category: 'getting-started',
    icon: '$(terminal)'
  },
  {
    label: 'First App Tutorial',
    description: 'Create your first Lando app step by step',
    url: 'https://docs.lando.dev/getting-started/first-app.html',
    category: 'getting-started',
    icon: '$(play)'
  },

  // Configuration
  {
    label: 'Landofile Reference',
    description: 'Complete .lando.yml configuration reference',
    url: 'https://docs.lando.dev/core/v3/landofile.html',
    category: 'configuration',
    icon: '$(file-code)'
  },
  {
    label: 'Proxy Configuration',
    description: 'Configure custom domains and routing',
    url: 'https://docs.lando.dev/core/v3/proxy.html',
    category: 'configuration',
    icon: '$(globe)'
  },
  {
    label: 'Tooling',
    description: 'Define custom commands and tooling',
    url: 'https://docs.lando.dev/core/v3/tooling.html',
    category: 'tooling',
    icon: '$(tools)'
  },
  {
    label: 'Services',
    description: 'Add and configure services in your app',
    url: 'https://docs.lando.dev/core/v3/services.html',
    category: 'configuration',
    icon: '$(server)'
  },
  {
    label: 'Build Steps',
    description: 'Run commands when building your app',
    url: 'https://docs.lando.dev/core/v3/services/lando.html#build-steps',
    category: 'configuration',
    icon: '$(gear)'
  },
  {
    label: 'Events',
    description: 'Hook into Lando lifecycle events',
    url: 'https://docs.lando.dev/core/v3/events.html',
    category: 'configuration',
    icon: '$(zap)'
  },
  {
    label: 'Environment Variables',
    description: 'Set and use environment variables',
    url: 'https://docs.lando.dev/core/v3/env.html',
    category: 'configuration',
    icon: '$(symbol-variable)'
  },
  {
    label: 'Global Configuration',
    description: 'Lando global configuration options',
    url: 'https://docs.lando.dev/core/v3/global.html',
    category: 'configuration',
    icon: '$(settings-gear)'
  },

  // Recipes
  {
    label: 'Drupal',
    description: 'Drupal CMS recipe documentation',
    url: 'https://docs.lando.dev/plugins/drupal/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['drupal', 'drupal7', 'drupal8', 'drupal9', 'drupal10', 'drupal11']
  },
  {
    label: 'WordPress',
    description: 'WordPress recipe documentation',
    url: 'https://docs.lando.dev/plugins/wordpress/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['wordpress']
  },
  {
    label: 'Laravel',
    description: 'Laravel framework recipe documentation',
    url: 'https://docs.lando.dev/plugins/laravel/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['laravel']
  },
  {
    label: 'Symfony',
    description: 'Symfony framework recipe documentation',
    url: 'https://docs.lando.dev/plugins/symfony/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['symfony']
  },
  {
    label: 'LAMP',
    description: 'Linux, Apache, MySQL, PHP stack',
    url: 'https://docs.lando.dev/plugins/lamp/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['lamp']
  },
  {
    label: 'LEMP',
    description: 'Linux, Nginx, MySQL, PHP stack',
    url: 'https://docs.lando.dev/plugins/lemp/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['lemp']
  },
  {
    label: 'MEAN',
    description: 'MongoDB, Express, Angular, Node stack',
    url: 'https://docs.lando.dev/plugins/mean/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['mean']
  },
  {
    label: 'Pantheon',
    description: 'Pantheon hosting platform integration',
    url: 'https://docs.lando.dev/plugins/pantheon/',
    category: 'recipes',
    icon: '$(cloud)',
    keywords: ['pantheon']
  },
  {
    label: 'Acquia',
    description: 'Acquia hosting platform integration',
    url: 'https://docs.lando.dev/plugins/acquia/',
    category: 'recipes',
    icon: '$(cloud)',
    keywords: ['acquia']
  },
  {
    label: 'Platform.sh',
    description: 'Platform.sh hosting integration',
    url: 'https://docs.lando.dev/plugins/platformsh/',
    category: 'recipes',
    icon: '$(cloud)',
    keywords: ['platformsh']
  },
  {
    label: 'Lagoon',
    description: 'Lagoon hosting platform integration',
    url: 'https://docs.lando.dev/plugins/lagoon/',
    category: 'recipes',
    icon: '$(cloud)',
    keywords: ['lagoon']
  },
  {
    label: 'Backdrop',
    description: 'Backdrop CMS recipe documentation',
    url: 'https://docs.lando.dev/plugins/backdrop/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['backdrop']
  },
  {
    label: 'Joomla',
    description: 'Joomla CMS recipe documentation',
    url: 'https://docs.lando.dev/plugins/joomla/',
    category: 'recipes',
    icon: '$(package)',
    keywords: ['joomla']
  },

  // Services
  {
    label: 'PHP',
    description: 'PHP service configuration',
    url: 'https://docs.lando.dev/plugins/php/',
    category: 'services',
    icon: '$(code)',
    keywords: ['php', 'appserver']
  },
  {
    label: 'MySQL',
    description: 'MySQL database service',
    url: 'https://docs.lando.dev/plugins/mysql/',
    category: 'services',
    icon: '$(database)',
    keywords: ['mysql', 'database']
  },
  {
    label: 'MariaDB',
    description: 'MariaDB database service',
    url: 'https://docs.lando.dev/plugins/mariadb/',
    category: 'services',
    icon: '$(database)',
    keywords: ['mariadb', 'database']
  },
  {
    label: 'PostgreSQL',
    description: 'PostgreSQL database service',
    url: 'https://docs.lando.dev/plugins/postgres/',
    category: 'services',
    icon: '$(database)',
    keywords: ['postgres', 'postgresql', 'database']
  },
  {
    label: 'Redis',
    description: 'Redis caching service',
    url: 'https://docs.lando.dev/plugins/redis/',
    category: 'services',
    icon: '$(layers)',
    keywords: ['redis', 'cache']
  },
  {
    label: 'Memcached',
    description: 'Memcached caching service',
    url: 'https://docs.lando.dev/plugins/memcached/',
    category: 'services',
    icon: '$(layers)',
    keywords: ['memcached', 'cache']
  },
  {
    label: 'Node.js',
    description: 'Node.js service configuration',
    url: 'https://docs.lando.dev/plugins/node/',
    category: 'services',
    icon: '$(code)',
    keywords: ['node', 'nodejs', 'javascript']
  },
  {
    label: 'Apache',
    description: 'Apache web server service',
    url: 'https://docs.lando.dev/plugins/apache/',
    category: 'services',
    icon: '$(server-environment)',
    keywords: ['apache', 'httpd']
  },
  {
    label: 'Nginx',
    description: 'Nginx web server service',
    url: 'https://docs.lando.dev/plugins/nginx/',
    category: 'services',
    icon: '$(server-environment)',
    keywords: ['nginx']
  },
  {
    label: 'Elasticsearch',
    description: 'Elasticsearch search service',
    url: 'https://docs.lando.dev/plugins/elasticsearch/',
    category: 'services',
    icon: '$(search)',
    keywords: ['elasticsearch', 'search']
  },
  {
    label: 'Solr',
    description: 'Apache Solr search service',
    url: 'https://docs.lando.dev/plugins/solr/',
    category: 'services',
    icon: '$(search)',
    keywords: ['solr', 'search']
  },
  {
    label: 'Mailhog',
    description: 'Email testing service',
    url: 'https://docs.lando.dev/plugins/mailhog/',
    category: 'services',
    icon: '$(mail)',
    keywords: ['mailhog', 'email', 'mail']
  },
  {
    label: 'Varnish',
    description: 'Varnish caching proxy',
    url: 'https://docs.lando.dev/plugins/varnish/',
    category: 'services',
    icon: '$(layers)',
    keywords: ['varnish', 'cache', 'proxy']
  },
  {
    label: 'MongoDB',
    description: 'MongoDB database service',
    url: 'https://docs.lando.dev/plugins/mongo/',
    category: 'services',
    icon: '$(database)',
    keywords: ['mongodb', 'mongo', 'database']
  },

  // Troubleshooting
  {
    label: 'Troubleshooting',
    description: 'Common issues and solutions',
    url: 'https://docs.lando.dev/help/troubleshooting.html',
    category: 'troubleshooting',
    icon: '$(bug)'
  },
  {
    label: 'Performance',
    description: 'Tips for improving Lando performance',
    url: 'https://docs.lando.dev/getting-started/performance.html',
    category: 'troubleshooting',
    icon: '$(dashboard)'
  },
  {
    label: 'Logs',
    description: 'How to access and understand logs',
    url: 'https://docs.lando.dev/cli/logs.html',
    category: 'troubleshooting',
    icon: '$(output)'
  },
  {
    label: 'GitHub Issues',
    description: 'Report bugs and search for solutions',
    url: 'https://github.com/lando/lando/issues',
    category: 'troubleshooting',
    icon: '$(github)'
  },
  {
    label: 'Lando Slack',
    description: 'Join the Lando community for help',
    url: 'https://launchpass.com/devwithlando',
    category: 'troubleshooting',
    icon: '$(comment-discussion)'
  }
];

/**
 * Finds a documentation link matching a recipe name
 * @param recipe - The recipe name to match (e.g., 'drupal10', 'wordpress')
 * @returns The matching documentation link or undefined
 */
export function findRecipeDocumentation(recipe: string): LandoDocLink | undefined {
  const recipeLower = recipe.toLowerCase();
  return LANDO_DOCUMENTATION.find(
    doc => doc.category === 'recipes' && 
           doc.keywords?.some(k => recipeLower.includes(k) || k.includes(recipeLower))
  );
}

/**
 * Finds a documentation link matching a service name
 * @param serviceName - The service name to match (e.g., 'mysql', 'redis')
 * @returns The matching documentation link or undefined
 */
export function findServiceDocumentation(serviceName: string): LandoDocLink | undefined {
  const serviceNameLower = serviceName.toLowerCase();
  return LANDO_DOCUMENTATION.find(
    doc => doc.category === 'services' && 
           doc.keywords?.some(k => 
             serviceNameLower.includes(k) || 
             k.includes(serviceNameLower)
           )
  );
}

/**
 * Gets context-aware documentation suggestions based on a Lando app's configuration.
 * Returns documentation links relevant to the app's recipe and services.
 * 
 * @param app - The Lando app info (recipe and services)
 * @returns Array of documentation links relevant to the app's configuration
 * 
 * @example
 * ```typescript
 * const docs = getContextAwareDocumentation({
 *   recipe: 'drupal10',
 *   services: ['mysql', 'redis']
 * });
 * // Returns: Drupal docs, MySQL docs, Redis docs
 * ```
 */
export function getContextAwareDocumentation(app: LandoAppInfo | undefined): LandoDocLink[] {
  if (!app) {
    return [];
  }

  const contextDocs: LandoDocLink[] = [];

  // Add recipe-specific documentation
  if (app.recipe) {
    const recipeDoc = findRecipeDocumentation(app.recipe);
    if (recipeDoc) {
      contextDocs.push({
        ...recipeDoc,
        label: `${recipeDoc.label} (Your Recipe)`,
        category: 'context',
        icon: '$(star-full)'
      });
    }
  }

  // Add documentation for services used in the app
  if (app.services && app.services.length > 0) {
    for (const serviceName of app.services) {
      const serviceDoc = findServiceDocumentation(serviceName);
      
      if (serviceDoc && !contextDocs.some(d => d.url === serviceDoc.url)) {
        contextDocs.push({
          ...serviceDoc,
          label: `${serviceDoc.label} (${serviceName})`,
          category: 'context',
          icon: '$(star)'
        });
      }
    }
  }

  return contextDocs;
}

/**
 * Gets all documentation links for a specific category
 * @param category - The category to filter by
 * @returns Array of documentation links in that category
 */
export function getDocumentationByCategory(category: LandoDocCategory): LandoDocLink[] {
  return LANDO_DOCUMENTATION.filter(doc => doc.category === category);
}

/**
 * Gets all unique categories present in the documentation
 * @returns Array of category keys
 */
export function getAllCategories(): LandoDocCategory[] {
  const categories = new Set<LandoDocCategory>();
  for (const doc of LANDO_DOCUMENTATION) {
    categories.add(doc.category);
  }
  return Array.from(categories);
}
