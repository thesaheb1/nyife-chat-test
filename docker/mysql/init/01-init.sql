-- Nyife Database Initialization
-- This script runs automatically when the MySQL container starts for the first time

CREATE DATABASE IF NOT EXISTS nyife_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON nyife_db.* TO 'nyife_user'@'%';
FLUSH PRIVILEGES;
