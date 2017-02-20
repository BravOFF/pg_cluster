'use strict';
const Db = require('./Db');
const MaintenanceDb = require('./MaintenanceDb');

class Cluster {

    constructor(cfg, log) {
        this.clusterInMasterMode = true;
        this.cfg = cfg;
        this.log = log;
        this.ready = false
    }

    set masterMode(v) {
        this.clusterInMasterMode = v;
    }

    close() {
        this.ready = false;
        for (const shard in this.shards) {
            this.shards[shard].close()
        }
    }

    //Создание/пересоздание и подключение/переподключенеие всех шардов. Шарды на мэйнтененсе будут удалены.
    init() {
        return new Promise(async (cb, rej)=> {
            try {
                this.shards = this.shards || {};
                await this.updateShardsConnections();
                this.afterInit();
                this.ready = true;
                this.log.info('Successful reload shards');
                cb();
            } catch (e) {
                rej(e)
            }
        })
    }

    reconnectBrokenShards() {
        return new Promise(async (cb, rej)=> {
            try {
                this.log.debug('reconnectBrokenShards');
                if (!this.hasBrokenShards) {
                    this.log.debug('no broken shards');
                    return cb();
                }
                await this.updateShardsConnections();
                this.afterInit();
                cb();
            } catch (e) {
                rej(e)
            }
        })
    }

    // Создаёт/пересоздаёт подключения к шардам.
    // Удаляет соединения с шардами на мэйнтененсе.
    async updateShardsConnections() {
        return new Promise(async (cb, rej)=> {
            try {
                for (const shardName in this.cfg) {
                    if (this.clusterInMasterMode && this.cfg[shardName].slave)
                        continue;
                    if (!this.clusterInMasterMode && !this.cfg[shardName].slave)
                        continue;

                    let db;
                    if (this.cfg[shardName].maintenance) {
                        this.log.info(`Shard ${shardName} in maintenance`);
                        if (this.shards[shardName]) {
                            this.shards[shardName].close();
                            delete this.shards[shardName];
                        }
                        db = this.createMaintenanceShard(shardName, this.cfg[shardName]);
                        this.shards[shardName] = db;
                        continue;
                    }

                    db = this.shards[shardName];
                    if (!db || (db && db.status === 'error'))
                        db = this.createShard(shardName, this.cfg[shardName]);

                    if (db.status === 'create')
                        await db.connect();
                    this.shards[shardName] = db;
                }
                cb()
            } catch (e) {
                rej(e)
            }
        })
    }

    afterInit() {

    }

    createShard(shard_name, params) {
        return new Db(Object.assign(params, {shard_name}), this.log)
    }

    createMaintenanceShard(shard_name, params) {
        return new MaintenanceDb(Object.assign(params, {shard_name}), this.log)
    }

    randomShard() {
        const randomInt = Math.floor(Math.random() * (this.shards.length));
        return this.shards[Object.keys(this.shards)[randomInt]]
    }

    getById(id) {
        for (const shardName in this.shards) {
            if (parseInt(this.shards[shardName].shard_id) === parseInt(id))
                return this.shards[shardName]
        }
        return null
    }

    get hasBrokenShards() {
        for (const shard in this.shards) {
            if (this.shards[shard].status === 'error') {
                this.log.warn("Shard is broken", {shard, shard_status: this.shards[shard].status});
                return true
            }
        }
        return false
    }
}

module.exports = Cluster;
