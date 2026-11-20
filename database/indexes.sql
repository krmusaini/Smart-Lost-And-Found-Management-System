-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Database Indexes
-- Target: MySQL 8.0+
-- Optimizes query performance across filters, joins, and aggregates
-- =====================================================================

USE smart_lost_found_db;

-- Indexes on Items table
CREATE INDEX idx_items_status_type ON Items(status, item_type);
CREATE INDEX idx_items_category ON Items(category_id);
CREATE INDEX idx_items_location ON Items(location_id);
CREATE INDEX idx_items_date ON Items(item_date);
CREATE INDEX idx_items_user ON Items(user_id);
CREATE INDEX idx_items_created ON Items(created_at);

-- Full-text / Composite search index for discovery
CREATE INDEX idx_items_type_date ON Items(item_type, item_date DESC);

-- Indexes on Claims table
CREATE INDEX idx_claims_item_status ON Claims(item_id, claim_status);
CREATE INDEX idx_claims_claimant ON Claims(claimant_id);
CREATE INDEX idx_claims_created ON Claims(created_at);

-- Indexes on ItemMatches table
CREATE INDEX idx_matches_lost ON ItemMatches(lost_item_id);
CREATE INDEX idx_matches_found ON ItemMatches(found_item_id);
CREATE INDEX idx_matches_score_status ON ItemMatches(match_score DESC, match_status);

-- Indexes on HandoverRecords table
CREATE INDEX idx_handover_date ON HandoverRecords(handover_date DESC);
CREATE INDEX idx_handover_admin ON HandoverRecords(handed_over_by);

-- Indexes on Locations table
CREATE INDEX idx_locations_building ON Locations(building_name);
