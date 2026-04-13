import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    console.log(`Initializing EmailService with Gmail service`);

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      console.log(`Attempting to send email to ${to}...`);
      const info = await this.transporter.sendMail({
        from: `"ZaloEdu System" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('EmailService Detailed Error:', JSON.stringify(error, null, 2));
      return false;
    }
  }

  async sendOtp(to: string, code: string, type: 'register' | 'forgot_password' | 'change_password') {
    let subject = '';
    let title = '';

    if (type === 'register') {
      subject = 'Mã xác thực đăng ký ZaloEdu';
      title = 'Xác thực đăng ký';
    } else if (type === 'forgot_password') {
      subject = 'Mã đặt lại mật khẩu ZaloEdu';
      title = 'Đặt lại mật khẩu';
    } else {
      subject = 'Mã xác thực đổi mật khẩu ZaloEdu';
      title = 'Đổi mật khẩu';
    }
    
    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #135bec; text-align: center;">ZaloEdu</h2>
        <p>Chào bạn, đây là mã OTP của bạn để <strong>${title}</strong>:</p>
        <div style="background: #f4f7ff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #135bec; border-radius: 8px;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">Mã này sẽ hết hạn trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
      </div>
    `;

    return this.sendMail(to, subject, html);
  }
}
