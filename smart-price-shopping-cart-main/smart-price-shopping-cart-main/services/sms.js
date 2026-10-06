/**
 * SMS sending, abstracted behind one function so a real provider can be
 * dropped in later without touching the auth routes. No provider is
 * configured yet: until SMS_PROVIDER is set, every OTP is logged to the
 * console instead of actually being texted (STUB_MODE).
 *
 * To go live:
 *   1. `npm install twilio` (or the SDK for whichever provider you pick)
 *   2. Set SMS_PROVIDER=twilio and the provider's credentials as env vars
 *      (e.g. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
 *   3. Implement that branch below using the provider's SDK/HTTP API.
 *
 * Example (Twilio):
 *   const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
 *   await client.messages.create({
 *       to: mobile,
 *       from: process.env.TWILIO_FROM_NUMBER,
 *       body: message
 *   });
 *
 * Example (MSG91): call MSG91's OTP API (https://docs.msg91.com/otp) with
 * fetch(), using MSG91_AUTH_KEY and a configured OTP template id.
 */

const SMS_PROVIDER = process.env.SMS_PROVIDER || null;
const STUB_MODE = !SMS_PROVIDER;

async function deliver(mobile, message) {
    if (STUB_MODE) {
        console.log(`[SMS STUB] would text ${mobile}: "${message}"`);
        return { sent: false, stub: true };
    }

    throw new Error(
        `SMS_PROVIDER="${SMS_PROVIDER}" has no implementation yet in services/sms.js.`
    );
}

async function sendOtp(mobile, otpCode) {
    return deliver(mobile, `Your Shopping Cart OTP is ${otpCode}. It expires in 10 minutes.`);
}

async function sendPriceAlert(mobile, productName, price) {
    return deliver(
        mobile,
        `Price Alert: ${productName} just dropped to ₹${price}. Grab it now!`
    );
}

module.exports = { sendOtp, sendPriceAlert, STUB_MODE };
