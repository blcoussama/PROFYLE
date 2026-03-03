import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Sender configuration
export const sender = {
    email: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    name: "PROFYLE",
};

// Nodemailer SMTP transporter
// Configure via .env: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS
// Works with Gmail (requires App Password), Outlook, Mailtrap, Brevo, etc.
export const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465', // true for port 465 (SSL), false for 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
