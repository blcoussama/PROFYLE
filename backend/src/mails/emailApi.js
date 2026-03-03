import {
    PASSWORD_RESET_REQUEST_TEMPLATE,
    PASSWORD_RESET_SUCCESS_TEMPLATE,
    VERIFICATION_EMAIL_TEMPLATE,
    APPLICATION_ACCEPTED_TEMPLATE,
    APPLICATION_REJECTED_TEMPLATE
} from "./emailTemplates.js";
import { transporter, sender } from './sendgridConfig.js';


export const SendVerificationEmail = async (email, verificationToken) => {
    try {
        await transporter.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to: email,
            subject: 'Verify Your Email - PROFYLE',
            html: VERIFICATION_EMAIL_TEMPLATE.replace("{verificationCode}", verificationToken),
        });
        console.log(`Verification email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending verification email:", error.message);
        throw new Error(`Error sending verification email: ${error.message}`);
    }
};

export const SendWelcomeEmail = async (email, username) => {
    try {
        await transporter.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to: email,
            subject: 'Welcome to PROFYLE!',
            html: `
                <p>Hi ${username},</p>
                <p>Welcome to PROFYLE! We're excited to have you on board.</p>
                <p>Start exploring job opportunities or posting your first job offer today.</p>
                <p>If you have any questions, feel free to reach out.</p>
                <p>Best regards,<br />The PROFYLE Team</p>
            `,
        });
        console.log(`Welcome email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending welcome email:", error.message);
        throw new Error(`Error sending welcome email: ${error.message}`);
    }
};

export const SendPasswordResetEmail = async (email, resetURL) => {
    try {
        await transporter.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to: email,
            subject: 'Reset Your Password - PROFYLE',
            html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL),
        });
        console.log(`Password reset email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending password reset email:", error.message);
        throw new Error(`Error sending password reset email: ${error.message}`);
    }
};

export const SendPasswordResetSuccessEmail = async (email) => {
    try {
        await transporter.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to: email,
            subject: 'Password Reset Successfully - PROFYLE',
            html: PASSWORD_RESET_SUCCESS_TEMPLATE,
        });
        console.log(`Password reset success email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending password reset success email:", error.message);
        throw new Error(`Error sending password reset success email: ${error.message}`);
    }
};

export const SendApplicationAcceptedEmail = async (email, applicantName, jobTitle, companyName) => {
    try {
        await transporter.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to: email,
            subject: 'Your Application Has Been Accepted - PROFYLE',
            html: APPLICATION_ACCEPTED_TEMPLATE
                .replace("{applicantName}", applicantName)
                .replace("{jobTitle}", jobTitle)
                .replace("{companyName}", companyName),
        });
        console.log(`Application accepted email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending application accepted email:", error.message);
        throw new Error(`Error sending application accepted email: ${error.message}`);
    }
};

export const SendApplicationRejectedEmail = async (email, applicantName, jobTitle, companyName) => {
    try {
        await transporter.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to: email,
            subject: 'Update on Your Application - PROFYLE',
            html: APPLICATION_REJECTED_TEMPLATE
                .replace("{applicantName}", applicantName)
                .replace("{jobTitle}", jobTitle)
                .replace("{companyName}", companyName),
        });
        console.log(`Application rejected email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending application rejected email:", error.message);
        throw new Error(`Error sending application rejected email: ${error.message}`);
    }
};
