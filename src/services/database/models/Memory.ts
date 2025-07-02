// src/services/database/models/Memory.ts
import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

interface MemoryAttrs {
  id: number;
  userId: number | null;
  guildId: number | null;
  content: string;
  embedding: number[]; // The vector
  createdAt?: Date;
  updatedAt?: Date;
}
interface MemoryCreation extends Optional<MemoryAttrs, 'id'> {}

export class Memory extends Model<MemoryAttrs, MemoryCreation> implements MemoryAttrs {
  public id!: number;
  public userId!: number | null;
  public guildId!: number | null;
  public content!: string;
  public embedding!: number[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function MemoryFactory(sequelize: Sequelize) {
  Memory.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    guildId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    embedding: {
      // Use a raw attribute for the vector type
      type: DataTypes.JSONB, // For Sequelize, but see below for actual storage
      allowNull: false,
      // @ts-ignore
      get() {
        // Parse the vector from the DB (if needed)
        const raw = this.getDataValue('embedding');
        return Array.isArray(raw) ? raw : JSON.parse(raw);
      },
      set(val: number[]) {
        // Store as JSON array, but you will use raw SQL for vector operations
        this.setDataValue('embedding', val);
      }
    }
  }, {
    tableName: 'memories',
    sequelize
  });
  return Memory;
}