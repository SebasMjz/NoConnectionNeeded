import { Html5Qrcode } from 'html5-qrcode';

/**
 * Downloads a QR code data URL as a PNG image file
 */
export function downloadQrImage(dataUrl, filename = 'pollar_qr.png') {
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Failed to download QR code:', err);
    return false;
  }
}

/**
 * Shares a QR code image and text summary to WhatsApp or native share sheet
 */
export async function shareQrToWhatsApp({ dataUrl, title = 'Pollar QR', text = '', filename = 'pollar_qr.png' }) {
  // 1. Try sharing image file via Web Share API (native share on Android/iOS)
  try {
    if (navigator.share && navigator.canShare && dataUrl) {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title,
          text: text ? `${text}\n_Pollar Offline Pay_` : '_Pollar Offline Pay_',
          files: [file]
        });
        return { success: true, method: 'native_share' };
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Native file share notice:', err);
    } else {
      // User cancelled share dialog
      return { success: false, cancelled: true };
    }
  }

  // 2. Direct WhatsApp Web / App intent fallback with formatted message
  try {
    const whatsappMessage = `${title ? `*${title}*\n` : ''}${text ? `${text}\n\n` : ''}_Enviado desde Pollar Offline Pay_`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
    return { success: true, method: 'whatsapp_url' };
  } catch (err) {
    console.error('WhatsApp redirect failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Scans and decodes a QR code from an uploaded Image File
 */
export async function scanQrFromImageFile(file) {
  if (!file) throw new Error('No se seleccionó ningún archivo de imagen');

  // Ensure helper off-screen element exists for Html5Qrcode
  let helperElem = document.getElementById('pollar-file-reader-target');
  if (!helperElem) {
    helperElem = document.createElement('div');
    helperElem.id = 'pollar-file-reader-target';
    helperElem.style.position = 'fixed';
    helperElem.style.left = '-9999px';
    helperElem.style.top = '-9999px';
    helperElem.style.width = '320px';
    helperElem.style.height = '320px';
    helperElem.style.opacity = '0';
    helperElem.style.pointerEvents = 'none';
    helperElem.style.overflow = 'hidden';
    document.body.appendChild(helperElem);
  }

  const html5QrCode = new Html5Qrcode('pollar-file-reader-target');
  try {
    const decodedText = await html5QrCode.scanFile(file, false);
    try {
      html5QrCode.clear();
    } catch (e) {}
    return decodedText;
  } catch (err) {
    try {
      html5QrCode.clear();
    } catch (e) {}
    throw new Error('No se detectó un código QR legible en la imagen. Verifica que la foto esté bien enfocada y contenga el QR.');
  }
}
