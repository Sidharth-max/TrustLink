# AWS Deployment Guide — WhatsApp Trust Manager

This guide explains how to deploy the application to **AWS EC2 (Free Tier)** using Docker.

## 1. AWS EC2 Setup (Console)
1. **Launch Instance**: Select **Ubuntu 22.04 LTS** (64-bit x86).
2. **Instance Type**: Select **t2.micro** (Free Tier eligible).
3. **Key Pair**: Create or select a key pair (`.pem` file) to SSH into the server.
4. **Security Group**:
   - Allow **SSH** (Port 22).
   - Allow **HTTP** (Port 80) and **HTTPS** (Port 443).
   - Allow Custom TCP **Port 3001** (for initial testing, if not using a reverse proxy).

## 2. Server Configuration (SSH)
Connect to your instance:
```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

Update and install Docker:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
# Log out and log back in for group changes to take effect
exit
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## 3. Application Deployment
1. **Clone the repo**:
   ```bash
   git clone <your-repository-url> wh-sol
   cd wh-sol
   ```
2. **Setup .env**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   **Important**: Set `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `VERIFY_TOKEN`, and `DATABASE_URL`.
   *Example `DATABASE_URL` for docker-compose:* `postgres://postgres:Sidharth%4012@db:5432/whatsapp_trust`

3. **Start with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```

4. **Verify**:
   - Check logs: `docker-compose logs -f app`
   - Access the dashboard at `http://your-ec2-public-ip:3001`

## 4. HTTPS (Optional but Recommended)
For Meta Webhook to work, you **must** use HTTPS. You can:
- Use **Nginx** with **Certbot** (Let's Encrypt).
- Use an **AWS Application Load Balancer (ALB)** with an **ACM Certificate**.
- Use **Cloudflare** workers/tunnels to expose your local port via HTTPS.

---

**Next Step**: follow `GUIDE_WEBHOOK.md` to link Meta to this server!
