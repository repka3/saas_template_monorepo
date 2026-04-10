import nodemailer from 'nodemailer'

import { env } from './env.js'
import { logger } from './logger.js'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER
    ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
    : undefined,
})

type AuthEmailOptions = {
  html: string
  subject: string
  text: string
  to: string
}

const renderEmailFrame = ({
  body,
  eyebrow,
  footer,
  title,
}: {
  body: string
  eyebrow: string
  footer: string
  title: string
}) => `
  <div style="background:#f4efe6;padding:32px;font-family:Arial,sans-serif;color:#1d1a17;">
    <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid #e6dccf;border-radius:24px;overflow:hidden;">
      <div style="padding:32px 32px 24px;background:linear-gradient(135deg,#17324d 0%,#314f6d 100%);color:#fffdf9;">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.78;">${eyebrow}</p>
        <h1 style="margin:0;font-size:28px;line-height:1.1;">${title}</h1>
      </div>
      <div style="padding:32px;">${body}</div>
      <div style="padding:0 32px 32px;color:#5b5145;font-size:13px;line-height:1.6;">
        ${footer}
      </div>
    </div>
  </div>
`

export const sendAuthEmail = async ({ html, subject, text, to }: AuthEmailOptions) => {
  const info = await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  })

  logger.info({ messageId: info.messageId, to }, 'auth email sent')
}

export const sendVerificationEmailMessage = async ({
  to,
  verificationUrl,
}: {
  to: string
  verificationUrl: string
}) => {
  const html = renderEmailFrame({
    eyebrow: 'Email Verification',
    title: 'Verify your email address',
    body: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Finish setting up your account by verifying this email address.</p>
      <p style="margin:0 0 24px;">
        <a href="${verificationUrl}" style="display:inline-block;padding:14px 20px;border-radius:999px;background:#17324d;color:#fffdf9;text-decoration:none;font-weight:600;">Verify email</a>
      </p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#5b5145;">If the button does not work, open this link:</p>
      <p style="margin:8px 0 0;font-size:14px;line-height:1.7;word-break:break-word;"><a href="${verificationUrl}" style="color:#17324d;">${verificationUrl}</a></p>
    `,
    footer: 'You can ignore this message if you did not request a new account.',
  })

  await sendAuthEmail({
    to,
    subject: 'Verify your email address',
    text: `Verify your email address by opening this link: ${verificationUrl}`,
    html,
  })
}

export const sendPasswordResetEmailMessage = async ({ resetUrl, to }: { resetUrl: string; to: string }) => {
  const html = renderEmailFrame({
    eyebrow: 'Password Reset',
    title: 'Reset your password',
    body: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">A password reset was requested for this account. Use the link below to choose a new password.</p>
      <p style="margin:0 0 24px;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 20px;border-radius:999px;background:#9a3412;color:#fffdf9;text-decoration:none;font-weight:600;">Reset password</a>
      </p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#5b5145;">If the button does not work, open this link:</p>
      <p style="margin:8px 0 0;font-size:14px;line-height:1.7;word-break:break-word;"><a href="${resetUrl}" style="color:#9a3412;">${resetUrl}</a></p>
    `,
    footer: 'If you did not request a password reset, you can ignore this email.',
  })

  await sendAuthEmail({
    to,
    subject: 'Reset your password',
    text: `Reset your password by opening this link: ${resetUrl}`,
    html,
  })
}
