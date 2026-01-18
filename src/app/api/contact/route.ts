import { NextResponse } from 'next/server';
import { sanitizeString, sanitizeEmail } from '@/app/utils/sanitize';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    let reason = formData.get('reason') as string;
    let name = formData.get('name') as string;
    let email = formData.get('email') as string;
    let description = formData.get('description') as string;

    // Sanitize inputs
    reason = sanitizeString(reason || '');
    name = sanitizeString(name || '');
    email = sanitizeEmail(email || '');
    description = sanitizeString(description || '');

    if (!reason || !name || !email || !description) {
      return NextResponse.json(
        { error: 'All fields are required and must be valid' },
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

    // Log submission to the console
    console.log('=== CONTACT FORM SUBMISSION ===');
    console.log('Reason:', reason);
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Description:', description);
    console.log('Images:', images.length);
    console.log('===============================');
    
    return NextResponse.json({
      success: true,
      message: 'Message received. We will get back to you shortly.',
    });

  } catch (error: any) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    );
  }
}
