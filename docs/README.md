# Assets Management System Documentation

Welcome to the Assets Management System documentation. This folder contains comprehensive guides for setting up, configuring, and troubleshooting the system.

## 📚 Documentation Index

### Setup Guides
- **[Complete Setup Guide](SETUP_GUIDE.md)** - Complete step-by-step setup from scratch
- **[MariaDB Installation](MARIADB_INSTALLATION.md)** - Detailed MariaDB installation for all platforms
- **[Database Setup](DATABASE_SETUP.md)** - Database configuration and schema import

### Troubleshooting
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions

## 🚀 Quick Start

1. **Install MariaDB** - Follow [MariaDB Installation Guide](MARIADB_INSTALLATION.md)
2. **Set up Database** - Follow [Database Setup Guide](DATABASE_SETUP.md)
3. **Configure Application** - Follow [Complete Setup Guide](SETUP_GUIDE.md)
4. **Run Application** - Start backend and frontend servers

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js** (v18 or higher)
- **MariaDB** (v10.6 or higher)
- **Git** (for cloning repository)
- **Basic command line knowledge**

## 🔧 System Requirements

### Minimum Requirements
- **RAM**: 2GB
- **Storage**: 5GB free space
- **CPU**: 2 cores
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+

### Recommended Requirements
- **RAM**: 4GB+
- **Storage**: 10GB+ free space
- **CPU**: 4 cores+
- **OS**: Latest stable version

## 📁 Project Structure

```
assets-management/
├── backend/                 # Node.js backend server
│   ├── config/             # Database configuration
│   ├── routes/             # API routes
│   ├── services/           # Business logic services
│   └── middleware/         # Express middleware
├── src/                    # React frontend
│   ├── components/         # Reusable components
│   ├── pages/             # Page components
│   ├── contexts/          # React contexts
│   └── services/          # API services
├── docs/                  # Documentation (this folder)
├── assets.sql            # Database schema file
└── package.json          # Frontend dependencies
```

## 🗄️ Database Schema

The system uses MariaDB with the following main tables:

- **users** - User accounts and authentication
- **departments** - Organizational departments
- **assets** - IT assets and equipment
- **issues** - Support tickets and issues
- **asset_requests** - Asset request workflows
- **notifications** - In-app notifications
- **audit_logs** - System audit trail
- **email_templates** - Email notification templates

## 🔐 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Role-based Access Control** - Admin, Manager, User roles
- **Password Hashing** - bcrypt password encryption
- **Input Validation** - Server-side validation for all inputs
- **Audit Logging** - Complete audit trail of all actions
- **CORS Protection** - Cross-origin request security

## 📧 Email Notifications

The system supports email notifications for:

- **User Registration** - Welcome emails with login details
- **Password Reset** - Secure code-based password reset
- **Issue Notifications** - Department manager notifications
- **System Alerts** - Important system events

## 🔄 Backup & Recovery

- **Automated Backups** - Scheduled database backups
- **Manual Backups** - On-demand backup creation
- **Export Functions** - Data export in multiple formats
- **Restore Capabilities** - Complete system restore

## 🚨 Troubleshooting

If you encounter issues:

1. **Check the logs** - Look for error messages in console
2. **Verify configuration** - Ensure all environment variables are correct
3. **Test components** - Test database, backend, and frontend separately
4. **Consult troubleshooting guide** - See [Troubleshooting Guide](TROUBLESHOOTING.md)

## 📞 Support

For additional help:

1. **Check documentation** - Review all guides in this folder
2. **Search issues** - Look for similar problems online
3. **Check logs** - Examine error logs for specific issues
4. **Verify setup** - Ensure all prerequisites are met

## 🔄 Updates

This documentation is updated regularly. Check for updates when:

- Installing new versions
- Encountering new issues
- Adding new features
- Changing system configuration

## 📝 Contributing

To improve this documentation:

1. **Identify gaps** - Find missing information
2. **Test procedures** - Verify all steps work correctly
3. **Update content** - Keep information current
4. **Add examples** - Include practical examples

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Compatibility**: MariaDB 10.6+, Node.js 18+
