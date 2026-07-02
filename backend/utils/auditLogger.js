import { executeQuery } from '../config/database.js';

/**
 * Centralized audit logging utility
 * Logs all system activities for compliance and security monitoring
 */
class AuditLogger {
  /**
   * Create an audit log entry
   * @param {Object} params - Log parameters
   * @param {string} params.userId - User ID who performed the action (null for system actions)
   * @param {string} params.action - Action type (e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.)
   * @param {string} params.entityType - Entity type (e.g., 'user', 'asset', 'department', etc.)
   * @param {string|null} params.entityId - Entity ID (optional)
   * @param {Object} params.details - Additional details (optional)
   * @param {string} params.ipAddress - IP address (optional)
   * @param {string} params.userAgent - User agent (optional)
   */
  async log({
    userId = null,
    action,
    entityType,
    entityId = null,
    details = {},
    ipAddress = null,
    userAgent = null
  }) {
    try {
      const DB_CLIENT = (process.env.DB_CLIENT || 'mysql').toLowerCase();
      
      if (DB_CLIENT === 'postgres') {
        await executeQuery(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            userId,
            action,
            entityType,
            entityId,
            JSON.stringify(details),
            ipAddress,
            userAgent
          ]
        );
      } else {
        await executeQuery(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            userId,
            action,
            entityType,
            entityId,
            JSON.stringify(details),
            ipAddress,
            userAgent
          ]
        );
      }
    } catch (error) {
      // Log error but don't throw - audit logging should never break the main flow
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Log user authentication events
   */
  async logAuth(userId, action, details = {}, ipAddress = null, userAgent = null) {
    return this.log({
      userId,
      action: `AUTH_${action}`,
      entityType: 'user',
      entityId: userId,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log CRUD operations
   */
  async logCRUD(userId, action, entityType, entityId, details = {}, ipAddress = null, userAgent = null) {
    return this.log({
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log system configuration changes
   */
  async logConfig(userId, action, configType, details = {}, ipAddress = null, userAgent = null) {
    return this.log({
      userId,
      action: `CONFIG_${action}`,
      entityType: 'system_config',
      entityId: configType,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log backup operations
   */
  async logBackup(userId, action, backupId = null, details = {}, ipAddress = null, userAgent = null) {
    return this.log({
      userId,
      action: `BACKUP_${action}`,
      entityType: 'backup',
      entityId: backupId,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log security events
   */
  async logSecurity(userId, action, details = {}, ipAddress = null, userAgent = null) {
    return this.log({
      userId,
      action: `SECURITY_${action}`,
      entityType: 'security',
      entityId: userId,
      details,
      ipAddress,
      userAgent
    });
  }
}

// Export singleton instance
const auditLogger = new AuditLogger();
export default auditLogger;

