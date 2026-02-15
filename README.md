# 🔐 WhisperSafe — Anonymous Reporting + Secure Follow-Up

WhisperSafe is a privacy-first anonymous reporting platform designed for secure incident reporting and confidential follow-up communication.

It enables individuals to submit reports without creating accounts, receive a tracking ID, and continue encrypted follow-up conversations — while providing administrators with a secure triage dashboard and risk analysis tools.

---

## 🚀 Core Features

### 🕵️ Anonymous Reporting

* No user accounts required
* Secure report submission
* Unique Tracking ID for follow-up access

### 🔁 Secure Follow-Up System

* Thread-based communication using Tracking ID
* End-to-end encrypted message storage (AES-GCM)
* No exposure of reporter identity

### 🔐 Security & Encryption

* AES-GCM encrypted messages
* Encrypted file attachments
* Secure HTTP-only admin authentication cookies
* Protected admin routes

### 🧠 Smart Admin Command Center

* Report filtering & sorting
* Priority-based triage queue
* SLA visibility
* Risk signal detection
* Threat meter visualization
* Escalation / lockdown logic

### 📎 Secure Attachments

* Reporter uploads encrypted files
* Admin-only secure download
* No public file exposure

### 🎨 Modern UI

* Clean landing page
* Scroll reveal animations
* Responsive layout
* Security-focused design

---

## 🛠 Tech Stack

* **Next.js (App Router)**
* **Prisma ORM**
* **SQLite (Development)**
* **Node.js Runtime**
* **TypeScript**
* **AES-GCM Encryption (Node Crypto API)**

---

# 🧩 Project Structure Overview

```
app/              → Routes & UI (App Router)
lib/              → Security, encryption, auth, triage logic
prisma/           → Database schema & migrations
uploads/          → Encrypted file storage
```

---

# ⚙️ Getting Started (Local Setup)

## 1️⃣ Install Dependencies

```bash
npm install
```

---

## 2️⃣ Setup Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./prisma/dev.db"

# Admin authentication secret
ADMIN_SECRET="your-admin-secret"

# 32-byte encryption key for AES-GCM
ENCRYPTION_KEY="your-32-byte-encryption-key"
```

⚠️ Never commit `.env` to GitHub.

---

## 3️⃣ Setup Database

Run Prisma migrations:

```bash
npx prisma migrate dev
npx prisma generate
```

This will:

* Create the SQLite database
* Apply schema migrations
* Generate Prisma client

---

## 4️⃣ Run Development Server

```bash
npm run dev
```

App runs at:

```
http://localhost:3000
```

---

# 🔐 Admin Authentication

Admin panel is available at:

```
http://localhost:3000/admin/login
```

Authentication is handled using secure HTTP-only cookies.

Admin credentials and encryption secrets must be configured inside `.env`.

🚨 Secrets are never hardcoded inside the repository.

---

# 🔎 How It Works (Security Overview)

1. Reporter submits anonymous report.
2. System generates unique Tracking ID.
3. Messages are encrypted using AES-GCM before storage.
4. Admin reviews reports via secure dashboard.
5. Follow-up communication remains encrypted.
6. Attachments are encrypted and restricted to admin-only access.

---

# 📸 Screenshots

Screenshots of the landing page, submission form, and admin console are available inside the `/screenshots` folder.

---

# 🛡 Security Considerations

* No user authentication required for reporters
* Admin-only protected routes
* Encryption applied before database storage
* Database file excluded from repository
* `.env` ignored via `.gitignore`
* No sensitive credentials committed

---

# 📌 Future Improvements

* PostgreSQL production deployment
* Role-based admin access
* Audit logging dashboard
* Rate limiting & abuse protection
* Cloud storage for encrypted attachments
* Docker production setup

---

# 📄 License

This project is built for educational and portfolio purposes.

---

# 💼 Why This Project Matters

WhisperSafe demonstrates:

* Secure system design
* Applied cryptography
* Backend architecture with Prisma
* Full-stack development with Next.js
* Authentication & authorization
* Threat modeling & risk triage logic

