/**
 * Clipboard utility with better error handling
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // Try modern Clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed:', error);
      // Fall through to fallback method
    }
  }

  // Fallback for older browsers or non-secure contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');
    document.body.appendChild(textArea);
    
    // Select and copy
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (error) {
    console.warn('Fallback copy method failed:', error);
  }

  // Last resort: prompt-based manual copy (works on iOS Safari when clipboard access is blocked)
  try {
    window.prompt('Copy this text:', text);
  } catch {
    // ignore
  }
  return false;
}

