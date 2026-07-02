-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    asset_request_id INT NOT NULL,
    type ENUM('status_change', 'comment_added', 'request_created', 'request_approved', 'request_rejected', 'request_fulfilled') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_request_id) REFERENCES asset_requests(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_asset_request_id (asset_request_id),
    INDEX idx_created_at (created_at)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS asset_request_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_request_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    parent_comment_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_request_id) REFERENCES asset_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES asset_request_comments(id) ON DELETE CASCADE,
    INDEX idx_asset_request_id (asset_request_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_comment_id (parent_comment_id),
    INDEX idx_created_at (created_at)
);

-- Add email notification preferences to users table
ALTER TABLE users 
ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN in_app_notifications BOOLEAN DEFAULT TRUE;

-- Add notification settings for asset requests
ALTER TABLE asset_requests
ADD COLUMN last_notified_at TIMESTAMP NULL,
ADD COLUMN notification_count INT DEFAULT 0;
