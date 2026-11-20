# Smart Student Lost & Found Management System

A production-ready, database-driven web application built for a **Semester 3 B.Tech Computer Science DBMS Capstone Project**.

The primary objective of this system is to replace informal notice boards and word-of-mouth reports with a centralized relational DBMS platform. It demonstrates advanced relational design, strict integrity constraints, stored procedures, stored functions, database triggers, complex analytical queries, views, indexes, and role-based access control (RBAC).

---

## 1. Project Overview

On college campuses, students frequently lose essential belongings (ID cards, laptops, calculators, wallets, textbooks, clothing) across lecture halls, laboratories, dining areas, and sports grounds. 

Traditional recovery methods fail due to unorganized tracking, no verifiable proof of ownership, and disjointed communication between finders and owners.

### Key Capabilities:
- **Centralized Listing Repository:** Direct reporting of LOST and FOUND belongings with standard campus categorization and building/room locations.
- **Rule-Based Smart Matching:** Automated matching algorithm evaluating category similarity, date proximity, location proximity, and keyword overlap with confidence scoring (0–100%).
- **Ownership Verification Mechanism:** Students submit claims detailing private identifying characteristics; authorized administrators review and approve/reject claims.
- **Transactional Item Handovers:** Enforces 1-to-1 recovery handovers with administrator audit logs and atomic status transitions.
- **DBMS Capstone Demonstrations:** Live execution of MySQL Stored Functions, Stored Procedures, Triggers, Views, and complex analytical SQL queries (CTEs, Window Functions, Aggregate Joins).

---

## 2. Technology Stack

- **Frontend:** HTML5, CSS3 (Teal & Slate Modern Theme), Vanilla JavaScript (Modular ES6), Responsive Design (Mobile & Desktop).
- **Backend:** Node.js, Express.js.
- **Database:** MySQL 8.0+ with `mysql2` connection pooling. Compatible with MySQL Workbench, Docker, AWS RDS, PlanetScale, Railway, and Aiven.
- **Authentication:** Express session cookies, `bcryptjs` password hashing, Role-Based Access Control (`STUDENT` vs `ADMIN`).
- **File Uploads:** `multer` with MIME type validation (JPEG/PNG/WebP), size restriction (5MB), and sanitized filenames.

---

## 3. Database Architecture (Exactly 7 Core Tables)

The database schema adheres strictly to normalized relational design with **exactly 7 core tables**:

```
Users (user_id PK)
  ├── 1:M ──> Items (user_id FK)
  ├── 1:M ──> Claims (claimant_id FK)
  └── 1:M ──> HandoverRecords (handed_over_by FK)

Categories (category_id PK)
  └── 1:M ──> Items (category_id FK)

Locations (location_id PK)
  └── 1:M ──> Items (location_id FK)

Items (item_id PK)
  ├── 1:M ──> Claims (item_id FK)
  ├── 1:M ──> ItemMatches (lost_item_id FK & found_item_id FK)
  └── 1:1 ──> HandoverRecords (item_id FK UNIQUE)

Claims (claim_id PK)
  └── 1:1 ──> HandoverRecords (claim_id FK UNIQUE)
```

1. **`Users`**: Student and administrator profiles, email uniqueness, hashed passwords.
2. **`Categories`**: Pre-seeded campus item categories (Electronics, Documents, Books, Bags, Accessories, Clothing, Other).
3. **`Locations`**: Pre-seeded campus buildings, floors, and rooms.
4. **`Items`**: Central repository storing both `LOST` and `FOUND` reports (`OPEN`, `CLAIM_PENDING`, `CLAIMED`, `CLOSED`).
5. **`Claims`**: Ownership claims submitted by students on found items (`PENDING`, `APPROVED`, `REJECTED`).
6. **`ItemMatches`**: Rule-based matching records linking a LOST report with a FOUND report (`SUGGESTED`, `CONFIRMED`, `DISMISSED`).
7. **`HandoverRecords`**: Permanent audit record of successful handovers executed by administrators.

---

## 4. Stored Routines, Triggers & Views

### Stored Functions
- `CountUserItems(p_user_id INT)`: Returns lifetime item reports submitted by a student.
- `CountOpenItems()`: Returns count of currently active open listings campus-wide.
- `GetCategoryItemCount(p_category_id INT)`: Returns item volume for a specific category.
- `GetUserRecoveryCount(p_user_id INT)`: Returns items successfully recovered by a student.

