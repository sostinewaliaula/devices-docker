import db from '../config/database.js';
import mfaService from './mfaService.js';

class MfaPolicyService {
  /**
   * Get all MFA policies
   * @returns {Promise<Array>} Array of MFA policies
   */
  async getPolicies() {
    const [rows] = await db.execute(`
      SELECT 
        p.*,
        u1.name as created_by_name,
        u2.name as updated_by_name
      FROM mfa_policies p
      LEFT JOIN users u1 ON p.created_by = u1.id
      LEFT JOIN users u2 ON p.updated_by = u2.id
      ORDER BY p.created_at DESC
    `);

    return rows.map(row => ({
      ...row,
      target_roles: JSON.parse(row.target_roles),
      exempt_roles: row.exempt_roles ? JSON.parse(row.exempt_roles) : null
    }));
  }

  /**
   * Get a specific MFA policy by ID
   * @param {number} policyId - Policy ID
   * @returns {Promise<Object|null>} MFA policy or null
   */
  async getPolicy(policyId) {
    const [rows] = await db.execute(
      'SELECT * FROM mfa_policies WHERE id = ?',
      [policyId]
    );

    if (rows.length === 0) return null;

    const policy = rows[0];
    return {
      ...policy,
      target_roles: JSON.parse(policy.target_roles),
      exempt_roles: policy.exempt_roles ? JSON.parse(policy.exempt_roles) : null
    };
  }

