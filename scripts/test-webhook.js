/**
 * scripts/test-webhook.js
 * Simulates a Meta WhatsApp Webhook call for testing purposes.
 */
const axios = require('axios');

async function sendTestWebhook() {
  const url = 'http://localhost:3001/trust-webhook';
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15555555555',
                phone_number_id: '1035355016333144'
              },
              contacts: [
                {
                  profile: { name: 'Test User' },
                  wa_id: '919876543210'
                }
              ],
              messages: [
                {
                  from: '919876543210',
                  id: 'wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgSRTIxMTU1OTU4QURDNEFFM0JDAA==',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: 'Hello from test script!' },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    console.log('Sending test webhook to:', url);
    const response = await axios.post(url, payload);
    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
  } catch (error) {
    console.error('Error sending webhook:', error.response?.data || error.message);
  }
}

sendTestWebhook();