### Stored Procedures
1. `SubmitItemReport(...)`: Inserts a validated lost or found report and outputs `@item_id`.
2. `SubmitClaim(...)`: Validates eligibility and records ownership claim for a found item.
3. `ApproveClaim(...)`: Approves a pending claim and automatically marks other claims rejected within a transaction.
4. `RejectClaim(...)`: Rejects claim with administrator remarks and reverts item state if no pending claims remain.
5. `GenerateItemMatches(...)`: Evaluates multi-criteria scoring algorithm and creates match records.
6. `GenerateMonthlyReport(...)`: Computes monthly lost vs found counts and recovery rates.
7. `RecordItemHandover(...)`: Executes transactional handover, validates 1-to-1 integrity, and updates status to `CLAIMED`.

### Triggers
- `trg_after_claim_insert`: When a claim is created, transitions item status from `OPEN` to `CLAIM_PENDING`.
- `trg_before_claim_update`: Enforces state transitions (finalized claims cannot be reverted to pending).
- `trg_after_claim_update`: Reverts item to `OPEN` if all claims are rejected.
- `trg_after_handover_insert`: Upon official handover insertion, finalizes item status to `CLAIMED`.

### Database Views
- `v_open_lost_items`: Surfaces active lost reports with category and location.
- `v_active_found_items`: Surfaces active found reports with pending claim counts.
- `v_handover_details`: Complete recovery audit trail linking items, claimants, and admins.

---

## 5. Local Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) (v8.0 or higher) or MySQL Workbench

### Step 1: Clone or Navigate to the Project
```bash
cd "c:\Users\itsdi\OneDrive\Desktop\dbms capstone"
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
Edit `.env` with your MySQL server credentials:
```env
PORT=3000
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_mysql_password
DATABASE_NAME=smart_lost_found_db

SESSION_SECRET=smart_lost_found_capstone_secure_session_key_2026
```

### Step 4: Initialize Database (Automatic or Manual)

#### Option A: Automatic Initialization Script (Recommended)
Run the built-in database setup script to create tables, functions, procedures, triggers, views, and indexes:
```bash
npm run init-db
```
To also load sample demonstration records:
```bash
npm run seed-db
```

#### Option B: Manual Execution via MySQL CLI or MySQL Workbench
Execute the scripts in `database/` in the exact required dependency order:
1. `database/schema.sql` (Creates DB and 7 core tables)
2. `database/functions.sql` (Registers stored functions)
3. `database/procedures.sql` (Registers stored procedures)
4. `database/triggers.sql` (Registers business logic triggers)
5. `database/views.sql` (Creates analytical views)
6. `database/indexes.sql` (Adds performance indexes)
7. `database/seed.sql` (Optional: Populates demo dataset)

### Step 5: Start the Web Application
```bash
npm start
```
For automatic restart during development:
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 6. Default Demo Accounts

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@campus.edu` | `Admin@123` | Full access: claims approval, handovers, users, categories, locations, matching engine, analytics |
| **Student 1** | `aarav.sharma@campus.edu` | `Student@123` | Report items, view personal submissions, claim items, track matches |
| **Student 2** | `priya.patel@campus.edu` | `Student@123` | Report items, view personal submissions, claim items, track matches |

*(New student accounts can also be registered at any time on `/register.html`)*

---

## 7. Capstone Demonstration Walkthrough

To demonstrate the full DBMS lifecycle during project examination:

1. **Student Registration & Login:** Register a new student or log in as `aarav.sharma@campus.edu`.
2. **Report Lost Item:** Navigate to *Report Lost*, enter title `"Dell XPS 15 Silver Laptop"`, category `Electronics`, location `Central Library`.
3. **Report Found Item:** Log in as another student (`priya.patel@campus.edu`) and submit a found item report for `"Silver Dell Laptop with Sleeve"` at `Central Library`.
4. **Trigger Smart Matching:** Check `/pages/matches.html` to see the automated rule-based match score (e.g. 95%).
5. **Submit Ownership Claim:** From the found item detail page, click *Claim Ownership*. Enter verification details (lockscreen info, serial tag).
6. **Trigger Verification:** Log in as `admin@campus.edu`, navigate to *Claims Review* (`/pages/manage-claims.html`), inspect claimant proof, and click **Approve**.
7. **Execute Handover Transaction:** In *Handovers* (`/pages/handovers.html`), select the approved claim, enter desk verification remarks, and submit. The item status transitions to `CLAIMED` via transaction.
8. **View Analytics:** Navigate to *Analytics* (`/pages/reports.html`) to show CTEs, Window Functions (`DENSE_RANK`), and category breakdown.

---

## 8. Deployment Guide (Cloud / Production)

The application is structured to ensure zero deployment surprises:
- **Relative API Calls:** All frontend AJAX calls use relative paths (`/api/items`), eliminating hardcoded localhost issues.
- **Unified Service:** Express serves both the REST API and the static frontend simultaneously.
- **Environment Driven:** Database host, port, user, password, and session secrets are read strictly from environment variables.

