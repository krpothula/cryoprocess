require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const LiveSession = require('./src/models/LiveSession');
  const s = await LiveSession.findOne({ status: 'running' }).sort({ created_at: -1 }).lean();
  if (!s) {
    console.log('No running session');
    process.exit(0);
  }
  console.log('Session:', s.session_name, '| ID:', s.id);
  console.log('State:', JSON.stringify(s.state, null, 2));
  console.log('Jobs:', JSON.stringify(s.jobs, null, 2));

  console.log('\n--- Last 30 Activity ---');
  const activities = (s.activity_log || []).slice(-30);
  activities.forEach(a => {
    const ts = a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '';
    console.log(ts, '|', a.level || 'info', '|', a.stage || '-', '|', a.event, '|', a.message);
    if (a.context && Object.keys(a.context).length > 0) {
      console.log('  ctx:', JSON.stringify(a.context));
    }
  });
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
