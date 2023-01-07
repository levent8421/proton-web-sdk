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
        withAction: function (action, actionVer, priority) {
            this.header.action = action;
            this.header.actionVer = actionVer;
            this.header.priority = priority || 3;
            return this;
        },
        withPayload: function (payload) {
            this.payload = payload;
            return this;
        },
        withExt: function (name, value) {
            this.ext[name] = value;
            return this;
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
        this.requestTable = {};
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
            this.bridge.onMqttEvent = function (res) {
                _this.onMqttEvent(res)
            };
            this.bridge.onMqttSubscribe = function (res) {
                _this.onMqttSubscribe(res)
            }
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
            var requestId = res.requestId;
            var request = this.requestTable[requestId];
            if (!request) {
                console.error("Can not find requestId:" + requestId);
                return;
            }
            request.callback(res);
            delete this.requestTable[requestId];
        },

        onMqttEvent: function (res) {
            console.log("onMqttEvent:" + JSON.stringify(res))
            var requestId = res.requestId;
            var request = this.requestTable[requestId];
            if (!request) {
                console.error("Can not find requestId:" + requestId);
                return
            }
            request.callback(res);
            delete this.requestTable[requestId];
        },

        onMqttSubscribe: function (res) {
            console.log("onMqttSubscribe:" + JSON.stringify(res))
            var requestId = res.requestId;
            var request = this.requestTable[requestId];
            if (!request) {
                console.error("Can not find requestId:" + requestId);
                return
            }
            request.callback(res);
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

        setConsoleVisible: function () {
            const _this = this;
            return new Promise(function (resolve, reject) {
                if (!_this.bridge) {
                    reject('Bridge not connected!');
                    return;
                }
                setTimeout(function () {
                    var res = _this.bridge.setConsoleVisible();
                    resolve(res);
                }, 0);
            });
        },

        setDebugModel: function () {
            const _this = this;
            return new Promise(function (resolve, reject) {
                if (!_this.bridge) {
                    reject('Bridge not connected!');
                    return;
                }
                setTimeout(function () {
                    var res = _this.bridge.setDebugModel();
                    resolve(res);
                }, 0);
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

        sendRequest: function (props) {
            if (!props.method) {
                props.method = 'GET';
            }
            var body = props.body;
            if ((typeof body) !== 'string') {
                props.body = JSON.stringify(props.body);
            }
            var params = JSON.stringify(props);
            var _this = this;
            return new Promise(function (resolve, reject) {
                if (!props.url) {
                    reject('url is required!');
                    return;
                }
                setTimeout(function () {
                    var requestId = _this.bridge.request(params);
                    _this.requestTable[requestId] = {
                        request: props,
                        callback: function (res) {
                            var status = res.status;
                            if (status !== 200) {
                                reject(res);
                            } else {
                                resolve(res);
                            }
                        }
                    };
                }, 0);
            });
        },

        request: function (props) {
            return this.sendRequest(props);
        },

        readFile: function (props) {
            var params = {
                path: props.path,
                charset: props.charset || 'utf8',
                mode: props.mode || 'string'
            };
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.readFile(JSON.stringify(params));
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        writeFile: function (props) {
            var params = {
                path: props.path,
                mode: props.mode || 'string',
                content: props.content,
                charset: props.charset || 'utf8',
                append: props.append || false,
                autoCreate: props.autoCreate || true
            };
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.writeFile(JSON.stringify(params));
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        fileStat: function (filePath) {
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.fileStat(filePath);
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        deleteFile: function (props) {
            var params = {
                path: props.path,
            };
            if (props.hasOwnProperty('recursion')) {
                params.recursion = props.recursion;
            } else {
                params.recursion = true;
            }
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.deleteFile(JSON.stringify(params));
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        listFile: function (filePath) {
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.listFile(filePath);
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        mkdir: function (props) {
            var params = {
                path: props.path,
            };
            if (props.hasOwnProperty('createParent')) {
                params.createParent = props.createParent;
            } else {
                params.createParent = true;
            }
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.mkdir(JSON.stringify(params));
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        connectMqtt: function (props) {
            return this.startMqtt(props);
        },

        startMqtt: function (props) {
            var param = {
                host: props.host,
                port: props.port,
                autoReconnect: props.autoReconnect || true,
                username: props.username,
                password: props.password
            };
            var _this = this;
            return new Promise(function (resolve, reject) {
                if (!props.host || !props.port || !props.username || !props.password) {
                    reject('url&port & username & password is required!');
                    return;
                }
                setTimeout(function () {
                        var requestId = _this.bridge.connectMqtt(JSON.stringify(param));
                        _this.requestTable[requestId] = {
                            callback: function (res) {
                                var hasError = res.hasError;
                                if (hasError) {
                                    reject(res);
                                } else {
                                    resolve(res);
                                }
                            }
                        }
                    }
                    , 500)
            })
        },

        mqttClose: function (chId) {
            var _this = this;
            return new Promise(function (resolve) {
                if (!chId) {
                    resolve("chId is required!")
                }
                setTimeout(function () {
                    var res = _this.bridge.mqttClose(chId);
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        mqttSendMessage: function (props) {
            var param = {
                chId: props.chId,
                payload: props.payload,
                payloadMode: props.payloadMode || "string",
                topic: props.topic,
                qos: props.qos,
                retained: props.retained || true
            }
            var _this = this;
            return new Promise(function (resolve) {
                if (!param.chId) {
                    resolve("chId is required!")
                    return
                }
                const re = '^[0-2]$';
                if (!param.qos.toString().match(re)) {
                    resolve('qos must 0|1|2')
                    return;
                }
                setTimeout(function () {
                    var res = _this.bridge.mqttSendMessage(JSON.stringify(param));
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0);
            });
        },

        mqttSubscribeTopic: function (props) {
            return this.subscribeTopic(props);
        },

        subscribeTopic: function (props) {
            var param = {
                chId: props.chId,
                topic: props.topic,
                qos: props.qos || 1,
                payloadMode: props.payloadMode || "string"
            }
            var _this = this;
            return new Promise(function (resolve, reject) {
                if (!param.topic || !param.qos || !param.chId) {
                    console.log("param:" + JSON.stringify(param))
                    reject("topic & qos & chId is required!")
                    return
                }
                const re = '^[0-2]$';
                if (!param.qos.toString().match(re)) {
                    resolve('qos must 0|1|2')
                    return;
                }
                setTimeout(function () {
                    var requestId = _this.bridge.mqttSubscribeTopic(JSON.stringify(param))
                    _this.requestTable[requestId] = {
                        callback: function (res) {
                            var hasError = res.hasError;
                            if (hasError) {
                                reject(res);
                            } else {
                                resolve(res);
                            }
                        }
                    }
                }, 500)
            })
        },

        mqttCancelSubscribeTopic: function (props) {
            var param = {
                chId: props.chId,
                topic: props.topic,
            }
            var _this = this;
            return new Promise(function (resolve) {
                if (!param.topic || !param.chId) {
                    resolve("topic & chId is required!")
                    return
                }
                setTimeout(function () {
                    var res = _this.bridge.mqttCancelSubscribeTopic(JSON.stringify(param));
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0)
            })
        },

        setStorageItem: function (name, value) {
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.setStorageItem(name,value);
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0)
            })
        },

        getStorageItem: function (name) {
            var _this = this;
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var res = _this.bridge.getStorageItem(name);
                    var resObj = JSON.parse(res);
                    resolve(resObj);
                }, 0)
            })
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