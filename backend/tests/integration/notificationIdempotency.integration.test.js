const { sequelize, Notification, User } = require('../../models');

let user;
beforeAll(async () => {
  await sequelize.sync({ force: true });
  user = await User.create({ email: 'notif_idempotency@test.com', username: 'notif_user', passwordHash: 'x', role: 'normal' });
});
afterAll(async () => { await sequelize.close(); });

describe('notification idempotency by sourceEventId', () => {
  test('same sourceEventId + user creates only one notification', async () => {
    const data = { userId: user.id, type: 'p2p', title: 't', message: 'm', sourceEventId: '11111111-1111-1111-1111-111111111111' };
    await Notification.createNotification(data);
    await Notification.createNotification(data); // redelivery
    const rows = await Notification.findAll({ where: { userId: user.id, sourceEventId: data.sourceEventId } });
    expect(rows).toHaveLength(1);
  });
});
