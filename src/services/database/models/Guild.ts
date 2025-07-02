import {
  DataTypes,
  Model,
  Optional,
  Sequelize
} from 'sequelize';
import type { Setting } from './Setting';

interface GuildAttrs {
  id: number;
  discordGuildId: string;
  name: string;
  iconUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
}
interface GuildCreation extends Optional<GuildAttrs,'id'> {}

export class Guild extends Model<GuildAttrs,GuildCreation>
  implements GuildAttrs {
  public id!: number;
  public discordGuildId!: string;
  public name!: string;
  public iconUrl!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getSettings!: () => Promise<Setting[]>;
}

export function GuildFactory(sequelize: Sequelize) {
  Guild.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    discordGuildId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    iconUrl: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'guilds',
    sequelize
  });
  return Guild;
}
