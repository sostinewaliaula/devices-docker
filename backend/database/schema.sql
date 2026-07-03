-- =====================================================
-- ASSETS MANAGEMENT SYSTEM - MARIADB SCHEMA
-- Mirrors the real production table structure (28 tables).
-- =====================================================

CREATE DATABASE IF NOT EXISTS assets_management;
USE assets_management;

SET FOREIGN_KEY_CHECKS=0;

-- =====================================================
-- TABLE CREATION
-- =====================================================

CREATE TABLE IF NOT EXISTS `asset_assignment_history` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assignment_type` enum('assign','transfer','return','unassign') COLLATE utf8mb4_unicode_ci DEFAULT 'assign',
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `returned_at` timestamp NULL DEFAULT NULL,
  `condition_on_assign` enum('excellent','good','fair','poor') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `condition_on_return` enum('excellent','good','fair','poor') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_asset_assignment_assigned_by` (`assigned_by`),
  KEY `fk_asset_assignment_department` (`department_id`),
  KEY `idx_asset_assignment_asset` (`asset_id`),
  KEY `idx_asset_assignment_user` (`user_id`),
  KEY `idx_asset_assignment_assigned_at` (`assigned_at`),
  CONSTRAINT `fk_asset_assignment_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_assignment_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_assignment_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_assignment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asset_issue_history` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issue_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` enum('created','status_change','owner_change','resolution','comment','asset_linked','asset_unlinked') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('open','in_progress','resolved','closed','scheduled') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `changed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occurred_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_asset_issue_history_user` (`changed_by`),
  KEY `idx_asset_issue_history_asset` (`asset_id`),
  KEY `idx_asset_issue_history_issue` (`issue_id`),
  KEY `idx_asset_issue_history_event` (`event_type`,`occurred_at`),
  CONSTRAINT `fk_asset_issue_history_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_issue_history_issue` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_issue_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asset_maintenance` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `asset_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `maintenance_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `performed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_date` date NOT NULL,
  `cost` decimal(10,2) DEFAULT NULL,
  `next_maintenance_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `asset_id` (`asset_id`),
  KEY `performed_by` (`performed_by`),
  CONSTRAINT `asset_maintenance_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_maintenance_ibfk_2` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asset_request_comments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `asset_request_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_comment_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `asset_request_id` (`asset_request_id`),
  KEY `user_id` (`user_id`),
  KEY `parent_comment_id` (`parent_comment_id`),
  CONSTRAINT `asset_request_comments_ibfk_1` FOREIGN KEY (`asset_request_id`) REFERENCES `asset_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_request_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_request_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `asset_request_comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asset_request_types` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `image_data` longblob,
  `image_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asset_requests` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `asset_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `status` enum('pending','approved','rejected','fulfilled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `requested_date` date NOT NULL,
  `approved_date` date DEFAULT NULL,
  `approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `estimated_cost` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `asset_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_requests_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asset_types` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(255) NOT NULL,
  `description` text,
  `parameters_schema` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assets` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manufacturer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serial_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `current_value` decimal(10,2) DEFAULT NULL,
  `status` enum('active','inactive','maintenance','retired') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `asset_condition` enum('excellent','good','fair','poor') COLLATE utf8mb4_unicode_ci DEFAULT 'good',
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_to` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `last_maintenance` date DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `image_data` longblob,
  `image_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `custom_attributes` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `assigned_to` (`assigned_to`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `assets_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `assets_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_created` (`created_at` DESC),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `audit_logs_chk_1` CHECK (json_valid(`details`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `backup_email_recipients` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'recipient',
  `is_active` tinyint(1) DEFAULT '1',
  `added_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_backup_email_recipients_email` (`email`),
  KEY `idx_backup_email_recipients_active` (`is_active`),
  KEY `idx_backup_email_recipients_added_by` (`added_by`),
  CONSTRAINT `backup_email_recipients_ibfk_1` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_backup_email_recipients_added_by` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `backups` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `timestamp` timestamp NOT NULL,
  `version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `backup_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `backups_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `backups_chk_1` CHECK (json_valid(`metadata`)),
  CONSTRAINT `backups_chk_2` CHECK (json_valid(`backup_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `departments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_count` int DEFAULT '0',
  `asset_count` int DEFAULT '0',
  `asset_value` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '$0',
  `manager` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manager_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dropdown_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL,
  `value` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_value` (`type`,`value`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  CONSTRAINT `email_templates_chk_1` CHECK (json_valid(`variables`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `issue_attachments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issue_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint NOT NULL,
  `file_content` longblob NOT NULL,
  `uploaded_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_issue_id` (`issue_id`),
  CONSTRAINT `issue_attachments_ibfk_1` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `issue_attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `issue_categories` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `issue_comments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `issue_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `issue_id` (`issue_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `issue_comments_ibfk_1` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `issue_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `issues` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('open','in_progress','resolved','closed','scheduled') COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `priority` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estimated_cost` decimal(12,2) DEFAULT NULL,
  `reported_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assigned_to` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asset_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estimated_resolution_date` date DEFAULT NULL,
  `actual_resolution_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reported_by` (`reported_by`),
  KEY `assigned_to` (`assigned_to`),
  KEY `asset_id` (`asset_id`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `issues_ibfk_1` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `issues_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_3` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `issues_ibfk_4` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mfa_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `enabled` tinyint(1) DEFAULT '1',
  `enforcement_level` enum('optional','recommended','required') COLLATE utf8mb4_unicode_ci DEFAULT 'optional',
  `target_roles` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `exempt_roles` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `grace_period_days` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mfa_policies_enabled` (`enabled`),
  KEY `idx_mfa_policies_enforcement` (`enforcement_level`),
  CONSTRAINT `mfa_policies_chk_1` CHECK (json_valid(`target_roles`)),
  CONSTRAINT `mfa_policies_chk_2` CHECK (json_valid(`exempt_roles`))
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mfa_policy_violations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `policy_id` int NOT NULL,
  `violation_type` enum('login_without_mfa','grace_period_expired','policy_violation') COLLATE utf8mb4_unicode_ci NOT NULL,
  `violation_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved` tinyint(1) DEFAULT '0',
  `resolved_date` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_violation_user` (`user_id`),
  KEY `fk_violation_policy` (`policy_id`),
  CONSTRAINT `fk_violation_policy` FOREIGN KEY (`policy_id`) REFERENCES `mfa_policies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_violation_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('success','error','warning','info') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_reset_tokens_user` (`user_id`),
  KEY `idx_reset_tokens_token` (`token`),
  KEY `idx_reset_tokens_expires` (`expires_at`),
  KEY `idx_reset_tokens_used` (`used`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `positions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(150) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_mfa_compliance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `policy_id` int NOT NULL,
  `is_compliant` tinyint(1) DEFAULT '0',
  `compliance_date` timestamp NULL DEFAULT NULL,
  `grace_period_end` timestamp NULL DEFAULT NULL,
  `last_reminder_sent` timestamp NULL DEFAULT NULL,
  `reminder_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_policy` (`user_id`,`policy_id`),
  KEY `fk_compliance_policy` (`policy_id`),
  CONSTRAINT `fk_compliance_policy` FOREIGN KEY (`policy_id`) REFERENCES `mfa_policies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_compliance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_mfa_factors` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `factor_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `factor_type` enum('totp','webauthn') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'totp',
  `friendly_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `secret` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_factor` (`user_id`,`factor_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_factor_type` (`factor_type`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_mfa_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_recovery_codes` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_used` tinyint(1) DEFAULT '0',
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_code_hash` (`code_hash`),
  KEY `idx_is_used` (`is_used`),
  CONSTRAINT `fk_recovery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `google_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_complete` tinyint(1) NOT NULL DEFAULT '1',
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','manager','user') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `department_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `email_notifications` tinyint(1) DEFAULT '1',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `in_app_notifications` tinyint(1) DEFAULT '1',
  `mfa_enabled` tinyint(1) DEFAULT '0',
  `mfa_enrolled_at` timestamp NULL DEFAULT NULL,
  `last_mfa_verification` timestamp NULL DEFAULT NULL,
  `mfa_policy_required` tinyint(1) DEFAULT '0',
  `mfa_grace_period_end` timestamp NULL DEFAULT NULL,
  `mfa_policy_violations` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `google_id` (`google_id`),
  KEY `department_id` (`department_id`),
  KEY `idx_users_mfa_enabled` (`mfa_enabled`),
  KEY `idx_users_mfa_enrolled` (`mfa_enrolled_at`),
  KEY `idx_users_google_id` (`google_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tracks which deploy/migrations/*.sql files have been applied to this
-- instance (see deploy/manage.sh option "Apply New Migrations"). Not
-- pre-seeded here - the manifest is empty as of this schema snapshot.
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `filename` varchar(255) NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;

-- =====================================================
-- REFERENCE / SEED DATA
-- (dropdowns, asset type templates, positions, issue
-- categories, MFA policies, email templates - no real
-- user/asset/activity data is seeded here)
-- =====================================================

INSERT INTO `dropdown_options` (`id`, `type`, `value`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, 'manufacturer', 'Dell', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(2, 'manufacturer', 'HP', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(3, 'manufacturer', 'Lenovo', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(4, 'manufacturer', 'Apple', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(5, 'manufacturer', 'Microsoft', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(6, 'manufacturer', 'Samsung', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(7, 'manufacturer', 'Cisco', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(8, 'manufacturer', 'Logitech', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(9, 'manufacturer', 'Canon', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(10, 'manufacturer', 'Epson', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(11, 'manufacturer', 'LG', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(12, 'manufacturer', 'ASUS', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(13, 'manufacturer', 'Acer', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(14, 'manufacturer', 'Sony', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(15, 'manufacturer', 'Brother', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(16, 'category', 'Electronics', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(17, 'category', 'Furniture', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(18, 'category', 'Vehicles', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(19, 'category', 'Office Equipment', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(20, 'category', 'Software', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(21, 'category', 'Other', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(22, 'status', 'Available', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(23, 'status', 'Assigned', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(24, 'status', 'In Maintenance', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(25, 'status', 'Reserved', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(26, 'status', 'Disposed', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(27, 'condition', 'New', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(28, 'condition', 'Excellent', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(29, 'condition', 'Good', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(30, 'condition', 'Fair', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(31, 'condition', 'Poor', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52'),
	(32, 'condition', 'Defective', 1, '2026-03-19 09:03:52', '2026-03-19 09:03:52');
INSERT INTO `asset_types` (`id`, `name`, `description`, `parameters_schema`, `is_active`, `created_at`, `updated_at`) VALUES
	('ba7c46fb-236d-11f1-8b3b-f875a4def71e', 'Laptop', 'Laptop computers', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}, {"name": "Purchase Price (KSh)", "type": "number", "required": false}, {"name": "Current Value (KSh)", "type": "number", "required": false}, {"name": "Hard Disk Type", "type": "dropdown", "options": "HDD, SSD", "required": false}, {"name": "Storage", "type": "dropdown", "options": "128GB, 256GB, 512GB, 1TB", "required": false}, {"name": "RAM", "type": "dropdown", "options": "4GB, 8GB, 16GB, 32GB, 64GB", "required": false}, {"name": "Processor", "type": "text", "required": false}, {"name": "OS", "type": "text", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:16:02'),
	('ba7d98a6-236d-11f1-8b3b-f875a4def71e', 'Desktop', 'Desktop computers', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}, {"name": "Purchase Price (KSh)", "type": "number", "required": false}, {"name": "Current Value (KSh)", "type": "number", "required": false}, {"name": "RAM", "type": "dropdown", "options": "4GB, 8GB, 16GB, 32GB, 64GB", "required": false}, {"name": "Storage", "type": "text", "required": false}, {"name": "Processor", "type": "text", "required": false}, {"name": "OS", "type": "text", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7da93c-236d-11f1-8b3b-f875a4def71e', 'Server', 'Server hardware', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}, {"name": "Purchase Price (KSh)", "type": "number", "required": false}, {"name": "Current Value (KSh)", "type": "number", "required": false}, {"name": "RAM", "type": "dropdown", "options": "16GB, 32GB, 64GB, 128GB, 256GB", "required": false}, {"name": "Storage", "type": "text", "required": false}, {"name": "Processor", "type": "text", "required": false}, {"name": "OS", "type": "text", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dade4-236d-11f1-8b3b-f875a4def71e', 'Monitor', 'Display monitors', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}, {"name": "Purchase Price (KSh)", "type": "number", "required": false}, {"name": "Current Value (KSh)", "type": "number", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7db0f0-236d-11f1-8b3b-f875a4def71e', 'Keyboard', 'Keyboards', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7db3b8-236d-11f1-8b3b-f875a4def71e', 'Mouse', 'Computer mice', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7db667-236d-11f1-8b3b-f875a4def71e', 'Phone', 'Mobile phones', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dba50-236d-11f1-8b3b-f875a4def71e', 'Tablet', 'Tablet devices', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dbcf0-236d-11f1-8b3b-f875a4def71e', 'Printer', 'Printers and copiers', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dbf49-236d-11f1-8b3b-f875a4def71e', 'Router', 'Network routers', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dc348-236d-11f1-8b3b-f875a4def71e', 'Switch', 'Network switches', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dc6a8-236d-11f1-8b3b-f875a4def71e', 'Projector', 'Display projectors', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dc952-236d-11f1-8b3b-f875a4def71e', 'Camera', 'Cameras and webcams', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dcbce-236d-11f1-8b3b-f875a4def71e', 'Furniture', 'Office furniture', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15'),
	('ba7dd199-236d-11f1-8b3b-f875a4def71e', 'Vehicle', 'Company vehicles', '[{"name": "Manufacturer", "type": "global_dropdown", "source": "manufacturer", "required": false}, {"name": "Category", "type": "global_dropdown", "source": "category", "required": false}, {"name": "Model", "type": "text", "required": false}, {"name": "Serial Number", "type": "text", "required": false}, {"name": "Status", "type": "global_dropdown", "source": "status", "required": false}, {"name": "Condition", "type": "global_dropdown", "source": "condition", "required": false}, {"name": "Purchase Date", "type": "date", "required": false}, {"name": "Warranty End Date", "type": "date", "required": false}]', 1, '2026-03-19 08:29:21', '2026-03-19 11:00:15');
INSERT INTO `issue_categories` (`id`, `name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
	('55486467-4656-4edf-a2ca-1e7d846a4773', 'Battery Replacement', NULL, 1, '2025-11-20 14:03:19', '2025-11-20 14:03:19'),
	('bcf3a078-c617-11f0-b2ae-00155d69d0ea', 'Hardware Failure', 'Physical component malfunction (power, motherboard, etc.)', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf40ca0-c617-11f0-b2ae-00155d69d0ea', 'Software Issue', 'Application bugs, crashes or configuration errors', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf416cc-c617-11f0-b2ae-00155d69d0ea', 'Connectivity Problem', 'Network, Wi-Fi or VPN disruptions', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf41d6c-c617-11f0-b2ae-00155d69d0ea', 'Security Incident', 'Security alerts, suspicious activity or access issues', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf426a4-c617-11f0-b2ae-00155d69d0ea', 'Performance Degradation', 'Slow systems or degraded experience', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf42bf4-c617-11f0-b2ae-00155d69d0ea', 'Upgrade Request', 'Request for updated hardware or software', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf43074-c617-11f0-b2ae-00155d69d0ea', 'Replacement Request', 'Lost, damaged or end-of-life replacement', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf4349e-c617-11f0-b2ae-00155d69d0ea', 'Maintenance', 'Preventive maintenance or servicing', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf43b97-c617-11f0-b2ae-00155d69d0ea', 'Accessory', 'Peripherals such as adapters, cables, docks', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30'),
	('bcf442d5-c617-11f0-b2ae-00155d69d0ea', 'Other', 'Catch-all category for edge cases', 1, '2025-11-20 13:49:30', '2025-11-20 13:49:30');
INSERT INTO `mfa_policies` (`id`, `name`, `description`, `enabled`, `enforcement_level`, `target_roles`, `exempt_roles`, `grace_period_days`, `created_at`, `updated_at`, `created_by`, `updated_by`) VALUES
	(2, 'Manager MFA Recommended', 'Managers are recommended to enable MFA for enhanced security', 1, 'recommended', '["manager"]', NULL, 14, '2025-10-19 11:35:34', '2025-10-19 11:35:34', 'system', NULL),
	(3, 'User MFA Optional', 'Regular users may optionally enable MFA', 1, 'optional', '["user"]', NULL, 0, '2025-10-19 11:35:34', '2025-10-19 11:35:34', 'system', NULL),
	(4, 'User MFA Policy', 'Regular users are required to enable MFA', 1, 'optional', '["user"]', '[]', 7, '2025-10-19 11:44:07', '2025-10-28 11:47:02', 'admin-user-id', 'admin-user-id'),
	(5, 'Manager MFA Recommended', 'Managers are recommended to enable MFA for enhanced security', 0, 'recommended', '["manager"]', '[]', 7, '2025-10-27 07:55:40', '2025-10-28 11:47:31', 'admin-user-id', 'admin-user-id'),
	(6, 'Admin MFA Required', 'All administrators must have MFA enabled for security', 1, 'recommended', '[]', '[]', 7, '2025-11-05 06:06:47', '2025-11-05 06:06:47', 'admin-user-id', NULL);
INSERT INTO `positions` (`id`, `name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
	('0046f88f-bf9d-4864-afb2-2724448e2ed0', 'Network Engineer', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53'),
	('0b994b57-9ae0-4fd0-bcb0-e98cd06d98f4', 'Finance Officer', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53'),
	('544ed509-c5f1-11f0-b2ae-00155d69d0ea', 'Accounts Assistant', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f1285-c5f1-11f0-b2ae-00155d69d0ea', 'Assistant Product Owner', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f1d63-c5f1-11f0-b2ae-00155d69d0ea', 'Associate Solution Consultant 1', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f3539-c5f1-11f0-b2ae-00155d69d0ea', 'Associate Solution Consultant 2', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f3ad6-c5f1-11f0-b2ae-00155d69d0ea', 'Associate Support Analyst 1', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f3fca-c5f1-11f0-b2ae-00155d69d0ea', 'Associate System Engineer', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f4407-c5f1-11f0-b2ae-00155d69d0ea', 'Business Analyst', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f48e1-c5f1-11f0-b2ae-00155d69d0ea', 'Business Analyst Intern', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f51fd-c5f1-11f0-b2ae-00155d69d0ea', 'CCO', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f573b-c5f1-11f0-b2ae-00155d69d0ea', 'CEO', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f5d25-c5f1-11f0-b2ae-00155d69d0ea', 'CoE Manager', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f61d1-c5f1-11f0-b2ae-00155d69d0ea', 'CPO', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f6699-c5f1-11f0-b2ae-00155d69d0ea', 'CTO', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f8904-c5f1-11f0-b2ae-00155d69d0ea', 'Customer Management', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f9221-c5f1-11f0-b2ae-00155d69d0ea', 'Delivery Lead', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f95ed-c5f1-11f0-b2ae-00155d69d0ea', 'Director', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f9aab-c5f1-11f0-b2ae-00155d69d0ea', 'DMS Engineer', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544f9e89-c5f1-11f0-b2ae-00155d69d0ea', 'Driver', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fa256-c5f1-11f0-b2ae-00155d69d0ea', 'Engineering Manager', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fa676-c5f1-11f0-b2ae-00155d69d0ea', 'Entry Business Analyst', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544faa93-c5f1-11f0-b2ae-00155d69d0ea', 'Entry Level 1', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fb350-c5f1-11f0-b2ae-00155d69d0ea', 'Entry Level 2', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fb7b6-c5f1-11f0-b2ae-00155d69d0ea', 'Entry Level 3', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fbb63-c5f1-11f0-b2ae-00155d69d0ea', 'Entry Software Engineer 1', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fbf71-c5f1-11f0-b2ae-00155d69d0ea', 'Entry Software Engineer 2', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fc3ba-c5f1-11f0-b2ae-00155d69d0ea', 'Entry Software Engineer 3', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fc7b7-c5f1-11f0-b2ae-00155d69d0ea', 'Entry System Engineer 1', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fe292-c5f1-11f0-b2ae-00155d69d0ea', 'Entry System Engineer 2', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fe809-c5f1-11f0-b2ae-00155d69d0ea', 'Entry System Engineer 3', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544fec46-c5f1-11f0-b2ae-00155d69d0ea', 'Finance Manager', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544ff063-c5f1-11f0-b2ae-00155d69d0ea', 'HOD Projects', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544ff4ea-c5f1-11f0-b2ae-00155d69d0ea', 'Hospitality Personnel', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('544ff9c6-c5f1-11f0-b2ae-00155d69d0ea', 'HR & Executive Support', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545003a4-c5f1-11f0-b2ae-00155d69d0ea', 'HR Admin', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545007e5-c5f1-11f0-b2ae-00155d69d0ea', 'Infrastructure Intern', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54500bfa-c5f1-11f0-b2ae-00155d69d0ea', 'Intern-Engineering', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545010a5-c5f1-11f0-b2ae-00155d69d0ea', 'Intern-Support', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545014eb-c5f1-11f0-b2ae-00155d69d0ea', 'Marketing Executive', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54501916-c5f1-11f0-b2ae-00155d69d0ea', 'Operations Lead', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54501dd0-c5f1-11f0-b2ae-00155d69d0ea', 'Operations Manager', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545028ab-c5f1-11f0-b2ae-00155d69d0ea', 'Product Owner', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54502d66-c5f1-11f0-b2ae-00155d69d0ea', 'Products Manager', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5450319b-c5f1-11f0-b2ae-00155d69d0ea', 'Project Coordinator', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545035be-c5f1-11f0-b2ae-00155d69d0ea', 'Project Manager', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54503adb-c5f1-11f0-b2ae-00155d69d0ea', 'PSM Manager', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54503f3d-c5f1-11f0-b2ae-00155d69d0ea', 'QA Associate Analyst', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54504446-c5f1-11f0-b2ae-00155d69d0ea', 'Sales Development Representative', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545048ef-c5f1-11f0-b2ae-00155d69d0ea', 'Sales Executive', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54505248-c5f1-11f0-b2ae-00155d69d0ea', 'Senior Software Engineer', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545056a2-c5f1-11f0-b2ae-00155d69d0ea', 'Software Engineer', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54505ab4-c5f1-11f0-b2ae-00155d69d0ea', 'Solution Consultant 1', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54505f25-c5f1-11f0-b2ae-00155d69d0ea', 'Solution Consultant 3', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54506336-c5f1-11f0-b2ae-00155d69d0ea', 'Solution Owner', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54506741-c5f1-11f0-b2ae-00155d69d0ea', 'Support Analyst 1', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('54506b77-c5f1-11f0-b2ae-00155d69d0ea', 'Support Analyst 2', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5450a349-c5f1-11f0-b2ae-00155d69d0ea', 'Support Analyst 3', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5450d44f-c5f1-11f0-b2ae-00155d69d0ea', 'Support Intern', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5450e75c-c5f1-11f0-b2ae-00155d69d0ea', 'System Architect', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5450f36d-c5f1-11f0-b2ae-00155d69d0ea', 'System Engineer', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5450f8c5-c5f1-11f0-b2ae-00155d69d0ea', 'System Engineer Intern', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5450fefd-c5f1-11f0-b2ae-00155d69d0ea', 'Team Lead System Engineer', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545103d7-c5f1-11f0-b2ae-00155d69d0ea', 'Technical Lead', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('545108ae-c5f1-11f0-b2ae-00155d69d0ea', 'UX Designer', NULL, 1, '2025-11-20 09:14:34', '2025-11-20 09:14:34'),
	('5a1dc731-514f-4216-8b21-346dde7c20bd', 'Procurement Officer', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53'),
	('602959d9-f84a-41c9-9ea3-b0bf214268c7', 'Data Analyst', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53'),
	('a7076bf7-8fac-4538-8a15-b20cb2ef37d6', 'Systems Administrator', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53'),
	('b5c06f52-6e54-4a71-862b-73bb398b3f81', 'test', NULL, 1, '2026-01-20 12:45:01', '2026-01-20 12:45:01'),
	('ba864e00-b3a6-462c-91b6-d5b6134c01e8', 'Support Technician', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53'),
	('e9bda81b-27e8-4c7f-b7a4-ecb78535f8dd', 'Finance Assistant', NULL, 1, '2025-11-20 09:15:21', '2025-11-20 09:15:21'),
	('f83e6b3f-1ee5-4ec0-8f5a-664cad09507f', 'IT Manager', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53'),
	('fcd5ecc5-dbf6-4df8-9413-17bd2bb30901', 'HR Manager', NULL, 1, '2026-01-22 13:19:53', '2026-01-22 13:19:53');
INSERT INTO `asset_request_types` (`id`, `name`, `description`, `is_active`, `image_data`, `image_type`, `created_at`, `updated_at`) VALUES
	('64e70865-211d-47dc-875b-2552240037c3', 'Charger', NULL, 1, NULL, NULL, '2026-03-02 13:26:21', '2026-03-02 13:26:21'),
	('b01d32c3-c612-11f0-b2ae-00155d69d0ea', 'Laptop', 'Portable computers for mobility-focused roles', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:18:17'),
	('b01d4cdd-c612-11f0-b2ae-00155d69d0ea', 'Desktop', 'Workstations for office-based setups', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:29:19'),
	('b01d5533-c612-11f0-b2ae-00155d69d0ea', 'Monitor', 'Standalone displays or multi-monitor setups', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:18:30'),
	('b01d5b63-c612-11f0-b2ae-00155d69d0ea', 'Keyboard', 'Mechanical, ergonomic or standard keyboards', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:17:16'),
	('b01d610a-c612-11f0-b2ae-00155d69d0ea', 'Mouse', 'Standard, ergonomic or vertical mice', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:19:06'),
	('b01d68f6-c612-11f0-b2ae-00155d69d0ea', 'Phone', 'Mobile or desk phones for communication needs', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:26:39'),
	('b01d6fae-c612-11f0-b2ae-00155d69d0ea', 'Tablet', 'Tablets for field or presentation work', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:28:42'),
	('b01d753f-c612-11f0-b2ae-00155d69d0ea', 'Printer', 'Printers or multi-function devices', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:26:56'),
	('b01d7ac3-c612-11f0-b2ae-00155d69d0ea', 'Server', 'On‑prem or edge compute hardware', 1, NULL, NULL, '2025-11-20 13:13:21', '2025-11-20 13:13:21'),
	('b01d8090-c612-11f0-b2ae-00155d69d0ea', 'Router', 'Networking routers or firewalls', 1, NULL, NULL, '2025-11-20 13:13:21', '2025-11-20 13:13:21'),
	('b01d85bb-c612-11f0-b2ae-00155d69d0ea', 'Switch', 'Network switches and hubs', 1, NULL, NULL, '2025-11-20 13:13:21', '2025-11-20 13:13:21'),
	('b01d8e3b-c612-11f0-b2ae-00155d69d0ea', 'Projector', 'Presentation projectors', 1, NULL, NULL, '2025-11-20 13:13:21', '2026-03-02 13:27:10'),
	('b01d95cd-c612-11f0-b2ae-00155d69d0ea', 'Camera', 'Webcams or DSLR/mirrorless cameras', 1, NULL, NULL, '2025-11-20 13:13:21', '2025-11-20 13:13:21'),
	('b01da50a-c612-11f0-b2ae-00155d69d0ea', 'Software License', 'Licensed software subscriptions or renewals', 1, NULL, NULL, '2025-11-20 13:13:21', '2025-11-20 13:13:21'),
	('b01da888-c612-11f0-b2ae-00155d69d0ea', 'Other', 'Catch-all for custom asset needs', 1, NULL, NULL, '2025-11-20 13:13:21', '2025-11-20 13:13:21'),
	('c1a28ffc-36b0-4d9d-b4fb-bf895501cc92', 'RAM', NULL, 1, NULL, NULL, '2025-11-20 13:14:23', '2026-03-02 13:28:25'),
	('e91b6678-870b-4a5d-97bd-1febe13e4f48', 'Battery', NULL, 1, NULL, NULL, '2025-11-20 14:03:33', '2026-03-02 13:13:46');
INSERT INTO `email_templates` (`id`, `name`, `subject`, `body`, `variables`, `is_active`, `created_at`, `updated_at`) VALUES
	('656d74cc-a299-11f0-b516-00155d38011b', 'password_reset', 'Your Password Reset Code - Caava Group', '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n  <title>Password Reset Code</title>\n  <style>\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n      margin: 0;\n      padding: 20px;\n      background-color: #f8fafc;\n      text-align: center;\n      color: #0f172a;\n    }\n    .container {\n      max-width: 520px;\n      margin: 0 auto;\n      background: #ffffff;\n      border-radius: 12px;\n      padding: 40px 30px;\n      box-shadow: 0 10px 24px rgba(2,6,23,0.08);\n    }\n    .logo {\n      width: 64px;\n      height: 64px;\n      background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);\n      border-radius: 14px;\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      margin-bottom: 16px;\n    }\n    .logo-text {\n      color: white;\n      font-size: 24px;\n      font-weight: 800;\n    }\n    .company {\n      font-size: 20px;\n      font-weight: 800;\n      color: #1f2937;\n    }\n    .subtitle {\n      font-size: 13px;\n      color: #64748b;\n      margin: 6px 0 22px;\n    }\n    .title {\n      font-size: 24px;\n      font-weight: 800;\n      color: #0ea5e9;\n      margin: 12px 0 8px;\n    }\n    .greeting {\n      color: #334155;\n      margin: 8px 0 18px;\n    }\n    .code {\n      display: inline-block;\n      font-family: "Courier New", monospace;\n      font-size: 36px;\n      font-weight: 800;\n      letter-spacing: 8px;\n      color: #0f172a;\n      background: #f1f5f9;\n      border: 2px solid #cbd5e1;\n      border-radius: 12px;\n      padding: 14px 18px;\n      margin: 8px 0 14px;\n    }\n    .hint {\n      font-size: 13px;\n      color: #64748b;\n      margin: 8px 0 4px;\n    }\n    .expiry {\n      font-size: 12px;\n      color: #ef4444;\n      font-weight: 700;\n      margin: 4px 0 18px;\n    }\n    .cta {\n      margin: 18px 0 6px;\n    }\n    .button {\n      display: inline-block;\n      background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);\n      color: #ffffff !important;\n      text-decoration: none;\n      padding: 12px 22px;\n      border-radius: 10px;\n      font-weight: 700;\n      font-size: 14px;\n    }\n    .footer {\n      font-size: 12px;\n      color: #94a3b8;\n      margin-top: 24px;\n      padding-top: 16px;\n      border-top: 1px solid #e5e7eb;\n      line-height: 1.5;\n    }\n    @media (max-width: 480px) {\n      .code { font-size: 28px; letter-spacing: 6px; }\n      .container { padding: 32px 20px; }\n    }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <div class="logo">\n      <div class="logo-text">C</div>\n    </div>\n    <div class="company">Caava Group</div>\n    <div class="subtitle">Assets Management System</div>\n\n    <div class="title">Password Reset</div>\n    <div class="greeting">Hello {{user_name}},</div>\n\n    <div class="hint">Use the code below to reset your password:</div>\n    <div class="code">{{reset_code}}</div>\n\n    <div class="expiry">Expires in 15 minutes</div>\n\n    <div class="cta">\n      <a class="button" href="{{reset_link}}" target="_blank" rel="noopener">Reset Password</a>\n    </div>\n\n    <div class="footer">\n      If you didnâ€™t request this, you can safely ignore this email.<br/>\n      Â© 2025 Caava Group. All rights reserved.\n    </div>\n  </div>\n</body>\n</html>', '["user_name", "reset_code"]', 1, '2025-10-06 09:46:56', '2025-10-09 08:46:21'),
	('ae77ffca-a2a4-11f0-b516-00155d38011b', 'welcome_user', 'Welcome to Caava Group Devices Management System! ðŸŽ‰', '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Welcome to Caava Group</title>\n    <style>\n        body {\n            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n            margin: 0;\n            padding: 20px;\n            background-color: #f8fafc;\n            text-align: center;\n        }\n        .container {\n            max-width: 500px;\n            margin: 0 auto;\n            background: white;\n            border-radius: 12px;\n            padding: 40px 30px;\n            box-shadow: 0 4px 15px rgba(0,0,0,0.1);\n        }\n        .logo {\n            width: 60px;\n            height: 60px;\n            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);\n            border-radius: 12px;\n            display: inline-flex;\n            align-items: center;\n            justify-content: center;\n            margin-bottom: 20px;\n        }\n        .logo-text {\n            color: white;\n            font-size: 24px;\n            font-weight: bold;\n        }\n        .company {\n            font-size: 20px;\n            font-weight: 700;\n            color: #1f2937;\n            margin-bottom: 10px;\n        }\n        .subtitle {\n            font-size: 14px;\n            color: #6b7280;\n            margin-bottom: 30px;\n        }\n        .welcome-title {\n            font-size: 28px;\n            font-weight: 700;\n            color: #10b981;\n            margin: 20px 0;\n        }\n        .message {\n            font-size: 16px;\n            color: #374151;\n            line-height: 1.6;\n            margin: 20px 0;\n        }\n        .login-box {\n            background: #f0fdf4;\n            border: 2px solid #10b981;\n            border-radius: 8px;\n            padding: 20px;\n            margin: 25px 0;\n        }\n        .login-title {\n            font-size: 18px;\n            font-weight: 600;\n            color: #10b981;\n            margin-bottom: 10px;\n        }\n        .login-url {\n            font-size: 16px;\n            color: #1f2937;\n            word-break: break-all;\n            background: white;\n            padding: 10px;\n            border-radius: 4px;\n            border: 1px solid #d1d5db;\n        }\n        .credentials {\n            background: #fef3c7;\n            border: 1px solid #f59e0b;\n            border-radius: 6px;\n            padding: 15px;\n            margin: 20px 0;\n            text-align: left;\n        }\n        .credentials-title {\n            font-size: 14px;\n            font-weight: 600;\n            color: #92400e;\n            margin-bottom: 10px;\n        }\n        .credential-item {\n            font-size: 14px;\n            color: #374151;\n            margin: 5px 0;\n        }\n        .next-steps {\n            background: #eff6ff;\n            border: 1px solid #3b82f6;\n            border-radius: 6px;\n            padding: 15px;\n            margin: 20px 0;\n            text-align: left;\n        }\n        .next-steps-title {\n            font-size: 14px;\n            font-weight: 600;\n            color: #1e40af;\n            margin-bottom: 10px;\n        }\n        .step {\n            font-size: 14px;\n            color: #374151;\n            margin: 5px 0;\n        }\n        .footer {\n            font-size: 12px;\n            color: #9ca3af;\n            margin-top: 30px;\n            padding-top: 20px;\n            border-top: 1px solid #e5e7eb;\n        }\n        .button {\n            display: inline-block;\n            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);\n            color: white;\n            padding: 12px 24px;\n            text-decoration: none;\n            border-radius: 6px;\n            font-weight: 600;\n            margin: 15px 0;\n        }\n    </style>\n</head>\n<body>\n    <div class="container">\n        <div class="logo">\n            <div class="logo-text">C</div>\n        </div>\n        <div class="company">Caava Group</div>\n        <div class="subtitle">Devices Management System</div>\n        \n        <h1 class="welcome-title">Welcome {{user_name}}! ðŸŽ‰</h1>\n        \n        <div class="message">\n            Your account has been successfully created. You can now access the Caava Group Devices Management System to manage your assets and track your requests.\n        </div>\n        \n        <div class="login-box">\n            <div class="login-title">ðŸ”— Access Your Account</div>\n            <div class="login-url">{{site_url}}</div>\n        </div>\n        \n        <div class="credentials">\n            <div class="credentials-title">ðŸ“§ Your Login Credentials:</div>\n            <div class="credential-item"><strong>Email:</strong> {{user_email}}</div>\n            <div class="credential-item"><strong>Password:</strong> {{temporary_password}}</div>\n        </div>\n        \n        <div class="next-steps">\n            <div class="next-steps-title">ðŸš€ Next Steps:</div>\n            <div class="step">1. Click the login URL above or visit the site</div>\n            <div class="step">2. Log in with your email and temporary password</div>\n            <div class="step">3. Change your password in the security settings</div>\n            <div class="step">4. Complete your profile information</div>\n        </div>\n        \n        <div class="message">\n            If you have any questions or need assistance, please contact your system administrator.\n        </div>\n        \n        <div class="footer">\n            <p>Â© 2025 Caava Group. All rights reserved.</p>\n            <p>This is an automated message, please do not reply.</p>\n        </div>\n    </div>\n</body>\n</html>', '["user_name", "user_email", "site_url", "temporary_password"]', 1, '2025-10-06 11:07:43', '2025-10-09 08:48:53');
-- =====================================================
-- INITIAL ADMIN USER
-- Login: admin@example.com / Admin123!
-- Change this password after first login.
-- =====================================================

INSERT INTO users (email, password_hash, name, role, is_active, email_notifications, in_app_notifications)
VALUES ('admin@example.com', '$2a$10$n81P6N5CGsZJl.9Xy9l5xOvzh6q27ImK/dWC7j40GzB01cJ99lwKG', 'System Administrator', 'admin', 1, 1, 1);

-- =====================================================
-- FINAL STATUS
-- =====================================================

SELECT 'MariaDB Database Setup Complete!' as status;
SELECT COUNT(*) as total_users FROM users;
