-- =====================================================
-- PASSWORD RESET TOKENS TABLE MIGRATION
-- =====================================================

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reset_tokens_user (user_id),
  INDEX idx_reset_tokens_token (token),
  INDEX idx_reset_tokens_expires (expires_at),
  INDEX idx_reset_tokens_used (used),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
