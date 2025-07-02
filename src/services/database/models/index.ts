import { Sequelize } from 'sequelize';
import { UserFactory, User } from './User';
import { GuildFactory, Guild } from './Guild';
import { SettingFactory, Setting } from './Setting';
import { MemoryFactory } from './Memory';

export function initModels(sequelize: Sequelize) {
  UserFactory(sequelize);
  GuildFactory(sequelize);
  SettingFactory(sequelize);
  MemoryFactory(sequelize);


  // User <→ Setting
  User.hasMany(Setting, {
    foreignKey: 'targetId',
    constraints: false,
    scope: { targetType: 'user' },
    as: 'settings'
  });
  Setting.belongsTo(User, {
    foreignKey: 'targetId',
    constraints: false,
    as: 'user',
    // only link when targetType = user
    scope: { targetType: 'user' }
  });

  // Guild <→ Setting
  Guild.hasMany(Setting, {
    foreignKey: 'targetId',
    constraints: false,
    scope: { targetType: 'guild' },
    as: 'settings'
  });
  Setting.belongsTo(Guild, {
    foreignKey: 'targetId',
    constraints: false,
    as: 'guild',
    scope: { targetType: 'guild' }
  });

  return { User, Guild, Setting };
}

// Export the model classes for type usage
export { User, Guild, Setting };

