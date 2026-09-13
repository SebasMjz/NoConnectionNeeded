/**
 * Pollar P2P Channels Engine
 * Supports offline transfers:
 * 1. NFC (Near Field Communication / Tap-to-Pay via Web NFC NDEFReader & Android Native)
 */

/**
 * -------------------------------------------------------------
 * NFC (NEAR FIELD COMMUNICATION / TAP-TO-PAY)
 * -------------------------------------------------------------
 */

/**
 * Checks whether Web NFC is supported by the current browser/device
 */
export function isNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/**
 * Starts listening for NFC Tap-to-Pay payments (Merchant / Receiver Mode)
 * @param {Function} onPayloadReceived Callback receiving parsed JSON payload
 * @param {Function} onStatusChange Callback for status strings
 * @returns {Promise<{ stop: Function }>}
 */
export async function startNfcReceiver(onPayloadReceived, onStatusChange = () => {}) {
  if (!isNfcSupported()) {
    onStatusChange({
      status: 'unsupported',
      message: 'Web NFC no está disponible en este navegador.'
    });
    return { stop: () => {} };
  }

  try {
    const ndef = new window.NDEFReader();
    const abortController = new AbortController();

    await ndef.scan({ signal: abortController.signal });
    onStatusChange({
      status: 'listening',
      message: '📡 NFC Activo: Acerca el teléfono del pagador parte trasera con trasera.'
    });

    ndef.onreading = (event) => {
      try {
        const decoder = new TextDecoder();
        for (const record of event.message.records) {
          if (record.recordType === 'text' || record.recordType === 'mime' || record.recordType === 'unknown') {
            const rawText = decoder.decode(record.data);
            console.log('[NFC] Mensaje NDEF recibido:', rawText);
            const parsed = JSON.parse(rawText);
            if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
            onPayloadReceived(parsed);
            break;
          }
        }
      } catch (err) {
        console.warn('[NFC] Error decodificando payload NDEF:', err.message);
        onStatusChange({
          status: 'error',
          message: 'Error al leer datos NFC. Verifica que sea un pago Avalanche válido.'
        });
      }
    };

    ndef.onreadingerror = () => {
      onStatusChange({
        status: 'error',
        message: 'Error de lectura NFC. Mantén los teléfonos juntos unos segundos.'
      });
    };

    return {
      stop: () => {
        try {
          abortController.abort();
        } catch (e) {}
      }
    };
  } catch (err) {
    console.error('[NFC] Error iniciando escáner NFC:', err);
    onStatusChange({
      status: 'error',
      message: err.name === 'NotAllowedError'
        ? 'Permiso de NFC denegado por el usuario.'
        : `Error NFC: ${err.message}`
    });
    return { stop: () => {} };
  }
}

/**
 * Transmits a signed payment voucher via NFC write (Payer / Customer Mode)
 * @param {Object} paymentPayload The signed offline transaction or invoice
 * @param {Function} onStatusChange Callback for status updates
 */
export async function sendNfcPayload(paymentPayload, onStatusChange = () => {}) {
  if (!isNfcSupported()) {
    throw new Error('Web NFC no está soportado en este dispositivo.');
  }

  try {
    const ndef = new window.NDEFReader();
    onStatusChange({
      status: 'ready_to_tap',
      message: '📱 Listo para pagar: Toca la parte trasera del teléfono del comercio.'
    });

    const serialized = JSON.stringify(paymentPayload);

    await ndef.write({
      records: [
        {
          recordType: 'text',
          data: serialized
        }
      ]
    });

    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    onStatusChange({
      status: 'transmitted',
      message: '✅ ¡Pago transmitido por NFC con éxito!'
    });

    return { success: true };
  } catch (err) {
    console.error('[NFC Write Error]', err);
    onStatusChange({
      status: 'error',
      message: `Error al transmitir por NFC: ${err.message}`
    });
    throw err;
  }
}
