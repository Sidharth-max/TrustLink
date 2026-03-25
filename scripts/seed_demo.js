/**
 * scripts/seed_demo.js
 * Seeds the database with fake contacts and chats for testing the new layout.
 */

'use strict';

require('dotenv').config();
const { query } = require('../src/utils/db');

async function seed() {
  console.log('[SEED] Starting demo data injection...');

  try {
    // 1. Get first available agent
    const agentRes = await query('SELECT id, name FROM agents LIMIT 1');
    const agent = agentRes.rows[0];
    if (!agent) {
       console.error('[SEED] No agents found. Please create an agent first.');
       process.exit(1);
    }
    console.log(`[SEED] Assigning chats to: ${agent.name} (ID: ${agent.id})`);

    // 2. Mock Data Definitions
    const demoContacts = [
      { name: 'Siddharth Jain', phone: '919876543210', messages: [
        { dir: 'inbound', text: 'Hi, is the Trust Manager ready for my team?' },
        { dir: 'outbound', text: 'Yes! We just finished the premium overhaul.' },
        { dir: 'inbound', text: 'Amazing. Can I test the broadcast feature now?' }
      ]},
      { name: 'John Doe', phone: '15551234567', messages: [
        { dir: 'inbound', text: 'Hey, I wanted to ask about the chatbot integration.' },
        { dir: 'outbound', text: 'Sure, we support keyword-based bot flows.' }
      ]},
      { name: 'Priya Sharma', phone: '919000000001', messages: [
        { dir: 'inbound', text: 'When will the display name be approved?' }
      ]},
      { name: 'Global Support', phone: '442079460958', messages: [
        { dir: 'outbound', text: 'Hello! Your ticket #405 has been resolved.' },
        { dir: 'inbound', text: 'Thanks for the quick update.' }
      ]},
      { name: 'Testing Bot', phone: '1000000001', messages: [
        { dir: 'inbound', text: 'AUTO_REPLY_TEST: Initializing flow setup.' }
      ]}
    ];

    for (const c of demoContacts) {
      console.log(`[SEED] Creating contact: ${c.name} (${c.phone})`);
      
      // UPSERT Contact
      const cRes = await query(
        `INSERT INTO contacts (name, phone, tags) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (phone) DO UPDATE SET name = $1 
         RETURNING id`,
        [c.name, c.phone, 'Mock, Demo']
      );
      const contactId = cRes.rows[0].id;

      // UPSERT Conversation
      await query(
        `INSERT INTO conversations (contact_id, assigned_to, status, updated_at) 
         VALUES ($1, $2, 'open', NOW()) 
         ON CONFLICT (contact_id) DO UPDATE SET status = 'open', updated_at = NOW()`,
        [contactId, agent.id]
      );

      // Insert Messages with staggered timestamps
      for (let i = 0; i < c.messages.length; i++) {
        const m = c.messages[i];
        // Ensure newest message is exactly NOW, older ones precede it
        const backInTime = (c.messages.length - 1 - i) * 60; // stagger by minutes
        const time = new Date(Date.now() - backInTime * 1000);

        await query(
          `INSERT INTO messages (contact_id, direction, content, status, created_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [contactId, m.dir, m.text, m.dir === 'inbound' ? 'received' : 'sent', time]
        );
      }
    }

    console.log('[SEED] Demo data injected successfully!');
  } catch (err) {
    console.error('[SEED] Error:', err.message);
  } finally {
    const { pool } = require('../src/utils/db');
    await pool.end();
    process.exit(0);
  }
}

seed();
