export const config = {
  email: {
    smtpHost: process.env.SMTP_HOST,       // e.g., 'smtp.gmail.com'
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),                          // e.g., 587 for TLS
    smtpSecure: process.env.SMTP_SECURE === 'true',                      // true for port 465, false for others
    smtpUser: process.env.SMTP_USER,     // your SMTP username
    smtpPassword: process.env.SMTP_PASSWORD,    // your SMTP password
    fromAddress: process.env.EMAIL_FROM_ADDRESS,    // sender email address
    fromName:process.env.EMAIL_FROM_NAME,              // sender name
  },
  app: {
    baseUrl: process.env.FRONTEND_BASE_URL,       // your application's base URL
  },
};