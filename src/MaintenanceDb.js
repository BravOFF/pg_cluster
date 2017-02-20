'use strict';
const Db = require('./Db');
const MAINTENANCE = 'maintenance';

class MaintenanceDb extends Db {

    constructor(config, log) {
        super(config, log);
        this.log = log;
        this.status = MAINTENANCE;
        this.config = config;
        this.shard_id = config.shard_id;
        this.shard_name = config.shard_name || "unknown";
    }

    createClient(conn) {

    }

    onEmitter(emitter) {
        emitter.emit("error", {error_code: "db_maintenance", message: "Shard on maintenance!"})
    }
}

module.exports = MaintenanceDb;