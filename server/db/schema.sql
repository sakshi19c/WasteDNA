-- WasteDNA schema (reconstructed from the queries in server/routes + services;
-- compare with your live database before running anywhere that has data).
CREATE TABLE IF NOT EXISTS locations (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(40)  NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    location_id       INT NOT NULL,
    week              INT NOT NULL,
    photo_ref         VARCHAR(255),
    materials_json    JSON NOT NULL,
    contamination     DECIMAL(4,3) NOT NULL,
    hazard_count      INT NOT NULL DEFAULT 0,
    recovery_score    DECIMAL(5,2) NOT NULL,
    segregation_score DECIMAL(5,2) NOT NULL,
    is_simulated      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    INDEX idx_location_week (location_id, week)
);

CREATE TABLE IF NOT EXISTS interventions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    start_week  INT NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

INSERT IGNORE INTO locations (id, name, type) VALUES
    (1, 'Ward A',         'residential'),
    (2, 'Ward B',         'residential'),
    (3, 'Ward C',         'residential'),
    (4, 'Ward D',         'residential'),
    (5, 'Central Market', 'market'),
    (6, 'Green Market',   'market'),
    (7, 'Green Colony',   'residential'),
    (8, 'City School',    'school');
