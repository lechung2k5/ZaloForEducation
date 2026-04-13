const { createClient } = require('redis');

async function checkRedis() {
  const client = createClient({
    url: 'redis://:1puxG0Jzdkg4b36EOtG758IVQ1Bk5X0e@redis-19622.crce302.ap-seast-1-3.ec2.cloud.redislabs.com:19622'
  });

  client.on('error', err => console.log('Redis Client Error', err));

  try {
    await client.connect();
    
    const keys = await client.keys('*');
    console.log('--- ALL KEYS ---');
    console.log(keys);

    const userKeys = await client.keys('USER_SESSIONS#*');
    for (const key of userKeys) {
        const members = await client.sMembers(key);
        console.log(`\nKey: ${key}`);
        console.log(`Members: ${JSON.stringify(members)}`);
        
        for (const deviceId of members) {
            const email = key.split('#')[1];
            const sessionKey = `session:${email}:${deviceId}`;
            const sessionData = await client.get(sessionKey);
            console.log(`  SessionKey: ${sessionKey}`);
            console.log(`  Data: ${sessionData}`);
        }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.disconnect();
  }
}

checkRedis();
