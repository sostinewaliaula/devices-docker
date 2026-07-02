INSERT INTO `asset_assignment_history` (
  `id`,
  `asset_id`,
  `user_id`,
  `assigned_by`,
  `department_id`,
  `location`,
  `assignment_type`,
  `assigned_at`,
  `condition_on_assign`,
  `notes`
)
SELECT
  UUID(),
  a.`id`,
  a.`assigned_to`,
  NULL,
  CASE
    WHEN d.`id` IS NOT NULL THEN d.`id`
    ELSE NULL
  END,
  a.`location`,
  'assign',
  COALESCE(a.`updated_at`, a.`created_at`, CURRENT_TIMESTAMP),
  a.`asset_condition`,
  'Backfilled from existing asset assignment'
FROM `assets` a
LEFT JOIN `departments` d ON d.`id` = NULLIF(a.`department_id`, '')
WHERE a.`assigned_to` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `asset_assignment_history` h
    WHERE h.`asset_id` = a.`id`
      AND h.`user_id` = a.`assigned_to`
      AND h.`returned_at` IS NULL
  );

INSERT INTO `asset_issue_history` (
  `id`,
  `asset_id`,
  `issue_id`,
  `event_type`,
  `status`,
  `summary`,
  `details`,
  `changed_by`,
  `occurred_at`
)
SELECT
  UUID(),
  i.`asset_id`,
  i.`id`,
  'created',
  i.`status`,
  CONCAT('Issue created: ', i.`title`),
  LEFT(COALESCE(i.`description`, ''), 500),
  i.`reported_by`,
  COALESCE(i.`created_at`, CURRENT_TIMESTAMP)
FROM `issues` i
WHERE i.`asset_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `asset_issue_history` h
    WHERE h.`issue_id` = i.`id`
      AND h.`event_type` = 'created'
  );


