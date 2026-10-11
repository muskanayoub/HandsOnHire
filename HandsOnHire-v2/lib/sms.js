'use strict';
/**
 * SMS delivery hook.
 *
 * Demo mode (default): the OTP is printed to the server console and also
 * returned by the API so the prototype works with no SMS account.
 *
 * Production: set OTP_MODE=production and implement the provider call below
 * (MSG91, Twilio Verify, Fast2SMS, etc. all work). In production the API
 * never returns the OTP to the browser.
 */
async function sendOtpSms(phone, code) {
  if (process.env.OTP_MODE === 'production') {
    // TODO: call your SMS provider here, e.g.
    // await fetch('https://api.msg91.com/...', { method: 'POST', headers: {...}, body: JSON.stringify({ mobile: '91' + phone, otp: code }) });
    console.log(`[SMS] (no provider configured) OTP for ${phone.slice(0, 2)}******${phone.slice(-2)} was generated`);
    return;
  }
  console.log(`[SMS demo] OTP for ${phone}: ${code}`);
}

module.exports = { sendOtpSms };
