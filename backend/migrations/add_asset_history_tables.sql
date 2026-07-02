CREATE TABLE IF NOT EXISTS `asset_assignment_history` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `asset_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) DEFAULT NULL,
  `assigned_by` CHAR(36) DEFAULT NULL,
  `department_id` CHAR(36) DEFAULT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `assignment_type` ENUM('assign','transfer','return','unassign') DEFAULT 'assign',
  `assigned_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `returned_at` TIMESTAMP NULL DEFAULT NULL,
  `condition_on_assign` ENUM('excellent','good','fair','poor') DEFAULT NULL,
  `condition_on_return` ENUM('excellent','good','fair','poor') DEFAULT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_asset_assignment_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_assignment_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_assignment_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_assignment_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_asset_assignment_asset` ON `asset_assignment_history` (`asset_id`);
CREATE INDEX `idx_asset_assignment_user` ON `asset_assignment_history` (`user_id`);
CREATE INDEX `idx_asset_assignment_assigned_at` ON `asset_assignment_history` (`assigned_at`);

CREATE TABLE IF NOT EXISTS `asset_issue_history` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `asset_id` CHAR(36) NOT NULL,
  `issue_id` CHAR(36) NOT NULL,
  `event_type` ENUM('created','status_change','owner_change','resolution','comment','asset_linked','asset_unlinked') NOT NULL,
  `status` ENUM('open','in_progress','resolved','closed','scheduled') DEFAULT NULL,
  `summary` VARCHAR(255) NOT NULL,
  `details` TEXT,
  `changed_by` CHAR(36) DEFAULT NULL,
  `occurred_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_asset_issue_history_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_issue_history_issue` FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_issue_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_asset_issue_history_asset` ON `asset_issue_history` (`asset_id`);
CREATE INDEX `idx_asset_issue_history_issue` ON `asset_issue_history` (`issue_id`);
CREATE INDEX `idx_asset_issue_history_event` ON `asset_issue_history` (`event_type`, `occurred_at`);


