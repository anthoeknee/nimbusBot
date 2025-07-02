import { Sequelize } from 'sequelize';
import { config } from '../../config';
import { initModels } from './models';

export const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  // Optional: Add additional configuration options
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Initialize models and get the initialized instances
export const models = initModels(sequelize);

// Test the connection
export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}