### Recommended Cloud Platforms:
1. **Application (Node.js):** Render, Railway, Heroku, DigitalOcean App Platform, AWS Elastic Beanstalk.
2. **Database (MySQL):** Railway MySQL, Aiven MySQL, AWS RDS MySQL, PlanetScale, DigitalOcean Managed MySQL.

### Production Environment Variables Checklist:
```env
PORT=3000
NODE_ENV=production
DATABASE_HOST=your-mysql-hostname.provider.com
DATABASE_PORT=3306
DATABASE_USER=your_db_username
DATABASE_PASSWORD=your_db_password
DATABASE_NAME=smart_lost_found_db
SESSION_SECRET=a_long_random_cryptographic_secret_string
```

> **Note on File Storage:** In serverless or ephemeral environments (e.g. basic Heroku dynos), files stored in local `uploads/` do not persist across restarts. For production deployment requiring persistent images, configure an S3 bucket or Cloudinary in `server/middleware/upload.js`.

---

## 9. Common Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL server is stopped | Start the MySQL service (`net start MySQL80` or via Windows Services). |
| `ER_ACCESS_DENIED_ERROR` | Incorrect DB credentials in `.env` | Verify `DATABASE_USER` and `DATABASE_PASSWORD` in `.env`. |
| `Routine execution failed` | Missing delimiter support during manual import | Use `npm run init-db` which correctly parses MySQL routine `DELIMITER $$` blocks. |
| `Access denied for user 'root'@'localhost'` | Password mismatch | Ensure password in `.env` matches your local MySQL root password. |

---

## 10. Repository File Structure

```
smart-lost-found/
│
├── public/                     # Frontend client assets
│   ├── index.html              # Landing page
│   ├── login.html              # Authentication sign-in
│   ├── register.html           # Student registration
│   ├── student-dashboard.html  # Student portal
│   ├── admin-dashboard.html    # Administrative dashboard
│   ├── pages/                  # Subpages
│   │   ├── report-lost.html    # Submit lost report
│   │   ├── report-found.html   # Submit found report
│   │   ├── browse-items.html   # Live search & filtering directory
│   │   ├── item-details.html   # Item details & claim trigger
│   │   ├── submit-claim.html   # Ownership proof submission
│   │   ├── my-reports.html     # User report management
│   │   ├── my-claims.html      # User claim tracking
│   │   ├── matches.html        # Smart item matching view
│   │   ├── manage-users.html   # Admin user & role management
│   │   ├── manage-categories.html # Admin category CRUD
│   │   ├── manage-locations.html  # Admin location CRUD
│   │   ├── manage-items.html   # Admin item management
│   │   ├── manage-claims.html  # Admin claim review & approval
│   │   ├── handovers.html      # Admin transactional handover
│   │   └── reports.html        # Complex SQL analytical reports
│   ├── css/                    # Stylesheets (Teal & Slate theme)
│   │   ├── style.css
│   │   ├── auth.css
│   │   ├── dashboard.css
│   │   ├── forms.css
│   │   └── responsive.css
│   ├── js/                     # Client JavaScript modules
│   │   ├── main.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── items.js
│   │   ├── claims.js
│   │   ├── matches.js
│   │   └── admin.js
│   └── assets/
│
├── server/                     # Backend Express application
│   ├── config/
│   │   └── db.js               # MySQL2 pool configuration
│   ├── middleware/
│   │   ├── auth.js             # Session & role middleware
│   │   ├── upload.js           # Multer file upload handler
│   │   └── errorHandler.js     # Centralized error handler
│   ├── routes/                 # Express API routes
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── items.routes.js
│   │   ├── claims.routes.js
│   │   ├── matches.routes.js
│   │   ├── handovers.routes.js
│   │   └── admin.routes.js
│   ├── controllers/            # Controller business logic
│   │   ├── authController.js
│   │   ├── itemsController.js
│   │   ├── claimsController.js
│   │   ├── matchesController.js
│   │   ├── handoversController.js
│   │   └── adminController.js
│   └── app.js                  # Express app setup & middleware
│
├── database/                   # MySQL relational assets
│   ├── schema.sql              # 7 Core tables with foreign keys
│   ├── seed.sql                # Seed data for demo
│   ├── functions.sql           # 4 MySQL Stored Functions
│   ├── procedures.sql          # 7 MySQL Stored Procedures
│   ├── triggers.sql            # 4 MySQL Triggers
│   ├── views.sql               # 3 MySQL Views
│   ├── indexes.sql             # Performance indexes
│   ├── test_queries.sql        # 10 Complex analytical queries
│   ├── initDb.js               # Automated DB setup runner
│   └── seedDb.js               # Automated seed runner
│
├── uploads/                    # Uploaded item photos
├── .env.example                # Template for environment configuration
├── .gitignore                  # Git ignore rules
├── package.json                # Project dependencies & scripts
├── server.js                   # Application server entry point
└── README.md                   # Comprehensive documentation
```
