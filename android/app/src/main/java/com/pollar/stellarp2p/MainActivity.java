package com.pollar.stellarp2p;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.content.Context;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "PollarNFC";
    private NfcAdapter nfcAdapter;
    private PendingIntent pendingIntent;
    private IntentFilter[] intentFiltersArray;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            nfcAdapter = NfcAdapter.getDefaultAdapter(this);
            if (nfcAdapter != null) {
                Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    flags |= PendingIntent.FLAG_MUTABLE;
                }
                pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

                IntentFilter ndefFilter = new IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED);
                try {
                    ndefFilter.addDataType("*/*");
                } catch (IntentFilter.MalformedMimeTypeException e) {
                    Log.e(TAG, "Malformed MIME type", e);
                }

                IntentFilter tagFilter = new IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED);
                IntentFilter techFilter = new IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED);

                intentFiltersArray = new IntentFilter[]{ndefFilter, techFilter, tagFilter};
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing NFC adapter", e);
        }

        handleNfcIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        if (nfcAdapter != null && pendingIntent != null) {
            try {
                nfcAdapter.enableForegroundDispatch(this, pendingIntent, intentFiltersArray, null);
            } catch (Exception e) {
                Log.e(TAG, "Error enabling foreground dispatch", e);
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (nfcAdapter != null) {
            try {
                nfcAdapter.disableForegroundDispatch(this);
            } catch (Exception e) {
                Log.e(TAG, "Error disabling foreground dispatch", e);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNfcIntent(intent);
    }

    private void handleNfcIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)
                || NfcAdapter.ACTION_TAG_DISCOVERED.equals(action)
                || NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)) {

            Log.i(TAG, "NFC Intent received with action: " + action);
            triggerVibration();

            Parcelable[] rawMessages = intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);
            if (rawMessages != null && rawMessages.length > 0) {
                NdefMessage message = (NdefMessage) rawMessages[0];
                for (NdefRecord record : message.getRecords()) {
                    byte[] payload = record.getPayload();
                    if (payload != null && payload.length > 0) {
                        String text = extractNdefText(payload);
                        if (text != null && !text.isEmpty()) {
                            dispatchNfcDataToWeb(text);
                            break;
                        }
                    }
                }
            } else {
                Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
                if (tag != null) {
                    try {
                        android.nfc.tech.Ndef ndef = android.nfc.tech.Ndef.get(tag);
                        if (ndef != null) {
                            ndef.connect();
                            NdefMessage ndefMessage = ndef.getNdefMessage();
                            if (ndefMessage != null) {
                                for (NdefRecord record : ndefMessage.getRecords()) {
                                    byte[] payload = record.getPayload();
                                    if (payload != null && payload.length > 0) {
                                        String text = extractNdefText(payload);
                                        if (text != null && !text.isEmpty()) {
                                            dispatchNfcDataToWeb(text);
                                            try { ndef.close(); } catch (Exception ignored) {}
                                            return;
                                        }
                                    }
                                }
                            }
                            try { ndef.close(); } catch (Exception ignored) {}
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Direct NDEF read notice: " + e.getMessage());
                    }

                    byte[] id = tag.getId();
                    String tagIdHex = bytesToHex(id);
                    Log.i(TAG, "Discovered NFC Tag / Contact ID: " + tagIdHex);
                    dispatchNfcDataToWeb("{\"type\":\"POLLAR_NFC_TAG\",\"tagId\":\"" + tagIdHex + "\"}");
                }
            }
        }
    }

    private String extractNdefText(byte[] payload) {
        try {
            int status = payload[0] & 0xff;
            int langCodeLength = status & 0x3f;
            int textLength = payload.length - 1 - langCodeLength;
            if (textLength > 0) {
                return new String(payload, 1 + langCodeLength, textLength, StandardCharsets.UTF_8);
            }
            return new String(payload, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return new String(payload, StandardCharsets.UTF_8);
        }
    }

    private void dispatchNfcDataToWeb(final String data) {
        if (data == null || data.isEmpty()) return;
        runOnUiThread(() -> {
            try {
                String safeJson = data.replace("\\", "\\\\")
                        .replace("'", "\\'")
                        .replace("\n", " ")
                        .replace("\r", "");
                String js = "window.dispatchEvent(new CustomEvent('pollar_nfc_scanned', { detail: '" + safeJson + "' }));";
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error evaluating JS in webview", e);
            }
        });
    }

    private void triggerVibration() {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(80);
                }
            }
        } catch (Exception ignored) {}
    }

    private static String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }
}
