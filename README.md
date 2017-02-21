# pg-cluster.
## Description.
Simple module for building cluster with postgresql databases for node v >=7 with 1 dependencies(pg). Support replication mode, maintenance mode.

###Install module.
```
npm install pg-cluster
```

## Usage.

#### Cluster is class, and you can extend him by you custom cluster.
#### Define sample config.
```
Define sample config:
2 shards dev0, dev1(in maintenance) - in master mode
2 shards dev2, dev3 - in slave mode

const config = {
    dev0: {
        adapter: "postgresql"
        port: 5432,
        host: "127.0.0.1",
        database: "dev0",
        shard_id: "00",
        username: "postgres",
        password: "pass"
    },
    dev1: {
        adapter: "postgresql"
        port: 5432,
        host: "127.0.0.1",
        database: "dev1",
        shard_id: "01",
        username: "postgres",
        password: "pass",
        maintenance: true
    },

    dev_slave0: {
        adapter: "postgresql"
        port: 5432,
        host: "127.0.0.1",
        database: "dev2",
        shard_id: "00",
        username: "postgres",
        password: "pass",
        slave: true
    },
    dev_slave1: {
        adapter: "postgresql"
        port: 5432,
        host: "127.0.0.1",
        database: "dev3",
        shard_id: "01",
        username: "postgres",
        password: "pass",
        slave: true
    }
};
```

#### Init cluster.
```
const Cluster = require('pg_cluster');
const customLog = console.log;
try {
    const db = new Cluster(config, customLog);
    await db.masterMode(false); // want switch to replications cluster;
    await db.init();
} catch (e) {
    console.log("Some Error", err)
}
```

#### Create model.
```
const onSuccessGetByUserId = function(res, params, cb) {
    cb(res)
}

const onErrorGetByUserId = function(err, params, cb) {
    cb(err)
}

const getByUserId = function() {
    const firstSlaveShard = db.getById("00");
    const userId = "userId";
    return new Promise((cb ,rej)=> {
        firstSlaveShard.sqlQuery(`SELECT * FROM users WHERE user_id=$1;`,[userId])
           .success(onSuccessGetByUserId, cb)
           .error(onErrorGetByUserId, rej)
    })
}
```

#### Call sql request.
```
Call model method:
try {
    const res = await getByUserId()
} catch (e) {
    console.log("Some Error wit db request", err)
}
```

#### Close cluster when shoutdown your server, or reinit cluster.
```
db.close();
```

#### Errors: postgresql can return serious error with codes("08P01", "EPIPE"), if this happened, cluster set shard status on "error", and this shard is locked. You need try reconnect you broken shards.
```
if (db.hasBrokenShards)
    db.reconnectBrokenShards();
```

#### Main methods
```
db.init();
db.close();
db.masterMode();
db.hasBrokenShards();
db.reconnectBrokenShards();
db.randomShard();
db.getById();
db.afterInit();
```

## License MIT
