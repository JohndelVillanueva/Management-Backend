// src/services/emailService.ts
import nodemailer from "nodemailer";
import { config } from "../config/EmailConfig.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Create the transporter once using config
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "kleigh.villanueva031@gmail.com",
    pass: "uopy wxrm rnkv mhsy", // your Gmail App Password
  },
  tls: {
    ciphers: "SSLv3",
    minVersion: "TLSv1.2",
  },
  logger: true,
  debug: process.env.NODE_ENV !== "production",
});


// Add connection verification
transporter.verify((error) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP server is ready to take our messages");
  }
});

// Add connection verification
transporter.verify((error) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP server is ready to take our messages");
  }
});

async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"${config.email.fromName}" <${config.email.fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || options.subject,
      html: options.html || `<p>${options.text || options.subject}</p>`,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
}

async function sendVerificationEmail(
  email: string,
  token: string,
  userId: string
): Promise<void> {
  try {
    console.log("[Email Service] Starting Gmail verification for:", email);

    // 1. Validate configuration with Gmail-specific checks
    if (!config?.email?.smtpHost?.includes("gmail.com")) {
      console.warn("Using Gmail SMTP but configured host is not Gmail");
    }

    // 2. Construct verification URL with enhanced security
const rawBaseUrl = config.app.baseUrl ?? '';
const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;
console.log('[Email Service] Verification URL:', verificationUrl);

    // 3. Create Gmail-optimized email template
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
        <div style="background-color: #1a73e8; padding: 15px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px;">
          <h2 style="color: white; margin: 0;">DHVSU Account Verification</h2>
        </div>
        
        <p style="font-size: 16px;">Please verify your email address to activate your PSU Management System account.</p>
        
        <a href="${verificationUrl}"
           style="display: inline-block; padding: 12px 24px; background-color: #1a73e8; 
                  color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 15px 0;">
          Verify Email Address
        </a>
        
        <p style="font-size: 14px; color: #666;">Or copy this link to your browser:</p>
        <p style="word-break: break-all; font-size: 12px; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">
          ${verificationUrl}
        </p>
        
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777;">
          <p>If you didn't request this, please ignore this email.</p>
          <p>© ${new Date().getFullYear()} DHVSU Management System</p>
        </div>
      </div>
    `;

    // 4. Enhanced Gmail mail options
    const mailOptions = {
      from: `"${config.email.fromName}" <${config.email.fromAddress}>`,
      to: email,
      subject: "Verify Your DHVSU Account",
      html: html,
      text: `Please verify your DHVSU account by visiting:\n${verificationUrl}`,
      priority: "high" as "high",
      headers: {
        "X-Priority": "1",
        "X-Mailer": "DHVSU Management System",
        "X-Application": "DHVSU",
      },
      // Gmail-specific options
      dsn: {
        id: `verification-${Date.now()}`,
        return: "headers",
        notify: ["failure", "delay"],
        recipient: config.email.fromAddress,
      },
    };

    console.log("[Email Service] Gmail options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      priority: mailOptions.priority,
    });

    // 5. Enhanced Gmail sending with retries
    let retries = 3;
    while (retries > 0) {
      try {
        const info = await transporter.sendMail(mailOptions);
        console.log("[Email Service] Gmail response:", {
          messageId: (info as any).messageId,
          accepted: (info as any).accepted,
          response: (info as any).response
            ? (info as any).response.substring(0, 100) + "..."
            : "",
        });
        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;

        console.warn(
          `[Email Service] Gmail send failed, ${retries} retries left. Error:`,
          (error as any).message
        );
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      }
    }
  } catch (error) {
    console.error("[Email Service] Gmail verification failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      code: error instanceof Error ? (error as any).code : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      email,
      timestamp: new Date().toISOString(),
    });

    // Special handling for common Gmail errors
    if (error instanceof Error) {
      if (error.message.includes("Invalid login")) {
        throw new Error(
          "Gmail authentication failed. Please check your SMTP credentials."
        );
      }
      if (error.message.includes("Message rejected")) {
        throw new Error(
          "Gmail rejected the email. Please check your account limits or content."
        );
      }
    }

    throw new Error(
      `Failed to send verification to ${email}. Please try again later.`
    );
  }
}

async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${config.app.baseUrl}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2>Password Reset Request</h2>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}"
         style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
      <p>This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html,
  });
}

export const emailService = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
