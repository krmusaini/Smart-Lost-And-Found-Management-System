-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Seed Data for Development and Demonstration
-- Target: MySQL 8.0+
-- Default Admin: admin@campus.edu / Admin@123
-- Default Students: aarav.sharma@campus.edu, priya.patel@campus.edu / Student@123
-- =====================================================================

USE smart_lost_found_db;

-- 1. Insert Categories
INSERT INTO Categories (category_id, category_name, description) VALUES
(1, 'Electronics', 'Laptops, smartphones, chargers, headphones, calculators, pendrives'),
(2, 'Documents', 'Student ID cards, driving licenses, passport copies, certificates, notebooks'),
(3, 'Books', 'Textbooks, reference manuals, novels, library books, course packets'),
(4, 'Bags', 'Backpacks, laptop sleeves, gym duffels, side bags, pouches'),
(5, 'Accessories', 'Wristwatches, smart bands, glasses, keys, jewelry, water bottles'),
(6, 'Clothing', 'Jackets, hoodies, college blazers, lab coats, caps, scarves'),
(7, 'Other', 'Sports equipment, umbrellas, musical instruments, miscellaneous items')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 2. Insert Standard Campus Locations
INSERT INTO Locations (location_id, location_name, building_name, floor_number, description) VALUES
(1, 'Central Library', 'Central Academic Block', '1st Floor', 'Reading hall, reference section and digital circulation desk'),
(2, 'Computer Laboratory 3', 'Engineering Block', '2nd Floor', 'High-performance computing lab, lab room 204'),
(3, 'Student Cafeteria', 'Student Activity Center', 'Ground Floor', 'Main dining hall, beverage counters and patio seating'),
(4, 'Main Auditorium', 'Campus Cultural Center', 'Ground Floor', 'Central auditorium seating 1000 with green rooms'),
(5, 'Block A - Room 302', 'Science Wing', '3rd Floor', 'Lecture hall for mathematics and physics courses'),
(6, 'Block B - Seminar Hall', 'Management & Arts Wing', '2nd Floor', 'Conference hall for departmental seminars and presentations'),
(7, 'Sports Complex', 'Athletics Arena', 'Ground Floor', 'Badminton courts, gymnasium and outdoor track')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 3. Insert Users (1 Administrator and 5 Students)
-- Admin Password: Admin@123
-- Student Passwords: Student@123
INSERT INTO Users (user_id, name, email, password_hash, role, created_at) VALUES
(1, 'Campus Security Administrator', 'admin@campus.edu', '$2a$10$O90gw68xGpgHSvv7XqhYtOZvRwbvfkB9PRIh9Lo4Oyr5KFt2/S7PC', 'ADMIN', '2026-08-01 09:00:00'),
(2, 'Aarav Sharma', 'aarav.sharma@campus.edu', '$2a$10$HHNMUWswv19HQ7Oatq/m6eImK/dGveq/itkCvomax7bulmSY0JMjW', 'STUDENT', '2026-08-10 10:15:00'),
(3, 'Priya Patel', 'priya.patel@campus.edu', '$2a$10$HHNMUWswv19HQ7Oatq/m6eImK/dGveq/itkCvomax7bulmSY0JMjW', 'STUDENT', '2026-08-11 11:30:00'),
(4, 'Rohan Gupta', 'rohan.gupta@campus.edu', '$2a$10$HHNMUWswv19HQ7Oatq/m6eImK/dGveq/itkCvomax7bulmSY0JMjW', 'STUDENT', '2026-08-15 14:00:00'),
(5, 'Ananya Singh', 'ananya.singh@campus.edu', '$2a$10$HHNMUWswv19HQ7Oatq/m6eImK/dGveq/itkCvomax7bulmSY0JMjW', 'STUDENT', '2026-08-20 08:45:00'),
(6, 'Vikram Verma', 'vikram.verma@campus.edu', '$2a$10$HHNMUWswv19HQ7Oatq/m6eImK/dGveq/itkCvomax7bulmSY0JMjW', 'STUDENT', '2026-09-01 16:20:00')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 4. Insert Items (Balanced mix of LOST and FOUND items)
INSERT INTO Items (item_id, user_id, category_id, location_id, item_type, title, description, item_date, image_url, status, created_at) VALUES
-- Item 1: Lost Dell XPS Laptop by Aarav Sharma
(1, 2, 1, 1, 'LOST', 'Dell XPS 15 Silver Laptop', 'Silver Dell XPS laptop with a carbon fiber palm rest, Intel Core i7 sticker, and black neoprene sleeve.', '2026-11-10', '/uploads/sample-laptop.jpg', 'OPEN', '2026-11-10 14:30:00'),
-- Item 2: Found Dell Laptop in Library by Priya Patel (Potential Match for Item 1)
(2, 3, 1, 1, 'FOUND', 'Silver Dell Laptop with Sleeve', 'Found unattended on study table 14 in Central Library. Enclosed in a black zipper sleeve with charger.', '2026-11-10', '/uploads/sample-laptop.jpg', 'CLAIM_PENDING', '2026-11-10 16:45:00'),
-- Item 3: Lost Student ID Card by Rohan Gupta
(3, 4, 2, 3, 'LOST', 'B.Tech Student ID Card - Rohan Gupta', 'Blue lanyard with RFID smart card, CS department 3rd semester, Roll Number 501730301.', '2026-11-12', NULL, 'OPEN', '2026-11-12 13:10:00'),
-- Item 4: Found ID Card in Cafeteria by Ananya Singh (Match for Item 3)
(4, 5, 2, 3, 'FOUND', 'College Student ID Card in Blue Lanyard', 'Found near the juice counter in the student cafeteria. ID belongs to CS student.', '2026-11-12', NULL, 'CLAIM_PENDING', '2026-11-12 14:00:00'),
-- Item 5: Lost Casio Scientific Calculator by Vikram Verma
(5, 6, 1, 5, 'LOST', 'Casio FX-991EX Classwiz Calculator', 'Black casing with student initials VV etched on back cover. Left in Room 302 after Calculus test.', '2026-11-05', NULL, 'CLAIMED', '2026-11-05 11:00:00'),
-- Item 6: Found Casio Calculator by Priya Patel (Recovered & Handed over to Vikram)
(6, 3, 1, 5, 'FOUND', 'Casio Scientific Calculator FX-991EX', 'Found on desk row 3 in Block A room 302 after afternoon exam session.', '2026-11-05', NULL, 'CLAIMED', '2026-11-05 13:30:00'),
-- Item 7: Lost Leather Wallet by Aarav Sharma
(7, 2, 5, 7, 'LOST', 'Brown Tommy Hilfiger Leather Wallet', 'Contains college library card, driving license, and some cash. Lost near basketball court.', '2026-11-15', NULL, 'OPEN', '2026-11-15 18:00:00'),
-- Item 8: Found Sony Noise Cancelling Headphones by Rohan Gupta
(8, 4, 1, 2, 'FOUND', 'Sony WH-1000XM4 Black Headphones', 'Found resting next to terminal 18 in Computer Lab 3 with grey protective case.', '2026-11-16', NULL, 'OPEN', '2026-11-16 17:15:00'),
-- Item 9: Lost Operating System Concepts Textbook by Priya Patel
(9, 3, 3, 1, 'LOST', 'Silberschatz Operating System Concepts (Dinosaur Book)', 'Hardcover 10th edition with yellow sticky notes on Chapter 7 Deadlocks.', '2026-11-14', NULL, 'OPEN', '2026-11-14 12:00:00'),
-- Item 10: Found Wildcraft Blue Backpack by Vikram Verma
(10, 6, 4, 4, 'FOUND', 'Wildcraft Navy Blue Backpack', 'Found in auditorium aisle 4 after freshman orientation rehearsal.', '2026-11-17', NULL, 'OPEN', '2026-11-17 19:00:00')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 5. Insert Claims
-- Temporarily disable triggers so seed data with historical statuses loads deterministically
SET @DISABLE_TRIGGERS = 1;

