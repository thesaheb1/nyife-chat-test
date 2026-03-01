'use strict';

require('dotenv').config();

const { Sequelize } = require('sequelize');

/**
 * Creates a configured Sequelize instance for the given service.
 *
 * @param {string} serviceName - The name of the microservice (used for logging context).
 * @returns {Sequelize} A configured Sequelize instance connected to MySQL.
 */
function createDatabase(serviceName) {
  if (!serviceName || typeof serviceName !== 'string') {
    throw new Error('serviceName is required and must be a non-empty string');
  }

  const host = process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.MYSQL_PORT, 10) || 3306;
  const username = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'nyife';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'mysql',
    logging: isProduction ? false : (msg) => console.log(`[${serviceName}][Sequelize] ${msg}`),
    pool: {
      min: 2,
      max: 10,
      acquire: 30000,
      idle: 10000,
    },
    retry: {
      max: 5,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
      ],
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
    timezone: '+00:00',
    dialectOptions: {
      dateStrings: true,
      typeCast: true,
      connectTimeout: 10000,
    },
  });

  return sequelize;
}

/**
 * Tests the database connection and logs the result.
 *
 * @param {Sequelize} sequelize - The Sequelize instance to test.
 * @param {string} serviceName - The name of the microservice (used for logging).
 * @returns {Promise<boolean>} True if connection succeeded, false otherwise.
 */
async function testConnection(sequelize, serviceName) {
  try {
    await sequelize.authenticate();
    console.log(`[${serviceName}] Database connection established successfully.`);
    return true;
  } catch (error) {
    console.error(`[${serviceName}] Unable to connect to the database:`, error.message);
    return false;
  }
}

module.exports = {
  createDatabase,
  testConnection,
};
