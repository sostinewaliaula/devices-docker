-- =====================================================
-- SIMPLE CODE-FOCUSED EMAIL TEMPLATE
-- =====================================================

-- Update the email template with simple, code-focused design
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            text-align: center;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            padding: 30px 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .logo {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
        }
        .logo-text {
            color: white;
            font-size: 18px;
            font-weight: bold;
        }
        .company {
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 25px;
        }
        .code {
            font-size: 48px;
            font-weight: 700;
            color: #10b981;
            letter-spacing: 8px;
            font-family: "Courier New", monospace;
            margin: 20px 0;
            padding: 15px;
            background: #f0fdf4;
            border: 2px solid #10b981;
            border-radius: 8px;
        }
        .message {
            font-size: 14px;
            color: #6b7280;
            margin: 15px 0;
        }
        .expiry {
            font-size: 12px;
            color: #ef4444;
            font-weight: 600;
            margin-top: 15px;
        }
        .footer {
            font-size: 11px;
            color: #9ca3af;
            margin-top: 20px;
        }
        @media (max-width: 480px) {
            .code {
                font-size: 36px;
                letter-spacing: 6px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <div class="logo-text">C</div>
        </div>
        <div class="company">Caava Group</div>
        
        <div class="code">{{reset_code}}</div>
        
        <div class="message">Your password reset code</div>
        
        <div class="expiry">Expires in 15 minutes</div>
        
        <div class="footer">
            If you didn\'t request this, please ignore this email.
        </div>
    </div>
</body>
</html>',
    variables = '["user_name", "reset_code"]'
WHERE name = 'password_reset';
