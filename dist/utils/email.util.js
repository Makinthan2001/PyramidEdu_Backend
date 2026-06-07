"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const AppError_1 = require("./AppError");
// Ensure the required environment variables are set
const { SMTP_USER, SMTP_PASS, SENDER_EMAIL } = process.env;
const transporter = nodemailer_1.default.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false, // Fix for self-signed certificate errors
    },
});
const sendEmail = (to, subject, htmlContent) => __awaiter(void 0, void 0, void 0, function* () {
    if (!SMTP_USER || !SMTP_PASS || !SENDER_EMAIL) {
        console.warn('Missing SMTP credentials. Email not sent.');
        return;
    }
    try {
        const info = yield transporter.sendMail({
            from: `"PyramidEdu" <${SENDER_EMAIL}>`,
            to,
            subject,
            html: htmlContent,
        });
        console.log(`Email sent: ${info.messageId}`);
        return info;
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw new AppError_1.AppError('Failed to send email. Please try again later.', 500);
    }
});
exports.sendEmail = sendEmail;
