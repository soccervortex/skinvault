import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const RECIPIENT_EMAIL = 'drmizayt2@gmail.com';

// Create transporter (using Gmail SMTP or your preferred email service)
function createTransporter() {
  // Option 1: Gmail SMTP (requires app password)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Option 2: Resend (recommended for production)
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  // Fallback: Use Ethereal Email for testing (no config needed)
  // This will log the email URL to console instead of actually sending
  return null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const reason = formData.get('reason') as string;
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const description = formData.get('description') as string;

    if (!reason || !name || !email || !description) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Collect images
    const images: { filename: string; content: Buffer }[] = [];
    let imageIndex = 0;
    while (formData.has(`image_${imageIndex}`)) {
      const imageFile = formData.get(`image_${imageIndex}`) as File;
      if (imageFile) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        images.push({
          filename: imageFile.name,
          content: buffer,
        });
      }
      imageIndex++;
    }

    const transporter = createTransporter();

    if (!transporter) {
      // Fallback: Log to console if no email service configured
      console.log('=== CONTACT FORM SUBMISSION ===');
      console.log('Reason:', reason);
      console.log('Name:', name);
      console.log('Email:', email);
      console.log('Description:', description);
      console.log('Images:', images.length);
      console.log('===============================');
      
      return NextResponse.json({
        success: true,
        message: 'Message received (logged to console - configure email service for actual delivery)',
      });
    }

    const reasonLabels: Record<string, string> = {
      payment: 'Payment Related',
      site: 'Site Related',
      bug: 'Bug Report',
      feature: 'Feature Request',
      pro: 'Pro Subscription',
      account: 'Account Issue',
      other: 'Other',
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #1e40af; }
            .value { margin-top: 5px; padding: 10px; background: white; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Contact Form Submission</h2>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Reason:</div>
                <div class="value">${reasonLabels[reason] || reason}</div>
              </div>
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${name}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value">${email}</div>
              </div>
              <div class="field">
                <div class="label">Description:</div>
                <div class="value">${description.replace(/\n/g, '<br>')}</div>
              </div>
              ${images.length > 0 ? `
              <div class="field">
                <div class="label">Images Attached:</div>
                <div class="value">${images.length} image(s)</div>
              </div>
              ` : ''}
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@skinvault.app',
      to: RECIPIENT_EMAIL,
      subject: `SkinVault Contact: ${reasonLabels[reason] || reason} - ${name}`,
      html: emailHtml,
      text: `
New Contact Form Submission

Reason: ${reasonLabels[reason] || reason}
Name: ${name}
Email: ${email}

Description:
${description}

${images.length > 0 ? `\nImages: ${images.length} image(s) attached\n` : ''}
      `.trim(),
      attachments: images.map(img => ({
        filename: img.filename,
        content: img.content,
      })),
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
    });
  } catch (error: any) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
