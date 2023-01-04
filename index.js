(function (w, m) {
    var BRIDGE_NAME = "__$proton__";
    var ROOT_ELEMENT = w;
    var PROTON_PROTOCOL_VER = 1;
    var Utils = {
        padStart: function (str, width, fill) {
            str = str.toString();
            if (str.hasOwnProperty('pasStart')) {
                return str.padStart(width, fill);
            }
            while (str.length < width) {
                str = fill + str;
            }
            return str;
        },
        timestamp: function () {
            var now = new Date();
            var y = now.getFullYear();
            var m = now.getMonth() + 1;
            var d = now.getDate();
            var h = now.getHours();
            var mm = now.getMinutes();
            var s = now.getSeconds();
            var sss = now.getMilliseconds();
            return Utils.padStart(y, 4, '0')
                + Utils.padStart(m, 2, '0')
                + Utils.padStart(d, 2, '0')
                + Utils.padStart(h, 2, '0')
                + Utils.padStart(mm, 2, '0')
                + Utils.padStart(s, 2, '0')
                + Utils.padStart(sss, 3, '0');
        }
    };

    function ProtonPacket() {
        this.type = 'request';
        this.protocolVer = PROTON_PROTOCOL_VER;
        this.header = {
            trace: '',
            priority: 1,
            actionVer: 'V0.1',
            timestamp: '',
            sign: 'MOCK'
        };
        this.ext = {};
        this.payload = null;
    }

    ProtonPacket.nextTrace = 0;
    ProtonPacket.prototype = {
        withAction: function (action) {
            this.header.action = action;
            return this;
        },
        withPayload: function (payload) {
            this.payload = payload;
        },
        withExt: function (name, value) {
            this.ext[name] = value;
        },
        preSend: function () {
            this.header.timestamp = Utils.timestamp();
            this.header.trace = 'WEB_' + ProtonPacket.nextTrace++;
        }
    };

    function ProtonWebSdk(props) {
        this.bridge = null;
        this.debug = props.debug || false;
        this.actionCallbackTable = {};
    }

    ProtonWebSdk.ProtonPacket = ProtonPacket;
    ProtonWebSdk.prototype = {
        _setup: function () {
            var _this = this;
            this.bridge.onMessage = function (msg) {
                _this.onMessage(msg);
            };
            this.bridge.onRequestComplete = function (res) {
                _this.onRequestComplete(res);
            };
        },
        onMessage: function (msg) {
            if (!msg) {
                return;
            }
            var pVer = msg.protocolVer;
            if (parseInt(pVer) !== PROTON_PROTOCOL_VER) {
                return;
            }
            var header = msg.header;
            if (!header) {
                return;
            }
            var action = header.action;
            var aVer = header.actionVer;
            var actionKey = this._actionKey(action, aVer);
            var callback = this.actionCallbackTable[actionKey];
            if (!callback) {
                return;
            }
            callback(msg);
        },
        onRequestComplete: function (res) {
            console.log('REQ:' + res);
        },
        connect: function () {
            var _this = this;
            return new Promise(function (resolve, reject) {
                if (ROOT_ELEMENT.hasOwnProperty(BRIDGE_NAME)) {
                    _this.bridge = ROOT_ELEMENT[BRIDGE_NAME];
                    _this._setup()
                    resolve(_this.bridge);
                } else {
                    _this.bridge = null;
                    reject('No variable named:[' + BRIDGE_NAME + '] in global namespace[window]!');
                }
            });
        },
        sendAction: function (packet) {
            packet.preSend();
            var param = JSON.stringify(packet);
            const _this = this;
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    var resp;
                    try {
                        resp = _this.bridge.sendCmd(param);
                        resp = JSON.parse(resp);
                        resolve(resp);
                    } catch (error) {
                        reject(error);
                    }
                }, 0);
            });
        },
        _actionKey: function (action, ver) {
            return action + '@' + ver;
        },
        subscribeAction: function (action, ver, callback) {
            var actionKey = this._actionKey(action, ver);
            this.actionCallbackTable[actionKey] = callback;
        },
    };

    if (m) {
        m.exports = ProtonWebSdk;
    } else {
        w.ProtonWebSdk = ProtonWebSdk;
    }
})(window, (typeof module) === 'undefined' ? undefined : module);