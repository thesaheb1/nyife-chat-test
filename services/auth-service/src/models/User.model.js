'use strict';

const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 12;

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('user', 'admin', 'super_admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending_verification'),
        allowNull: false,
        defaultValue: 'pending_verification',
      },
      email_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      email_verification_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      email_verification_expires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      password_reset_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      password_reset_expires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_login_ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      login_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      google_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      facebook_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'auth_users',
      timestamps: true,
      underscored: true,
      paranoid: true,
      defaultScope: {
        attributes: {
          exclude: [
            'password',
            'email_verification_token',
            'email_verification_expires',
            'password_reset_token',
            'password_reset_expires',
          ],
        },
      },
      scopes: {
        withPassword: {
          attributes: { include: ['password'] },
        },
        withTokens: {
          attributes: {
            include: [
              'email_verification_token',
              'email_verification_expires',
              'password_reset_token',
              'password_reset_expires',
            ],
          },
        },
      },
    }
  );

  // Hash password before create
  User.beforeCreate(async (user) => {
    if (user.password) {
      user.password = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
    }
  });

  // Hash password before update if changed
  User.beforeUpdate(async (user) => {
    if (user.changed('password') && user.password) {
      user.password = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
    }
  });

  // Instance method: compare password
  User.prototype.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  };

  // Instance method: generate access token
  User.prototype.generateAccessToken = function () {
    const payload = {
      id: this.id,
      email: this.email,
      role: this.role,
      firstName: this.first_name,
      lastName: this.last_name,
    };
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY || '15m',
    });
  };

  // Instance method: generate refresh token
  User.prototype.generateRefreshToken = function () {
    const payload = {
      id: this.id,
      type: 'refresh',
    };
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });
  };

  // Instance method: safe JSON (no sensitive fields)
  User.prototype.toSafeJSON = function () {
    return {
      id: this.id,
      email: this.email,
      first_name: this.first_name,
      last_name: this.last_name,
      phone: this.phone,
      avatar_url: this.avatar_url,
      role: this.role,
      status: this.status,
      email_verified_at: this.email_verified_at,
      last_login_at: this.last_login_at,
      created_at: this.created_at,
    };
  };

  User.associate = (models) => {
    User.hasMany(models.RefreshToken, {
      foreignKey: 'user_id',
      as: 'refreshTokens',
    });
  };

  return User;
};
