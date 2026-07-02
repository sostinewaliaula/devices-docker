-- =====================================================
-- ASSETS MANAGEMENT SYSTEM - MARIADB SCHEMA
-- =====================================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS assets_management;
USE assets_management;

-- =====================================================
-- TABLE CREATION
-- =====================================================

-- Create departments table
CREATE TABLE departments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  location VARCHAR(255),
  user_count INT DEFAULT 0,
  asset_count INT DEFAULT 0,
  asset_value VARCHAR(50) DEFAULT 'KSh 0',
  manager VARCHAR(255),
  manager_id CHAR(36),
  parent_id CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_departments_name (name),
  INDEX idx_departments_location (location),
  INDEX idx_departments_manager (manager_id),
  INDEX idx_departments_parent (parent_id)
);

-- Create users table
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'user') NOT NULL DEFAULT 'user',
  department_id CHAR(36),
  phone VARCHAR(20),
  position VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_department (department_id),
  INDEX idx_users_role (role),
  INDEX idx_users_active (is_active),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Create assets table
CREATE TABLE assets (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  category VARCHAR(100),
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  serial_number VARCHAR(255) UNIQUE,
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  current_value DECIMAL(10,2),
  status ENUM('active', 'inactive', 'maintenance', 'retired') DEFAULT 'active',
  asset_condition ENUM('excellent', 'good', 'fair', 'poor') DEFAULT 'good',
  location VARCHAR(255),
  assigned_to CHAR(36),
  department_id CHAR(36),
  warranty_expiry DATE,
  last_maintenance DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assets_serial (serial_number),
  INDEX idx_assets_department (department_id),
  INDEX idx_assets_assigned (assigned_to),
  INDEX idx_assets_status (status),
  INDEX idx_assets_type (type),
  INDEX idx_assets_category (category),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Create issues table
CREATE TABLE issues (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('open', 'in_progress', 'resolved', 'closed', 'scheduled') DEFAULT 'open',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  category VARCHAR(100),
  estimated_cost DECIMAL(12,2),
  reported_by CHAR(36) NOT NULL,
  assigned_to CHAR(36),
  asset_id CHAR(36),
  department_id CHAR(36),
  estimated_resolution_date DATE,
  actual_resolution_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issues_status (status),
  INDEX idx_issues_priority (priority),
  INDEX idx_issues_reported_by (reported_by),
  INDEX idx_issues_assigned_to (assigned_to),
  INDEX idx_issues_asset (asset_id),
  INDEX idx_issues_department (department_id),
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Create issue_comments table
CREATE TABLE issue_comments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  issue_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_comments_issue (issue_id),
  INDEX idx_issue_comments_user (user_id),
  INDEX idx_issue_comments_created (created_at),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create asset_maintenance table
CREATE TABLE asset_maintenance (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  asset_id CHAR(36) NOT NULL,
  maintenance_type VARCHAR(100) NOT NULL,
  description TEXT,
  performed_by CHAR(36),
  performed_date DATE NOT NULL,
  cost DECIMAL(10,2),
  next_maintenance_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_maintenance_asset (asset_id),
  INDEX idx_maintenance_date (performed_date),
  INDEX idx_maintenance_type (maintenance_type),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create notifications table
CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('success', 'error', 'warning', 'info') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_read (is_read),
  INDEX idx_notifications_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create audit_logs table
CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id CHAR(36),
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create asset_requests table
CREATE TABLE asset_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  asset_name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  status ENUM('pending', 'approved', 'rejected', 'fulfilled') DEFAULT 'pending',
  requested_date DATE NOT NULL,
  approved_date DATE,
  approved_by CHAR(36),
  notes TEXT,
  estimated_cost DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asset_requests_user (user_id),
  INDEX idx_asset_requests_status (status),
  INDEX idx_asset_requests_priority (priority),
  INDEX idx_asset_requests_date (requested_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create backups table
CREATE TABLE backups (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  timestamp TIMESTAMP NOT NULL,
  version VARCHAR(50),
  metadata JSON,
  backup_data JSON,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_backups_created_by (created_by),
  INDEX idx_backups_timestamp (timestamp),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to update department user count
DELIMITER //
CREATE TRIGGER update_department_user_count_insert
  AFTER INSERT ON users
  FOR EACH ROW
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    UPDATE departments SET user_count = user_count + 1 WHERE id = NEW.department_id;
  END IF;
END//

CREATE TRIGGER update_department_user_count_update
  AFTER UPDATE ON users
  FOR EACH ROW
BEGIN
  IF NOT (OLD.department_id <=> NEW.department_id) THEN
    IF OLD.department_id IS NOT NULL THEN
      UPDATE departments SET user_count = user_count - 1 WHERE id = OLD.department_id;
    END IF;
    IF NEW.department_id IS NOT NULL THEN
      UPDATE departments SET user_count = user_count + 1 WHERE id = NEW.department_id;
    END IF;
  END IF;
END//

CREATE TRIGGER update_department_user_count_delete
  AFTER DELETE ON users
  FOR EACH ROW
BEGIN
  IF OLD.department_id IS NOT NULL THEN
    UPDATE departments SET user_count = user_count - 1 WHERE id = OLD.department_id;
  END IF;
END//

-- Trigger to update department asset counts and values
CREATE TRIGGER update_department_asset_stats_insert
  AFTER INSERT ON assets
  FOR EACH ROW
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    UPDATE departments SET 
      asset_count = asset_count + 1,
      asset_value = CONCAT('KSh ', COALESCE((
        SELECT SUM(current_value) FROM assets WHERE department_id = NEW.department_id
      ), 0))
    WHERE id = NEW.department_id;
  END IF;
END//

CREATE TRIGGER update_department_asset_stats_update
  AFTER UPDATE ON assets
  FOR EACH ROW
BEGIN
  IF NOT (OLD.department_id <=> NEW.department_id) THEN
    -- Remove from old department
    IF OLD.department_id IS NOT NULL THEN
      UPDATE departments SET 
        asset_count = asset_count - 1,
        asset_value = CONCAT('KSh ', COALESCE((
          SELECT SUM(current_value) FROM assets WHERE department_id = OLD.department_id
        ), 0))
      WHERE id = OLD.department_id;
    END IF;
    -- Add to new department
    IF NEW.department_id IS NOT NULL THEN
      UPDATE departments SET 
        asset_count = asset_count + 1,
        asset_value = CONCAT('KSh ', COALESCE((
          SELECT SUM(current_value) FROM assets WHERE department_id = NEW.department_id
        ), 0))
      WHERE id = NEW.department_id;
    END IF;
  END IF;
END//

CREATE TRIGGER update_department_asset_stats_delete
  AFTER DELETE ON assets
  FOR EACH ROW
BEGIN
  IF OLD.department_id IS NOT NULL THEN
    UPDATE departments SET 
      asset_count = asset_count - 1,
      asset_value = CONCAT('KSh ', COALESCE((
        SELECT SUM(current_value) FROM assets WHERE department_id = OLD.department_id
      ), 0))
    WHERE id = OLD.department_id;
  END IF;
END//

DELIMITER ;

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Insert sample departments
INSERT INTO departments (id, name, description, location, manager) VALUES
(UUID(), 'IT Department', 'Information Technology department responsible for IT infrastructure, software development, and technical support at Turnkey Africa.', 'Turnkey Africa', 'John Odhiambo'),
(UUID(), 'Human Resources', 'Human Resources department responsible for recruitment, employee relations, and HR operations at Turnkey Africa.', 'Turnkey Africa', 'Jane Wanjiku'),
(UUID(), 'Finance & Accounting', 'Finance department responsible for financial planning, accounting, and budget management at Turnkey Africa.', 'Turnkey Africa', 'Mike Kamau'),
(UUID(), 'Operations', 'Operations department responsible for day-to-day business operations and process management at Turnkey Africa.', 'Turnkey Africa', 'Sarah Akinyi'),
(UUID(), 'Marketing', 'Marketing department responsible for brand management, campaigns, and market research at Turnkey Africa.', 'Turnkey Africa', 'David Mutua'),
(UUID(), 'Sales', 'Sales department responsible for customer acquisition and revenue generation at Turnkey Africa.', 'Turnkey Africa', 'Lisa Nyambura'),
(UUID(), 'Research & Development', 'R&D department responsible for innovation and product development at Turnkey Africa.', 'Turnkey Africa', 'Robert Kiprop'),
(UUID(), 'Customer Support', 'Customer Support department responsible for customer service and technical support at Turnkey Africa.', 'Turnkey Africa', 'Emily Chebet');

-- Create admin user (password: admin123)
INSERT INTO users (id, email, password_hash, name, role, phone, position) VALUES
(UUID(), 'admin@turnkeyafrica.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin', '+254-700-000-000', 'System Administrator');

-- Update department managers
UPDATE departments SET manager_id = (SELECT id FROM users WHERE email = 'admin@turnkeyafrica.com') WHERE name = 'IT Department';

-- =====================================================
-- FINAL STATUS
-- =====================================================

SELECT 'MariaDB Database Setup Complete!' as status;
SELECT COUNT(*) as total_departments FROM departments;
SELECT COUNT(*) as total_users FROM users;

