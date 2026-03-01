require('dotenv').config();

module.exports = {
  development: {
    username: process.env.MYSQL_USER || 'nyife_user',
    password: process.env.MYSQL_PASSWORD || 'nyife_pass',
    database: process.env.MYSQL_DATABASE || 'nyife_db',
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    dialect: 'mysql',
    logging: console.log,
  },
  test: {
    username: process.env.MYSQL_USER || 'nyife_user',
    password: process.env.MYSQL_PASSWORD || 'nyife_pass',
    database: process.env.MYSQL_DATABASE || 'nyife_db_test',
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    dialect: 'mysql',
    logging: false,
  },
  production: {
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    dialect: 'mysql',
    logging: false,
    pool: {
      min: 2,
      max: 10,
      acquire: 30000,
      idle: 10000,
    },
  },
};
