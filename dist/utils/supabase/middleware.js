"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = void 0;
var ssr_1 = require("@supabase/ssr");
var server_1 = require("next/server");
var createClient = function (request) {
    // Create an unmodified response
    var response = server_1.NextResponse.next({
        request: {
            headers: request.headers,
        },
    });
    // Prüfen, ob die Umgebungsvariablen gesetzt sind
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase-Umgebungsvariablen sind nicht definiert');
    }
    var supabase = (0, ssr_1.createServerClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            get: function (name) {
                var _a;
                return (_a = request.cookies.get(name)) === null || _a === void 0 ? void 0 : _a.value;
            },
            set: function (name, value, options) {
                // Setze die Cookies direkt auf die Response
                response.cookies.set(__assign({ name: name, value: value }, options));
            },
            remove: function (name, options) {
                // Entferne die Cookies, indem expires auf einen vergangenen Zeitpunkt gesetzt wird
                response.cookies.set(__assign({ name: name, value: '', expires: new Date(0) }, options));
            },
        },
    });
    return { supabase: supabase, response: response };
};
exports.createClient = createClient;
