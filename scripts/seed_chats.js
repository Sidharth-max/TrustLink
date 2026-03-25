/**
 * scripts/seed_chats.js
 * Seeds fake contacts, conversations, and messages for testing.
 */

'use strict';

require('dotenv').config();
const { pool } = require('../src/utils/db');

async function main() {
  console.log('Seeding fake chats...');

  try {
    // 1. Get an agent ID (first one)
    const agentRes = await pool.query('SELECT id FROM agents LIMIT 1');
    const agentId = agentRes.rows[0]?.id || null;

    const fakeData = [
      {
        name: 'Sidharth Jain',
        phone: '919876543210',
        messages: [
          { direction: 'inbound', content: 'Hello, I would like to know about the temple timings.', status: 'received' },
          { direction: 'outbound', content: 'Sure! The temple opens at 6 AM and closes at 9 PM.', status: 'read' },
          { direction: 'inbound', content: 'Thank you! Is there any special pooja today?', status: 'received' }
        ]
      },
      {
        name: 'John Doe',
        phone: '1234567890',
        messages: [
          { direction: 'inbound', content: 'Can I donate online?', status: 'received' },
          { direction: 'outbound', content: 'Yes, you can use the donation link on our website.', status: 'delivered' }
        ]
      },
      {
        name: 'Jane Smith',
        phone: '0987654321',
        messages: [
          { direction: 'inbound', content: 'I want to volunteer for the upcoming event.', status: 'received' }
        ]
      }
    ];

    for (const data of fakeData) {
      // Create Contact
      const contactRes = await pool.query(
        `INSERT INTO contacts (name, phone) VALUES ($1, $2)
         ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [data.name, data.phone]
      );
      const contactId = contactRes.rows[0].id;

      // Create Conversation
      await pool.query(
        `INSERT INTO conversations (contact_id, assigned_to, status, bot_active)
         VALUES ($1, $2, 'open', false)
         ON CONFLICT (contact_id) DO NOTHING`,
        [contactId, agentId]
      );

      // Create Messages
      for (const msg of data.messages) {
        await pool.query(
          `INSERT INTO messages (contact_id, direction, content, status, sent_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [contactId, msg.direction, msg.content, msg.status]
        );
      }
    }

    console.log('✅ Seeding complete!');
  } catch (err) {
    console.error('❌ Failed to seed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
