// Sends text messages to guardians.
// SMS_PROVIDER=console (default) prints the message in the terminal, for development.
// SMS_PROVIDER=africastalking sends a real SMS. It needs AT_USERNAME and AT_API_KEY. This path has not been tested against a live account yet.
const provider = process.env.SMS_PROVIDER || 'console';

async function sendSms(to, message) {
  if (provider === 'africastalking') {
    const body = new URLSearchParams({ username: process.env.AT_USERNAME, to, message });
    if (process.env.AT_SENDER_ID) body.set('from', process.env.AT_SENDER_ID);
    const r = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { apiKey: process.env.AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!r.ok) throw new Error(`SMS failed with status ${r.status}`);
    return;
  }
  if (process.env.NODE_ENV !== 'test') console.log(`\n[SMS to ${to}] ${message}\n`);
}
module.exports = { sendSms, provider };
