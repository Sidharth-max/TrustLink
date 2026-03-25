# Meta WhatsApp Webhook Setup Guide

To receive incoming Hindu/Diwali greetings, messages, and delivery reports, you **must** link your Meta Developer App to your running server.

## 1. Meta App Configuration (Meta Dashboard)
1. Go to [developers.facebook.com](https://developers.facebook.com) → Your App.
2. In the left sidebar, click **WhatsApp** → **Configuration**.
3. Under **Webhook**, click **Edit**.
4. Set the following:
   - **Callback URL**: `https://trustlink.pjpt.prg/webhook`
   - **Verify Token**: (Matches your `VERIFY_TOKEN` in `.env`)
5. Click **Verify and Save**. Meta will send a GET request to your server to confirm it's ready!

## 2. Subscribe to Webhook Fields
After saving, click **Manage** under **Webhook Fields**.
1. **Find `messages`** and click **Subscribe**.
2. **Find `message_events`** and click **Subscribe**.
3. (Optional) **Find `message_status`** for delivery updates.

## 3. Verify Local Connectivity (External Tool)
If you're developing locally and don't have a public domain yet, use a tool like **ngrok** to create a temporary HTTPS tunnel:
```bash
# Expose Port 3001 to the internet
ngrok http 3001
```
Copy the `https://xxxx.ngrok-free.app` URL and use it as your **Callback URL** in the Meta dashboard (add `/webhook` at the end).

## 4. Troubleshooting
- **Verify Token Mismatch**: Check if `VERIFY_TOKEN` in `.env` is identical to what you paste in Meta.
- **Port 80/443 Access**: Ensure your AWS/Firewall allows incoming traffic to the server.
- **SSL Required**: Meta **only** allows `https://` for callback URLs.
