-- =====================================================
-- WELCOME EMAIL TEMPLATE FOR NEW USERS
-- =====================================================

-- Insert welcome email template for new users
INSERT INTO email_templates (name, subject, body, variables) VALUES (
  'welcome_user',
  'Welcome to Caava Group Assets Management System! 🎉',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Caava Group</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            text-align: center;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 40px 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .logo {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
        }
        .logo-text {
            color: white;
            font-size: 24px;
            font-weight: bold;
        }
        .company {
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 30px;
        }
        .welcome-title {
            font-size: 28px;
            font-weight: 700;
            color: #10b981;
            margin: 20px 0;
        }
        .message {
            font-size: 16px;
            color: #374151;
            line-height: 1.6;
            margin: 20px 0;
        }
        .login-box {
            background: #f0fdf4;
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        .login-title {
            font-size: 18px;
            font-weight: 600;
            color: #10b981;
            margin-bottom: 10px;
        }
        .login-url {
            font-size: 16px;
            color: #1f2937;
            word-break: break-all;
            background: white;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #d1d5db;
        }
        .credentials {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
        }
        .credentials-title {
            font-size: 14px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 10px;
        }
        .credential-item {
            font-size: 14px;
            color: #374151;
            margin: 5px 0;
        }
        .next-steps {
            background: #eff6ff;
            border: 1px solid #3b82f6;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
        }
        .next-steps-title {
            font-size: 14px;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 10px;
        }
        .step {
            font-size: 14px;
            color: #374151;
            margin: 5px 0;
        }
        .footer {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <div class="logo-text">C</div>
        </div>
        <div class="company">Caava Group</div>
        <div class="subtitle">Assets Management System</div>
        
        <h1 class="welcome-title">Welcome {{user_name}}! 🎉</h1>
        
        <div class="message">
            Your account has been successfully created. You can now access the Caava Group Assets Management System to manage your assets and track your requests.
        </div>
        
        <div class="login-box">
            <div class="login-title">🔗 Access Your Account</div>
            <div class="login-url">{{site_url}}</div>
        </div>
        
        <div class="credentials">
            <div class="credentials-title">📧 Your Login Credentials:</div>
            <div class="credential-item"><strong>Email:</strong> {{user_email}}</div>
            <div class="credential-item"><strong>Password:</strong> {{temporary_password}}</div>
        </div>
        
        <div class="next-steps">
            <div class="next-steps-title">🚀 Next Steps:</div>
            <div class="step">1. Click the login URL above or visit the site</div>
            <div class="step">2. Log in with your email and temporary password</div>
            <div class="step">3. Change your password in the security settings</div>
            <div class="step">4. Complete your profile information</div>
        </div>
        
        <div class="message">
            If you have any questions or need assistance, please contact your system administrator.
        </div>
        
        <div class="footer">
            <p>© 2024 Caava Group. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
        </div>
    </div>
</body>
</html>',
  '["user_name", "user_email", "site_url", "temporary_password"]'
) ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  body = VALUES(body),
  variables = VALUES(variables);
