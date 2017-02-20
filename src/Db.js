'use strict';
const pg = require('pg');
const Emitter = require("./EventEmitterExt");

// драйвер неверно конвертит даты из UTC
// https://github.com/brianc/node-postgres/issues/429
pg.types.setTypeParser(1114, (s)=> {return new Date(Date.parse(s + 'Z'))});

//set status of db
const CREATE = 'create';
const CONNECT = 'connect';
const READY = 'ready';
const ERROR = 'error';

class Db {

    constructor(config, log) {
        this.log = log;

        const conn = {
            user: config.username,
            password: config.password,
            database: config.database,
            host: config.host,
            port: config.port
        };
        this.createClient(conn);
        this.status = CREATE;
        this.config = config;
        this.shard_id = config.shard_id;
        this.shard_name = config.shard_name || "unknown";
    }

    createClient(conn) {
        this.client = new pg.Client(conn);
        this.client.on('error', this.onError.bind(this));
        this.client.on('end', this.onEnd.bind(this));
    }

    connect() {
        return new Promise((cb, rej)=> {
            try {
                this.status = CONNECT;
                this.client.connect((err)=> {
                    if (err) {
                        this.status = ERROR;
                        this.log.error("Db on connect err", {err});
                        rej && rej(err)
                    } else {
                        this.status = READY;
                        this.log.info(`Shard: ${this.shard_name} success connect`);
                        cb && cb()
                    }
                })
            } catch (e) {
                rej(e)
            }
        })
    }

    close() {
        this.log.info(`Shard: ${this.shard_name}, close connection`);
        this.client.end()
    }

    //Простой или параметризованный sql-запрос
    // q {String} sql-строка с возможными нумерованными параметрами типа $1,$2 etc
    // params {Array} параметры
    // return {core.EventEmitterExt}
    // https://github.com/brianc/node-postgres/wiki/Prepared-Statements'>https://github.com/brianc/node-postgres/wiki/Prepared-Statements
    sqlQuery(q, params) {
        this.logQuery(params, q);
        return new Emitter(this.onEmitter.bind(this), q, params).run()
    }

    onEmitter(emitter) {
        if (this.status === ERROR)
            return emitter.emit("error", {error_code: "db_error", message: "No connection for DB!"});

        this.client.query(emitter.q, emitter.params, (e, result)=> {
            if (e) {
                if (e.code && (e.code === "08P01" || e.code === "EPIPE"))
                    this.status = ERROR;

                const query = this.prepareQuery.bind(this)(emitter.params, emitter.q);
                const err = {
                    pg_code: e.code,
                    error_code: "db_error",
                    query,
                    message: (e instanceof Error) ? e.message : e
                };
                this.log.error("Db onEmitter error", {err});
                emitter.emit('error', err)
            } else
                emitter.emit('success', result.rows)
        })
    }

    logQuery(params, query, time) {
        query = this.prepareQuery.bind(this)(params, query);
        if (time)
            query = "Finish: " + query + " (" + (Math.floor(new Date()/1000) - time / 1000) + "ms)";
        this.log.info("Inspect query", {shard: this.shard_name, query})
    }

    onEnd(err) {
        this.status = ERROR;
        this.log.error("Connection was ended during query", {err});
    }

    onError(err) {
        this.status = ERROR;
        this.log.error("Db onError", {err});
    }

    prepareQuery(params, query) {
        if (params && params.length > 0) {
            const ps = params.concat();
            query = query.replace(/\$\d+/g, (v)=> {
                if (ps.length === 0)
                    return v;

                const el = ps.shift();
                if (el)
                    return JSON.stringify(el);
                return 'null';
            })
        }
        return query
    }
}

module.exports = Db;