INSERT INTO Claims (claim_id, item_id, claimant_id, claim_message, claim_status, admin_note, created_at) VALUES
-- Claim 1: Aarav claiming Found Laptop (Item 2) - PENDING
(1, 2, 2, 'This is my Dell XPS 15 laptop. Inside the bag there is a 130W USB-C charger, and my student ID sticker is under the base plate. Service tag begins with 8GKP.', 'PENDING', 'Pending hardware verification with claimant at security desk.', '2026-11-11 09:30:00'),
-- Claim 2: Rohan claiming Found ID Card (Item 4) - APPROVED
(2, 4, 4, 'The card belongs to me, Rohan Gupta, CS 3rd Sem, Roll: 501730301. I lost it during lunch break.', 'APPROVED', 'Identity verified against university database record. Approved for collection.', '2026-11-12 15:30:00'),
-- Claim 3: Vikram claiming Found Calculator (Item 6) - APPROVED & HANDED OVER
(3, 6, 6, 'It is my Casio Classwiz calculator with initials VV etched into the back battery cover in small print.', 'APPROVED', 'Verification confirmed by admin inspection of initials VV. Handover executed.', '2026-11-06 10:00:00'),
-- Claim 4: Aarav claiming unrelated found backpack - REJECTED
(4, 10, 2, 'I lost a black backpack recently and wonder if this might be mine.', 'REJECTED', 'Description does not match. Claimant reported black bag, found bag is navy blue Wildcraft.', '2026-11-18 10:00:00')
ON DUPLICATE KEY UPDATE claim_message = VALUES(claim_message);

SET @DISABLE_TRIGGERS = NULL;

-- 6. Insert Rule-Based Item Matches
INSERT INTO ItemMatches (match_id, lost_item_id, found_item_id, match_score, match_status, created_at) VALUES
-- Match 1: Laptop lost (1) vs Laptop found (2) -> High confidence
(1, 1, 2, 95.00, 'CONFIRMED', '2026-11-10 17:00:00'),
-- Match 2: ID card lost (3) vs ID card found (4) -> High confidence
(2, 3, 4, 90.00, 'CONFIRMED', '2026-11-12 14:15:00'),
-- Match 3: Calculator lost (5) vs Calculator found (6) -> Confirmed Handover
(3, 5, 6, 95.00, 'CONFIRMED', '2026-11-05 14:00:00')
ON DUPLICATE KEY UPDATE match_score = VALUES(match_score);

-- 7. Insert Handover Records
INSERT INTO HandoverRecords (handover_id, item_id, claim_id, handed_over_by, handover_date, remarks) VALUES
(1, 6, 3, 1, '2026-11-06 11:30:00', 'Student Vikram Verma verified identity via physical student ID card. Successfully handed over Casio scientific calculator in working order.')
ON DUPLICATE KEY UPDATE remarks = VALUES(remarks);
