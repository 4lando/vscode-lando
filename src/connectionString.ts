/**
 * Connection String Generator Module
 * 
 * Generates ready-to-use database connection URLs from Lando service info.
 * Supports MySQL, MariaDB, PostgreSQL, and MongoDB.
 * 
 * @module connectionString
 */

/**
 * Database credentials from Lando service info
 */
export interface DatabaseCredentials {
  user?: string;
  password?: string;
  database?: string;
}

/**
 * Connection endpoint information
 */
export interface ConnectionEndpoint {
  host?: string;
  port?: string;
}

/**
 * Input for connection string generation
 */
export interface ConnectionStringInput {
  /** The service name (e.g., 'database', 'db') */
  serviceName: string;
  /** The service type (e.g., 'mysql:8.0', 'postgres:14', 'mariadb', 'mongo:4.4') */
  serviceType?: string;
  /** Database credentials */
  creds?: DatabaseCredentials;
  /** External connection endpoint (for host machine connections) */
  externalConnection?: ConnectionEndpoint;
  /** Internal connection endpoint (for container-to-container) */
  internalConnection?: ConnectionEndpoint;
}

/**
 * Result of connection string generation
 */
export interface ConnectionStringResult {
  /** Display label for the connection string */
  label: string;
  /** The full connection string/URL */
  connectionString: string;
  /** Whether this is for external (host) or internal (container) connection */
  type: 'external' | 'internal';
  /** The database protocol (mysql, postgresql, mongodb) */
  protocol: string;
  /** The service this connection belongs to */
  serviceName: string;
}

/**
 * Maps Lando service types to connection string protocols
 */
const SERVICE_TYPE_PROTOCOLS: Record<string, string> = {
  'mysql': 'mysql',
  'mariadb': 'mysql',
  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'mongo': 'mongodb',
  'mongodb': 'mongodb',
};

/**
 * Extracts the base database type from a Lando service type string.
 * Handles versioned types like 'mysql:8.0', 'postgres:14', etc.
 * 
 * @param serviceType - The full service type string from Lando
 * @returns The base database type (e.g., 'mysql', 'postgres')
 */
export function extractDatabaseType(serviceType: string | undefined): string | undefined {
  if (!serviceType) {
    return undefined;
  }
  
  // Remove version suffix (e.g., 'mysql:8.0' -> 'mysql')
  const baseType = serviceType.split(':')[0].toLowerCase();
  
  return baseType;
}

/**
 * Gets the connection string protocol for a database type
 * 
 * @param databaseType - The base database type (e.g., 'mysql', 'postgres')
 * @returns The protocol string (e.g., 'mysql', 'postgresql') or undefined if unsupported
 */
export function getProtocolForDatabaseType(databaseType: string | undefined): string | undefined {
  if (!databaseType) {
    return undefined;
  }
  
  return SERVICE_TYPE_PROTOCOLS[databaseType];
}

/**
 * Checks if a service type is a supported database type
 * 
 * @param serviceType - The service type string from Lando
 * @returns true if this is a database type we can generate connection strings for
 */
export function isSupportedDatabaseType(serviceType: string | undefined): boolean {
  const baseType = extractDatabaseType(serviceType);
  return baseType !== undefined && SERVICE_TYPE_PROTOCOLS[baseType] !== undefined;
}

/**
 * URL-encodes special characters in a connection string component.
 * Used for username, password, and database name to handle special characters
 * like @, :, /, ?, # that would otherwise break the URL format.
 * 
 * @param value - The raw value to encode
 * @returns URL-encoded value safe for use in connection strings
 */
export function encodeConnectionComponent(value: string): string {
  return encodeURIComponent(value);
}

/**
 * URL-encodes special characters in a password for use in a connection string.
 * 
 * @param password - The raw password
 * @returns URL-encoded password safe for use in connection strings
 * @deprecated Use encodeConnectionComponent instead
 */
export function encodePassword(password: string): string {
  return encodeConnectionComponent(password);
}

/**
 * Builds a database connection string URL.
 * All user-provided values (user, password, database) are URL-encoded to handle
 * special characters that would otherwise break the URL format.
 * 
 * @param protocol - The database protocol (mysql, postgresql, mongodb)
 * @param user - Username (will be URL-encoded)
 * @param password - Password (will be URL-encoded)
 * @param host - Hostname or IP
 * @param port - Port number
 * @param database - Database name (will be URL-encoded)
 * @returns The complete connection string URL
 */
export function buildConnectionUrl(
  protocol: string,
  user: string,
  password: string,
  host: string,
  port: string,
  database: string
): string {
  const encodedUser = encodeConnectionComponent(user);
  const encodedPassword = encodeConnectionComponent(password);
  const encodedDatabase = encodeConnectionComponent(database);
  return `${protocol}://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}`;
}

/**
 * Generates connection strings for a database service.
 * Returns both external (host machine) and internal (container) connection strings
 * when the relevant endpoint information is available.
 * 
 * @param input - The service information from Lando
 * @returns Array of connection string results (may be empty if not a database or missing info)
 */
export function generateConnectionStrings(input: ConnectionStringInput): ConnectionStringResult[] {
  const results: ConnectionStringResult[] = [];
  
  // Check if this is a supported database type
  const baseType = extractDatabaseType(input.serviceType);
  const protocol = getProtocolForDatabaseType(baseType);
  
  if (!protocol) {
    return results;
  }
  
  // Check if we have the required credentials
  const { creds } = input;
  if (!creds?.user || !creds?.password || !creds?.database) {
    return results;
  }
  
  // Generate external connection string (for connecting from host machine)
  if (input.externalConnection?.host && input.externalConnection?.port) {
    const connectionString = buildConnectionUrl(
      protocol,
      creds.user,
      creds.password,
      input.externalConnection.host,
      input.externalConnection.port,
      creds.database
    );
    
    results.push({
      label: `${input.serviceName}: Connection URL (external)`,
      connectionString,
      type: 'external',
      protocol,
      serviceName: input.serviceName,
    });
  }
  
  // Generate internal connection string (for container-to-container connections)
  if (input.internalConnection?.host && input.internalConnection?.port) {
    const connectionString = buildConnectionUrl(
      protocol,
      creds.user,
      creds.password,
      input.internalConnection.host,
      input.internalConnection.port,
      creds.database
    );
    
    results.push({
      label: `${input.serviceName}: Connection URL (internal)`,
      connectionString,
      type: 'internal',
      protocol,
      serviceName: input.serviceName,
    });
  }
  
  return results;
}
