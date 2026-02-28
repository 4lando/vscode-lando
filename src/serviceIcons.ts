/**
 * Service Icon Mapping Module
 * 
 * Maps Lando service types to VS Code ThemeIcons for intuitive visual representation
 * in the tree view. This helps GUI users quickly identify service types at a glance.
 * 
 * @module serviceIcons
 */

/**
 * Represents a service icon configuration
 */
export interface ServiceIconConfig {
  /** The VS Code ThemeIcon id to use */
  icon: string;
  /** Human-friendly category for documentation/tooltips */
  category: string;
}

/**
 * Default icon for unknown service types
 */
export const DEFAULT_SERVICE_ICON: ServiceIconConfig = {
  icon: 'server',
  category: 'Service'
};

/**
 * Mapping of Lando service types to VS Code ThemeIcons.
 * 
 * Service types can include version suffixes (e.g., "mysql:8.0", "php:8.2")
 * so we match on the base type before the colon.
 * 
 * Icons chosen for intuitive recognition:
 * - database: All SQL and NoSQL databases
 * - globe: Web servers (nginx, apache)
 * - symbol-namespace: PHP/application servers
 * - terminal: Node.js, Python, Ruby runtimes
 * - mail: Mail services (mailhog, mailcatcher)
 * - archive: Cache/memory stores (redis, memcached, varnish)
 * - search: Search engines (elasticsearch, solr)
 * - cloud: Platform services (platformsh, pantheon, acquia)
 */
const SERVICE_TYPE_ICONS: Record<string, ServiceIconConfig> = {
  // Database services
  'mysql': { icon: 'database', category: 'Database' },
  'mariadb': { icon: 'database', category: 'Database' },
  'postgres': { icon: 'database', category: 'Database' },
  'postgresql': { icon: 'database', category: 'Database' },
  'mongo': { icon: 'database', category: 'Database' },
  'mongodb': { icon: 'database', category: 'Database' },
  'mssql': { icon: 'database', category: 'Database' },
  'sqlite': { icon: 'database', category: 'Database' },
  
  // Web servers
  'nginx': { icon: 'globe', category: 'Web Server' },
  'apache': { icon: 'globe', category: 'Web Server' },
  'tomcat': { icon: 'globe', category: 'Web Server' },
  
  // Application servers / runtimes
  'php': { icon: 'code', category: 'PHP' },
  'appserver': { icon: 'code', category: 'Application' },
  'node': { icon: 'symbol-event', category: 'Node.js' },
  'python': { icon: 'symbol-method', category: 'Python' },
  'ruby': { icon: 'ruby', category: 'Ruby' },
  'go': { icon: 'symbol-interface', category: 'Go' },
  'dotnet': { icon: 'symbol-class', category: '.NET' },
  'java': { icon: 'symbol-class', category: 'Java' },
  
  // Cache / memory stores
  'redis': { icon: 'layers', category: 'Cache' },
  'memcached': { icon: 'layers', category: 'Cache' },
  'varnish': { icon: 'layers', category: 'Cache' },
  
  // Search engines
  'elasticsearch': { icon: 'search', category: 'Search' },
  'solr': { icon: 'search', category: 'Search' },
  'meilisearch': { icon: 'search', category: 'Search' },
  
  // Mail services
  'mailhog': { icon: 'mail', category: 'Mail' },
  'mailcatcher': { icon: 'mail', category: 'Mail' },
  'mailpit': { icon: 'mail', category: 'Mail' },
  
  // Message queues
  'rabbitmq': { icon: 'broadcast', category: 'Message Queue' },
  'kafka': { icon: 'broadcast', category: 'Message Queue' },
  
  // Platform/hosting services
  'platformsh': { icon: 'cloud', category: 'Platform' },
  'pantheon': { icon: 'cloud', category: 'Platform' },
  'acquia': { icon: 'cloud', category: 'Platform' },
  'lagoon': { icon: 'cloud', category: 'Platform' },
  
  // Utility services
  'phpmyadmin': { icon: 'browser', category: 'Database UI' },
  'adminer': { icon: 'browser', category: 'Database UI' },
  'pma': { icon: 'browser', category: 'Database UI' },
  
  // Compose/custom services
  'compose': { icon: 'package', category: 'Docker Compose' },
  'lando': { icon: 'package', category: 'Lando' },
};

/**
 * Gets the icon configuration for a Lando service type.
 * 
 * @param serviceType - The service type from Lando (e.g., "mysql:8.0", "php", "appserver")
 * @returns The icon configuration for the service type
 * 
 * @example
 * getServiceIcon('mysql:8.0')  // { icon: 'database', category: 'Database' }
 * getServiceIcon('php')         // { icon: 'code', category: 'PHP' }
 * getServiceIcon('unknown')     // { icon: 'server', category: 'Service' }
 */
export function getServiceIcon(serviceType: string | undefined): ServiceIconConfig {
  if (!serviceType) {
    return DEFAULT_SERVICE_ICON;
  }
  
  // Extract base type (before version suffix)
  // e.g., "mysql:8.0" -> "mysql", "php:8.2-apache" -> "php"
  const baseType = serviceType.split(':')[0].toLowerCase().trim();
  
  // Look up the icon, falling back to default
  return SERVICE_TYPE_ICONS[baseType] ?? DEFAULT_SERVICE_ICON;
}

/**
 * Gets just the icon ID for a service type.
 * Convenience function for use in tree item setup.
 * 
 * @param serviceType - The service type from Lando
 * @returns The VS Code ThemeIcon id
 */
export function getServiceIconId(serviceType: string | undefined): string {
  return getServiceIcon(serviceType).icon;
}

/**
 * Gets the category label for a service type.
 * Useful for tooltips and descriptions.
 * 
 * @param serviceType - The service type from Lando
 * @returns The human-friendly category name
 */
export function getServiceCategory(serviceType: string | undefined): string {
  return getServiceIcon(serviceType).category;
}

/**
 * Checks if a service type is a database service.
 * Useful for determining which services to show connection info for.
 * 
 * @param serviceType - The service type from Lando
 * @returns True if the service is a database
 */
export function isDatabaseService(serviceType: string | undefined): boolean {
  const config = getServiceIcon(serviceType);
  return config.category === 'Database';
}

/**
 * Checks if a service type is a web server.
 * 
 * @param serviceType - The service type from Lando
 * @returns True if the service is a web server
 */
export function isWebServer(serviceType: string | undefined): boolean {
  const config = getServiceIcon(serviceType);
  return config.category === 'Web Server';
}

/**
 * Gets all known service types and their icons.
 * Useful for documentation and testing.
 * 
 * @returns Map of service types to their icon configurations
 */
export function getAllServiceIcons(): Record<string, ServiceIconConfig> {
  return { ...SERVICE_TYPE_ICONS };
}
