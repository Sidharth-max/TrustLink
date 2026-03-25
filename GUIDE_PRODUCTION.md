# Production Deployment Checklist — WhatsApp Trust Manager

To go live for the Trust, follow these 5 steps to ensure security and reliability.

## 1. Static IP (AWS Elastic IP)
By default, EC2 IPs change on every restart. You **must** assign an Elastic IP:
1. Go to **EC2 Dashboard** → **Network & Security** → **Elastic IPs**.
2. Click **Allocate Elastic IP address**.
3. Once allocated, select it → **Actions** → **Associate Elastic IP address** → Select your Instance.

## 2. Domain Name & HTTPS (Mandatory)
Meta **requires** an `https://` URL for Webhooks.
1. Point your domain (**trustlink.pjpt.prg**) A-Record to your Elastic IP.
2. Install **Nginx** and **Certbot** on your server:
   ```bash
   sudo apt install nginx python3-certbot-nginx -y
   ```
3. Create an Nginx config (`/etc/nginx/sites-available/whatsapp`):
   ```nginx
   server {
       listen 80;
       server_name trustlink.pjpt.prg;
       location / {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
4. Enable and Get SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/whatsapp /etc/nginx/sites-enabled/
   sudo certbot --nginx -d trustlink.pjpt.prg
   ```

## 3. Production Environment Variables
Update your `.env` for production:
```env
NODE_ENV=production
PORT=3001
SESSION_SECRET=a-very-long-random-secret-string-123!@#
# Ensure DATABASE_URL uses the docker service 'db'
DATABASE_URL=postgres://postgres:Sidharth%4012@db:5432/whatsapp_trust
```

## 4. Security Lockdown
Restrict access so only the Webhook and Admin Panel are reachable.
1. In your **AWS Security Group**:
   - Keep **Port 80/443** (HTTP/HTTPS) open to **0.0.0.0/0** (Everyone).
   - **Close Port 3001** (Now handled by Nginx).
   - Keep **Port 22** (SSH) restricted to **My IP** only.

## 5. Automatic Restarts
Docker Compose already handles restarts (`restart: always`), but you should also ensure Docker starts on boot:
```bash
sudo systemctl enable docker
```

---
**Final Step**: Once your `https://trustlink.pjpt.prg/webhook` is live, go to Meta and click **Verify and Save**!
