-- =====================================================
-- CLEAN MINIMALIST EMAIL TEMPLATE
-- =====================================================

-- Update the email template with clean, minimalist design
UPDATE email_templates 
SET subject = 'Your Password Reset Code - Caava Group',
    body = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #374151;
            background-color: #f9fafb;
            margin: 0;
            padding: 20px;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .trouble-text {
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            margin-bottom: 20px;
        }
        .trouble-text a {
            color: #6b7280;
            text-decoration: none;
        }
        .main-content {
            background-color: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 40px 30px;
            text-align: center;
            margin-bottom: 30px;
        }
        .logo-container {
            margin-bottom: 30px;
        }
        .logo {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
        }
        .logo-text {
            color: white;
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .company-name {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            margin: 0;
        }
        .title {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            margin: 30px 0 20px 0;
        }
        .code-container {
            background-color: #ffffff;
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            display: inline-block;
        }
        .code {
            font-size: 36px;
            font-weight: 700;
            color: #10b981;
            letter-spacing: 6px;
            font-family: "Courier New", monospace;
            margin: 0;
        }
        .instruction {
            font-size: 16px;
            color: #6b7280;
            margin: 20px 0 0 0;
        }
        .expiry-warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 12px 16px;
            margin: 20px 0;
            font-size: 14px;
            color: #92400e;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            line-height: 1.5;
        }
        .footer a {
            color: #3b82f6;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .divider {
            height: 1px;
            background-color: #e5e7eb;
            margin: 20px 0;
        }
        @media (max-width: 600px) {
            .main-content {
                padding: 30px 20px;
            }
            .code {
                font-size: 28px;
                letter-spacing: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="trouble-text">
            Having trouble viewing this email? <a href="#">View in browser</a>
        </div>
        
        <div class="main-content">
            <div class="logo-container">
                <div class="logo">
                    <div class="logo-text">C</div>
                </div>
                <p class="company-name">Caava Group</p>
            </div>
            
            <h1 class="title">Password Reset Code</h1>
            
            <div class="code-container">
                <div class="code">{{reset_code}}</div>
            </div>
            
            <p class="instruction">Here is the password reset code you requested for your Assets Management System account.</p>
            
            <div class="expiry-warning">
                <strong>⏰ This code expires in 15 minutes</strong> for security reasons.
            </div>
        </div>
        
        <div class="footer">
            <p>By using this code, you agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</p>
            <div class="divider"></div>
            <p>© 2024 Caava Group. All rights reserved. | <a href="#">Account</a> | <a href="#">Security</a></p>
            <p>If you did not request this code, please ignore this email or contact support.</p>
        </div>
    </div>
</body>
</html>',
    variables = '["user_name", "reset_code"]'
WHERE name = 'password_reset';
