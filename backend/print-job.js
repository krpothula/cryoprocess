process.chdir('/home/kpothula/Documents/software-development/cryoprocess-nodejs/backend');
require('dotenv').config({ path: '/home/kpothula/Documents/software-development/cryoprocess-nodejs/.env' });
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cryoprocess-db';

mongoose.connect(uri).then(async () => {
  const job = await mongoose.connection.db.collection('jobs').findOne({
    job_name: 'Job007',
    job_type: { $regex: /ctf/i }
  });
  if (!job) {
    const job2 = await mongoose.connection.db.collection('jobs').findOne({ job_name: 'Job007' });
    console.log(JSON.stringify(job2, null, 2));
  } else {
    console.log(JSON.stringify(job, null, 2));
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
