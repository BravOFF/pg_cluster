'use strict';
const EventEmitter = require("events").EventEmitter;

class EventEmitterExt extends EventEmitter {

    constructor(fct, q, params) {
        super();
        this.fct = fct;
        this.q = q;
        this.params = params;
        EventEmitter.call(this)
    }

    run() {
        this.stopped = false;
        process.nextTick(()=>{
            //delay the function call and return the emitter
            if (!this.stopped)
                this.fct.call(this, this)
        });
        return this
    }

    stop() {
        this.stopped = true;
        return this
    }

    success(fct, extParams) {
        this.once('success',(result, params)=> {
            this.removeAllListeners();
            fct(result, params, extParams)
        });
        return this
    }

    error(fct, extParams) {
        this.once('error', (err, params)=> {
            this.removeAllListeners();
            fct(err, params, extParams)
        });
        return this
    }

    done(fct) {
        this.on('error', (err, params)=> {
            this.removeAllListeners();
            fct(err, params)
        }).on('success', (result, params)=> {
            this.removeAllListeners();
            fct(null, result)
        });
        return this
    }
}

module.exports = EventEmitterExt;