import { NextResponse } from 'next/server';

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
    const images: { filename: string }[] = [];
    let imageIndex = 0;
    while (formData.has(`image_${imageIndex}`)) {
      const imageFile = formData.get(`image_${imageIndex}`) as File;
      if (imageFile) {
        images.push({
          filename: imageFile.name,
        });
      }
      imageIndex++;
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

    // Log to console (for Vercel logs / server logs)
    console.log('=== CONTACT FORM SUBMISSION ===');
    console.log('Reason:', reasonLabels[reason] || reason);
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Description:', description);
    console.log('Images:', images.length, images.map(img => img.filename).join(', '));
    console.log('===============================');
    
    return NextResponse.json({
      success: true,
      message: 'Message received. We will get back to you soon!',
    });
  } catch (error: any) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

