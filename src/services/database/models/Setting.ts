import {
  DataTypes,
  Model,
  Optional,
  Sequelize
} from 'sequelize';

type TargetType = 'user' | 'guild';

interface SettingAttrs {
  id: number;
  targetType: TargetType;
  targetId: number;
  key: string;
  value: object;
  createdAt?: Date;
  updatedAt?: Date;
}
interface SettingCreation extends Optional<SettingAttrs,'id'> {}

export class Setting
  extends Model<SettingAttrs,SettingCreation>
  implements SettingAttrs {
  public id!: number;
  public targetType!: TargetType;
  public targetId!: number;
  public key!: string;
  public value!: object;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function SettingFactory(sequelize: Sequelize) {
  Setting.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    targetType: {
      type: DataTypes.ENUM('user','guild'),
      allowNull: false
    },
    targetId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: false
    }
  }, {
    tableName: 'settings',
    indexes: [
      { fields: ['targetType','targetId'] }
    ],
    sequelize
  });
  return Setting;
}
