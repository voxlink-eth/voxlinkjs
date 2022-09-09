/*
    This library is used to link to the Voxlink onchain API.
    It is self contained and does not require any other libraries.
*/
(async () => {
    window.Voxlink = {
        init: async function () {
            Voxlink.interceptor();
            Voxlink.initKeccak(Voxlink);
            Voxlink.VoxlinkMainNode = Voxlink.getNameHash(Voxlink.VoxlinkMainDomain); //"0x6afd9e9c9770c951012614a4b0237155806a4f897ba05dac300f7e6694aae017", //"0x23d962ed956faa47b43b7d38741047a33a659deb4ca69d29dd4ed8d1b5644fe5";
            Voxlink.VoxlinkTestNode = Voxlink.getNameHash(Voxlink.VoxlinkTestDomain);
            if (!Voxlink.VoxlinkContract) {
                Voxlink.VoxlinkContract = await Voxlink.getVoxlinkContract();
                // bug in metamask, need to ask for it a second time
                Voxlink.VoxlinkContract = await Voxlink.getVoxlinkContract();
            };
            window.ethereum.on("accountsChanged", (e)=>Voxlink.events("accountsChanged", e));
            window.ethereum.on("chainChanged", (e)=>Voxlink.events("chainChanged", e));
            window.ethereum.on('connect', (e)=>Voxlink.events("connect",e));
            window.ethereum.on('disconnect', (e)=>Voxlink.events("disconnect",e));
            window.ethereum.on('error', (e)=>Voxlink.events("error",e));
        },
        events: async function (event, data) {
            switch (event) {
                case "accountsChanged":
                    console.log("accountsChanged", data);
                    await Voxlink.disconnect();
                    await Voxlink.connect();
                    break;
                case "chainChanged":
                    console.log("chainChanged", data);
                    await Voxlink.disconnect();
                    break;
                case "connect":
                    console.log("connect", data);
                    Voxlink.ethereumConnected = true;
                    break;
                case "disconnect":
                    console.log("disconnect", data);
                    Voxlink.ethereumConnected = false;
                    break;
                case "error":
                    console.log("error", data);
                    Voxlink.ethereumConnected = false;
                    return Voxlink.error(data);
                    break;
                default:
                    console.log(data);
            }
            var VoxlinkEvent = new CustomEvent("VoxlinkEvent", { detail: {event:event, data:data}});
            window.dispatchEvent(VoxlinkEvent);
        },
        error: function (error) {
            var errorEvent = new CustomEvent("VoxlinkError", { detail: error });
            window.dispatchEvent(errorEvent);
        },
        ENSRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        VoxlinkMainNode: undefined,
        VoxlinkMainDomain: "voxlink.eth",
        VoxlinkTestNode: undefined,
        VoxlinkTestDomain: "newtest.eth",
        VoxlinkContract: undefined,
        connectedWallet: undefined,
        ethereumConnected: false,
        zeroAddress: "0x0000000000000000000000000000000000000000",
        getVoxlinkContract: async function () {
            // call the ENSRegistry to get the owner of the main node
            var nodeToUse = Voxlink.VoxlinkMainNode;
            // if we are on the test network, use the test node instead
            if (window.ethereum.networkVersion == "5") {
                nodeToUse = Voxlink.VoxlinkTestNode;
            }
            var owner = await window.ethereum.request({
                method: 'eth_call',
                jsonrpc: "2.0",
                id: "1",
                value: "0x0",
                params: [{
                    to: Voxlink.ENSRegistry,
                    data: "0x02571be3" + nodeToUse.slice(2)
                }, "latest"]
            });
            return "0x" + owner.slice(64 + 2 - 40);
        },
        burnerWalletExists: async function (burnerWallet) {
            if (!Voxlink.VoxlinkContract) {
                Voxlink.VoxlinkContract = await Voxlink.getVoxlinkContract();
            }
            var result = await window.ethereum.request({
                method: 'eth_call',
                jsonrpc: "2.0",
                id: "1",
                params: [{
                    to: Voxlink.VoxlinkContract,
                    data: "0xbb10c61d" + Voxlink.padded(burnerWallet.slice(2))
                }, "latest"]
            });
            result = result.slice(2);
            // success is a boolean of the first 64 bytes
            var exists = Boolean(parseInt(result.substr(0, 64)));
            return exists;
        },
        getMainWalletFromBurnerWallet: async function (burnerWallet) {
            if (!Voxlink.VoxlinkContract) {
                Voxlink.VoxlinkContract = await Voxlink.getVoxlinkContract();
            }
            var result = await window.ethereum.request({
                method: 'eth_call',
                jsonrpc: "2.0",
                id: "1",
                params: [{
                    to: Voxlink.VoxlinkContract,
                    data: "0xe702a670" + Voxlink.padded(burnerWallet.slice(2))
                }, "latest"]
            });
            result = result.slice(2);
            // success is a boolean of the first 64 bytes
            var success = Boolean(parseInt(result.substr(0, 64)));
            var mainWallet = result.substr(64 + 64 - 40, 128);
            return { success: success, mainWallet: Voxlink.toChecksumAddress("0x" + mainWallet) };
        },
        registerVoxlink: async function (mainWallet, burnerWallet, safetyCode, mainWalletSignature, burnerWalletSignature) {
            //address mainWallet,
            //address burnerWallet,
            //uint256 safetyCode,
            //bytes memory mainWalletSignature,
            //bytes memory burnerWalletSignature
            if (!Voxlink.VoxlinkContract) {
                Voxlink.VoxlinkContract = await Voxlink.getVoxlinkContract();
            }
            var result = await window.ethereum.request({
                method: 'eth_sendTransaction',
                jsonrpc: "2.0",
                id: "1",
                params: [{
                    to: Voxlink.VoxlinkContract,
                    from: burnerWallet,
                    data: "0xa7b42475" + 
                        Voxlink.padded(mainWallet.slice(2)) + 
                        Voxlink.padded(burnerWallet.slice(2)) +
                        Voxlink.padded(safetyCode.toString(16),64) +
                        Voxlink.padded((64+64+32).toString(16),64)+
                        Voxlink.padded((64+64+32+64+64).toString(16),64)+
                        Voxlink.padded("41", 64)+
                        Voxlink.padded(mainWalletSignature.slice(2),64,'right') +
                        Voxlink.padded("41", 64)+
                        Voxlink.padded(burnerWalletSignature.slice(2),64,'right')
                }]
            });
            return result;
        },
        deleteVoxlink: async function (burnerWallet) {
            if (!Voxlink.VoxlinkContract) {
                Voxlink.VoxlinkContract = await Voxlink.getVoxlinkContract();
            }
            if (!Voxlink.connectedWallet) {
                await Voxlink.connect();
            }
            var burnerWalletNode = Voxlink.getNameHash(burnerWallet.toLowerCase() + '.' + Voxlink.VoxlinkTestDomain);
            var result = await window.ethereum.request({
                method: 'eth_sendTransaction',
                jsonrpc: "2.0",
                id: "1",
                params: [{
                    to: Voxlink.ENSRegistry,
                    from:Voxlink.connectedWallet,
                    data: "0x5b0fc9c3" + 
                        burnerWalletNode.slice(2) + 
                        Voxlink.padded(Voxlink.zeroAddress.slice(2))
                }]
            });
            return result;
        },
        connect: async function () {
            Voxlink.connectedWallet = Voxlink.toChecksumAddress((await window.ethereum.request({ method: "eth_requestAccounts" }))[0]);
        },
        disconnect: async function () {
            Voxlink.connectedWallet = undefined;
            Voxlink.ethereumConnected = false;
        },
        toChecksumAddress: function (address) {
            address = address.toLowerCase().replace('0x', '')
            var hash = Voxlink.keccak256(address);
            var ret = '0x'
            for (var i = 0; i < address.length; i++) {
                if (parseInt(hash[i], 16) >= 8) {
                    ret += address[i].toUpperCase()
                } else {
                    ret += address[i]
                }
            }
            return ret
        },
        resolveName: async function (name) {
            var node = Voxlink.getNameHash(name);
            console.log(name,node);
            var owner = await window.ethereum.request({
                method: 'eth_call',
                jsonrpc: "2.0",
                id: "1",
                params: [{
                    to: Voxlink.ENSRegistry,
                    data: "0x02571be3" + node.slice(2)
                }, "latest"]
            });
            return Voxlink.toChecksumAddress("0x" + owner.slice(64 + 2 - 40));
        },
        getSafetyCode: function (minutes) {
            if (!minutes) {
                minutes = 10;
            }
            return Math.floor((new Date().getTime() + minutes * 60 * 1000) / 1000);
        },
        getVoxlinkString: async function (mainWallet, burnerWallet, safetyCode) {
            return "voxlink.eth:\n\nmainWallet\n" + mainWallet.toLowerCase() + "\n\nburnerWallet\n" + burnerWallet.toLowerCase() +
                "\n\nsafetyCode\n" + safetyCode;
        },
        sign: async function (VoxlinkString) {
            var signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [VoxlinkString, Voxlink.connectedWallet]
            });
            return signature;
        },
        getNameHash: function (fullDomain) {
            var fullDomainSplit = fullDomain.split('.');
            function _getNameHash(args) {
                if (typeof args !== 'object') {
                    args = [args];
                }
                var namehash = "0000000000000000000000000000000000000000000000000000000000000000";
                for (var i = args.length - 1; i >= 0; i--) {
                    var combined = new Uint8Array([
                        ...Voxlink.hexToUint8Array(namehash),
                        ...Voxlink.hexToUint8Array(Voxlink.keccak256(args[i]))
                    ]);
                    namehash = Voxlink.keccak256(combined);
                }
                return "0x" + namehash;
            }
            return _getNameHash(fullDomainSplit);
        },
        toHex: function (str) {
            return Array.from(str).map(el => el.charCodeAt(0)).map(el => el.toString(16)).join('');
        },
        // from hexstring to Uint8Array
        hexToUint8Array: function (hexstring) {
            var hexstring = hexstring.replace('0x', '');
            var arr = [];
            for (var i = 0; i < hexstring.length; i += 2) {
                arr.push(parseInt(hexstring.substr(i, 2), 16));
            }
            return new Uint8Array(arr);
        },
        padded: function (val, amount, side) {
            // pad val to multiple of 32 bytes
            var amount = amount || 32;
            var side = side || "left";
            var padded = val;
            while (padded.length % amount != 0) {
                if (side == "left") {
                    padded = "0" + padded;
                } else {
                    padded = padded + "0";
                }
            }
            return padded;
        },
        interceptor: function () {
            // get all functions in the Voxlink object and add an interceptor to each one, for catching errors
            var functions = Object.getOwnPropertyNames(Voxlink).filter(prop => typeof Voxlink[prop] == 'function');
            // for each function, add an interceptor add a try catch to the function
            for (var i = 0; i < functions.length; i++) {
                var func = functions[i];
                Voxlink.functionStorage[func] = Voxlink[func];
                if (["interceptor", "error", "init"].indexOf(func) > -1) {
                    continue;
                }
                Voxlink[func] = new Function('try { return Voxlink.functionStorage["' + func + '"].apply(null,arguments); } catch (error) { Voxlink.error(error); }');
            }
        },
        // thx https://github.com/emn178/js-sha3
        initKeccak: function (i) { "use strict"; function t(t, e, r) { this.blocks = [], this.s = [], this.padding = e, this.outputBits = r, this.reset = !0, this.finalized = !1, this.block = 0, this.start = 0, this.blockCount = 1600 - (t << 1) >> 5, this.byteCount = this.blockCount << 2, this.outputBlocks = r >> 5, this.extraBytes = (31 & r) >> 3; for (var n = 0; n < 50; ++n)this.s[n] = 0 } function e(e, r, n) { t.call(this, e, r, n) } var r = "input is invalid type", n = "object" == typeof window; i.JS_SHA3_NO_WINDOW && (n = !1); var o = !n && "object" == typeof self; !i.JS_SHA3_NO_NODE_JS && "object" == typeof process && process.versions && process.versions.node ? i = global : o && (i = self); var a = !i.JS_SHA3_NO_COMMON_JS && "object" == typeof module && module.exports, s = "function" == typeof define && define.amd, u = !i.JS_SHA3_NO_ARRAY_BUFFER && "undefined" != typeof ArrayBuffer, f = "0123456789abcdef".split(""), c = [4, 1024, 262144, 67108864], h = [0, 8, 16, 24], p = [1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649, 0, 2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0, 2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771, 2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648, 2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648], d = [224, 256, 384, 512], l = [128, 256], y = ["hex", "buffer", "arrayBuffer", "array", "digest"], b = { 128: 168, 256: 136 }; !i.JS_SHA3_NO_NODE_JS && Array.isArray || (Array.isArray = function (t) { return "[object Array]" === Object.prototype.toString.call(t) }), !u || !i.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW && ArrayBuffer.isView || (ArrayBuffer.isView = function (t) { return "object" == typeof t && t.buffer && t.buffer.constructor === ArrayBuffer }); for (var A = function (e, r, n) { return function (i) { return new t(e, r, e).update(i)[n]() } }, w = function (e, r, n) { return function (i, o) { return new t(e, r, o).update(i)[n]() } }, v = function (t, e, r) { return function (e, n, i, o) { return S["cshake" + t].update(e, n, i, o)[r]() } }, B = function (t, e, r) { return function (e, n, i, o) { return S["kmac" + t].update(e, n, i, o)[r]() } }, g = function (t, e, r, n) { for (var i = 0; i < y.length; ++i) { var o = y[i]; t[o] = e(r, n, o) } return t }, _ = function (e, r) { var n = A(e, r, "hex"); return n.create = function () { return new t(e, r, e) }, n.update = function (t) { return n.create().update(t) }, g(n, A, e, r) }, k = [{ name: "keccak", padding: [1, 256, 65536, 16777216], bits: d, createMethod: _ }, { name: "sha3", padding: [6, 1536, 393216, 100663296], bits: d, createMethod: _ }, { name: "shake", padding: [31, 7936, 2031616, 520093696], bits: l, createMethod: function (e, r) { var n = w(e, r, "hex"); return n.create = function (n) { return new t(e, r, n) }, n.update = function (t, e) { return n.create(e).update(t) }, g(n, w, e, r) } }, { name: "cshake", padding: c, bits: l, createMethod: function (e, r) { var n = b[e], i = v(e, 0, "hex"); return i.create = function (i, o, a) { return o || a ? new t(e, r, i).bytepad([o, a], n) : S["shake" + e].create(i) }, i.update = function (t, e, r, n) { return i.create(e, r, n).update(t) }, g(i, v, e, r) } }, { name: "kmac", padding: c, bits: l, createMethod: function (t, r) { var n = b[t], i = B(t, 0, "hex"); return i.create = function (i, o, a) { return new e(t, r, o).bytepad(["KMAC", a], n).bytepad([i], n) }, i.update = function (t, e, r, n) { return i.create(t, r, n).update(e) }, g(i, B, t, r) } }], S = {}, C = [], x = 0; x < k.length; ++x)for (var m = k[x], E = m.bits, O = 0; O < E.length; ++O) { var z = m.name + "_" + E[O]; if (C.push(z), S[z] = m.createMethod(E[O], m.padding), "sha3" !== m.name) { var N = m.name + E[O]; C.push(N), S[N] = S[z] } } t.prototype.update = function (t) { if (this.finalized) throw new Error("finalize already called"); var e, n = typeof t; if ("string" !== n) { if ("object" !== n) throw new Error(r); if (null === t) throw new Error(r); if (u && t.constructor === ArrayBuffer) t = new Uint8Array(t); else if (!(Array.isArray(t) || u && ArrayBuffer.isView(t))) throw new Error(r); e = !0 } for (var i, o, a = this.blocks, s = this.byteCount, f = t.length, c = this.blockCount, p = 0, d = this.s; p < f;) { if (this.reset) for (this.reset = !1, a[0] = this.block, i = 1; i < c + 1; ++i)a[i] = 0; if (e) for (i = this.start; p < f && i < s; ++p)a[i >> 2] |= t[p] << h[3 & i++]; else for (i = this.start; p < f && i < s; ++p)(o = t.charCodeAt(p)) < 128 ? a[i >> 2] |= o << h[3 & i++] : o < 2048 ? (a[i >> 2] |= (192 | o >> 6) << h[3 & i++], a[i >> 2] |= (128 | 63 & o) << h[3 & i++]) : o < 55296 || o >= 57344 ? (a[i >> 2] |= (224 | o >> 12) << h[3 & i++], a[i >> 2] |= (128 | o >> 6 & 63) << h[3 & i++], a[i >> 2] |= (128 | 63 & o) << h[3 & i++]) : (o = 65536 + ((1023 & o) << 10 | 1023 & t.charCodeAt(++p)), a[i >> 2] |= (240 | o >> 18) << h[3 & i++], a[i >> 2] |= (128 | o >> 12 & 63) << h[3 & i++], a[i >> 2] |= (128 | o >> 6 & 63) << h[3 & i++], a[i >> 2] |= (128 | 63 & o) << h[3 & i++]); if (this.lastByteIndex = i, i >= s) { for (this.start = i - s, this.block = a[c], i = 0; i < c; ++i)d[i] ^= a[i]; j(d), this.reset = !0 } else this.start = i } return this }, t.prototype.encode = function (t, e) { var r = 255 & t, n = 1, i = [r]; for (r = 255 & (t >>= 8); r > 0;)i.unshift(r), r = 255 & (t >>= 8), ++n; return e ? i.push(n) : i.unshift(n), this.update(i), i.length }, t.prototype.encodeString = function (t) { var e, n = typeof t; if ("string" !== n) { if ("object" !== n) throw new Error(r); if (null === t) throw new Error(r); if (u && t.constructor === ArrayBuffer) t = new Uint8Array(t); else if (!(Array.isArray(t) || u && ArrayBuffer.isView(t))) throw new Error(r); e = !0 } var i = 0, o = t.length; if (e) i = o; else for (var a = 0; a < t.length; ++a) { var s = t.charCodeAt(a); s < 128 ? i += 1 : s < 2048 ? i += 2 : s < 55296 || s >= 57344 ? i += 3 : (s = 65536 + ((1023 & s) << 10 | 1023 & t.charCodeAt(++a)), i += 4) } return i += this.encode(8 * i), this.update(t), i }, t.prototype.bytepad = function (t, e) { for (var r = this.encode(e), n = 0; n < t.length; ++n)r += this.encodeString(t[n]); var i = e - r % e, o = []; return o.length = i, this.update(o), this }, t.prototype.finalize = function () { if (!this.finalized) { this.finalized = !0; var t = this.blocks, e = this.lastByteIndex, r = this.blockCount, n = this.s; if (t[e >> 2] |= this.padding[3 & e], this.lastByteIndex === this.byteCount) for (t[0] = t[r], e = 1; e < r + 1; ++e)t[e] = 0; for (t[r - 1] |= 2147483648, e = 0; e < r; ++e)n[e] ^= t[e]; j(n) } }, t.prototype.toString = t.prototype.hex = function () { this.finalize(); for (var t, e = this.blockCount, r = this.s, n = this.outputBlocks, i = this.extraBytes, o = 0, a = 0, s = ""; a < n;) { for (o = 0; o < e && a < n; ++o, ++a)t = r[o], s += f[t >> 4 & 15] + f[15 & t] + f[t >> 12 & 15] + f[t >> 8 & 15] + f[t >> 20 & 15] + f[t >> 16 & 15] + f[t >> 28 & 15] + f[t >> 24 & 15]; a % e == 0 && (j(r), o = 0) } return i && (t = r[o], s += f[t >> 4 & 15] + f[15 & t], i > 1 && (s += f[t >> 12 & 15] + f[t >> 8 & 15]), i > 2 && (s += f[t >> 20 & 15] + f[t >> 16 & 15])), s }, t.prototype.arrayBuffer = function () { this.finalize(); var t, e = this.blockCount, r = this.s, n = this.outputBlocks, i = this.extraBytes, o = 0, a = 0, s = this.outputBits >> 3; t = i ? new ArrayBuffer(n + 1 << 2) : new ArrayBuffer(s); for (var u = new Uint32Array(t); a < n;) { for (o = 0; o < e && a < n; ++o, ++a)u[a] = r[o]; a % e == 0 && j(r) } return i && (u[o] = r[o], t = t.slice(0, s)), t }, t.prototype.buffer = t.prototype.arrayBuffer, t.prototype.digest = t.prototype.array = function () { this.finalize(); for (var t, e, r = this.blockCount, n = this.s, i = this.outputBlocks, o = this.extraBytes, a = 0, s = 0, u = []; s < i;) { for (a = 0; a < r && s < i; ++a, ++s)t = s << 2, e = n[a], u[t] = 255 & e, u[t + 1] = e >> 8 & 255, u[t + 2] = e >> 16 & 255, u[t + 3] = e >> 24 & 255; s % r == 0 && j(n) } return o && (t = s << 2, e = n[a], u[t] = 255 & e, o > 1 && (u[t + 1] = e >> 8 & 255), o > 2 && (u[t + 2] = e >> 16 & 255)), u }, (e.prototype = new t).finalize = function () { return this.encode(this.outputBits, !0), t.prototype.finalize.call(this) }; var j = function (t) { var e, r, n, i, o, a, s, u, f, c, h, d, l, y, b, A, w, v, B, g, _, k, S, C, x, m, E, O, z, N, j, J, M, H, I, R, U, V, F, D, W, Y, K, q, G, L, P, Q, T, X, Z, $, tt, et, rt, nt, it, ot, at, st, ut, ft, ct; for (n = 0; n < 48; n += 2)i = t[0] ^ t[10] ^ t[20] ^ t[30] ^ t[40], o = t[1] ^ t[11] ^ t[21] ^ t[31] ^ t[41], a = t[2] ^ t[12] ^ t[22] ^ t[32] ^ t[42], s = t[3] ^ t[13] ^ t[23] ^ t[33] ^ t[43], u = t[4] ^ t[14] ^ t[24] ^ t[34] ^ t[44], f = t[5] ^ t[15] ^ t[25] ^ t[35] ^ t[45], c = t[6] ^ t[16] ^ t[26] ^ t[36] ^ t[46], h = t[7] ^ t[17] ^ t[27] ^ t[37] ^ t[47], e = (d = t[8] ^ t[18] ^ t[28] ^ t[38] ^ t[48]) ^ (a << 1 | s >>> 31), r = (l = t[9] ^ t[19] ^ t[29] ^ t[39] ^ t[49]) ^ (s << 1 | a >>> 31), t[0] ^= e, t[1] ^= r, t[10] ^= e, t[11] ^= r, t[20] ^= e, t[21] ^= r, t[30] ^= e, t[31] ^= r, t[40] ^= e, t[41] ^= r, e = i ^ (u << 1 | f >>> 31), r = o ^ (f << 1 | u >>> 31), t[2] ^= e, t[3] ^= r, t[12] ^= e, t[13] ^= r, t[22] ^= e, t[23] ^= r, t[32] ^= e, t[33] ^= r, t[42] ^= e, t[43] ^= r, e = a ^ (c << 1 | h >>> 31), r = s ^ (h << 1 | c >>> 31), t[4] ^= e, t[5] ^= r, t[14] ^= e, t[15] ^= r, t[24] ^= e, t[25] ^= r, t[34] ^= e, t[35] ^= r, t[44] ^= e, t[45] ^= r, e = u ^ (d << 1 | l >>> 31), r = f ^ (l << 1 | d >>> 31), t[6] ^= e, t[7] ^= r, t[16] ^= e, t[17] ^= r, t[26] ^= e, t[27] ^= r, t[36] ^= e, t[37] ^= r, t[46] ^= e, t[47] ^= r, e = c ^ (i << 1 | o >>> 31), r = h ^ (o << 1 | i >>> 31), t[8] ^= e, t[9] ^= r, t[18] ^= e, t[19] ^= r, t[28] ^= e, t[29] ^= r, t[38] ^= e, t[39] ^= r, t[48] ^= e, t[49] ^= r, y = t[0], b = t[1], L = t[11] << 4 | t[10] >>> 28, P = t[10] << 4 | t[11] >>> 28, O = t[20] << 3 | t[21] >>> 29, z = t[21] << 3 | t[20] >>> 29, st = t[31] << 9 | t[30] >>> 23, ut = t[30] << 9 | t[31] >>> 23, Y = t[40] << 18 | t[41] >>> 14, K = t[41] << 18 | t[40] >>> 14, H = t[2] << 1 | t[3] >>> 31, I = t[3] << 1 | t[2] >>> 31, A = t[13] << 12 | t[12] >>> 20, w = t[12] << 12 | t[13] >>> 20, Q = t[22] << 10 | t[23] >>> 22, T = t[23] << 10 | t[22] >>> 22, N = t[33] << 13 | t[32] >>> 19, j = t[32] << 13 | t[33] >>> 19, ft = t[42] << 2 | t[43] >>> 30, ct = t[43] << 2 | t[42] >>> 30, et = t[5] << 30 | t[4] >>> 2, rt = t[4] << 30 | t[5] >>> 2, R = t[14] << 6 | t[15] >>> 26, U = t[15] << 6 | t[14] >>> 26, v = t[25] << 11 | t[24] >>> 21, B = t[24] << 11 | t[25] >>> 21, X = t[34] << 15 | t[35] >>> 17, Z = t[35] << 15 | t[34] >>> 17, J = t[45] << 29 | t[44] >>> 3, M = t[44] << 29 | t[45] >>> 3, C = t[6] << 28 | t[7] >>> 4, x = t[7] << 28 | t[6] >>> 4, nt = t[17] << 23 | t[16] >>> 9, it = t[16] << 23 | t[17] >>> 9, V = t[26] << 25 | t[27] >>> 7, F = t[27] << 25 | t[26] >>> 7, g = t[36] << 21 | t[37] >>> 11, _ = t[37] << 21 | t[36] >>> 11, $ = t[47] << 24 | t[46] >>> 8, tt = t[46] << 24 | t[47] >>> 8, q = t[8] << 27 | t[9] >>> 5, G = t[9] << 27 | t[8] >>> 5, m = t[18] << 20 | t[19] >>> 12, E = t[19] << 20 | t[18] >>> 12, ot = t[29] << 7 | t[28] >>> 25, at = t[28] << 7 | t[29] >>> 25, D = t[38] << 8 | t[39] >>> 24, W = t[39] << 8 | t[38] >>> 24, k = t[48] << 14 | t[49] >>> 18, S = t[49] << 14 | t[48] >>> 18, t[0] = y ^ ~A & v, t[1] = b ^ ~w & B, t[10] = C ^ ~m & O, t[11] = x ^ ~E & z, t[20] = H ^ ~R & V, t[21] = I ^ ~U & F, t[30] = q ^ ~L & Q, t[31] = G ^ ~P & T, t[40] = et ^ ~nt & ot, t[41] = rt ^ ~it & at, t[2] = A ^ ~v & g, t[3] = w ^ ~B & _, t[12] = m ^ ~O & N, t[13] = E ^ ~z & j, t[22] = R ^ ~V & D, t[23] = U ^ ~F & W, t[32] = L ^ ~Q & X, t[33] = P ^ ~T & Z, t[42] = nt ^ ~ot & st, t[43] = it ^ ~at & ut, t[4] = v ^ ~g & k, t[5] = B ^ ~_ & S, t[14] = O ^ ~N & J, t[15] = z ^ ~j & M, t[24] = V ^ ~D & Y, t[25] = F ^ ~W & K, t[34] = Q ^ ~X & $, t[35] = T ^ ~Z & tt, t[44] = ot ^ ~st & ft, t[45] = at ^ ~ut & ct, t[6] = g ^ ~k & y, t[7] = _ ^ ~S & b, t[16] = N ^ ~J & C, t[17] = j ^ ~M & x, t[26] = D ^ ~Y & H, t[27] = W ^ ~K & I, t[36] = X ^ ~$ & q, t[37] = Z ^ ~tt & G, t[46] = st ^ ~ft & et, t[47] = ut ^ ~ct & rt, t[8] = k ^ ~y & A, t[9] = S ^ ~b & w, t[18] = J ^ ~C & m, t[19] = M ^ ~x & E, t[28] = Y ^ ~H & R, t[29] = K ^ ~I & U, t[38] = $ ^ ~q & L, t[39] = tt ^ ~G & P, t[48] = ft ^ ~et & nt, t[49] = ct ^ ~rt & it, t[0] ^= p[n], t[1] ^= p[n + 1] }; if (a) module.exports = S; else { for (x = 0; x < C.length; ++x)i[C[x]] = S[C[x]]; s && define(function () { return S }) } },
        functionStorage: []
    };
    await Voxlink.init();
})();