-- =====================================================
-- MODERN EMAIL TEMPLATE WITH LOGO
-- =====================================================

-- Update the email template for modern, appealing design with logo
UPDATE email_templates 
SET subject = '🔐 Your Password Reset Code - Caava Group',
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
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
        }
        .logo {
            width: 80px;
            height: auto;
            margin-bottom: 15px;
        }
        .content {
            padding: 40px 30px;
        }
        .code-container {
            background: #f1f5f9;
            border: 2px dashed #10b981;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
        }
        .code {
            font-size: 32px;
            font-weight: bold;
            color: #10b981;
            letter-spacing: 4px;
            font-family: "Courier New", monospace;
        }
        .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .divider {
            height: 1px;
            background: #e2e8f0;
            margin: 30px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00MCAxMEMyMi4zODU4IDEwIDggMjQuMzg1OCA4IDQyQzggNTkuNjE0MiAyMi4zODU4IDc0IDQwIDc0QzU3LjYxNDIgNzQgNzIgNTkuNjE0MiA3MiA0MkM3MiAyNC4zODU4IDU3LjYxNDIgMTAgNDAgMTBaIiBmaWxsPSIjMTBiOTgxIi8+CjxwYXRoIGQ9Ik00MCAyMEMyNi43NDUyIDIwIDE2IDMwLjc0NTIgMTYgNDRDMjYgNTcuMjU0OCAzNi43NDUyIDY4IDQwIDY4QzUzLjI1NDggNjggNjQgNTcuMjU0OCA2NCA0NEM2NCAzMC43NDUyIDUzLjI1NDggMjAgNDAgMjBaIiBmaWxsPSIjM2I4MmY2Ii8+Cjx0ZXh0IHg9IjQwIiB5PSI0OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9ImJvbGQiPkNBQVZBPC90ZXh0Pgo8L3N2Zz4K" alt="Caava Group Logo" class="logo">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Caava Group</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Assets Management System</p>
        </div>
        
        <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Password Reset Request</h2>
            
            <p>Hello <strong>{{user_name}}</strong>,</p>
            
            <p>We received a request to reset your password for your Caava Group Assets Management System account. Use the verification code below to complete the process:</p>
            
            <div class="code-container">
                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Your verification code:</p>
                <div class="code">{{reset_code}}</div>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This code will expire in <strong>15 minutes</strong> for security reasons.
            </div>
            
            <p>If you did not request this password reset, please ignore this email. Your account remains secure.</p>
            
            <div class="divider"></div>
            
            <p style="font-size: 14px; color: #64748b;">
                <strong>Need help?</strong> Contact our support team if you have any questions or concerns.
            </p>
        </div>
        
        <div class="footer">
            <p style="margin: 0;">© 2024 Caava Group. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
    </div>
</body>
</html>',
    variables = '["user_name", "reset_code"]'
WHERE name = 'password_reset';
