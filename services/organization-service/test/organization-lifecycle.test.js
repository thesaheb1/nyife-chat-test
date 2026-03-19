'use strict';

const assert = require('node:assert/strict');
const { after, afterEach, describe, it, mock } = require('node:test');
const crypto = require('crypto');
const sharedConfig = require('@nyife/shared-config');
const sharedEvents = require('@nyife/shared-events');

const originalCreateKafkaProducer = sharedConfig.createKafkaProducer;
const originalPublishEvent = sharedEvents.publishEvent;

sharedConfig.createKafkaProducer = async () => ({
  connect: async () => undefined,
  disconnect: async () => undefined,
});
sharedEvents.publishEvent = async () => undefined;

const organizationService = require('../src/services/organization.service');
const {
  sequelize,
  User,
  Organization,
  TeamMember,
  Invitation,
} = require('../src/models');

afterEach(async () => {
  await organizationService.disconnectKafka();
  mock.restoreAll();
});

after(() => {
  sharedConfig.createKafkaProducer = originalCreateKafkaProducer;
  sharedEvents.publishEvent = originalPublishEvent;
});

describe('organization-service lifecycle', () => {
  it('derives team auth-user status from active memberships', async () => {
    const user = {
      id: 'team-user-1',
      role: 'team',
      status: 'active',
      deleted_at: null,
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
    };

    mock.method(User, 'findByPk', async () => user);
    mock.method(TeamMember, 'count', async ({ where }) => {
      if (where.member_user_id === 'team-user-1' && where.status === 'active') {
        return 0;
      }

      throw new Error(`Unexpected TeamMember.count call: ${JSON.stringify(where)}`);
    });

    const result = await organizationService.syncTeamAuthUserStatus('team-user-1');

    assert.deepEqual(result, { changed: true, status: 'inactive' });
    assert.equal(user.status, 'inactive');
  });

  it('revokes team access and refresh tokens when the last active membership becomes inactive', async () => {
    const queries = [];
    const teamMember = {
      id: 'member-1',
      organization_id: 'org-1',
      member_user_id: 'team-user-1',
      role_title: 'Agent',
      status: 'active',
      permissions: { chat: ['read'] },
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
    };
    const teamUser = {
      id: 'team-user-1',
      role: 'team',
      status: 'active',
      deleted_at: null,
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
    };

    mock.method(Organization, 'findOne', async () => ({ id: 'org-1', user_id: 'owner-1' }));
    mock.method(TeamMember, 'findOne', async () => teamMember);
    mock.method(TeamMember, 'count', async ({ where }) => {
      if (where.member_user_id === 'team-user-1' && where.status === 'active') {
        return 0;
      }
      if (where.organization_id === 'org-1' && where.status === 'active') {
        return 0;
      }
      throw new Error(`Unexpected TeamMember.count call: ${JSON.stringify(where)}`);
    });
    mock.method(Invitation, 'count', async () => 0);
    mock.method(User, 'findByPk', async () => teamUser);
    mock.method(sequelize, 'transaction', async (callback) => callback({ id: 'tx-1' }));
    mock.method(sequelize, 'query', async (sql) => {
      queries.push(sql);
      if (sql.includes('UPDATE chat_conversations')) {
        return [];
      }
      if (sql.includes('UPDATE auth_refresh_tokens')) {
        return [];
      }
      throw new Error(`Unexpected sequelize.query SQL: ${sql}`);
    });
    mock.method(global, 'fetch', async (url) => ({
      ok: true,
      async json() {
        if (String(url).includes('/subscriptions/internal/active/')) {
          return {
            data: {
              subscription: {
                plan: { max_team_members: 5 },
                usage: { team_members_used: 0 },
              },
            },
          };
        }

        return {};
      },
    }));

    const updated = await organizationService.updateTeamMember('owner-1', 'org-1', 'member-1', {
      status: 'inactive',
      role_title: 'Agent',
      permissions: { chat: ['read'] },
    });

    assert.equal(updated.status, 'inactive');
    assert.equal(teamUser.status, 'inactive');
    assert.ok(queries.some((sql) => sql.includes('UPDATE chat_conversations')));
    assert.ok(queries.some((sql) => sql.includes('UPDATE auth_refresh_tokens')));
  });

  it('reopens revoked org invitations and soft-deletes them separately from revoke', async () => {
    const invitation = {
      id: 'invite-1',
      organization_id: 'org-1',
      status: 'revoked',
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
      async destroy() {
        this.deleted = true;
      },
    };

    mock.method(Organization, 'findOne', async () => ({ id: 'org-1', user_id: 'owner-1', name: 'Acme' }));
    mock.method(Invitation, 'findOne', async () => invitation);
    mock.method(Invitation, 'count', async () => 0);
    mock.method(TeamMember, 'count', async () => 0);
    mock.method(crypto, 'randomBytes', () => ({
      toString: () => 'fresh-org-token',
    }));
    mock.method(global, 'fetch', async (url) => ({
      ok: true,
      async json() {
        if (String(url).includes('/subscriptions/internal/active/')) {
          return {
            data: {
              subscription: {
                plan: { max_team_members: 5 },
                usage: { team_members_used: 0 },
              },
            },
          };
        }

        return {};
      },
    }));

    const resent = await organizationService.resendInvitation('owner-1', 'org-1', 'invite-1');
    assert.equal(resent.status, 'pending');
    assert.equal(resent.invite_token, 'fresh-org-token');

    await organizationService.deleteInvitation('owner-1', 'org-1', 'invite-1');
    assert.equal(invitation.deleted, true);
  });

  it('rejects revoking accepted org invitations', async () => {
    mock.method(Organization, 'findOne', async () => ({ id: 'org-1', user_id: 'owner-1' }));
    mock.method(Invitation, 'findOne', async () => ({
      id: 'invite-accepted',
      organization_id: 'org-1',
      status: 'accepted',
    }));

    await assert.rejects(
      organizationService.revokeInvitation('owner-1', 'org-1', 'invite-accepted'),
      /Accepted invitations cannot be revoked/
    );
  });
});
