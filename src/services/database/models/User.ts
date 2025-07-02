import {
  DataTypes,
  Model,
  Optional,
  Sequelize
} from 'sequelize';
import type { Setting } from './Setting';

interface UserAttrs {
  id: number;
  discordId: string;
  username: string;
  displayName: string;
  createdAt?: Date;
  updatedAt?: Date;
}
interface UserCreation extends Optional<UserAttrs,'id'> {}

export class User extends Model<UserAttrs,UserCreation>
  implements UserAttrs {
  public id!: number;
  public discordId!: string;
  public username!: string;
  public displayName!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Polymorphic mixins (added by Setting association)
  public getSettings!: () => Promise<Setting[]>;
}

export function UserFactory(sequelize: Sequelize) {
  User.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    discordId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'users',
    sequelize
  });
  return User;
}
