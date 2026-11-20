-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Database Schema: EXACTLY 7 CORE RELATIONAL TABLES
-- Target: MySQL 8.0+
-- =====================================================================

-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS smart_lost_found_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE smart_lost_found_db;

-- Disable foreign key checks during schema creation/reset
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS HandoverRecords;
DROP TABLE IF EXISTS ItemMatches;
DROP TABLE IF EXISTS Claims;
DROP TABLE IF EXISTS Items;
DROP TABLE IF EXISTS Locations;
DROP TABLE IF EXISTS Categories;
DROP TABLE IF EXISTS Users;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- TABLE 1: Users
-- Stores student and administrator credentials and profiles
-- =====================================================================
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 2: Categories
-- Stores standardized item categories
-- =====================================================================
CREATE TABLE Categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 3: Locations
-- Stores standardized campus buildings and areas
-- =====================================================================
CREATE TABLE Locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL,
    building_name VARCHAR(100) NULL,
    floor_number VARCHAR(30) NULL,
    description VARCHAR(255) NULL
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 4: Items
-- Central table storing both LOST and FOUND item reports
-- =====================================================================
CREATE TABLE Items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    location_id INT NOT NULL,
    item_type ENUM('LOST', 'FOUND') NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    item_date DATE NOT NULL,
    image_url VARCHAR(255) NULL,
    status ENUM('OPEN', 'CLAIM_PENDING', 'CLAIMED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_items_user
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_items_category
        FOREIGN KEY (category_id) REFERENCES Categories(category_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_items_location
        FOREIGN KEY (location_id) REFERENCES Locations(location_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 5: Claims
-- Stores ownership claims submitted by students for FOUND items
-- =====================================================================
CREATE TABLE Claims (
    claim_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    claimant_id INT NOT NULL,
    claim_message TEXT NOT NULL,
    claim_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    admin_note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claims_item
        FOREIGN KEY (item_id) REFERENCES Items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_claims_claimant
        FOREIGN KEY (claimant_id) REFERENCES Users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 6: ItemMatches
-- Stores rule-based potential matches between LOST and FOUND items
-- =====================================================================
CREATE TABLE ItemMatches (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    lost_item_id INT NOT NULL,
    found_item_id INT NOT NULL,
    match_score DECIMAL(5,2) NOT NULL,
    match_status ENUM('SUGGESTED', 'CONFIRMED', 'DISMISSED') NOT NULL DEFAULT 'SUGGESTED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_matches_lost_item
        FOREIGN KEY (lost_item_id) REFERENCES Items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_matches_found_item
        FOREIGN KEY (found_item_id) REFERENCES Items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_lost_found_match
        UNIQUE (lost_item_id, found_item_id)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 7: HandoverRecords
-- Maintains permanent verified handover and item recovery records
-- =====================================================================
CREATE TABLE HandoverRecords (
    handover_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL UNIQUE,
    claim_id INT NOT NULL UNIQUE,
    handed_over_by INT NOT NULL,
    handover_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT NULL,
    CONSTRAINT fk_handover_item
        FOREIGN KEY (item_id) REFERENCES Items(item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_handover_claim
        FOREIGN KEY (claim_id) REFERENCES Claims(claim_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_handover_admin
        FOREIGN KEY (handed_over_by) REFERENCES Users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