  /**
   * Create a new MFA policy
   * @param {Object} policyData - Policy data
   * @param {string} createdBy - User ID who created the policy
   * @returns {Promise<Object>} Created policy
   */
  async createPolicy(policyData, createdBy) {
    const {
      name,
      description,
      enforcement_level = 'optional',
      target_roles = [],
      exempt_roles = null,
      grace_period_days = 0,
      enabled = true
    } = policyData;

    const [result] = await db.execute(
      `INSERT INTO mfa_policies 
       (name, description, enforcement_level, target_roles, exempt_roles, grace_period_days, enabled, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        enforcement_level,
        JSON.stringify(target_roles),
        exempt_roles ? JSON.stringify(exempt_roles) : null,
        grace_period_days,
        enabled,
        createdBy
      ]
    );

    return await this.getPolicy(result.insertId);
  }

  /**
   * Update an MFA policy
   * @param {number} policyId - Policy ID
   * @param {Object} policyData - Updated policy data
   * @param {string} updatedBy - User ID who updated the policy
   * @returns {Promise<Object|null>} Updated policy or null
   */
  async updatePolicy(policyId, policyData, updatedBy) {
    const {
      name,
      description,
      enforcement_level,
      target_roles,
      exempt_roles,
      grace_period_days,
      enabled
    } = policyData;

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (enforcement_level !== undefined) {
      updateFields.push('enforcement_level = ?');
      updateValues.push(enforcement_level);
    }
    if (target_roles !== undefined) {
      updateFields.push('target_roles = ?');
      updateValues.push(JSON.stringify(target_roles));
    }
    if (exempt_roles !== undefined) {
      updateFields.push('exempt_roles = ?');
      updateValues.push(exempt_roles ? JSON.stringify(exempt_roles) : null);
    }
    if (grace_period_days !== undefined) {
      updateFields.push('grace_period_days = ?');
      updateValues.push(grace_period_days);
    }
    if (enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(enabled);
    }

    updateFields.push('updated_by = ?');
    updateValues.push(updatedBy);

    updateValues.push(policyId);

    await db.execute(
      `UPDATE mfa_policies SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    return await this.getPolicy(policyId);
  }

  /**
   * Delete an MFA policy
   * @param {number} policyId - Policy ID
   * @returns {Promise<boolean>} Success status
   */
  async deletePolicy(policyId) {
    const [result] = await db.execute(
      'DELETE FROM mfa_policies WHERE id = ?',
      [policyId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Get policies that apply to a specific role
   * @param {string} role - User role
   * @returns {Promise<Array>} Applicable policies
   */
  async getPoliciesForRole(role) {
    const [rows] = await db.execute(`
      SELECT * FROM mfa_policies 
      WHERE enabled = 1 
      AND JSON_CONTAINS(target_roles, ?)
      AND (exempt_roles IS NULL OR NOT JSON_CONTAINS(exempt_roles, ?))
      ORDER BY enforcement_level DESC, created_at ASC
    `, [JSON.stringify(role), JSON.stringify(role)]);

    return rows.map(row => ({
      ...row,
      target_roles: JSON.parse(row.target_roles),
      exempt_roles: row.exempt_roles ? JSON.parse(row.exempt_roles) : null
    }));
  }

  /**
   * Check if a user is compliant with MFA policies
   * @param {string} userId - User ID
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Compliance status
   */
  async checkUserCompliance(userId, userRole) {
    const policies = await this.getPoliciesForRole(userRole);

    if (policies.length === 0) {
      return {
        isCompliant: true,
        requiredPolicies: [],
        recommendedPolicies: [],
        violations: [],
        policies: []
      };
    }

    // Get user's MFA status
    const [userRows] = await db.execute(
      'SELECT mfa_enabled, mfa_enrolled_at FROM users WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      throw new Error('User not found');
    }

    const user = userRows[0];
    const hasMfa = Boolean(user.mfa_enabled);

    const requiredPolicies = policies.filter(p => p.enforcement_level === 'required');
    const recommendedPolicies = policies.filter(p => p.enforcement_level === 'recommended');
    const violations = [];

    // Check compliance for each policy
    for (const policy of policies) {
      const compliance = await this.getUserPolicyCompliance(userId, policy.id);

      if (policy.enforcement_level === 'required' && !hasMfa) {
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          violationType: 'mfa_required',
          message: 'MFA is required but not enabled'
        });
      }
    }

    return {
      isCompliant: violations.length === 0,
      hasMfa,
      requiredPolicies,
      recommendedPolicies,
      violations,
      policies
    };
  }

  /**
   * Get user's compliance status for a specific policy
   * @param {string} userId - User ID
   * @param {number} policyId - Policy ID
   * @returns {Promise<Object>} Policy compliance
   */
  async getUserPolicyCompliance(userId, policyId) {
    const [rows] = await db.execute(
      'SELECT * FROM user_mfa_compliance WHERE user_id = ? AND policy_id = ?',
      [userId, policyId]
    );

    if (rows.length === 0) {
      // Create compliance record
      const policy = await this.getPolicy(policyId);
      if (!policy) return null;

      const gracePeriodEnd = policy.grace_period_days > 0
        ? new Date(Date.now() + policy.grace_period_days * 24 * 60 * 60 * 1000)
        : null;

      await db.execute(
        `INSERT INTO user_mfa_compliance 
         (user_id, policy_id, grace_period_end) 
         VALUES (?, ?, ?)`,
        [userId, policyId, gracePeriodEnd]
      );

      return {
        userId,
        policyId,
        isCompliant: false,
        complianceDate: null,
        gracePeriodEnd,
        lastReminderSent: null,
        reminderCount: 0
      };
    }

    return rows[0];
  }

  /**
   * Update user compliance status
   * @param {string} userId - User ID
   * @param {number} policyId - Policy ID
   * @param {boolean} isCompliant - Compliance status
   * @returns {Promise<void>}
   */
  async updateUserCompliance(userId, policyId, isCompliant) {
    const complianceDate = isCompliant ? new Date() : null;

    await db.execute(
      `UPDATE user_mfa_compliance 
       SET is_compliant = ?, compliance_date = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND policy_id = ?`,
      [isCompliant, complianceDate, userId, policyId]
    );
  }

  /**
   * Record a policy violation
   * @param {string} userId - User ID
   * @param {number} policyId - Policy ID
   * @param {string} violationType - Type of violation
   * @param {string} notes - Additional notes
   * @returns {Promise<void>}
   */
  async recordViolation(userId, policyId, violationType, notes = null) {
    await db.execute(
      `INSERT INTO mfa_policy_violations 
       (user_id, policy_id, violation_type, notes) 
       VALUES (?, ?, ?, ?)`,
      [userId, policyId, violationType, notes]
    );

    // Update user's violation count
    await db.execute(
      'UPDATE users SET mfa_policy_violations = mfa_policy_violations + 1 WHERE id = ?',
      [userId]
    );
  }

  /**
   * Get policy violations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User violations
   */
  async getUserViolations(userId) {
    const [rows] = await db.execute(`
      SELECT 
        v.*,
        p.name as policy_name,
        p.enforcement_level
      FROM mfa_policy_violations v
      JOIN mfa_policies p ON v.policy_id = p.id
      WHERE v.user_id = ? AND v.resolved = 0
      ORDER BY v.violation_date DESC
    `, [userId]);

    return rows;
  }

  /**
   * Resolve a policy violation
   * @param {number} violationId - Violation ID
   * @param {string} notes - Resolution notes
   * @returns {Promise<void>}
   */
  async resolveViolation(violationId, notes = null) {
    await db.execute(
      `UPDATE mfa_policy_violations 
       SET resolved = 1, resolved_date = CURRENT_TIMESTAMP, notes = ? 
       WHERE id = ?`,
      [notes, violationId]
    );
  }

  /**
   * Get compliance statistics
   * @returns {Promise<Object>} Compliance stats
   */
  async getComplianceStats() {
    const [statsRows] = await db.execute(`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.mfa_enabled = 1 THEN u.id END) as users_with_mfa,
        COUNT(DISTINCT CASE WHEN c.is_compliant = 1 THEN c.user_id END) as compliant_users,
        COUNT(DISTINCT v.user_id) as users_with_violations,
        COUNT(v.id) as total_violations
      FROM users u
      LEFT JOIN user_mfa_compliance c ON u.id = c.user_id
      LEFT JOIN mfa_policy_violations v ON u.id = v.user_id AND v.resolved = 0
      WHERE u.is_active = 1
    `);

    const [policyStats] = await db.execute(`
      SELECT 
        p.name,
        p.enforcement_level,
        COUNT(DISTINCT c.user_id) as total_users,
        COUNT(DISTINCT CASE WHEN c.is_compliant = 1 THEN c.user_id END) as compliant_users,
        COUNT(DISTINCT v.user_id) as violating_users
      FROM mfa_policies p
      LEFT JOIN user_mfa_compliance c ON p.id = c.policy_id
      LEFT JOIN mfa_policy_violations v ON p.id = v.policy_id AND v.resolved = 0
      WHERE p.enabled = 1
      GROUP BY p.id, p.name, p.enforcement_level
    `);

    return {
      overall: statsRows[0],
      byPolicy: policyStats
    };
  }

  /**
   * Enforce MFA policies for a user (called during login)
   * @param {string} userId - User ID
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Enforcement result
   */
  async enforcePolicies(userId, userRole) {
    const compliance = await this.checkUserCompliance(userId, userRole);

    // Update compliance status
    for (const policy of compliance.policies) {
      await this.updateUserCompliance(userId, policy.id, compliance.isCompliant);
    }

    // Record violations if any
    for (const violation of compliance.violations) {
      try {
        // Map violation types to database ENUM values
        let violationType = 'policy_violation'; // default
        if (violation.violationType === 'mfa_required') {
          violationType = 'login_without_mfa';
        } else if (violation.violationType === 'grace_period_expired') {
          violationType = 'grace_period_expired';
        }

        await this.recordViolation(
          userId,
          violation.policyId,
          violationType,
          violation.message
        );
      } catch (error) {
        console.error('Error recording policy violation:', error);
        // Don't fail the entire login process if violation recording fails
      }
    }

    return {
      canLogin: compliance.isCompliant || compliance.requiredPolicies.length === 0,
      compliance,
      requiresMfa: compliance.requiredPolicies.length > 0 && !compliance.hasMfa
    };
  }
}

export default new MfaPolicyService();
