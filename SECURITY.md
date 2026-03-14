# Security Policy

## 🛡️ Security Overview
nanobot-node takes security seriously. We follow the principle of least privilege and secure-by-design principles to protect users and their data.

## 🔐 Security Features

### 1. Sandboxed Execution
- **File system access**: All file operations are restricted to the configured workspace directory by default
- **Shell execution**: Commands run in a restricted environment with limited permissions
- **Network access**: Outbound requests can be filtered and controlled via configuration
- **No root access**: The agent runs with regular user permissions by default

### 2. Input Validation
- All user inputs are validated and sanitized before processing
- Tool parameters are validated against JSON Schema before execution
- Dangerous commands are automatically blocked (e.g., `rm -rf /`, `format`, etc.)
- Sensitive information (API keys, passwords) is automatically redacted from logs and outputs

### 3. Authentication & Authorization
- Multi-user support with role-based access control (RBAC)
- Each user can be granted specific tool permissions
- Channel-specific authentication for different chat platforms
- API endpoints require valid authentication tokens

### 4. Data Protection
- Session data is stored encrypted at rest (optional)
- Sensitive configuration values are encrypted in the config file
- No data is sent to third parties without explicit user consent
- Automatic cleanup of temporary files and sensitive data

### 5. Audit Logging
- All tool executions are logged with user, timestamp, and parameters
- All incoming and outgoing messages are logged for audit purposes
- Security events are explicitly logged and can be forwarded to SIEM systems
- Logs do not contain sensitive information (automatically redacted)

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue** - this could put other users at risk
2. Send a detailed report to security@nanobot.ai (PGP key available upon request)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)
4. We will acknowledge your report within 24 hours
5. We will provide a fix within 72 hours for critical vulnerabilities

### Bug Bounty Program
We offer bounties for responsibly disclosed security vulnerabilities. Bounty amounts depend on the severity of the issue:

| Severity | Bounty Range |
|----------|--------------|
| Critical | $500 - $2,000 |
| High | $200 - $500 |
| Medium | $50 - $200 |
| Low | $10 - $50 |

## ✅ Supported Versions

We provide security updates for the following versions:

| Version | Supported |
|---------|-----------|
| 0.1.x | ✅ Current stable |
| < 0.1.0 | ❌ Unsupported |

Always use the latest stable version for production deployments.

## 🔒 Security Best Practices

### For Users
1. **Run as non-root user**: Never run nanobot-node as root or with administrative privileges
2. **Restrict workspace**: Configure the workspace directory to a non-sensitive location
3. **Limit tool access**: Only enable tools that you actually need
4. **Use API keys with minimal permissions**: When providing API keys for models or services, use keys with only the required permissions
5. **Keep it updated**: Regularly update to the latest version to get security patches
6. **Use strong authentication**: Enable authentication for all channels and API endpoints
7. **Backup your data**: Regularly backup your configuration and session data

### For Developers
1. **Follow secure coding guidelines**: All code must pass security reviews before merging
2. **No hardcoded secrets**: Never hardcode API keys, passwords, or tokens in the codebase
3. **Input validation**: All user inputs and parameters must be validated
4. **Dependency scanning**: Regularly scan dependencies for known vulnerabilities
5. **Security testing**: Run static analysis, penetration testing, and fuzz testing before releases
6. **Least privilege**: Code should run with the minimal permissions required

## 🚫 Prohibited Use Cases

nanobot-node should NOT be used for:
- Any illegal activities
- Processing sensitive personal data without proper encryption and compliance
- Running in production environments without proper security hardening
- Executing untrusted code or skills from unknown sources
- Granting access to untrusted users without proper permission controls

## 📧 Contact

For any security-related questions or concerns, contact security@nanobot.ai.

---

**Last updated: March 2026**
