/**
 * Create Admin User Utility
 *
 * Creates the default admin user if it doesn't exist.
 * Also repairs broken admin documents from old installs.
 * Run with: node backend/src/utils/createAdmin.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const mongoose = require('mongoose');

async function setup() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cryoprocess-db';
    await mongoose.connect(uri);

    const User = require('../models/User');

    // Check for broken admin from old installs (missing required fields)
    const db = mongoose.connection.db;
    const existing = await db.collection('users').findOne({ email: 'admin@example.com' });

    if (existing && (!existing.username || existing.id === undefined)) {
        await db.collection('users').deleteOne({ email: 'admin@example.com' });
        console.log('Removed broken admin user (missing required fields), recreating...');
    }

    const validAdmin = await User.findOne({ email: 'admin@example.com' });
    if (!validAdmin) {
        const nextId = await User.getNextId();
        await User.create({
            id: nextId,
            username: 'admin',
            email: 'admin@example.com',
            password: 'admin123',
            first_name: 'Admin',
            last_name: '',
            is_active: true,
            is_staff: true,
            is_superuser: true,
            must_change_password: true
        });
        console.log('Admin user created (admin@example.com / admin123)');
    } else {
        console.log('Admin user already exists');
    }

    await mongoose.disconnect();
}

setup().catch(e => { console.error('Admin setup error:', e.message); process.exit(1); });
